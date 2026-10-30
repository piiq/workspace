#!/bin/bash
set -euo pipefail

case "${1:-}" in
  -h|--help)
    echo "Usage: workspace-command COMMAND [ARGUMENTS]"
    echo "Run a backend command with the persisted Workspace secrets."
    exit 0
    ;;
  "") echo "Specify a backend command. Use --help for usage." >&2; exit 2 ;;
esac

# shellcheck source=docker/workspace/environment.sh
source /usr/local/share/workspace/environment.sh
exec workspace-backend "$@"
