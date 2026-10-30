# Development Setup

This guide walks through setting up the OpenBB Workspace backend for local development.

For interactive UI development on macOS, run the backend inside Docker via
`docker/docker-compose-local-dev.yml`. The API and RQ worker both run from Linux
containers with the local `backend/` folder bind-mounted, so normal code changes
do not require rebuilding the images.

For automated browser tests, follow the [browser test setup](../frontend/tests/e2e/README.md). It runs the API and worker from source with SQLite and file storage, and starts Redis in Docker.

## Prerequisites

- Docker and Docker Compose
- Python 3.13 and uv for running tests or scripts on the host

For source commands, create and activate the backend environment from the repository root:

```sh
cd backend
uv sync --locked
source .venv/bin/activate
cd ..
```

`backend/uv.lock` pins runtime and development dependencies. `uv sync --locked --no-dev` installs runtime dependencies without development tools. Use `uv add` and `uv remove` in `backend/` to change dependencies. Python and pytest run directly from the activated environment.

## Environment

The `.env` file at `backend/envs/.env` is the single source of configuration.
For local Docker development the important host-facing values are:

```ini
MODE=onprem
DISABLE_CORS=1
```

`docker/docker-compose-local-dev.yml` overrides `DB_HOST` and `REDIS_HOST` inside the
API and RQ worker containers to use Docker networking (`mysql`, `redis`), so the
same `.env` file works for both host tooling and containers.

The SQLite compose files (`docker/docker-compose-local-dev-sqlite.yml`,
`docker/docker-compose-lite.yml`) read `backend/envs/.env.sqlite`, which is not
tracked. Create it once from the template:

```sh
cp backend/envs/.env.sqlite.example backend/envs/.env.sqlite
```

The backend image includes provisioning scripts and `openbb-admin`. Run provisioning inside the API container so it uses the same database and bootstrap-file path as the API and worker.

## Setup Steps

All commands run from the repository root unless noted otherwise.

### 1. Start the local stack

```bash
docker compose -f docker/docker-compose-local-dev.yml up --build --watch
```

This starts MySQL (port 3306), Redis (port 6379), the FastAPI backend on
`http://localhost:8000`, and the RQ worker. The API container runs migrations on
startup and starts Uvicorn with `--reload`, so backend edits are picked up
automatically. The worker container uses Compose watch to restart on backend
code changes.

### 2. Initialize admin users and entities

Use `user_create.json` generated for the same database as the API. Run `scripts.init_users` with at least one administrator in each configuration; it creates the organization and its Admin/User role mappings.

```bash
docker compose -f docker/docker-compose-local-dev.yml exec fastapi python -m scripts.init_users
docker compose -f docker/docker-compose-local-dev.yml restart fastapi rq_worker
```

This reads entity/admin configuration from `backend/scripts/cfgs/config.toml` and:

- Creates an entity ("Local Development") with Admin and User permission maps
- Creates the admin user (`admin@openbb.co` / `asdQWE123!`) as a superuser
- Writes `/data/user_create.json` with UUIDs needed by the API and worker

The HubSpot errors in the output are expected (fake API keys in local dev).

### 3. Verify authentication

```bash
curl -s http://localhost:8000/pro/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@openbb.co","password":"asdQWE123!","remember":false}'
```

A successful response returns JSON with `access_token`, `uuid`, etc.

You can also use the admin CLI:

```bash
cd admin_cli
./openbb-admin auth login --api-url http://localhost:8000
```

## UI Testing Workflow

1. Start the stack:

```bash
docker compose -f docker/docker-compose-local-dev.yml up --build --watch
```

2. Keep that command running in a terminal.

3. Start the frontend separately and point it at `http://localhost:8000`.

4. Edit files under `backend/` normally. The FastAPI container reloads
automatically, and Compose restarts the RQ worker container when backend files
change.

Notes:

- If you change `.env` values or Python dependencies, rebuild the containers:
  `docker compose -f docker/docker-compose-local-dev.yml up --build`.
- `docker compose --watch` requires a recent Docker Compose version. If `--watch`
  is unavailable on your machine, keep the bind mount and restart the worker
  manually with `docker compose -f docker/docker-compose-local-dev.yml restart rq_worker`.

## Full Reset

To start completely from scratch:

```bash
# Stop and remove containers + volumes
docker compose -f docker/docker-compose-local-dev.yml down -v

# Restart
docker compose -f docker/docker-compose-local-dev.yml up --build -d

# Recreate the admin user/bootstrap data
docker compose -f docker/docker-compose-local-dev.yml exec fastapi python -m scripts.init_users
docker compose -f docker/docker-compose-local-dev.yml restart fastapi rq_worker
```

## Troubleshooting

- **Migration hangs / "Another migration in progress":**
  A previous migration failed and left a Redis lock. Clear it:
  `docker exec redis redis-cli flushall`

- **Port 8000 already in use:**
  Stop the existing stack or free the port before starting compose.

- **Login returns 401 "Incorrect username or password":**
  Check that the account belongs to the expected organization and rerun `scripts.init_users` with its configured administrator credentials.

- **Login returns 403 "User is not confirmed":**
  The admin user was created without `confirmed=1`. This is fixed in the current
  `init_users.py`. Do a full reset.

- **API or worker is not picking up code changes:**
  Confirm the bind mount is active and that you started Compose with `--watch`.
  If Compose watch is unavailable, restart `rq_worker` manually after worker-code
  changes.

- **rq_worker can't connect to MySQL/Redis:**
  The worker runs inside Docker and must use container names (`mysql`, `redis`), not
  `localhost`. The compose file handles this via `environment:` overrides. If you see
  connection errors, verify the overrides are present in `docker/docker-compose-local-dev.yml`.

## Architecture Notes

- The password column (`User.password`) uses a `PasswordType` SQLAlchemy TypeDecorator
  that automatically bcrypt-hashes values on write. Code that inserts or updates
  passwords must pass the **plaintext** password — never pre-hash it.

- The `OPENBB_AUTH_TOKEN` in `.env` is the service-to-service auth token. When
  `DISABLE_CORS=1`, the `/pro/*` endpoints auto-authenticate using this token,
  so no `X-OpenBB-Authorization` header is needed from localhost clients.

### Account bootstrap file

`scripts.init_users` writes `backend/user_create.json` by default. `ProSettings` reads `user_create.json` from the backend's working directory at startup. Set `USER_CREATE_PATH` to the same absolute path for provisioning and the API/worker to use a different file.

The file is a JSON object with these fields:

| Field | Type | Meaning | Setting populated |
| --- | --- | --- | --- |
| `admin_permissions_uuid` | UUID string | Entity's Admin permission mapping | `DEFAULT_ADMIN_PERMISSIONS_UUID` |
| `permissions_uuid` | UUID string | Entity's User permission mapping | `DEFAULT_PERMISSIONS_UUID` |
| `inviting_uuid` | UUID string | Administrator's user UUID | `DEFAULT_INVITER_UUID` |
| `inviting_email` | Email string | Administrator's email | `DEFAULT_INVITER_EMAIL` |

The file contains generated database identifiers; use `scripts.init_users` to produce it. Delete it before initializing a clean database so settings cannot reuse identifiers from another database.

`User.permissions_uuid` references `permissions_entity_map.uuid`. Each mapping row contains an organization UUID (`entity_uuid`) and a membership name (`Admin` or `User`). Each organization has its own rows. Resource roles in the `role` table grant access to particular dashboards, apps, files, and backends separately from these membership roles.

A deployment can contain multiple organizations. The bootstrap file selects one organization for self-registration and identity-provider defaults; existing accounts and invitations use their assigned organizations. With one provisioning configuration, that organization supplies the defaults. With multiple configurations, select the organization by name:

```bash
python -m scripts.init_users --config-dir scripts/cfgs --default-entity "My Organization"
```

Provisioning creates all configured organizations and writes bootstrap identifiers for the selected organization. Multiple configurations without `--default-entity` fail before provisioning.

## Account access and resource limits

Admin/User mappings and resource roles control organization administration and sharing. The organization setting `allow_custom_backends` controls personal backend connections; administrator-configured organization backends remain available when it is disabled. Removing an account from its organization invalidates its Workspace sessions and MCP access.

Set `COPILOT_CALLS_PER_DAY` (default `10000`) and `FILE_UPLOAD_LIMIT_GB` (default `10`) on the backend. These deployment settings give every user the same limits, with separate counters for each account. Individual limit overrides are not supported. The worker resets daily agent-call counters; users cannot reset or decrement them through the usage API. Uploads exceeding the configured total storage limit fail before files are written.
