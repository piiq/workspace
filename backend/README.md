# Backend

FastAPI + SQLAlchemy backend for OpenBB Workspace.

## Setup

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for full local development instructions.

Quick start for local UI testing:

From the repository root:

```bash
docker compose -f docker/docker-compose-local-dev.yml up --build --watch

# in a second terminal
docker compose -f docker/docker-compose-local-dev.yml exec fastapi python -m scripts.init_users
docker compose -f docker/docker-compose-local-dev.yml restart fastapi rq_worker
```

This runs the API and RQ worker in Docker with the local `backend/` folder mounted.
The API reloads automatically, and Compose can restart the worker when files change.
See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for the full workflow.

## Project Layout

| Path | Description |
|---|---|
| `api/` | Application models, schemas, helpers, and authentication |
| `routers/` | API route handlers |
| `utilities/` | Configuration, shared utilities |
| `alembic/` | Database migration revisions |
| `envs/` | Environment files (`.env`) |
| `scripts/` | Provisioning, import/export, and development scripts |
| `tests/` | Test suite (`pytest`) |
| `run.py` | Application entrypoint (Gunicorn + Uvicorn) |
| `main.py` | FastAPI app factory |

## Conventions

- Use `api.base.get_now()` instead of `datetime.datetime.now`.
- The `User.password` column uses a `PasswordType` TypeDecorator that bcrypt-hashes on write. Pass plaintext passwords to avoid hashing them twice.

For source commands and tests, run `uv sync --locked` in `backend/` and activate `.venv` with `source .venv/bin/activate`. Python 3.13 is required.

## Database Migrations

```bash
# Apply pending migrations
python -m alembic upgrade head

# Create a new migration after model changes
python -m alembic revision --autogenerate -m "description"
```

## Checks

```bash
ruff check .
ty check
pytest
```

The pytest suite starts database and Redis containers through Docker. See [the test guide](tests/README.md) for setup and individual test commands.
Coverage report is generated at `htmlcov/index.html`.
