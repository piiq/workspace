# OpenBB Workspace Community Fork

A self-hosted workspace for financial data. Connect your data sources, build dashboards with charts and tables, and share them with your team.

<img width="1450" height="851" alt="image" src="https://github.com/user-attachments/assets/112e56a9-d583-42b6-8a93-72552e454321" />

## Get started

Run Workspace with Docker on macOS, Windows, or Linux:

```sh
docker run -d --name workspace -p 127.0.0.1:8080:80 -v "${PWD}/data:/data" ghcr.io/piiq/workspace:latest
```

Once the container is healthy, run `docker exec workspace credentials` and sign in at [http://localhost:8080](http://localhost:8080). See the [quickstart](docs/quickstart.md) for Docker requirements and connecting your data.

Workspace starts without bundled market data. Bring your own data through file uploads, APIs, or an [Open Data Platform](https://github.com/openbq-org/OpenBB) connection. Optional plugins add renderers and grid features.

## Set up with an agent

Give your agent this prompt:

```text
Set up OpenBB Workspace Community Fork on this machine following https://raw.githubusercontent.com/piiq/workspace/main/docs/quickstart.md. Use docker run with the published image and a local data folder mounted at /data. Start Workspace, verify that it is healthy, and tell me the URL and the command to retrieve the administrator credentials.
```

## Documentation

- [Quickstart](docs/quickstart.md): launch, sign in, and connect your data.
- [Operating guide](docs/operations.md): updates, backups, and restoration.
- [Deployment](docs/deployment.md): Compose, hostnames, databases, and storage.
- [Plugin installation](docs/plugin-installation.md): runtime servers and build-time selections.
- [Install from source](docs/install-from-source.md): build and run your own image.
- [Plugin development](docs/plugins.md): SDK interfaces and building plugins.
- [Administration](admin_cli/README.md): manage users and organizations, export and import accounts.

See [development](docs/development.md) for source workflows and checks, and [repository maintenance](docs/maintaining.md) for image publication and GitHub security settings.

Licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
