# Install from source

Run Workspace locally with Docker. The combined container includes the frontend, API, background worker, and Redis. It stores accounts and dashboards in SQLite and uploaded files on the container's persistent volume.

## Requirements

- Docker with Compose and Buildx. Docker Desktop provides these on macOS and Windows.
- Git to clone the repository.
- Port `8080` available on your machine.

Docker must be running. Python, uv, Node, and Bun are not required on the host for this installation.

## Start Workspace

Clone the repository:

```sh
git clone https://github.com/piiq/workspace.git workspace-oss
cd workspace-oss
```

For an existing checkout, run the remaining commands from its repository root.

Build and start the application:

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml up --build -d --wait
```

The first build downloads dependencies and compiles the frontend. Wait for the container to report healthy, then print the generated administrator credentials:

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml exec workspace credentials
```

Open [http://localhost:8080](http://localhost:8080) and sign in. Use `localhost` as shown; browser origins include the hostname and port.

## Connect your data

Accounts start without sample dashboards or provider feeds. Upload a CSV or JSON file, or add your backend through Settings > Data Connectors. Connected backends supply their own widget declarations and data.

Optional plugins provide additional renderers and grid features. Follow [the advanced deployment guide](../docker/README.md#plugin-installation) to install them at runtime or include them in an image build. Each plugin's repository documents its data requirements and library configuration.

## Stop and start again

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml down
docker compose -p workspace -f docker/docker-compose.workspace.yml up -d --wait
```

The named volume preserves accounts, dashboards, files, and generated secrets. Keep the same Compose project name (`workspace`) to reuse it. Adding `--volumes` to `down` deletes that data.

After changing application source code, repeat the build-and-start command with `--build`. Restarting a container does not rebuild its image.

## Troubleshooting

Inspect startup and API errors:

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml logs --tail=100 workspace
```

If login succeeds but subsequent requests return `401: Not allowed to access this endpoint`, check the browser origin against the deployment's frontend URL and CORS settings. See [URL configuration](../docker/README.md#deployment-urls-and-cors).

For a different port or hostname, external databases, account administration, runtime settings, and plugins, use [the advanced deployment guide](../docker/README.md).
