# Backend Integration Tests

## How to run the tests

### Prerequisites

- Docker must be running (testcontainers uses Docker to spin up MySQL and Redis)
- Python 3.13 with the activated development environment from [backend prerequisites](../DEVELOPMENT_SETUP.md#prerequisites)

### Run tests

```bash
cd backend
pytest tests -v
```

Testcontainers manages MySQL and Redis for the test session.

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

`test_migration_dialects.py` checks migrations and database reads/writes on MySQL, PostgreSQL, and SQLite. MySQL and PostgreSQL require Docker.

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

`--require-docker` fails before running tests when Docker is unavailable. Use it for runs covering all database dialects, including CI. Without that option, tests requiring Docker are skipped when it is unavailable.

---

## Database Seeding

The default organization, its Admin/User roles, and confirmed administrator `workspace-admin@openbb.co` are defined in `fixtures/base.py`.

### UUID References

Keep `DEFAULT_PERMISSIONS_UUID`, `DEFAULT_ADMIN_PERMISSIONS_UUID`, `DEFAULT_INVITER_UUID`, and `DEFAULT_INVITER_EMAIL` consistent with the seeded records when changing test registration settings.

### The `pro_client` fixture

Use `pro_client` for `/pro/*` requests; it supplies the required service JWT.

```python
@pytest.mark.asyncio
async def test_pro_login(pro_client):
    response = await pro_client.post("/pro/login", json={...})
    assert response.status_code == 200
```

## Unit Tests (no Docker required)

Run unit tests separately:

```bash
pytest tests/test_mailchimp.py -v
```

### Unit test files

| File               | What it covers                                              |
|--------------------|-------------------------------------------------------------|
| `test_mailchimp.py` | `api.email.mailchimp` send functions, `create_html` helper |
