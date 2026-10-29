"""Container startup must propagate migration and provisioning failures."""

import os
import subprocess
from pathlib import Path

import pytest

ENTRYPOINT = Path(__file__).resolve().parents[2] / "docker/backend/entrypoint.sh"


@pytest.fixture(autouse=True)
def mock_external_services():
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    yield


@pytest.fixture
def invoke(tmp_path):
    python = tmp_path / "python"
    python.write_text(
        '#!/bin/bash\nset -euo pipefail\nprintf "%s\\n" "$*" >> "$INVOCATION_LOG"\n'
        'if [[ "$*" == "$FAIL_COMMAND" ]]; then exit 23; fi\n'
    )
    python.chmod(0o755)
    log = tmp_path / "calls"

    def run(command, fail_command=""):
        result = subprocess.run(  # noqa: S603
            ["/bin/bash", str(ENTRYPOINT), *command],
            env={
                "PATH": f"{tmp_path}:{os.environ['PATH']}",
                "INVOCATION_LOG": str(log),
                "FAIL_COMMAND": fail_command,
            },
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode, log.read_text().splitlines()

    return run


def test_api_stops_when_migrations_fail(invoke):
    code, calls = invoke(["api"], "-m alembic upgrade head")
    assert code == 23
    assert calls == ["-m alembic upgrade head"]


def test_bootstrap_failure_is_fatal(invoke):
    code, calls = invoke(["bootstrap", "--config-dir", "/config"], "-m scripts.init_users --config-dir /config")
    assert code == 23
    assert calls == ["-m alembic upgrade head", "-m scripts.init_users --config-dir /config"]


def test_api_runs_after_migrations(invoke):
    code, calls = invoke([])
    assert code == 0
    assert calls == ["-m alembic upgrade head", "run.py"]


def test_worker_runs_without_migrations(invoke):
    code, calls = invoke(["worker"])
    assert code == 0
    assert calls == ["base_workers.py"]
