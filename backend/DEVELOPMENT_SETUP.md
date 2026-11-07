# Development Setup

For UI development on macOS, use `docker/docker-compose-local-dev.yml`. It mounts `backend/` into the API and worker containers for source edits.

For automated UI checks, follow the [browser test setup](../frontend/tests/e2e/README.md).

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

On Windows, use `.\.venv\Scripts\Activate.ps1` in PowerShell or `.venv\Scripts\activate.bat` in cmd to activate the environment.

`backend/uv.lock` pins runtime and development dependencies. `uv sync --locked --no-dev` installs runtime dependencies without development tools. Use `uv add` and `uv remove` in `backend/` to change dependencies. Python and pytest run directly from the activated environment.

## Environment

The backend reads `backend/envs/.env`; the frontend uses separate files, `frontend/.env` and `frontend/.env.local`. For local backend development, set:

```ini
MODE=onprem
DISABLE_CORS=1
```

`docker/docker-compose-local-dev.yml` loads `backend/envs/.env` into the API and worker containers, then overrides `DB_HOST` and `REDIS_HOST` with the Docker service names `mysql` and `redis`. Backend commands run on the host read the file directly and need host-reachable addresses for those services.

The SQLite Compose file (`docker/docker-compose-local-dev-sqlite.yml`) reads `backend/envs/.env.sqlite`, which is not tracked. Create it from the template and set `MODE=onprem`:

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

The API is available at `http://localhost:8000`, MySQL at port `3306`, and Redis at port `6379`. API edits reload through Uvicorn; worker edits restart through Compose watch.

### 2. Initialize admin users and entities

Use `user_create.json` generated for the same database as the API. Run `scripts.init_users` with at least one administrator in each configuration; it creates the organization and its Admin/User roles.

```bash
docker compose -f docker/docker-compose-local-dev.yml exec fastapi python -m scripts.init_users
docker compose -f docker/docker-compose-local-dev.yml restart fastapi rq_worker
```

Edit `backend/scripts/cfgs/config.toml` to change the organization or administrator. The default login is `admin@openbb.co` / `asdQWE123!`. Provisioning writes `/data/user_create.json` for the API and worker.

### 3. Verify authentication

```bash
curl -s http://localhost:8000/pro/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@openbb.co","password":"asdQWE123!","remember":false}'
```

Check that the response contains an `access_token`.

Deployment administrators use the [admin CLI](../admin_cli/README.md) to manage this backend's users and organizations.

## UI Testing Workflow

Keep the [local stack](#1-start-the-local-stack) running and start the frontend using its [development instructions](../frontend/README.md#development). Backend edits trigger API reloads and worker restarts.

After editing `backend/envs/.env`, recreate the API and worker containers to load the new values:

```sh
docker compose -f docker/docker-compose-local-dev.yml up -d --force-recreate fastapi rq_worker
```

Python dependency changes require an image rebuild; repeat the [stack startup command](#1-start-the-local-stack) with `--build`. Frontend environment changes require restarting Vite; see [frontend development](../frontend/README.md#development). If Compose watch is unavailable, restart `rq_worker` after worker-code changes. Automated UI checks use the [browser test guide](../frontend/tests/e2e/README.md).

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

- Migration hangs / "Another migration in progress":
  A previous migration failed and left a Redis lock. Clear it:
  `docker exec redis redis-cli flushall`

- Port 8000 already in use:
  Stop the existing stack or free the port before starting compose.

- Login returns 401 "Incorrect username or password":
  Check that the account belongs to the expected organization and rerun `scripts.init_users` with its configured administrator credentials.

- Login returns 403 "User is not confirmed":
  Check the user's `confirmed` field. Development administrators must be confirmed.

- API or worker is not picking up code changes:
  Confirm the bind mount is active and that you started Compose with `--watch`.
  If Compose watch is unavailable, restart `rq_worker` manually after worker-code
  changes.

- rq_worker can't connect to MySQL/Redis:
  The worker runs inside Docker and must use container names (`mysql`, `redis`), not
  `localhost`. The compose file handles this via `environment:` overrides. If you see
  connection errors, verify the overrides are present in `docker/docker-compose-local-dev.yml`.

## Service authentication

`OPENBB_AUTH_TOKEN` is the service token. With `DISABLE_CORS=1`, localhost requests to `/pro/*` can omit `X-OpenBB-Authorization`.

### Account bootstrap file

`scripts.init_users` writes `backend/user_create.json` by default. `ProSettings` reads `user_create.json` from the backend's working directory at startup. Set `USER_CREATE_PATH` to the same absolute path for provisioning and the API/worker to use a different file.

The file is a JSON object with these fields:

| Field | Type | Meaning | Setting populated |
| --- | --- | --- | --- |
| `admin_permissions_uuid` | UUID string | Organization's Admin role | `DEFAULT_ADMIN_PERMISSIONS_UUID` |
| `permissions_uuid` | UUID string | Organization's User role | `DEFAULT_PERMISSIONS_UUID` |
| `inviting_uuid` | UUID string | Administrator's user UUID | `DEFAULT_INVITER_UUID` |
| `inviting_email` | Email string | Administrator's email | `DEFAULT_INVITER_EMAIL` |

The file contains generated database identifiers; use `scripts.init_users` to produce it. Delete it before initializing a clean database so settings cannot reuse identifiers from another database.

`User.permissions_uuid` references `permissions_entity_map.uuid`. Each row identifies an organization (`entity_uuid`) and a membership role (`Admin` or `User`). Each organization has its own rows. The `role` table records access to individual dashboards, apps, files, and backends.

A deployment can contain multiple organizations. The bootstrap file selects one organization for self-registration and identity-provider defaults; existing accounts and invitations use their assigned organizations. With one provisioning configuration, that organization provides the defaults. With multiple configurations, select the organization by name:

```bash
python -m scripts.init_users --config-dir scripts/cfgs --default-entity "My Organization"
```

Provisioning creates all configured organizations and writes bootstrap identifiers for the selected organization. Multiple configurations without `--default-entity` fail before provisioning.

Account authorization and usage limits are documented under [account access and resource limits](../admin_cli/README.md#account-access-and-resource-limits).
