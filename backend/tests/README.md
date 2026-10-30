# Backend Integration Tests

## How to run the tests

### Prerequisites

- Docker must be running (testcontainers uses Docker to spin up MySQL and Redis)
- Python 3.13 with the dev dependencies installed
- Run `uv sync --locked` in `backend/`

### Run tests

```bash
cd backend
source .venv/bin/activate
pytest tests -v
```

On Windows, use `.\.venv\Scripts\Activate.ps1` in PowerShell or `.venv\Scripts\activate.bat` in cmd to activate the environment before running `pytest`.

Testcontainers supplies the database and Redis; no separate Compose stack is needed. Testcontainers automatically:

1. Starts fresh MySQL and Redis containers with random ports
2. Configures the test environment to use those containers
3. Stops and cleans up containers when tests finish

### Running a specific test file

```bash
pytest tests/test_auth.py -v
```

### Running a specific test class or method

```bash
pytest tests/test_auth.py::TestProLogin -v
pytest tests/test_auth.py::TestProLogin::test_login_valid_credentials -v
```

## Database Dialect Migration Tests

Separate from the integration tests, `test_migration_dialects.py` verifies that
`alembic upgrade head` works correctly on a **fresh** database for all three
supported dialects: MySQL, PostgreSQL, and SQLite.

Each test spins up a fresh container (or temp file for SQLite), runs the full
migration chain via subprocess, then introspects every table to verify:

- All tables were created (40+ expected)
- Every column can be reflected without type-mapping errors
- A `SELECT` succeeds on every table
- Synchronous pg8000 and asynchronous asyncpg connections can read and write PostgreSQL UUID, JSON, and numeric values
- Database revision matches the Alembic migration head

### Run all dialect tests

```bash
cd backend
pytest tests/test_migration_dialects.py --require-docker -v
```

### Run a single dialect

```bash
python -m pytest tests/test_migration_dialects.py::TestSQLiteMigrations -v
python -m pytest tests/test_migration_dialects.py::TestMySQLMigrations -v
python -m pytest tests/test_migration_dialects.py::TestPostgreSQLMigrations -v
```

> **Note:** MySQL and PostgreSQL tests require Docker. SQLite runs without Docker.

`--require-docker` fails before running tests when Docker is unavailable. Use it for runs covering all database dialects, including CI. Without that option, tests requiring Docker are skipped when it is unavailable.

---

## Test Infrastructure

The test setup uses [testcontainers-python](https://testcontainers-python.readthedocs.io/) to automatically manage:

- **MySQL 8.0** container (random port, auto-configured)
- **Redis Alpine** container (random port, auto-configured)

Environment variables are set dynamically by `conftest.py` based on the container ports.

## Database Seeding

The `apply_migrations` fixture calls `_seed_workspace_entities()` in `fixtures/base.py` after applying database migrations. It provisions the default organization, member and admin roles, and an admin user for registration and login tests.

### What gets seeded

The seed function creates the following records after database migrations run:

1. `EntityType` and `Entity` records for the default organization
2. `PermissionsEntityMap` records named `User` and `Admin` within that organization
3. A confirmed admin user, `workspace-admin@openbb.co`, used as the default inviter

### UUID References

The seed function sets `DEFAULT_PERMISSIONS_UUID`, `DEFAULT_ADMIN_PERMISSIONS_UUID`, `DEFAULT_INVITER_UUID`, and `DEFAULT_INVITER_EMAIL` to match the seeded records. These settings select the organization, roles, and inviter used by registration.

The UUID constants are defined alongside `_seed_workspace_entities()` in `fixtures/base.py`.

### The `pro_client` fixture

Tests that hit `/pro/*` endpoints must use the `pro_client` fixture instead of the base `client` fixture. This is because the `/pro` router requires a service JWT in the `X-OpenBB-Authorization` header.

```python
@pytest.mark.asyncio
async def test_pro_login(pro_client):
    response = await pro_client.post("/pro/login", json={...})
    assert response.status_code == 200
```

The `pro_client` fixture:

- Inherits from the base `client` fixture
- Adds `X-OpenBB-Authorization: Bearer <service_jwt>` header
- The service JWT has `sub="pro"` and `iss="openbb-hub"`

### Cleanup

The database and client fixtures delete records belonging to their test users, sessions, roles, and entities. The default organization and inviter remain available throughout the test session. Testcontainers removes the database container after the session.

## Unit Tests (no Docker required)

Some test files are pure unit tests that mock all external dependencies and don't need the integration test infrastructure (MySQL, Redis, Docker). They can be run standalone without Docker:

```bash
pytest tests/test_mailchimp.py -v
```

### Unit test files

| File               | What it covers                                              |
|--------------------|-------------------------------------------------------------|
| `test_mailchimp.py` | `api.email.mailchimp` send functions, `create_html` helper |
