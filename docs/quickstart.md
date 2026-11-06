# OpenBB Workspace Community quickstart

Install [Docker](https://docs.docker.com/get-started/get-docker/) and start it. Docker Desktop on macOS and Windows includes everything needed; Windows installations use Linux containers, and the commands below run in PowerShell. Images support Intel/AMD 64-bit and ARM64 (including Apple Silicon) machines.

## Run Workspace

```sh
docker run -d --name workspace -p 127.0.0.1:8080:80 -v "${PWD}/data:/data" ghcr.io/piiq/workspace:latest
```

Docker downloads the image and starts the application with SQLite and file storage. Docker creates a `data/` folder in your current directory and mounts it at `/data` in the container. Accounts, dashboards, uploads, and generated secrets persist there. No source checkout or configuration files are needed.

Wait for the container to report healthy, then print the administrator login:

```sh
docker ps --filter name=workspace
docker exec workspace credentials
```

Open [http://localhost:8080](http://localhost:8080) and sign in with the printed credentials. Use `localhost` consistently; `127.0.0.1` is a different browser origin. The port binding makes Workspace accessible from this machine.

## Add your data

Workspace starts without sample dashboards or data subscriptions. Drag a CSV file onto a dashboard, or open Connections to upload a CSV or JSON file. Add a backend through Add Data > Apps. Backends, including [Open Data Platform](https://github.com/openbq-org/OpenBB), supply their own widget declarations and data. A backend URL must be reachable from the browser using Workspace; `localhost` in that URL refers to the browser's machine.

Create a dashboard, add a widget from your connection, and reload the page to check that it is saved.

Optional plugins provide additional renderers and grid features. See [plugin installation](plugin-installation.md); each plugin's repository documents its installation and library requirements.

## Next steps

- [Deployment configuration](deployment.md): Compose, administrator credentials, hostnames, databases, and storage.
- [Plugin installation](plugin-installation.md): runtime servers and build-time selections.
- [Operating guide](operations.md): stopping, starting, updates, backups, and troubleshooting.
- [Install from source](install-from-source.md): build a Workspace image from this repository.
