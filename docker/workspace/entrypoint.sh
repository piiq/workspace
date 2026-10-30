#!/bin/bash
set -euo pipefail

case "${1:-start}" in
  -h|--help)
    echo "Usage: workspace [start|credentials|BACKEND_COMMAND [ARGUMENTS]]"
    echo "Start nginx, the API, RQ worker, and Redis; persist accounts and secrets in /data."
    exit 0
    ;;
  start) ;;
  credentials) exec credentials ;;
  *) exec runuser -u appuser -- workspace-command "$@" ;;
esac

mkdir -p /data/storage /data/redis /data/config

python -m scripts.configure_workspace

chown -R appuser:appuser /data
# shellcheck source=docker/workspace/environment.sh
source /usr/local/share/workspace/environment.sh

render-frontend-config.sh
envsubst '${NGINX_PORT} ${BACKEND_UPSTREAM}' < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf
nginx -t

# Server-database migrations use Redis to coordinate migration locks.
/usr/bin/supervisord -c /etc/supervisor/supervisord.conf &
supervisor_pid=$!
trap 'kill -TERM "$supervisor_pid" 2>/dev/null || true; wait "$supervisor_pid" || true' EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
until supervisorctl pid >/dev/null 2>&1; do
  if ! kill -0 "$supervisor_pid" 2>/dev/null; then
    wait "$supervisor_pid"
    exit 1
  fi
  sleep 0.1
done
supervisorctl start redis
runuser -u appuser -- workspace-backend bootstrap --config-dir /data/config
supervisorctl start api worker nginx
echo "Workspace administrator: $OPENBB_ADMIN_EMAIL. Run docker exec <container> credentials to print the password."
wait "$supervisor_pid"
