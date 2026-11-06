# Backend

FastAPI + SQLAlchemy backend for OpenBB Workspace.

## Setup

Follow [backend development setup](DEVELOPMENT_SETUP.md) for the Python environment, local containers, provisioning, and reloads. Container deployment is covered in the [deployment guide](../docs/deployment.md).

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

## Database Migrations

```bash
# Apply pending migrations
python -m alembic upgrade head

# Create a new migration after model changes
python -m alembic revision --autogenerate -m "description"
```

## Checks

Run these from the activated backend environment:

```sh
ruff check .
ty check
```

Test commands and fixtures are documented in [backend tests](tests/README.md).

Marketplace documentation separates [architecture and public APIs](docs/marketplace.md), [app submission](docs/developer-marketplace.md), and [administration](docs/admin-marketplace.md).
