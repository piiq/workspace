"""Check loaded Workspace images through combined and separate deployments."""

import json
import os
import secrets
import socket
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[2]
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "ImageAdmin123!"
MEMBER_EMAIL = "playwright@example.com"
MEMBER_PASSWORD = "WorkspaceTest123!"


def request(
    origin: str,
    path: str,
    data: dict | None = None,
    *,
    token: str = "",
    method: str = "GET",
):
    headers = {"Content-Type": "application/json", "Origin": origin}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        origin + "/api" + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


@pytest.mark.parametrize("layout", ["combined", "separate"])
def test_images(layout: str) -> None:
    tag = os.environ.get("WORKSPACE_IMAGE_TAG", "dev")
    platform = (
        os.environ.get("WORKSPACE_IMAGE_PLATFORM")
        or subprocess.check_output(
            ["docker", "version", "--format", "{{.Server.Os}}/{{.Server.Arch}}"],
            text=True,
        ).strip()
    )
    with tempfile.TemporaryDirectory(prefix=f"workspace-images-{layout}-") as directory:
        temporary = Path(directory)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        origin = f"http://127.0.0.1:{port}"
        project = f"workspace-images-{layout}-{uuid4().hex[:8]}"
        config = temporary / "config"
        config.mkdir()
        (config / "account.toml").write_text(f"""[entity]
name = "Image Checks"
aum = 1000
company_type = "CORPORATION"
organization_size = "SMALL"
country = "DOM"

[[admins]]
email = "{ADMIN_EMAIL}"
first_name = "Image"
last_name = "Admin"
password = "{ADMIN_PASSWORD}"
""")
        environment = {
            "WORKSPACE_PORT": str(port),
            "WORKSPACE_CONFIG_DIR": str(config),
            "BACKEND_ENV_FILE": str(temporary / "backend.env"),
            "WORKSPACE_IMAGE": f"workspace:{tag}",
            "FRONTEND_IMAGE": f"workspace-frontend:{tag}",
            "BACKEND_IMAGE": f"workspace-backend:{tag}",
            "MODE": "onprem",
            "DATABASE_TYPE": "mysql",
            "DB_HOST": "mysql",
            "DB_PORT": "3306",
            "DB_NAME": "workspace",
            "READ_DB_USER": "root",
            "READ_DB_PASSWORD": secrets.token_hex(16),
            "WRITE_DB_USER": "root",
            "REDIS_HOST": "redis",
            "REDIS_PORT": "6379",
            "REDIS_PASS": "",
            "JWT_SECRET": secrets.token_hex(48),
            "OPENBB_AES_KEY": secrets.token_hex(16),
            "LOCAL_STORAGE_SECRET_KEY": secrets.token_hex(32),
            "SELFURL": origin + "/api",
            "FRONTENDURL": origin,
            "PROURL": origin,
            "STORAGE_PROVIDER": "folder",
            "FOLDER_STORAGE_PATH": "/data/storage",
            "EMAIL_PROVIDER": "none",
            "HUBSPOT": "false",
            "PROMETHEUS": "false",
            "WORKERS": "1",
            "DISABLE_REGISTRATION": "true",
            "RUNTIME_PLUGINS_ENABLED": "false",
            "MCP_DEFAULT_SERVER_ENABLED": "false",
        }
        environment["WRITE_DB_PASSWORD"] = environment["READ_DB_PASSWORD"]
        (temporary / "backend.env").write_text(
            "".join(f"{key}={value}\n" for key, value in environment.items())
        )
        combined = layout == "combined"
        application_service = "workspace" if combined else "backend"
        image_services = (
            ["workspace"]
            if combined
            else ["bootstrap", "backend", "worker", "frontend"]
        )
        services = {
            name: {"platform": platform, "pull_policy": "never"}
            for name in image_services
        }
        if combined:
            services["workspace"]["environment"] = {
                "SELFURL": origin + "/api",
                "FRONTENDURL": origin,
                "PROURL": origin,
                "OPENBB_ADMIN_EMAIL": ADMIN_EMAIL,
                "OPENBB_ADMIN_PASSWORD": ADMIN_PASSWORD,
                "MCP_DEFAULT_SERVER_ENABLED": "false",
            }
        else:
            services["frontend"]["environment"] = {
                "MCP_DEFAULT_SERVER_ENABLED": "false"
            }
        override = temporary / "override.json"
        override.write_text(json.dumps({"services": services}))
        compose_file = (
            "docker-compose.workspace.yml" if combined else "docker-compose.yml"
        )
        compose = [
            "docker",
            "compose",
            "--project-name",
            project,
            "--env-file",
            str(temporary / "backend.env"),
            "--file",
            str(ROOT / "docker" / compose_file),
            "--file",
            str(override),
        ]
        process_env = {**os.environ, **environment}

        def run(*arguments: str, capture: bool = False) -> str:
            result = subprocess.run(
                [*compose, *arguments],
                env=process_env,
                check=True,
                text=True,
                stdout=subprocess.PIPE if capture else None,
            )
            return result.stdout or ""

        command = "workspace-command" if combined else "workspace-backend"

        def execute(*arguments: str) -> str:
            return run(
                "exec",
                "-T",
                "--user",
                "appuser",
                "-e",
                "OPENBB_CONFIG_FILE=/data/image-check-cli.json",
                application_service,
                command,
                *arguments,
                capture=True,
            )

        def cli(*arguments: str):
            return json.loads(execute("openbb-admin", *arguments, "--json"))

        def login():
            return request(
                origin,
                "/pro/login",
                {
                    "email": MEMBER_EMAIL,
                    "password": MEMBER_PASSWORD,
                    "source": "pro",
                    "remember": False,
                },
                method="POST",
            )["access_token"]

        try:
            print(f"Checking {layout} deployment for {platform}", flush=True)
            run("up", "--no-build", "--detach", "--wait", "--wait-timeout", "300")
            with urllib.request.urlopen(origin + "/config.js", timeout=15) as response:
                if 'backend: "/api"' not in response.read().decode():
                    raise RuntimeError(
                        "The frontend runtime configuration must use /api"
                    )
            cli(
                "auth",
                "login",
                "--api-url",
                "http://127.0.0.1:8000",
                "--email",
                ADMIN_EMAIL,
                "--password",
                ADMIN_PASSWORD,
            )
            entity = next(
                entity
                for entity in cli("entity", "list")["items"]
                if entity["name"] == ("Workspace" if combined else "Image Checks")
            )
            member = cli(
                "user",
                "create",
                entity["uuid"],
                "--email",
                MEMBER_EMAIL,
                "--first-name",
                "Image",
                "--last-name",
                "Tester",
                "--role",
                "user",
            )
            session = request(
                origin,
                "/pro/login",
                {
                    "email": MEMBER_EMAIL,
                    "password": member["temporary_password"],
                    "source": "pro",
                    "remember": False,
                },
                method="POST",
            )
            request(
                origin,
                "/user",
                {
                    "old_password": member["temporary_password"],
                    "new_password": MEMBER_PASSWORD,
                },
                token=session["access_token"],
                method="PUT",
            )
            request(origin, "/pro/validate", token=login())
            artifacts = (
                ROOT / ".build" / "image-checks" / platform.split("/")[1] / layout
            )
            subprocess.run(
                [
                    "bun",
                    "run",
                    "playwright",
                    "test",
                    "tests/e2e/auth.spec.ts",
                    "tests/e2e/data-conectors.spec.ts",
                    "tests/e2e/dashboards.spec.ts",
                    "--output",
                    str(artifacts / "test-results"),
                ],
                cwd=ROOT / "frontend",
                check=True,
                env={
                    **os.environ,
                    "PLAYWRIGHT_BASE_URL": origin,
                    "PLAYWRIGHT_API_URL": origin + "/api",
                    "PLAYWRIGHT_EMAIL": MEMBER_EMAIL,
                    "PLAYWRIGHT_PASSWORD": MEMBER_PASSWORD,
                    "PLAYWRIGHT_HOSTED_TESTS": "false",
                    "PLAYWRIGHT_ALLOW_REGISTRATION": "false",
                    "PLAYWRIGHT_ALLOW_FORGOT_PASSWORD": "false",
                    "PLAYWRIGHT_IDENTITY_PROVIDERS": "",
                    "PLAYWRIGHT_HTML_OUTPUT_DIR": str(artifacts / "playwright-report"),
                },
            )
            execute(
                "python",
                "-c",
                """import time
from rq import Queue
from utilities.config import settings
job = Queue('payments_queue', connection=settings.get_redis_session('bot')).enqueue('builtins.sum', [1, 2, 3])
deadline = time.monotonic() + 60
while time.monotonic() < deadline:
    status = job.get_status(refresh=True)
    if status == 'finished':
        if job.return_value() != 6:
            raise SystemExit('Worker returned an incorrect result')
        print('Worker executed the queued job')
        break
    if status == 'failed':
        raise SystemExit('Worker job failed: ' + str(job.exc_info))
    time.sleep(0.2)
else:
    raise SystemExit('Worker did not finish the queued job within 60 seconds')
""",
            )
            if combined:
                status = run(
                    "exec", "-T", "workspace", "supervisorctl", "status", capture=True
                )
                if len(status.splitlines()) != 4 or any(
                    "RUNNING" not in line for line in status.splitlines()
                ):
                    raise RuntimeError(f"Combined services are not running:\n{status}")
                snapshot_code = """import hashlib, json, pathlib, sqlite3
db = sqlite3.connect('/data/openbb.db')
tables = {name: db.execute('SELECT count(*) FROM ' + name).fetchone()[0] for name in ('user', 'dashboard_item', 'stored_file')}
files = {str(path.relative_to('/data/storage')): hashlib.sha256(path.read_bytes()).hexdigest() for path in pathlib.Path('/data/storage').rglob('*') if path.is_file()}
print(json.dumps({'tables': tables, 'files': files, 'secrets': hashlib.sha256(pathlib.Path('/data/secrets.env').read_bytes()).hexdigest()}, sort_keys=True))
"""
                before = json.loads(execute("python", "-c", snapshot_code))
                if not before["files"] or not before["tables"]["dashboard_item"]:
                    raise RuntimeError(
                        "Browser checks did not persist dashboards and uploaded files"
                    )
                run(
                    "up",
                    "--no-build",
                    "--detach",
                    "--force-recreate",
                    "--wait",
                    "--wait-timeout",
                    "300",
                    "--timeout",
                    "15",
                )
                after = json.loads(execute("python", "-c", snapshot_code))
                if before != after:
                    raise RuntimeError(
                        "Container recreation changed persisted accounts, dashboards, files, or secrets"
                    )
                request(origin, "/pro/validate", token=login())
            print(f"{layout} deployment checks passed", flush=True)
        except BaseException:
            subprocess.run(
                [*compose, "logs", "--no-color", "--tail", "100"],
                env=process_env,
                check=False,
            )
            raise
        finally:
            # The project and volumes belong to this invocation, including failed startup.
            run("down", "--volumes", "--remove-orphans", "--timeout", "15")
