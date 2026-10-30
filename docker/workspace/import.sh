#!/bin/bash
set -euo pipefail

case "${1:-}" in
  -h|--help)
    echo "Usage: openbb-import ARCHIVE.zip [--force] [--describe-scope]"
    echo "Mount the archive directory into the container and pass its container path."
    exit 0
    ;;
esac

exec runuser -u appuser -- workspace-command python -m scripts.import_user_data "$@"
