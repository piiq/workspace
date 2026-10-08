import json
from contextlib import asynccontextmanager
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient, Response


@asynccontextmanager
async def mcp_client():
    from routers.pro.workspace_mcp.asgi import create_workspace_mcp_asgi_app

    mcp_app = create_workspace_mcp_asgi_app()
    async with (
        mcp_app.lifespan(mcp_app),
        AsyncClient(
            transport=ASGITransport(app=mcp_app),
            base_url="http://test",
            headers={"Accept": "application/json, text/event-stream"},
        ) as async_client,
    ):
        yield async_client


def mcp_response(response: Response) -> dict:
    # Streamable HTTP carries MCP results and errors in SSE messages with HTTP 200.
    assert response.status_code == 200
    return json.loads(next(line[6:] for line in response.iter_lines() if line.startswith("data: ")))


def test_workspace_mcp_token_helpers_generate_hash_and_prefix():
    from routers.pro.workspace_mcp.auth import (
        WORKSPACE_MCP_TOKEN_PREFIX,
        display_token_prefix,
        generate_workspace_mcp_token,
        hash_workspace_mcp_token,
    )

    token = generate_workspace_mcp_token()
    other_token = generate_workspace_mcp_token()

    assert token.startswith(WORKSPACE_MCP_TOKEN_PREFIX)
    assert other_token.startswith(WORKSPACE_MCP_TOKEN_PREFIX)
    assert token != other_token
    assert len(token.removeprefix(WORKSPACE_MCP_TOKEN_PREFIX)) >= 43
    assert hash_workspace_mcp_token(token) == hash_workspace_mcp_token(token)
    assert hash_workspace_mcp_token(token) != token
    assert display_token_prefix(token) == token[:20]


def test_workspace_mcp_auth_failure_does_not_advertise_oauth():
    from routers.pro.workspace_mcp.auth import workspace_mcp_credentials_exception

    assert "WWW-Authenticate" not in (workspace_mcp_credentials_exception.headers or {})


@pytest.mark.asyncio
async def test_mcp_endpoint_rejects_missing_and_malformed_auth(client):
    async with mcp_client() as mcp:
        missing = await mcp.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        malformed = await mcp.post(
            "/mcp",
            headers={"Authorization": "Basic abc"},
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        )
        unknown = await mcp.post(
            "/mcp",
            headers={"Authorization": "Bearer obb_mcp_unknown"},
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        )

        for response in (missing, malformed, unknown):
            payload = mcp_response(response)
            assert "result" not in payload
            assert "401" in payload["error"]["message"]
            assert "Could not validate Workspace MCP credentials" in payload["error"]["message"]


@pytest.mark.asyncio
async def test_mcp_get_is_not_registered_as_one_shot_transport(client):
    response = await client.get("/mcp")

    assert response.status_code == 405


@pytest.mark.asyncio
async def test_unknown_path_returns_404_not_credential_error(client):
    response = await client.post(
        "/pro/adfasdfasfd",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )

    assert response.status_code == 404
    assert "Could not validate Workspace MCP credentials" not in response.text


@pytest.mark.asyncio
async def test_mcp_endpoint_rejects_revoked_token(auth_client, client):
    async with mcp_client() as mcp:
        create_response = await auth_client.post(
            "/pro/workspace-mcp/tokens",
            json={"name": "Revoked token"},
        )
        token = create_response.json()["token"]
        token_uuid = create_response.json()["uuid"]

        await auth_client.delete(f"/pro/workspace-mcp/tokens/{token_uuid}")

        response = await mcp.post(
            "/mcp",
            headers={"Authorization": f"Bearer {token}"},
            json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        )

        payload = mcp_response(response)
        assert "result" not in payload
        assert "401" in payload["error"]["message"]
        assert "Could not validate Workspace MCP credentials" in payload["error"]["message"]


@pytest.mark.asyncio
async def test_mcp_tool_call_with_valid_token_returns_no_browser_connected(auth_client, client):
    async with mcp_client() as mcp:
        create_response = await auth_client.post(
            "/pro/workspace-mcp/tokens",
            json={"name": "Agent"},
        )
        payload = create_response.json()

        assert UUID(payload["uuid"])

        response = await mcp.post(
            "/mcp",
            headers={"Authorization": f"Bearer {payload['token']}"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {"name": "get_workspace_snapshot", "arguments": {}},
            },
        )

        payload = mcp_response(response)
        assert "error" not in payload
        result = payload["result"]["structuredContent"]
        assert result["ok"] is False
        assert result["error"]["code"] == "unavailable"
