# Browser tests

Playwright checks login settings, uploaded CSV/JSON data, connected backend widgets and apps, dashboard operations, and compiled plugins against the local application. Each scenario creates its own data. Plugin tests use the standalone example and controlled data, agent, and MCP responses without subscriptions or paid model calls. Set `PLAYWRIGHT_HOSTED_TESTS=true` to include onboarding questions and PDF export against a deployment with those features enabled.

## Run from source

Use Python 3.13, uv, Bun, Node supported by `frontend/package.json`, and a running Docker daemon. Create and activate the backend environment using [backend prerequisites](../../../backend/DEVELOPMENT_SETUP.md#prerequisites), and install dependencies using [frontend installation](../../README.md#installation). Then, from the repository root:

```bash
cd packages/plugin-sdk
bun install --frozen-lockfile --production
cd ../../frontend
bun run playwright install chromium
bun run test:e2e
```

On Linux, install Chromium's system dependencies with `bun run playwright install --with-deps chromium`.

Playwright starts the frontend at `http://127.0.0.1:1420`, the API at `http://127.0.0.1:8000`, and Redis in Docker. Temporary SQLite data is stored under `backend/.e2e/`. Reused servers must match the test settings in [playwright.config.ts](../../playwright.config.ts).

The test account is `playwright@example.com` / `WorkspaceTest123!`. CLI credentials are stored in `playwright/.cache/admin.json`, and browser authentication in `playwright/.auth/user.json`.

```bash
bun run playwright test tests/e2e/auth.spec.ts
bun run playwright test tests/e2e/data-conectors.spec.ts
bun run playwright test tests/e2e/backend-declarations.spec.ts
bun run playwright test tests/e2e/plugins.spec.ts
bun run playwright test tests/e2e --ui
```

Set `PLAYWRIGHT_FRONTEND_BUILD=true` to test a production build. Bundled plugin selection changes require the source server or another build.

Run the same scenarios with runtime loading:

```sh
PLAYWRIGHT_PLUGIN_MODE=runtime bun run playwright test tests/e2e/plugins.spec.ts
PLAYWRIGHT_PLUGIN_MODE=runtime PLAYWRIGHT_FRONTEND_BUILD=true bun run playwright test tests/e2e/plugins.spec.ts
```

`PLAYWRIGHT_API_URL` selects the local API URL, including its listening port. `PLAYWRIGHT_REDIS_PORT` selects Redis's host port (default `16379`). `PLAYWRIGHT_EMAIL` and `PLAYWRIGHT_PASSWORD` select the test account. Source login settings disable registration, forgotten-password links, and identity providers.

## Run against a deployment

Provision a test account through the admin CLI. Set the application URL and credentials:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
PLAYWRIGHT_EMAIL=playwright@example.com \
PLAYWRIGHT_PASSWORD=WorkspaceTest123! \
bun run test:e2e
```

For application installation, use the [quickstart](../../../docs/quickstart.md) or [deployment guide](../../../docs/deployment.md). Image integration checks are covered in [development](../../../docs/development.md#test-images).

Setting `PLAYWRIGHT_BASE_URL` uses the supplied deployment and account; Playwright does not start source servers or provision accounts. For deployments with registration, password recovery, or Google login, set `PLAYWRIGHT_ALLOW_REGISTRATION=true`, `PLAYWRIGHT_ALLOW_FORGOT_PASSWORD=true`, or `PLAYWRIGHT_IDENTITY_PROVIDERS=google` to match the deployed login settings. The configuration test checks the matching controls.

Set `PLAYWRIGHT_PLUGIN_TESTS=true` to run plugin scenarios against a deployment with the basic widget example installed and external agents enabled. Selection changes run against the source server; deployment checks use the selected compiled plugin.

## Results and CI

Failure traces and screenshots are stored in `test-results/`; the HTML report is in `playwright-report/`. Run `bun run playwright show-report` to inspect it. CI uploads the report as an artifact; see the [browser-test workflow](../../../.github/workflows/frontend-browser-tests.yml) for triggers and settings.
