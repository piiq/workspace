"""Run the API and worker from source for browser tests."""

import argparse
import json
import os
import signal
import subprocess  # noqa: S404
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

import jwt

BACKEND_DIR = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog="Requires installed backend dependencies and a running Docker daemon.",
    )
    parser.add_argument(
        "-a",
        "--api-url",
        default=os.environ.get("PLAYWRIGHT_API_URL", "http://127.0.0.1:8000"),
        help="Local API URL (default: PLAYWRIGHT_API_URL or http://127.0.0.1:8000).",
    )
    args: argparse.Namespace = parser.parse_args()
    api = urlparse(args.api_url)
    if api.hostname not in {"localhost", "127.0.0.1"} or api.scheme != "http":
        parser.error("--api-url must be a local HTTP URL; provide deployed servers through Playwright configuration.")

    compose = [
        "docker",
        "compose",
        "-p",
        "workspace-e2e",
        "-f",
        str(BACKEND_DIR.parent / "docker/docker-compose.e2e.yml"),
    ]
    BACKEND_DIR.joinpath(".e2e").mkdir(exist_ok=True)
    processes: list[subprocess.Popen] = []

    def stop(signum: int, frame: object) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    with tempfile.TemporaryDirectory(prefix="source-", dir=BACKEND_DIR / ".e2e") as temporary:
        data = Path(temporary)
        frontend_url = os.environ.get("PLAYWRIGHT_BASE_URL", "http://127.0.0.1:1420")
        env = {
            **os.environ,
            "DATABASE_TYPE": "sqlite",
            "DB_PATH": str(data / "openbb.db"),
            "STORAGE_PROVIDER": "folder",
            "FOLDER_STORAGE_PATH": str(data / "storage"),
            "USER_CREATE_PATH": str(data / "user_create.json"),
            "REDIS_HOST": "127.0.0.1",
            "REDIS_PORT": os.environ.get("PLAYWRIGHT_REDIS_PORT", "16379"),
            "REDIS_USER": "",
            "REDIS_PASS": "",
            "REDIS_CLUSTER_MODE": "false",
            "REDIS_RQ_HASH_TAGS": "false",
            "MODE": "onprem",
            "WORKERS": "1",
            "SELFURL": args.api_url,
            "FRONTENDURL": frontend_url,
            "PROURL": frontend_url,
            "BACKEND_CORS_ORIGINS": json.dumps([frontend_url, "http://localhost:1420", "http://127.0.0.1:1420"]),
            "DISABLE_CORS": "false",
            "HUBSPOT": "false",
            "PROMETHEUS": "false",
            "MAILCHIMP_MARKETING": "",
            "MAILCHIMP_TRANSACTIONAL": "",
            "OPENBB_GEO_KEY": "",
            "OPENBB_AES_KEY": "0123456789abcdef0123456789abcdef",
            "JWT_SECRET": "workspace-local-browser-tests-secret",
            "LOCAL_STORAGE_SECRET_KEY": "workspace-local-browser-tests-secret",
            "DISABLE_REGISTRATION": "false",
            "OPENBB_AUTH_TOKEN": jwt.encode({"sub": "openbb"}, "workspace-local-browser-tests-secret", algorithm="HS256"),
            "LITE_LAMBDA_FUNCTION_NAME": "",
            "SUPPRESSED_API_ROUTERS": "[]",
            "SUPPRESSED_API_ROUTES": "[]",
        }
        email = "admin@openbb.co"
        password = "asdQWE123!"  # noqa: S105
        (data / "account.toml").write_text(
            '[entity]\nname = "Browser Tests"\nseats = 100\naum = 1000\n'
            'company_type = "CORPORATION"\norganization_size = "SMALL"\ncountry = "DOM"\n'
            f'\n[[admins]]\nemail = {json.dumps(email)}\nfirst_name = "Browser"\n'
            f'last_name = "Admin"\npassword = {json.dumps(password)}\n',
        )
        try:
            subprocess.run(  # noqa: S603
                [*compose, "up", "-d", "--wait"], env=env, check=True
            )
            subprocess.run(  # noqa: S603
                [sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND_DIR, env=env, check=True
            )
            subprocess.run(  # noqa: S603
                [sys.executable, "-m", "scripts.init_users", "--config-dir", str(data)],
                cwd=BACKEND_DIR,
                env=env,
                check=True,
            )
            for command in (
                [sys.executable, "-m", "uvicorn", "main:app", "--host", api.hostname, "--port", str(api.port or 8000)],
                [sys.executable, "base_workers.py"],
            ):
                processes.append(subprocess.Popen(command, cwd=BACKEND_DIR, env=env))  # noqa: S603
            while all(process.poll() is None for process in processes):
                time.sleep(0.5)
            raise RuntimeError("API or worker exited; inspect its output above.")
        except KeyboardInterrupt:
            pass
        finally:
            for process in processes:
                if process.poll() is None:
                    process.terminate()
            for process in processes:
                process.wait()
            subprocess.run(  # noqa: S603
                [*compose, "down"], env=env, check=True
            )


if __name__ == "__main__":
    main()
