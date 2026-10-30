"""Persist secrets and provisioning configuration for the combined container."""

import argparse
import json
import os
import secrets
import string
from pathlib import Path


def configure_workspace(data_dir: Path) -> None:
    path = data_dir / "secrets.env"
    saved = dict(line.split("=", 1) for line in path.read_text().splitlines()) if path.exists() else {}
    groups = (string.ascii_lowercase, string.ascii_uppercase, string.digits, "!@#$%&*+?")
    characters = [secrets.choice(group) for group in groups]
    characters.extend(secrets.choice("".join(groups)) for _ in range(16))
    secrets.SystemRandom().shuffle(characters)
    defaults = {
        "JWT_SECRET": secrets.token_hex(48),
        "OPENBB_AES_KEY": secrets.token_hex(16),
        "LOCAL_STORAGE_SECRET_KEY": secrets.token_urlsafe(32),
        "OPENBB_ADMIN_EMAIL": "admin@openbb.co",
        "OPENBB_ADMIN_PASSWORD": "".join(characters),
    }
    values = {key: os.environ.get(key) or saved.get(key) or value for key, value in defaults.items()}
    data_dir.mkdir(parents=True, exist_ok=True)
    path.touch(mode=0o600)
    path.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
    config = data_dir / "config" / "account.toml"
    config.parent.mkdir(exist_ok=True)
    config.touch(mode=0o600)
    config.write_text(f"""[entity]
name = "Workspace"
aum = 1000
company_type = "CORPORATION"
organization_size = "SMALL"
country = "DOM"

[[admins]]
email = {json.dumps(values["OPENBB_ADMIN_EMAIL"])}
first_name = "Workspace"
last_name = "Admin"
password = {json.dumps(values["OPENBB_ADMIN_PASSWORD"])}
""")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog="Environment variables override persisted values; missing secrets are generated.",
    )
    parser.add_argument("-d", "--data-dir", type=Path, default=Path("/data"), help="Persistent data directory.")
    args: argparse.Namespace = parser.parse_args()
    configure_workspace(args.data_dir)
