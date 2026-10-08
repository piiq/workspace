# Browser tests

Playwright checks login settings, uploaded CSV/JSON data, and dashboard operations against the local application. Each scenario creates its own data. Set `PLAYWRIGHT_HOSTED_TESTS=true` to include provider and subscription tests against a deployment with the required data and features.

## Run from source

Use Python 3.13 with an activated virtual environment, Poetry, Bun, Node supported by `frontend/package.json`, and a running Docker daemon. From the repository root:

```bash
cd backend
poetry install --with dev
cd ../frontend
bun install --frozen-lockfile
bun run playwright install chromium
bun run test:e2e
```

On Linux, install Chromium's system dependencies with `bun run playwright install --with-deps chromium`.

Playwright starts or reuses the frontend at `http://127.0.0.1:1420` and API at `http://127.0.0.1:8000`. The source backend runner starts Redis through `docker/docker-compose.e2e.yml`, applies migrations to SQLite, provisions the `Browser Tests` organization, and runs the API and worker. Database and uploaded files are stored in a temporary directory under ignored `backend/.e2e/`; stopping the runner removes the directory and its Redis container. Existing source servers must use the same organization and account configuration.

The account setup uses `admin_cli/openbb-admin` to create `playwright@example.com` with password `WorkspaceTest123!`, then signs in through the UI. CLI credentials stay in ignored `frontend/playwright/.cache/admin.json`; browser authentication stays in `frontend/playwright/.auth/user.json`. These credentials are for the local test environment.

```bash
bun run test:e2e auth.spec.ts
bun run test:e2e data-conectors.spec.ts
bun run playwright test tests/e2e --ui
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

Setting `PLAYWRIGHT_BASE_URL` uses the supplied deployment and account; Playwright does not start source servers or provision accounts. For deployments exposing registration, password recovery, or Google login, set `PLAYWRIGHT_ALLOW_REGISTRATION=true`, `PLAYWRIGHT_ALLOW_FORGOT_PASSWORD=true`, or `PLAYWRIGHT_IDENTITY_PROVIDERS=google` to match the deployed login settings. The configuration test checks the matching controls.

## Results and CI

Tests run headlessly in Chromium with one worker and no retries. Failure traces and screenshots are stored in `test-results/`; the HTML report is in `playwright-report/`. Use `bun run playwright show-report` to inspect it.

The `Frontend Local Browser Tests` workflow runs these tests manually and uploads the HTML report. Pull requests run frontend typechecking and unit tests for relevant frontend changes, and backend tests for relevant backend changes.
