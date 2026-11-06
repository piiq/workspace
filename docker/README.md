# Docker files

Use the [quickstart](../docs/quickstart.md) to run Workspace, [deployment guide](../docs/deployment.md) for configuration, and [development guide](../docs/development.md#container-images) to build and test images.

| File or directory | Purpose |
| --- | --- |
| [Dockerfile](Dockerfile) | Builds the combined Workspace, frontend, and backend images. |
| [docker-compose.yml](docker-compose.yml) | Separate frontend, API, worker, bootstrap, MySQL, and Redis services. |
| [docker-compose.workspace.yml](docker-compose.workspace.yml) | Builds and runs the combined application from a checkout. |
| [docker-compose.plugins.yml](docker-compose.plugins.yml) | Serves compiled plugins through nginx; see [plugin installation](../docs/plugin-installation.md). |
| [docker-compose-local-dev.yml](docker-compose-local-dev.yml) | Backend development with MySQL and Redis. |
| [docker-compose-local-dev-postgres.yml](docker-compose-local-dev-postgres.yml) | Backend development with PostgreSQL and Redis. |
| [docker-compose-local-dev-sqlite.yml](docker-compose-local-dev-sqlite.yml) | Backend development with SQLite and Redis. |
| [docker-compose.e2e.yml](docker-compose.e2e.yml) | Redis for source browser tests. |
| [.env.example](.env.example) | Settings template for the separate-service deployment. |
| [frontend/](frontend/) | Frontend nginx configuration template. |
| [workspace/](workspace/) | Combined-container startup, credentials, and process configuration. |
| [tests/](tests/) | Image integration tests; see [image checks](../docs/development.md#test-images). |
