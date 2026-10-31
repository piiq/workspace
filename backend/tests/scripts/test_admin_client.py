"""Administrator requests keep credentials out of debug logs."""

import io
import logging
from pathlib import Path
from runpy import run_path
from unittest.mock import Mock


def test_request_does_not_log_credentials(monkeypatch, caplog):
    module = run_path(str(Path(__file__).resolve().parents[3] / "admin_cli/openbb-admin"))
    urlopen = Mock(return_value=io.BytesIO(b'{"success": true}'))
    monkeypatch.setattr(module["urllib"].request, "urlopen", urlopen)
    client = module["HubAPIClient"]("http://localhost:8080", "admin-session-token")

    with caplog.at_level(logging.DEBUG, logger="openbb-admin"):
        result = client._request("POST", "/admin/users", {"password": "account-password"})

    assert result == {"success": True}
    request = urlopen.call_args.args[0]
    assert request.get_header("Authorization") == "Bearer admin-session-token"
    assert b"account-password" in request.data
    assert "POST http://localhost:8080/admin/users" in caplog.text
    assert "admin-session-token" not in caplog.text
    assert "account-password" not in caplog.text
