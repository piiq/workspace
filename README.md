# OpenBB Workspace

Source code for OpenBB Workspace and the components that build and run it.

## Run Workspace

Start with [installation from source](docs/install-from-source.md) for a local Docker installation. Use [the advanced deployment guide](docker/README.md) for configuration, separate containers, databases, storage, administration, and plugin installation. [The plugin guide](docs/plugins.md) covers plugin development and loading interfaces.

## Layout

| Directory | What it is |
|---|---|
| `frontend/` | The Workspace frontend (React 18 + TypeScript + Vite) |
| `backend/` | FastAPI API, SQLAlchemy models, migrations, workers, and backend tooling |
| `admin_cli/` | CLI for managing users, entities, and backend operations |
| `docker/` | Compose deployments and test infrastructure |
| `.github/workflows/` | Repository workflows |
| `excel-add-in/` | The OpenBB Add-in for Excel (Office.js, TypeScript/React) |

Each component keeps its own README with setup and development instructions.

## Source development

Use Bun and a Node version supported by [frontend/package.json](frontend/package.json). From the repository root:

```bash
cd frontend
bun install --frozen-lockfile
bun run dev
```

The backend requires Python 3.13 and uv. Create its environment and activate it:

```bash
cd backend
uv sync --locked
source .venv/bin/activate
```

Follow [backend/DEVELOPMENT_SETUP.md](backend/DEVELOPMENT_SETUP.md) for environment files, backend services, and account provisioning. Compose commands run from the repository root, for example:

```bash
docker compose -f docker/docker-compose-local-dev.yml up --build --watch
```

The frontend, backend, and combined Workspace targets use the repository root as their build context:

```bash
docker buildx build --load -f docker/Dockerfile --target frontend -t workspace-frontend:dev .
docker buildx build --load -f docker/Dockerfile --target backend -t workspace-backend:dev .
docker buildx build --load -f docker/Dockerfile --target workspace -t workspace:dev .
```

See [the container instructions](docker/README.md) for runtime configuration, account provisioning, and combined or separate deployments.

Use [the local image build command](docker/README.md#build) and [image integration tests](docker/README.md#test-images) to verify combined and separate deployments before publication. The [Workspace Images workflow](.github/workflows/workspace-images.yml) verifies native AMD64 and ARM64 images on `main` and supports manual runs with publication disabled by default. See [image names and tags](docker/README.md#image-publication).

## Checks

Frontend unit tests compile the example plugin. Install its dependencies and the SDK runtime dependencies using [the plugin build instructions](docs/plugins.md#building-a-plugin) before running the suite.

```bash
cd frontend
bun run typecheck
bun run test:unit

cd ../backend
pytest
```

Backend integration and database migration tests start their own Docker containers. Lint and unit/integration workflows run on pull requests that change their component's source, tests, configuration, or workflow file. Frontend browser tests run manually and on PRs affecting browser or plugin integration, using source servers with SQLite, file storage, and Redis. See [the browser test setup](frontend/tests/e2e/README.md). Excel smoke tests use a manual trigger and require hosted OpenBB accounts and secrets.

## Notes

- Root workflows cover tests, lint, and PR descriptions.
- Licensed under Apache-2.0 (see [LICENSE](LICENSE)). Individual components may carry additional notices in their own directories.
