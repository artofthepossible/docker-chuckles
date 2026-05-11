# Selenium + Testcontainers integration tests — build summary

Brief writeup of how the integration suite for the **Container Joke App** was
created and stabilized inside a Docker sandbox.

## Goal

Validate the end-to-end stack (Postgres → Express API → React UI) using
black-box browser automation, without any manual `docker compose up`. Tests
should be reproducible on any host with a Docker daemon.

## Stack

[Testcontainers for Node.js](https://node.testcontainers.org/) orchestrates
the dependencies; [Selenium WebDriver](https://www.selenium.dev/) drives the
browser remotely via the
[Selenium Testcontainers module](https://testcontainers.com/modules/selenium/).

```
┌────────────────────────── ephemeral docker network ──────────────────────────┐
│                                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┐   ┌─────────────────┐  │
│  │ postgres:15  │   │ redis:alpine │   │  app       │   │ selenium chrome │  │
│  │  alias:      │◄──┤  alias:      │◄──┤ (built     │◄──┤ standalone      │  │
│  │  postgres    │   │  redis       │   │  from      │   │                 │  │
│  └──────────────┘   └──────────────┘   │  Dockerfile│   └─────────────────┘  │
│                                        └────────────┘                        │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲                                       ▲                ▲
        │ mapped 5432                           │ mapped 3001    │ mapped 4444/7900
        │                                       │                │
        └────────────────────── test host (jest) ────────────────┘
```

Selenium's Chromium reaches the app over the shared network; Jest reaches
both the app and WebDriver via Testcontainers-mapped ports.

## Files added

| Path                                              | Purpose                                       |
| ------------------------------------------------- | --------------------------------------------- |
| `tests/integration/jokeApp.selenium.test.cjs`     | Five black-box tests covering API + UI flows. |
| `tests/integration/jest.config.cjs`               | Standalone Jest config, serial, long timeout. |
| `tests/integration/README.md`                     | What gets spun up + how to run.               |
| `tests/integration/VIEWING_RESULTS.md`            | How to monitor a run (jest, docker, noVNC).   |
| `package.json`                                    | Added `test:integration` script + deps.       |

New devDependencies: `testcontainers`, `selenium-webdriver`, `jest`.

## What the suite asserts

1. `/health` returns `200 { status: "healthy" }` once Postgres and Redis are wired up.
2. `GET /api/jokes/random` returns a joke object with `id`, `setup`, `punchline`.
3. The UI renders the joke (setup + punchline) and the `Next Joke` button.
4. Clicking `Next Joke` triggers a new fetch and updates the DOM.
5. The `times_displayed` counter advances when the same joke is served twice.

## Issues encountered and fixes

### 1. `WebDriverError: net::ERR_SSL_PROTOCOL_ERROR` on `driver.get('http://app:3001/')`

Chrome 147 keeps upgrading short hostnames to `https://` via HTTPS-First /
HSTS heuristics — features that aren't reliably gated behind the
`HttpsUpgrades` runtime flag. Adding `--disable-features=HttpsUpgrades,
HttpsFirstBalancedMode,HttpsFirstModeIncognito,HttpsOnlyMode` plus
`--allow-insecure-localhost` and `--ignore-certificate-errors` was not
sufficient — Chrome still attempted TLS and failed.

**Fix:** navigate to the app container's IP on the test network rather than
its alias. IPs are not HSTS-eligible, so the upgrade heuristics never fire.

```js
appInternalUrl = `http://${app.getIpAddress(network.getName())}:${APP_PORT}`;
```

The Chrome flags stayed in place as defence in depth.

### 2. `times_displayed` assertion failing with `0 > 0`

Loop bug. The original implementation seeded the loop variable with the
initial response and used a `for` condition that was false on entry, so the
re-fetch never happened.

```js
// before — never re-fetches
let after = before;
for (let i = 0; i < 50 && after.body.id !== targetId; i += 1) { … }

// after — guarantees at least one re-fetch
let after, attempts = 0;
do {
  after = await fetchJson(`${appHostUrl}/api/jokes/random`);
  attempts += 1;
} while (after.body.id !== targetId && attempts < 50);
```

The server `SELECT`s, `UPDATE`s, then returns the originally-selected row, so
the response reflects the pre-increment value — re-fetching the same id is
required to observe the bump.

### 3. Hostname / network plumbing

The app's `server.js` hardcodes `host: 'redis'` and reads `POSTGRES_HOST` from
env. To match those expectations:

- Both data services were started with `withNetworkAliases('redis')` and
  `withNetworkAliases('postgres')`.
- The app container was started with `POSTGRES_HOST=postgres` and joined to
  the same network.

## Running

```bash
npm install
npm run test:integration
```

First run is slow (image pulls + `Dockerfile` build); subsequent runs reuse
the layer cache. Expected runtime on a warm cache: ~40–90 seconds.

## Sandbox notes

The work was authored inside a Docker-based development sandbox; the test
suite itself only depends on a working Docker daemon being reachable from
wherever Jest is invoked. There is no sandbox-specific code in the tests.

GitHub authentication for `git push` is handled by the sandbox proxy when a
GitHub token has been registered as a sandbox secret on the host
(`sbx secret set <sandbox-name> github -t "$(gh auth token)"`).
