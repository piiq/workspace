# docker exec commands need the same secrets as the API and worker processes.
if [[ ! -f /data/secrets.env ]]; then
  echo "Missing /data/secrets.env. Start the Workspace container to initialize its configuration." >&2
  exit 1
fi
while IFS='=' read -r key value; do
  if [[ -z "${!key:-}" ]]; then
    export "$key=$value"
  fi
done < /data/secrets.env
