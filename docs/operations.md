# Operate OpenBB Workspace Community Fork

These commands apply to installations from the [quickstart](quickstart.md), with a local `data/` folder mounted at `/data`. For Compose, run them from the directory containing `compose.yaml`.

## Stop and start

For a `docker run` installation:

```sh
docker stop workspace
docker start workspace
```

For Compose:

```sh
docker compose down
docker compose up -d --wait
```

Container removal keeps the local `data/` folder. Use its same path when recreating the deployment.

## Update Workspace

[Back up the data](#back-up-and-restore) first. For a Compose deployment, download and start the latest image with:

```sh
docker compose pull
docker compose up -d --wait
```

For a `docker run` installation using published images, download the image with `docker pull ghcr.io/piiq/workspace:latest`, then [replace the container](#replace-a-docker-container). For a source installation, [rebuild the image](install-from-source.md#build-workspace) before replacing the container.

For a deployment tied to a particular revision, replace `:latest` with a published `:sha-<full-commit>` tag. Updating can apply database migrations; restoring an older image may also require restoring its backup.

### Replace a Docker container

```sh
docker stop workspace
docker rm workspace
```

Repeat the [launch command](quickstart.md#run-workspace) from the directory containing your `data/` folder. Use `workspace:dev` as the image for a source build.

## Back up and restore

Stop the application with `docker stop workspace` or `docker compose stop`. Copy the entire `data/` folder to your backup location, along with `compose.yaml` when using Compose, then start the application with `docker start workspace` or `docker compose start`.

Copying while stopped keeps the SQLite database and uploaded files consistent. The backup includes secrets and administrator credentials. Preserve `data/secrets.env`: its keys are needed to read encrypted credentials.

To restore on another machine, install Docker and copy the backed-up `data/` folder there. Place `compose.yaml` beside it and run `docker compose up -d --wait`, or run the [Docker launch command](quickstart.md#run-workspace) from its parent directory.

## Backend commands

The backend includes the API, RQ worker, migrations, provisioning scripts, and `openbb-admin`. Its commands are:

| Command | Behavior |
| --- | --- |
| `api` | Apply migrations and run the Gunicorn API using `PORT` and `WORKERS`. |
| `worker` | Run the RQ worker with its scheduler. |
| `migrate [arguments]` | Run Alembic; no arguments means `upgrade head`. |
| `bootstrap [arguments]` | Apply migrations, then run `scripts.init_users` with the supplied arguments. |
| `openbb-admin [arguments]` | Run the admin CLI. |

`api` is the backend image's default command. Use the same settings for API and worker containers. Run `workspace-backend --help` for command options.

For a combined installation, run backend commands through `workspace-command`, which loads persisted application secrets:

```sh
docker exec workspace workspace-command openbb-admin auth login --api-url http://127.0.0.1:8000
```

For Compose, replace `docker exec workspace` with `docker compose exec workspace`. In a separate-service deployment, use `docker compose --env-file docker/.env -f docker/docker-compose.yml exec backend openbb-admin` as the CLI prefix. Sign in again after container recreation because CLI authentication is stored in the container user's home directory. See [administration](../admin_cli/README.md) for user and organization commands.

The combined image includes `openbb-import /import/account.zip`. Mount the archive directory at `/import` when creating the container; the helper loads the API's persisted secrets for credential encryption. Archive contents and import arguments are documented under [account export and import](../admin_cli/README.md#importing-into-workspace).

## Troubleshooting

Inspect startup errors with `docker logs --tail=100 workspace`, or `docker compose logs --tail=100 workspace` for Compose. For separate services, inspect `backend` and `worker` logs. In the combined container, `docker exec workspace supervisorctl status` reports the API, worker, Redis, and nginx processes.

- If Docker reports that port `8080` is in use, choose another port and configure the [deployment URLs](deployment.md#deployment-urls-and-cors).
- If login succeeds but later requests return `401: Not allowed to access this endpoint`, check the browser origin against `FRONTENDURL`, `PROURL`, and any explicit `BACKEND_CORS_ORIGINS` setting. See [URL and CORS configuration](deployment.md#deployment-urls-and-cors).
- If a widget requests a missing plugin, follow [plugin installation](plugin-installation.md). Data connections and rendering plugins are configured separately.
