# Workspace containers

Run commands from the repository root. Both images use `docker/Dockerfile` and the repository root as the build context.

## Build

```sh
docker buildx build --load -f docker/Dockerfile --target frontend -t workspace-frontend:dev .
docker buildx build --load -f docker/Dockerfile --target backend -t workspace-backend:dev .
```

The frontend serves a runtime build through nginx. Prepare build-time plugins with [the plugin preparation command](../docs/plugins.md#including-plugins-in-a-frontend-build) before building; compiled output under `.build/plugins/` is included without copying plugin repositories into the image. A checkout without prepared output builds with no optional plugins.

The backend includes the API, RQ worker, migrations, provisioning scripts, and `openbb-admin`. Its commands are:

| Command | Behavior |
| --- | --- |
| `api` | Apply migrations and run the Gunicorn API using `PORT` and `WORKERS`. |
| `worker` | Run the RQ worker with its scheduler. |
| `migrate [arguments]` | Run Alembic; no arguments means `upgrade head`. |
| `bootstrap [arguments]` | Apply migrations, then run `scripts.init_users` with the supplied arguments. |
| `openbb-admin [arguments]` | Run the admin CLI. |

`api` is the image's default command. Migration and bootstrap failures exit with an error. The worker uses the same image and backend settings as the API. Compose supplies an init process to forward signals and reap worker children. `workspace-backend --help` lists the commands.

## Separate deployment

Copy the environment example and edit it:

```sh
cp docker/.env.example docker/.env
```

Set `WORKSPACE_CONFIG_DIR` to an absolute directory containing your provisioning TOML files. Use the [provisioning format](../backend/scripts/cfgs/config.toml) and set your administrator credentials. The provisioning directory is mounted read-only and is excluded from the image build. With a single TOML file, that organization supplies registration defaults. For multiple organizations, override the bootstrap service's command with `["bootstrap", "--config-dir", "/config", "--default-entity", "My Organization"]` to choose the registration default.

Set the database password consistently in `READ_DB_PASSWORD` and `WRITE_DB_PASSWORD`. Generate secrets with Python from your activated virtual environment:

```sh
python -c 'import secrets; print(secrets.token_urlsafe(48))'
python -c 'import secrets; print(secrets.token_hex(16))'
```

Use separate random values for `JWT_SECRET` and `LOCAL_STORAGE_SECRET_KEY`; use the 32-character hex value for `OPENBB_AES_KEY`. Keep these values across container recreation. When `OPENBB_AUTH_TOKEN` is absent, the backend entrypoint derives it from `JWT_SECRET`; a supplied token is preserved.

Set `SELFURL` to the browser-facing API URL, including `/api`, and `FRONTENDURL`, `PROURL`, and `BACKEND_CORS_ORIGINS` to your Workspace origin. Set `WORKSPACE_PORT` to the published frontend port. Then start the deployment:

```sh
docker compose --env-file docker/.env -f docker/docker-compose.yml up --build -d --wait
```

Compose starts MySQL and Redis, applies migrations and provisions accounts, then starts the worker, API, and frontend. Bootstrap failure prevents application startup. MySQL, Redis, uploaded files, and `user_create.json` use named volumes; `down` keeps these volumes, while `down -v` deletes them.

The backend reads `docker/.env`. Set `BACKEND_ENV_FILE` to an absolute backend environment file to use a separate file; `--env-file` still supplies Compose settings such as the database password, provisioning path, and published port. Change `DATABASE_TYPE`, database connection fields, and storage settings in the backend environment file to use external services. The MySQL and Redis services in this example are deployment-local services. The [backend settings template](../backend/envs/.env.example) lists database TLS and Redis settings. For object storage, set `STORAGE_PROVIDER=aws` and the existing `S3_*` settings, including `S3_FILE_BUCKET`, `S3_REGION`, and `S3_ENDPOINT_URL` when using an S3-compatible server. Mount database certificates through a Compose override when using certificate paths.

The shared `/data` volume holds the bootstrap file and folder storage. API and worker containers must use the same storage and secrets. For horizontally scaled hosts, use shared storage or object storage and make the generated bootstrap file available to every backend container.

To manage accounts through the installed CLI:

```sh
docker compose --env-file docker/.env -f docker/docker-compose.yml exec backend openbb-admin auth login --api-url http://127.0.0.1:8000
```

Subsequent CLI commands use the same `exec backend openbb-admin` prefix. The CLI stores its authentication in the container user's home directory; sign in again after container recreation.

## Frontend runtime settings

The frontend writes `/config.js` at startup using [scripts/render-frontend-config.sh](../scripts/render-frontend-config.sh). `BACKEND_URL` defaults to `/api`; nginx forwards that prefix to `BACKEND_UPSTREAM`, which defaults to `backend:8000`. The browser-facing backend URL and nginx upstream are separate settings. The proxy preserves WebSocket upgrades and streams responses without buffering. It preserves supplied `Origin` headers and fills missing ones from the Workspace origin for same-origin GET requests. When TLS terminates at an upstream proxy, that proxy must supply `X-Forwarded-Proto`.

Set frontend environment variables in a Compose override to configure authentication, UI, AI, or branding. The example exposes plugin settings through `RUNTIME_PLUGINS_ENABLED` and `PLUGINS_MANIFEST_URL`. See [runtime plugin installation](../docs/plugins.md#installing-plugins-at-runtime). Recreate the frontend container to apply environment changes; the application image is reused.

## Development and verification

The `docker-compose-local-dev*.yml` examples build the same backend target and mount `backend/` for source editing. See [backend development setup](../backend/DEVELOPMENT_SETUP.md) for provisioning and reload commands.

Use the existing browser scenarios against the deployment with a test account created through `openbb-admin`:

```sh
cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
PLAYWRIGHT_API_URL=http://localhost:8080/api \
PLAYWRIGHT_EMAIL=playwright@example.com \
PLAYWRIGHT_PASSWORD='WorkspaceTest123!' \
bun run playwright test tests/e2e/auth.spec.ts tests/e2e/data-conectors.spec.ts tests/e2e/dashboards.spec.ts
```

These scenarios check login settings, uploads, exports, and saved dashboards. The [browser test guide](../frontend/tests/e2e/README.md#run-against-a-deployment) describes account setup and deployment options. Worker startup and completed jobs appear in `docker compose logs worker`.
