"""Deployment URLs determine browser access without trusting hosted installations."""

import pytest
from fastapi import Depends, FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.testclient import TestClient

from api import auth_helpers
from api.auth_helpers import openbb_oauth2_scheme
from api.rate_limit import exempt_openbb_ai
from utilities.config import Settings, settings
from workspace_mcp.app import create_app
from workspace_mcp.config import Settings as SidecarSettings


@pytest.fixture(autouse=True)
def mock_external_services():
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    yield


@pytest.fixture
def configuration(monkeypatch):
    for name in ("BACKEND_CORS_ORIGINS", "FRONTENDURL", "PROURL", "SPECIAL_EMAILS"):
        monkeypatch.delenv(name, raising=False)
    return settings.model_dump(exclude={"BACKEND_CORS_ORIGINS", "FRONTENDURL", "PROURL", "SPECIAL_EMAILS"})


def test_combined_deployment_defaults(configuration):
    deployment = Settings(_env_file=None, **configuration, PROURL="http://localhost:8080")
    assert deployment.FRONTENDURL == "http://localhost:8080"
    assert deployment.BACKEND_CORS_ORIGINS == ["http://localhost:8080"]
    assert not deployment.SPECIAL_EMAILS


def test_origins_use_configured_urls_without_paths(configuration):
    deployment = Settings(
        _env_file=None,
        **configuration,
        PROURL="https://workspace.example.com/app/",
        FRONTENDURL="https://accounts.example.com/",
    )
    assert deployment.BACKEND_CORS_ORIGINS == ["https://workspace.example.com", "https://accounts.example.com"]


@pytest.mark.parametrize(
    "origins",
    [
        ["https://custom.example.com"],
        '["https://custom.example.com"]',
        "https://custom.example.com",
        [],
        "[]",
    ],
)
def test_explicit_allowlist_replaces_deployment_origins(configuration, origins):
    deployment = Settings(
        _env_file=None,
        **configuration,
        PROURL="http://localhost:8080",
        BACKEND_CORS_ORIGINS=origins,
    )
    expected = [] if origins in ([], "[]") else ["https://custom.example.com"]
    assert expected == deployment.BACKEND_CORS_ORIGINS


def test_environment_can_override_origins(configuration, monkeypatch):
    monkeypatch.setenv("BACKEND_CORS_ORIGINS", '["https://configured.example.com"]')
    deployment = Settings(_env_file=None, **configuration, PROURL="http://localhost:8080")
    assert deployment.BACKEND_CORS_ORIGINS == ["https://configured.example.com"]


def test_authenticated_routes_and_preflight_share_deployment_origins(configuration, monkeypatch):
    deployment = Settings(_env_file=None, **configuration, PROURL="http://localhost:8080")
    monkeypatch.setattr(settings, "BACKEND_CORS_ORIGINS", deployment.BACKEND_CORS_ORIGINS)
    monkeypatch.setattr(settings, "DISABLE_CORS", False)
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=deployment.BACKEND_CORS_ORIGINS, allow_methods=["GET"])

    @app.get("/protected", dependencies=[Depends(openbb_oauth2_scheme)])
    async def protected():
        return {"ok": True}

    client = TestClient(app)
    origin = "http://localhost:8080"
    response = client.get("/protected", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert (
        client.options(
            "/protected",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        ).status_code
        == 200
    )

    for origin in ("https://pro.openbb.co", "https://bofa.openbb.dev", "https://unknown.example.com"):
        response = client.get("/protected", headers={"Origin": origin})
        assert response.status_code == 401
        assert "access-control-allow-origin" not in response.headers
        assert (
            client.options(
                "/protected",
                headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
            ).status_code
            == 400
        )


@pytest.mark.parametrize(
    ("origins", "origin", "allowed"),
    [
        ((), "http://localhost:8080", True),
        ((), "http://127.0.0.1:1420", True),
        ((), "https://pro.openbb.co", False),
        (("https://workspace.example.com",), "https://workspace.example.com", True),
        (("https://workspace.example.com",), "http://localhost:8080", False),
    ],
)
def test_sidecar_allows_loopback_or_explicit_origins(origins, origin, allowed):
    app = create_app(SidecarSettings(cors_allow_origins=origins))
    response = TestClient(app).options(
        "/bridge/session/start",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == (200 if allowed else 400)
    assert response.headers.get("access-control-allow-origin") == (origin if allowed else None)


@pytest.mark.parametrize(
    ("mode", "valid_token", "expected"),
    [
        ("local", True, True),
        ("local", False, False),
        ("onprem", True, False),
        ("production", True, False),
    ],
)
def test_service_rate_limit_exemption_uses_mode(mode, valid_token, expected, monkeypatch):
    monkeypatch.setattr(settings, "MODE", mode)
    token = auth_helpers.create_jwt({"sub": "copilot"}) if valid_token else "invalid"
    request = Request(
        {
            "type": "http",
            "headers": [(b"x-openbb-authorization", f"Bearer {token}".encode())],
        }
    )
    assert exempt_openbb_ai(request) is expected
