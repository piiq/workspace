# Workspace deployment

For first launch, use the [quickstart](quickstart.md). See [operations](operations.md) for updates and backups, [plugin installation](plugin-installation.md) for plugins, and [development](development.md#container-images) for image builds.

## Combined container

Use Docker Compose to keep deployment settings in a file, configure a server address, or run additional services such as a plugin server. This configuration stores application data in a local `data/` folder.

Save the following as `compose.yaml` beside your `data/` folder. For a quickstart installation, use the directory where you ran `docker run`:

```yaml
name: workspace

services:
  workspace:
    image: ghcr.io/piiq/workspace:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:80"
    environment:
      SELFURL: http://localhost:8080/api
      FRONTENDURL: http://localhost:8080
      PROURL: http://localhost:8080
    volumes:
      - ./data:/data
```

Add settings under `environment`. See the [backend environment example](../backend/envs/.env.example) and [backend configuration definitions](../backend/utilities/config.py) for backend settings. The [frontend container configuration](../scripts/render-frontend-config.sh) lists runtime environment names; [frontend/.env](../frontend/.env) describes the corresponding features using development-time `VITE_*` names. Use the container environment names in Compose.

This mounts the same local data folder as the quickstart. To switch a running quickstart installation to Compose, stop and remove its container:

```sh
docker stop workspace
docker rm workspace
```

From the directory containing `compose.yaml`, start Workspace and retrieve its credentials:

```sh
docker compose up -d --wait
docker compose exec workspace credentials
```

These commands require the Compose plugin, which Docker Desktop includes. Keep `compose.yaml` for subsequent configuration changes. See [operations](operations.md) for lifecycle commands.

### Administrator account

To choose the administrator email, add `OPENBB_ADMIN_EMAIL: you@example.com` under `environment`, using your email address. Otherwise, the generated account uses `admin@openbb.co`. A password is generated automatically.

Administrator credentials and application secrets persist in `/data/secrets.env`. Startup reapplies the configured administrator password. Setting `OPENBB_ADMIN_PASSWORD` under `environment` overrides that saved password. Changing `OPENBB_ADMIN_EMAIL` provisions or promotes the selected account; it does not rename or remove the previous administrator. See [administration](../admin_cli/README.md) for managing users.

Startup also generates missing `JWT_SECRET`, `OPENBB_AES_KEY`, and `LOCAL_STORAGE_SECRET_KEY`. Explicit environment values override saved values; values absent from the environment survive container recreation. The combined container starts Redis before applying migrations and provisioning. A failure stops startup before the API, worker, and nginx start.

## Deployment URLs and CORS

For a different local port, change the host port in `ports` and all three URL values. For example, port `9090` uses `127.0.0.1:9090:80`, `http://localhost:9090/api`, and `http://localhost:9090`.

For a server behind an HTTPS reverse proxy, set the browser-facing URLs in `compose.yaml`:

```yaml
    environment:
      SELFURL: https://workspace.example.com/api
      FRONTENDURL: https://workspace.example.com
      PROURL: https://workspace.example.com
```

Replace `workspace.example.com` with your hostname. Configure DNS and TLS at your reverse proxy and forward requests to the Workspace host's port `8080`. A proxy on the same host can use the loopback binding above. A proxy on another host needs a reachable binding, such as `8080:80`, or the Workspace host's network address in place of `127.0.0.1`. Forward WebSocket upgrades and supply `X-Forwarded-Proto: https` when terminating TLS.

CORS defaults to the origins of `FRONTENDURL` and `PROURL`. Keep them consistent with the URL you open in the browser. `SELFURL` includes `/api`. Set `BACKEND_CORS_ORIGINS` to a JSON array to replace that allowlist, for example `'["https://workspace.example.com"]'`; an explicit `[]` trusts no browser origins. `FRONTENDURL` defaults to `PROURL` when omitted. `localhost` and `127.0.0.1` are different browser origins.

Apply Compose changes by recreating the container:

```sh
docker compose up -d --wait
```

`docker compose restart` does not apply changes to `compose.yaml`.

## Frontend runtime settings

The frontend writes `/config.js` at startup using [scripts/render-frontend-config.sh](../scripts/render-frontend-config.sh). `BACKEND_URL` defaults to `/api`; nginx forwards that prefix to `BACKEND_UPSTREAM`, which defaults to `backend:8000`. The browser-facing backend URL and nginx upstream are separate settings. The proxy preserves WebSocket upgrades and streams responses without buffering. It preserves supplied `Origin` headers and fills missing ones from the Workspace origin for same-origin GET requests. When TLS terminates at an upstream proxy, that proxy must supply `X-Forwarded-Proto`.

Set frontend environment variables in a Compose override to configure authentication, UI, AI, or branding. Plugin settings are documented in [plugin installation](plugin-installation.md). Recreate the frontend container to apply environment changes; the application image is reused.

## Databases and storage

The combined image defaults to SQLite at `/data/openbb.db`, file storage at `/data/storage`, and Redis on `127.0.0.1:6379`. Redis state, provisioning configuration, and secrets also persist under `/data`. The combined Compose configuration above keeps all of this in your local `data/` folder.

To use PostgreSQL or MySQL, set `DATABASE_TYPE`, the database connection fields, and credentials in the container environment. The standalone backend image defaults to MySQL; the combined image overrides that default with SQLite. The [backend settings template](../backend/envs/.env.example) lists connection, TLS, and Redis settings. Mount database certificates when supplying certificate paths. API and worker processes must use the same settings.

For S3-compatible storage, set `STORAGE_PROVIDER=aws` and `S3_FILE_BUCKET`, `S3_REGION`, and `S3_ENDPOINT_URL` for your server. Otherwise, use `STORAGE_PROVIDER=folder` with `FOLDER_STORAGE_PATH` inside persistent storage.

## Separate services

The [separate-service Compose example](../docker/docker-compose.yml) runs MySQL, Redis, API, worker, bootstrap, and frontend services. These commands use the example files in a source checkout and run from the repository root. Copy the environment example and edit it:

```sh
cp docker/.env.example docker/.env
```

Set `WORKSPACE_CONFIG_DIR` to an absolute directory containing your provisioning TOML files. Use the [provisioning format](../backend/scripts/cfgs/config.toml) and set your administrator credentials. The provisioning directory is mounted read-only and is excluded from the image build. With a single TOML file, that organization supplies registration defaults. For multiple organizations, override the bootstrap service's command with `["bootstrap", "--config-dir", "/config", "--default-entity", "My Organization"]` to choose the registration default.

Set the database password consistently in `READ_DB_PASSWORD` and `WRITE_DB_PASSWORD`. Generate secrets using the backend image:

```sh
docker run --rm --entrypoint python ghcr.io/piiq/workspace-backend:latest -c 'import secrets; print(secrets.token_urlsafe(48)); print(secrets.token_hex(16)); print(secrets.token_urlsafe(48))'
```

Use the three printed values for `JWT_SECRET`, `OPENBB_AES_KEY`, and `LOCAL_STORAGE_SECRET_KEY`, in that order. Keep these values across container recreation. When `OPENBB_AUTH_TOKEN` is absent, the backend entrypoint derives it from `JWT_SECRET`; a supplied token is preserved.

Configure the [deployment URLs](#deployment-urls-and-cors). The example sets `BACKEND_CORS_ORIGINS` explicitly. Set `WORKSPACE_PORT` to the published frontend port. To use published images, add these entries to `docker/.env`:

```ini
BACKEND_IMAGE=ghcr.io/piiq/workspace-backend:latest
FRONTEND_IMAGE=ghcr.io/piiq/workspace-frontend:latest
```

Then start the deployment:

```sh
docker compose --env-file docker/.env -f docker/docker-compose.yml up --no-build -d --wait
```

MySQL, Redis, uploaded files, and `user_create.json` use named volumes. `down` keeps them; `down -v` deletes them.

The backend reads `docker/.env`. Set `BACKEND_ENV_FILE` to an absolute backend environment file to use a separate file; `--env-file` still supplies Compose settings such as the database password, provisioning path, and published port. See [databases and storage](#databases-and-storage) for external services.

The shared `/data` volume holds the bootstrap file and folder storage. API and worker containers must use the same storage and secrets. For horizontally scaled hosts, use shared storage or object storage and make the generated bootstrap file available to every backend container.

For account management and imports, see [backend commands](operations.md#backend-commands).
