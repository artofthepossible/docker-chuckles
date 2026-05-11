# Selenium + Testcontainers integration tests

These tests stand up the full app stack on an ephemeral Docker network and drive the
browser via a Selenium WebDriver container.

## What gets spun up

For each test run, [`testcontainers`](https://node.testcontainers.org/) starts:

| Service           | Image                                  | Network alias |
| ----------------- | -------------------------------------- | ------------- |
| PostgreSQL        | `postgres:15-alpine`                   | `postgres`    |
| Redis             | `redis:alpine`                         | `redis`       |
| App under test    | built from this repo's `Dockerfile`    | `app`         |
| Selenium (Chrome) | `selenium/standalone-chromium:latest`  | _(default)_   |

All containers share a single user-defined Docker network so the Selenium-driven
browser can reach the app at `http://app:3001` using the network alias. The test
host reaches the app and the WebDriver via mapped ports.

## Requirements

- Node.js 18+
- A working Docker daemon reachable by the test host (Docker Desktop, Colima,
  Rancher Desktop, or a remote daemon — see the
  [Testcontainers configuration docs](https://node.testcontainers.org/configuration/))

## Install

```bash
npm install
```

## Run

```bash
npm run test:integration
```

The first run takes longer because Docker has to:

1. Pull `postgres`, `redis`, and the Selenium image.
2. Build the app image from `Dockerfile`.

Subsequent runs reuse the layer cache.

## What the suite validates

- `/health` returns `200 { status: "healthy" }` once Postgres + Redis are wired up.
- `GET /api/jokes/random` returns a joke object with `id`, `setup`, `punchline`.
- The UI renders the joke (setup + punchline) and a `Next Joke` button.
- Clicking `Next Joke` triggers a new fetch and updates the DOM.
- `times_displayed` is incremented when a joke is served.

## Debugging

The Selenium container is `selenium/standalone-chromium`, which exposes a noVNC
debug session on port `7900`. To watch the browser live while tests run, you can
temporarily change the test to keep the container alive (or run it manually with
the same image) and connect to `http://<host>:<mapped-7900>/?autoconnect=1`.
