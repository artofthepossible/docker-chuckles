# Viewing integration test results

After kicking off `npm run test:integration`, Jest first prints:

```
 RUNS  tests/integration/jokeApp.selenium.test.cjs
```

…and stays put for a while. Nothing is broken — `beforeAll` is pulling images
and building the app container, which takes a couple of minutes on a cold run.
Here are the different ways to see what's happening.

## 1. The Jest output (same terminal)

The suite is configured with `verbose: true` and `maxWorkers: 1`, so as each
test finishes it prints a `✓` / `✗` plus the test name. The summary at the
bottom shows totals and any failure stacks.

```
Container Joke App — Selenium integration
  ✓ health endpoint reports healthy after dependencies are wired up
  ✓ GET /api/jokes/random returns a joke with setup and punchline
  ✓ UI renders a joke (setup + punchline) and a Next Joke button
  ✓ clicking Next Joke fetches a new joke and updates the DOM
  ✓ times_displayed counter increments after a UI fetch

Tests:       5 passed, 5 total
```

## 2. Watch the containers (another terminal)

Open a second terminal while the run is in flight:

```bash
docker ps                                # see all 4 containers spun up by testcontainers
docker logs -f <app-container-id>        # tail Express logs, DB seeding, /health hits
docker logs -f <selenium-container-id>   # WebDriver session activity
```

You can identify each container by its image:

```bash
docker ps --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}'
```

## 3. Watch the browser live (noVNC)

The Selenium image exposes a noVNC viewer on container port `7900`. Find the
host-mapped port:

```bash
docker ps --filter "ancestor=selenium/standalone-chromium:latest" --format "{{.Ports}}"
```

Look for the entry like `0.0.0.0:XXXXX->7900/tcp`, then in your browser open:

```
http://localhost:<that-port>/?autoconnect=1&resize=scale
```

Password: `secret`. You'll see the Chromium instance being driven by the test
in real time — useful for watching the joke page render and the `Next Joke`
button click.

## 4. Machine-readable output for CI

```bash
npx jest \
  --config tests/integration/jest.config.cjs \
  --json --outputFile=integration-results.json
```

This produces a structured JSON report you can feed into a CI system. Combine
with `--ci` to fail on snapshot drift, or add `jest-junit` as a reporter for
JUnit XML.

## 5. Re-running a single test

While iterating on a flake or a fix:

```bash
npx jest \
  --config tests/integration/jest.config.cjs \
  -t "UI renders a joke"
```

The `-t` flag filters by test name (substring match against the `test(...)`
descriptions).

## 6. Common stalls and what they mean

| Symptom                                            | What's happening                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `RUNS …` for 1–3 minutes on first run              | Docker is pulling `postgres`, `redis`, `selenium/standalone-chromium`. |
| `RUNS …` then a `node:…-builder` container appears | `GenericContainer.fromDockerfile` is building the app image.        |
| App container restarting in `docker ps`            | Likely a Postgres or Redis startup race; check `docker logs` on it. |
| `WebDriverError: ERR_SSL_PROTOCOL_ERROR`           | Chrome's HTTPS-First feature upgraded `http://` to `https://`. The suite disables this via chrome flags — if you forked Chrome options, restore `--disable-features=HttpsUpgrades,HttpsFirstBalancedMode,…`. |

## 7. Cleaning up after a crashed run

Testcontainers' Ryuk container removes leftover test containers automatically,
but if a run was killed hard you can sweep manually:

```bash
docker ps -a --filter "label=org.testcontainers=true" -q | xargs -r docker rm -f
docker network ls --filter "label=org.testcontainers=true" -q | xargs -r docker network rm
```
