# Browser tests

Playwright checks login settings, uploaded CSV/JSON data, dashboard operations, and compiled plugins against the local application. Each scenario creates its own data. Plugin tests use the standalone example and controlled data, agent, and MCP responses without subscriptions or paid model calls. Set `PLAYWRIGHT_HOSTED_TESTS=true` to include provider and subscription tests against a deployment with the required data and features.

## Run from source

Use Python 3.13 with an activated virtual environment, Poetry, Bun, Node supported by `frontend/package.json`, and a running Docker daemon. From the repository root:

```bash
cd backend
poetry install --with dev
cd ../frontend
bun install --frozen-lockfile
cd ../packages/plugin-sdk
bun install --frozen-lockfile --production
cd ../../frontend
bun run playwright install chromium
bun run test:e2e
```

On Linux, install Chromium's system dependencies with `bun run playwright install --with-deps chromium`.

Playwright starts or reuses the frontend at `http://127.0.0.1:1420` and API at `http://127.0.0.1:8000`. The source backend runner starts Redis through `docker/docker-compose.e2e.yml`, applies migrations to SQLite, provisions the `Browser Tests` organization, and runs the API and worker. Database and uploaded files are stored in a temporary directory under ignored `backend/.e2e/`; stopping the runner removes the directory and its Redis container. Existing source servers must use the same organization and account configuration.

The frontend server command prepares `fixtures/plugins.json`, which installs, typechecks, and builds the example using its own dependencies. Source configuration enables external agents and disables the hosted OpenBB Copilot and AI file enhancements. Reused frontend servers need the same prepared selection and configuration.

The account setup uses `admin_cli/openbb-admin` to create `playwright@example.com` with password `WorkspaceTest123!`, then signs in through the UI. CLI credentials stay in ignored `frontend/playwright/.cache/admin.json`; browser authentication stays in `frontend/playwright/.auth/user.json`. These credentials are for the local test environment.

```bash
bun run test:e2e auth.spec.ts
bun run test:e2e data-conectors.spec.ts
bun run test:e2e plugins.spec.ts
bun run playwright test tests/e2e --ui
```

Set `PLAYWRIGHT_FRONTEND_BUILD=true` to build the frontend once and run against Vite's production preview instead of the source server. The plugin scenarios check parameters, saved selection, stylesheet URLs, agent data export, and MCP-triggered refresh through compiled output. The omission/restoration scenario runs against the source server, changing preparation and reopening the saved dashboard with a usable core widget beside it; changing a production selection requires another build.

`PLAYWRIGHT_API_URL` selects the local API URL, including its listening port. `PLAYWRIGHT_REDIS_PORT` selects Redis's host port (default `16379`). `PLAYWRIGHT_EMAIL` and `PLAYWRIGHT_PASSWORD` select the test account. Source login settings disable registration, forgotten-password links, and identity providers.

## Run against a deployment

Provision a test account through the admin CLI. Set the application URL and credentials:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
PLAYWRIGHT_EMAIL=playwright@example.com \
PLAYWRIGHT_PASSWORD=WorkspaceTest123! \
bun run test:e2e
```

Setting `PLAYWRIGHT_BASE_URL` uses the supplied deployment and account; Playwright does not start source servers or provision accounts. For deployments exposing registration, password recovery, or Google login, set `PLAYWRIGHT_ALLOW_REGISTRATION=true`, `PLAYWRIGHT_ALLOW_FORGOT_PASSWORD=true`, or `PLAYWRIGHT_IDENTITY_PROVIDERS=google` to match the deployed login settings. The configuration test checks the matching controls.

Set `PLAYWRIGHT_PLUGIN_TESTS=true` to run plugin scenarios against a deployment with the basic widget example installed and external agents enabled. Selection changes run against the source server; deployment checks use the selected compiled plugin.

## Results and CI

Tests run headlessly in Chromium with one worker and no retries. Dashboard persistence checks wait up to 30 seconds for the Workspace sidebar after reloading or reopening, then assert the saved content. Failure traces and screenshots are stored in `test-results/`; the HTML report is in `playwright-report/`. Use `bun run playwright show-report` to inspect it.

The `Frontend Local Browser Tests` workflow runs these tests manually and on pull requests affecting the browser tests or their configuration, plugin SDK, registry, widget dispatch, or shared table integration, and uploads the HTML report. Pull requests run frontend typechecking and unit tests for relevant frontend and SDK changes, and backend tests for relevant backend changes.
