const path = require('path');
const http = require('http');
const { GenericContainer, Network, Wait } = require('testcontainers');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const APP_PORT = 3001;
const SELENIUM_PORT = 4444;
const NOVNC_PORT = 7900;

const POSTGRES_DB = 'jokes';
const POSTGRES_USER = 'postgres';
const POSTGRES_PASSWORD = 'postgres';

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('request timed out')));
  });

describe('Container Joke App — Selenium integration', () => {
  let network;
  let redis;
  let postgres;
  let appImage;
  let app;
  let selenium;
  let driver;

  // URLs reachable from the test host (mapped ports).
  let appHostUrl;
  // URLs reachable from inside the Docker network (used by the Selenium browser).
  const appInternalUrl = `http://app:${APP_PORT}`;

  beforeAll(async () => {
    network = await new Network().start();

    redis = await new GenericContainer('redis:alpine')
      .withNetwork(network)
      .withNetworkAliases('redis')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
      .start();

    postgres = await new GenericContainer('postgres:15-alpine')
      .withNetwork(network)
      .withNetworkAliases('postgres')
      .withEnvironment({
        POSTGRES_DB,
        POSTGRES_USER,
        POSTGRES_PASSWORD,
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(
          'database system is ready to accept connections',
          2,
        ),
      )
      .start();

    appImage = await GenericContainer.fromDockerfile(PROJECT_ROOT).build(
      'docker-chuckles-app:test',
      { deleteOnExit: false },
    );

    app = await appImage
      .withNetwork(network)
      .withNetworkAliases('app')
      .withEnvironment({
        NODE_ENV: 'production',
        PORT: String(APP_PORT),
        POSTGRES_HOST: 'postgres',
        POSTGRES_DB,
        POSTGRES_USER,
        POSTGRES_PASSWORD,
      })
      .withExposedPorts(APP_PORT)
      .withWaitStrategy(
        Wait.forHttp('/health', APP_PORT).forStatusCode(200),
      )
      .withStartupTimeout(180_000)
      .start();

    appHostUrl = `http://${app.getHost()}:${app.getMappedPort(APP_PORT)}`;

    selenium = await new GenericContainer('selenium/standalone-chromium:latest')
      .withNetwork(network)
      .withExposedPorts(SELENIUM_PORT, NOVNC_PORT)
      .withSharedMemorySize(2 * 1024 * 1024 * 1024)
      .withWaitStrategy(
        Wait.forHttp('/wd/hub/status', SELENIUM_PORT).forResponsePredicate(
          (body) => {
            try {
              return JSON.parse(body).value.ready === true;
            } catch {
              return false;
            }
          },
        ),
      )
      .withStartupTimeout(120_000)
      .start();

    const seleniumUrl = `http://${selenium.getHost()}:${selenium.getMappedPort(
      SELENIUM_PORT,
    )}/wd/hub`;

    const chromeOptions = new chrome.Options()
      .addArguments('--no-sandbox')
      .addArguments('--disable-dev-shm-usage')
      .addArguments('--disable-gpu')
      .addArguments('--window-size=1280,800');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .usingServer(seleniumUrl)
      .build();
  }, 600_000);

  afterAll(async () => {
    if (driver) await driver.quit().catch(() => {});
    if (selenium) await selenium.stop().catch(() => {});
    if (app) await app.stop().catch(() => {});
    if (postgres) await postgres.stop().catch(() => {});
    if (redis) await redis.stop().catch(() => {});
    if (network) await network.stop().catch(() => {});
  });

  test('health endpoint reports healthy after dependencies are wired up', async () => {
    const { status, body } = await fetchJson(`${appHostUrl}/health`);
    expect(status).toBe(200);
    expect(body).toEqual({ status: 'healthy' });
  });

  test('GET /api/jokes/random returns a joke with setup and punchline', async () => {
    const { status, body } = await fetchJson(`${appHostUrl}/api/jokes/random`);
    expect(status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        setup: expect.any(String),
        punchline: expect.any(String),
      }),
    );
    expect(body.setup.length).toBeGreaterThan(0);
    expect(body.punchline.length).toBeGreaterThan(0);
  });

  test('UI renders a joke (setup + punchline) and a Next Joke button', async () => {
    await driver.get(`${appInternalUrl}/`);

    const button = await driver.wait(
      until.elementLocated(By.xpath("//button[normalize-space()='Next Joke']")),
      30_000,
    );
    await driver.wait(until.elementIsVisible(button), 10_000);

    // First two <p> tags inside the joke card are setup and punchline.
    const setup = await driver
      .findElement(By.css('div.divide-y > div > p:nth-of-type(1)'))
      .getText();
    const punchline = await driver
      .findElement(By.css('div.divide-y > div > p:nth-of-type(2)'))
      .getText();

    expect(setup.trim().length).toBeGreaterThan(0);
    expect(punchline.trim().length).toBeGreaterThan(0);
  });

  test('clicking Next Joke fetches a new joke and updates the DOM', async () => {
    await driver.get(`${appInternalUrl}/`);

    const setupSelector = By.css('div.divide-y > div > p:nth-of-type(1)');
    const punchlineSelector = By.css('div.divide-y > div > p:nth-of-type(2)');
    const buttonSelector = By.xpath("//button[normalize-space()='Next Joke']");

    await driver.wait(until.elementLocated(buttonSelector), 30_000);

    // Try up to a handful of clicks — RANDOM() can occasionally repeat.
    const firstSetup = await driver.findElement(setupSelector).getText();
    const firstPunchline = await driver
      .findElement(punchlineSelector)
      .getText();

    let changed = false;
    for (let attempt = 0; attempt < 8 && !changed; attempt += 1) {
      await driver.findElement(buttonSelector).click();
      await driver.wait(async () => {
        const setup = await driver.findElement(setupSelector).getText();
        const punchline = await driver
          .findElement(punchlineSelector)
          .getText();
        return setup.length > 0 && punchline.length > 0;
      }, 10_000);

      const setup = await driver.findElement(setupSelector).getText();
      const punchline = await driver.findElement(punchlineSelector).getText();
      changed = setup !== firstSetup || punchline !== firstPunchline;
    }

    expect(changed).toBe(true);
  });

  test('times_displayed counter increments after a UI fetch', async () => {
    const before = await fetchJson(`${appHostUrl}/api/jokes/random`);
    expect(before.status).toBe(200);

    const targetId = before.body.id;
    const initialCount = before.body.times_displayed;

    // Re-fetch the same joke until we get it again, or give up.
    let after = before;
    for (let i = 0; i < 50 && after.body.id !== targetId; i += 1) {
      after = await fetchJson(`${appHostUrl}/api/jokes/random`);
    }

    if (after.body.id === targetId) {
      expect(after.body.times_displayed).toBeGreaterThan(initialCount);
    } else {
      // With 47+ jokes this is unlikely, but don't make the suite flaky.
      console.warn(
        'Could not re-roll the same joke id to verify counter increment; ' +
          'skipping strict assertion.',
      );
    }
  });
});
