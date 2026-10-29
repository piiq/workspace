"""Database driver selection and TLS arguments for application connections."""

import ssl
from unittest.mock import Mock

import pytest
from sqlalchemy.engine import make_url

from utilities.config import DatabaseEngineSettings, DatabaseSettings


@pytest.fixture(autouse=True)
def mock_external_services():
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    yield


@pytest.fixture(params=["mysql", "postgresql", "sqlite"])
def db_settings(request, tmp_path):
    return DatabaseSettings(
        DATABASE_TYPE=request.param,
        DB_PATH=str(tmp_path / "test.db"),
        DB_HOST="localhost",
        DB_PORT=5432 if request.param == "postgresql" else 3306,
        DB_NAME="test_db",
        READ_DB_USER="reader",
        READ_DB_PASSWORD="read-pymysql-pg8000",
        WRITE_DB_USER="writer",
        WRITE_DB_PASSWORD="write-pymysql-pg8000",
    )


@pytest.mark.parametrize("factory_name", [
    "get_read_engine", "get_write_engine", "get_read_session",
    "get_write_session", "get_validate_user_session",
])
@pytest.mark.parametrize("use_custom_ssl_context", [False, True])
def test_connection_driver_credentials_and_tls(db_settings, factory_name, use_custom_ssl_context, monkeypatch):
    context = ssl.create_default_context() if use_custom_ssl_context else None
    monkeypatch.setattr(DatabaseSettings, "get_ssl_config", lambda self: context)
    factory = Mock()
    asynchronous = factory_name.endswith("session")
    monkeypatch.setattr(
        "utilities.config.DatabaseSessionManager" if asynchronous else "utilities.config.create_engine",
        factory,
    )

    assert getattr(db_settings, factory_name)() is factory.return_value
    url = make_url(factory.call_args.args[0])
    drivers = {
        "mysql": ("mysql+pymysql", "mysql+aiomysql"),
        "postgresql": ("postgresql+pg8000", "postgresql+asyncpg"),
        "sqlite": ("sqlite", "sqlite+aiosqlite"),
    }
    assert url.drivername == drivers[db_settings.DATABASE_TYPE][asynchronous]
    connect_args = factory.call_args.kwargs["connect_args"]
    if db_settings.DATABASE_TYPE == "sqlite":
        assert url.database == db_settings.DB_PATH
        assert connect_args == {"check_same_thread": False, "timeout": 5}
    else:
        reading = factory_name.startswith("get_read")
        assert url.username == ("reader" if reading else "writer")
        assert url.password == ("read-pymysql-pg8000" if reading else "write-pymysql-pg8000")
        if db_settings.DATABASE_TYPE == "mysql":
            assert url.query == {"charset": "utf8mb4"}
        ssl_key = "ssl_context" if db_settings.DATABASE_TYPE == "postgresql" and not asynchronous else "ssl"
        assert connect_args == {ssl_key: context}


def test_explicit_engine_settings_preserve_tls_and_pool_options(monkeypatch):
    db_settings = DatabaseSettings(
        DATABASE_TYPE="postgresql", DB_HOST="localhost", DB_PORT=5432,
        DB_NAME="test_db", READ_DB_USER="reader", READ_DB_PASSWORD="password",
        WRITE_DB_USER="writer", WRITE_DB_PASSWORD="password",
    )
    context = ssl.create_default_context()
    engine_settings = DatabaseEngineSettings.with_custom_ssl(context)
    engine_settings.pool_timeout = 17
    factory = Mock()
    monkeypatch.setattr("utilities.config.create_engine", factory)

    db_settings.get_write_engine(engine_settings)

    assert factory.call_args.kwargs["connect_args"] == {"ssl_context": context}
    assert factory.call_args.kwargs["pool_timeout"] == 17
    assert engine_settings.connect_args.ssl is context


def test_async_sqlite_preserves_engine_options(tmp_path, monkeypatch):
    db_settings = DatabaseSettings(DATABASE_TYPE="sqlite", DB_PATH=str(tmp_path / "test.db"))
    engine_settings = DatabaseEngineSettings(pool_timeout=17, echo=True)
    factory = Mock()
    monkeypatch.setattr("utilities.config.DatabaseSessionManager", factory)

    db_settings.get_write_session(engine_settings)

    assert factory.call_args.kwargs["pool_timeout"] == 17
    assert factory.call_args.kwargs["echo"] is True
    assert factory.call_args.kwargs["connect_args"] == {"check_same_thread": False, "timeout": 5}
