"""Combined deployments preserve secrets and use explicit administrator settings."""

import string
import tomllib

import pytest

from scripts.configure_workspace import configure_workspace


@pytest.fixture
def clean_environment(monkeypatch):
    for key in (
        "JWT_SECRET", "OPENBB_AES_KEY", "LOCAL_STORAGE_SECRET_KEY", "OPENBB_ADMIN_EMAIL", "OPENBB_ADMIN_PASSWORD",
    ):
        monkeypatch.delenv(key, raising=False)


def test_configuration_survives_recreation(tmp_path, clean_environment):
    configure_workspace(tmp_path)
    original = (tmp_path / "secrets.env").read_text()
    configure_workspace(tmp_path)
    assert (tmp_path / "secrets.env").read_text() == original
    values = dict(line.split("=", 1) for line in original.splitlines())
    config = tomllib.loads((tmp_path / "config/account.toml").read_text())
    assert config["admins"][0]["password"] == values["OPENBB_ADMIN_PASSWORD"]
    assert config["admins"][0]["email"] == "admin@openbb.co"
    assert len(values["OPENBB_AES_KEY"]) == 32
    for group in (string.ascii_lowercase, string.ascii_uppercase, string.digits, "!@#$%&*+?"):
        assert any(char in group for char in values["OPENBB_ADMIN_PASSWORD"])
    assert (tmp_path / "secrets.env").stat().st_mode & 0o777 == 0o600
    assert (tmp_path / "config/account.toml").stat().st_mode & 0o777 == 0o600


def test_environment_overrides_persisted_credentials(tmp_path, clean_environment, monkeypatch):
    configure_workspace(tmp_path)
    monkeypatch.setenv("OPENBB_ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setenv("OPENBB_ADMIN_PASSWORD", 'Workspace"Test123!')
    monkeypatch.setenv("JWT_SECRET", "deployment-secret")
    configure_workspace(tmp_path)
    config = tomllib.loads((tmp_path / "config/account.toml").read_text())
    assert config["admins"][0]["email"] == "admin@example.com"
    assert config["admins"][0]["password"] == 'Workspace"Test123!'
    assert "JWT_SECRET=deployment-secret\n" in (tmp_path / "secrets.env").read_text()
