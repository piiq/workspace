# OpenBB Workspace

Source code for OpenBB Workspace and the components that build and run it.

## Layout

| Directory | What it is |
|---|---|
| `frontend/` | The Workspace frontend (React 18 + TypeScript + Vite) |
| `backend/` | FastAPI API, SQLAlchemy models, migrations, workers, and backend tooling |
| `admin_cli/` | CLI for managing users, entities, and backend operations |
| `docker/` | Compose deployments and test infrastructure |
| `.github/workflows/` | Repository workflows |
| `lite/` | Docker packaging that assembles OpenBB Lite from the backend and frontend |
| `excel-add-in/` | The OpenBB Add-in for Excel (Office.js, TypeScript/React) |

Each component keeps its own README with setup and development instructions.

## Source development

Use Bun and a Node version supported by [frontend/package.json](frontend/package.json). From the repository root:

```bash
cd frontend
bun install --frozen-lockfile
bun run dev
```

The backend requires Python 3.13 and Poetry. With your Python virtual environment activated:

```bash
cd backend
poetry install --with dev
```

Follow [backend/DEVELOPMENT_SETUP.md](backend/DEVELOPMENT_SETUP.md) for environment files, backend services, and account provisioning. Compose commands run from the repository root, for example:

```bash
docker compose -f docker/docker-compose-local-dev.yml up --build --watch
```

The frontend and backend Docker recipes use the repository root as their build context:

```bash
docker build -f frontend/Dockerfile -t workspace-frontend:dev .
docker build -f backend/fastapi.Dockerfile -t workspace-backend:dev .
```

## Checks

```bash
cd frontend
bun run typecheck
bun run test:unit

cd ../backend
poetry run pytest
```

Backend integration and database migration tests start their own Docker containers. Lint and unit/integration workflows run on pull requests that change their component's source, tests, configuration, or workflow file. Frontend browser and Excel smoke tests use manual workflow triggers and require hosted OpenBB accounts and secrets.

## Notes

- Root workflows cover tests, lint, and PR descriptions.
- Licensed under Apache-2.0 (see [LICENSE](LICENSE)). Individual components may carry additional notices in their own directories.
