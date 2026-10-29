#!/bin/bash
set -euo pipefail

if [[ $# -eq 0 ]]; then set -- api; fi

if [[ -n "${JWT_SECRET:-}" && -z "${OPENBB_AUTH_TOKEN:-}" ]]; then
  OPENBB_AUTH_TOKEN="$(python - <<'PY'
import os
import jwt
print(jwt.encode({"sub": "openbb"}, os.environ["JWT_SECRET"], algorithm="HS256"))
PY
)"
  export OPENBB_AUTH_TOKEN
fi

case "${1:-api}" in
  -h|--help)
    cat <<'EOF'
Usage: workspace-backend [COMMAND] [ARGUMENTS]

  api        Apply migrations and run the API (default).
  worker     Run the RQ worker and scheduler.
  migrate    Run Alembic; defaults to upgrade head.
  bootstrap  Apply migrations and provision accounts with scripts.init_users.
  -h, --help Show this help.

Other commands execute directly, including openbb-admin and python.
EOF
    ;;
  api)
    shift
    python -m alembic upgrade head
    exec python run.py "$@"
    ;;
  worker)
    shift
    exec python base_workers.py "$@"
    ;;
  migrate)
    shift
    if [[ $# -eq 0 ]]; then set -- upgrade head; fi
    exec python -m alembic "$@"
    ;;
  bootstrap)
    shift
    python -m alembic upgrade head
    exec python -m scripts.init_users "$@"
    ;;
  *) exec "$@" ;;
esac
