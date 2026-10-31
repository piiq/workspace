# Advanced Workspace deployment

Start with [installation from source](../docs/install-from-source.md) for a local installation. This guide covers image builds, deployment settings, plugins, separate services, and administration. Run commands from the repository root. All three images use `docker/Dockerfile` and the repository root as the build context.

## Build

Run the build script from your checkout:

```sh
./scripts/build-images.sh
```

It requires Docker with Buildx and loads these images into the local Docker engine:

- `workspace:dev`
- `workspace-frontend:dev`
- `workspace-backend:dev`

The script builds from the current checkout, including prepared plugins. It uses Docker's platform by default. Choose another platform and local tag with:

```sh
./scripts/build-images.sh --platform linux/amd64 --tag dev-amd64
```

This produces the same three local image names with `:dev-amd64` tags. A tag identifies an image version; it does not choose a registry. The build script leaves the images local. Publication is a separate operation described below. See `./scripts/build-images.sh --help` for usage.

Local builds reuse Docker's build cache automatically. CI restores saved build layers into a directory and sets `BUILD_CACHE_FROM` to read them through Docker's `--cache-from` option. `BUILD_CACHE_TO` supplies Docker's `--cache-to` option to save layers for subsequent runs. The workflow provides these environment variables.

Prepare build-time plugins with [the plugin preparation command](../docs/plugins.md#including-plugins-in-a-frontend-build) before building. Compiled output under `.build/plugins/` is included without copying plugin repositories into the image. A checkout without prepared output builds with no optional plugins.

To build an individual target directly:

```sh
docker buildx build --load -f docker/Dockerfile --target frontend -t workspace-frontend:dev .
docker buildx build --load -f docker/Dockerfile --target backend -t workspace-backend:dev .
docker buildx build --load -f docker/Dockerfile --target workspace -t workspace:dev .
```

## Test images

The image integration tests are [pytest tests under `docker/tests/`](tests/). Use the activated backend environment with its development dependencies, plus the frontend and SDK dependencies and Chromium from [the browser test guide](../frontend/tests/e2e/README.md#run-from-source). From the repository root, test the default `:dev` images:

```sh
pytest docker/tests -v
```

For images built with a different tag or platform:

```sh
WORKSPACE_IMAGE_TAG=dev-amd64 WORKSPACE_IMAGE_PLATFORM=linux/amd64 pytest docker/tests -v
```

The tests run the existing login, upload/export, and dashboard browser scenarios against isolated combined and separate deployments, check worker execution, and check combined-container persistence across recreation. They use loaded images without building or pushing. Test projects and volumes are removed afterward; reports and traces remain under ignored `.build/image-checks/<architecture>/`. Building and testing another architecture locally requires Docker support for running it.

## Image publication

The [Workspace Images workflow](../.github/workflows/workspace-images.yml) runs on pushes to `main` affecting application images or their checks. It does not build application images on pull requests. A manual run defaults to `publish: false`; enabling `publish` also permits optional comma-separated `release_tags`, such as `v1.0.0,stable`.

Each architecture has a native Ubuntu runner. Both build local images with `scripts/build-images.sh`, sharing Buildx cache across the three targets and restoring a build cache per architecture. The workflow builds without optional plugins or subscription credentials. Each job runs `pytest docker/tests` against the loaded images, once per layout, without repeating the full application test suite. Tests must pass before the workflow tags and pushes those images to GHCR.

For this repository, publication uses these names:

| Image | Contents |
| --- | --- |
| `ghcr.io/piiq/workspace` | Combined application |
| `ghcr.io/piiq/workspace-frontend` | Frontend and nginx |
| `ghcr.io/piiq/workspace-backend` | API, worker, migrations, and admin CLI |

Forks use their own lowercase `owner/repository` as the combined image name, with `-frontend` and `-backend` suffixes for the other targets.

When publishing is enabled, each runner pushes its verified local images as `sha-<full-commit>-amd64` or `sha-<full-commit>-arm64`. After both runners succeed, the publication job joins those images into multi-platform `sha-<full-commit>`, `latest`, and requested release tags. It uses `docker buildx imagetools create` without rebuilding or repeating deployment checks. A failed architecture prevents multi-platform publication. A non-publishing run stops after verification and does not push images.

The workflow authenticates with `GITHUB_TOKEN` and `packages: write`; no registry secret is required. GitHub creates container packages with private visibility. After the first publication, the repository owner must set each of the three packages to Public in its package settings to allow anonymous pulls. See [GitHub's container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

The publication job uses [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations) to sign provenance for each final multi-platform image digest and store it in GitHub and GHCR. Its `id-token: write` and `attestations: write` permissions allow signing and attestation storage. Verify a published image with the GitHub CLI:

```sh
gh attestation verify oci://ghcr.io/piiq/workspace:latest \
  --repo piiq/workspace \
  --signer-workflow piiq/workspace/.github/workflows/workspace-images.yml
```

Use `workspace-frontend` or `workspace-backend` to verify the separate images. Attestations identify the source revision and publishing workflow for the image digest.

After building and testing the default `:dev` images, you can publish the combined image manually using Docker commands. Replace `your-account` with a registry account you control:

```sh
docker login ghcr.io
docker tag workspace:dev ghcr.io/your-account/workspace:my-build
docker push ghcr.io/your-account/workspace:my-build
```

The full destination is `ghcr.io/your-account/workspace:my-build`: `ghcr.io` is the registry, `your-account/workspace` is the repository, and `my-build` is the tag. This example pushes one architecture. The workflow assembles the multi-platform images. Authenticate with credentials that can write the destination package. Use a commit tag for a deployment tied to a specific revision; `latest` and release tags can be reassigned.

## Repository security

[Dependabot configuration](../.github/dependabot.yml) schedules weekly updates for Python, JavaScript, GitHub Actions, Docker base images, and Compose image references, with one open version-update pull request per ecosystem. Dependabot alerts and security updates, secret scanning, and push protection are configured in the repository's GitHub security settings. Fork owners enable these settings for their repositories.

The [CodeQL workflow](../.github/workflows/codeql.yml) scans Python, JavaScript/TypeScript, and GitHub Actions on main pushes, pull requests, manual runs, and a weekly schedule. Use advanced setup in GitHub's security settings for this workflow. Python and JavaScript scans include CodeQL's inline suppression queries. Put a rule-specific comment immediately before the flagged expression, such as `# codeql[py/clear-text-storage-sensitive-data] Credentials belong to this temporary test deployment.` Use `// codeql[js/rule-id] Reason` in JavaScript or TypeScript. The workflow removes results marked by those comments before uploading SARIF; the rule remains active elsewhere. Include the reason in each comment.

The [Dependabot PR Descriptions workflow](../.github/workflows/dependabot-pr-descriptions.yml) keeps dependency summaries and removes generated changelog HTML, badges, and bot instructions so descriptions can be used as squash commit messages. It processes Dependabot-authored PRs when Dependabot opens or updates them. Run it manually to format existing open Dependabot PRs. Its formatting job reads and edits PR metadata with `pull-requests: write`. The repository's Actions event policy must allow `pull_request_target` for this workflow.

Dependabot alerts depend on GitHub's dependency graph. Check Insights > Dependency graph for recognized manifests and resolved dependencies. Bun and uv update support does not establish complete transitive alert coverage. Docker and Compose updates cover image references. Operating-system packages installed inside images require separate vulnerability assessment. See [GitHub's supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) and [dependency graph coverage](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems).

## Backend commands

The backend includes the API, RQ worker, migrations, provisioning scripts, and `openbb-admin`. Its commands are:

| Command | Behavior |
| --- | --- |
| `api` | Apply migrations and run the Gunicorn API using `PORT` and `WORKERS`. |
| `worker` | Run the RQ worker with its scheduler. |
| `migrate [arguments]` | Run Alembic; no arguments means `upgrade head`. |
| `bootstrap [arguments]` | Apply migrations, then run `scripts.init_users` with the supplied arguments. |
| `openbb-admin [arguments]` | Run the admin CLI. |

`api` is the image's default command. Migration and bootstrap failures exit with an error. The worker uses the same image and backend settings as the API. Compose supplies an init process to forward signals and reap worker children. `workspace-backend --help` lists the commands.

## Combined deployment

The `workspace` target runs nginx, the API, an RQ worker, and Redis in one container. It uses the same application and runtime settings as the separate images. Start it with:

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml up --build -d --wait
docker compose -p workspace -f docker/docker-compose.workspace.yml exec workspace credentials
```

Open `http://localhost:8080` and sign in with the printed credentials. To use Docker directly:

```sh
docker run -d --name workspace -p 8080:80 -v workspace-data:/data workspace:dev
docker exec workspace credentials
```

The image defaults to SQLite at `/data/openbb.db`, file storage at `/data/storage`, and Redis on `127.0.0.1:6379`. Redis state, bootstrap output, provisioning configuration, and secrets also persist under `/data`. Keep the volume when recreating the container. `docker compose down` keeps it; `down -v` deletes it.

Startup generates missing `JWT_SECRET`, `OPENBB_AES_KEY`, `LOCAL_STORAGE_SECRET_KEY`, and administrator credentials, and saves them in `/data/secrets.env`. Set `OPENBB_ADMIN_EMAIL` and `OPENBB_ADMIN_PASSWORD` to choose the administrator login. Explicit environment values override saved values; values absent from the environment survive container recreation. Provisioning runs on every start and sets the administrator password to the configured value. Redis starts before migrations so server databases can acquire their migration lock. A migration or provisioning failure stops startup before the API, worker, and nginx start.

Pass backend and frontend environment variables through `docker run -e` or a Compose override's `environment` section. See [deployment URLs and CORS](#deployment-urls-and-cors) for hostname and port settings. `NGINX_PORT` controls nginx's container port; `PORT` controls the API port and must match `BACKEND_UPSTREAM`.

Use the database and object-storage settings described below to connect PostgreSQL, MySQL, or S3-compatible storage. Supply database credentials and host/port settings when changing `DATABASE_TYPE`. API and worker processes inherit the same settings. The backend image's global MySQL default is independent of the combined image's SQLite default.

Run account management and imports inside the container:

```sh
docker compose -p workspace -f docker/docker-compose.workspace.yml exec workspace workspace-command openbb-admin auth login --api-url http://127.0.0.1:8000
docker compose -p workspace -f docker/docker-compose.workspace.yml exec workspace openbb-import /import/account.zip
docker compose -p workspace -f docker/docker-compose.workspace.yml exec workspace supervisorctl status
```

Mount the directory containing the archive at `/import` when creating the container. `workspace-command` loads the persisted secrets before running backend commands; the import helper uses it so credentials are encrypted with the same key as the API. See [account export and import](../admin_cli/README.md) for archive contents and scope.

## Deployment URLs and CORS

For a different published port or hostname, set `SELFURL` to the browser-facing API URL including `/api`, and `FRONTENDURL` and `PROURL` to the Workspace origin. Run `mkdir -p .build`, then save this override in ignored `.build/workspace.override.yml`:

```yaml
services:
  workspace:
    environment:
      SELFURL: "http://localhost:8080/api"
      FRONTENDURL: "http://localhost:8080"
      PROURL: "http://localhost:8080"
```

Apply it with:

```sh
docker compose -p workspace \
  -f docker/docker-compose.workspace.yml \
  -f .build/workspace.override.yml \
  up -d --wait
```

CORS defaults to the origins of `PROURL` and `FRONTENDURL`. Set `BACKEND_CORS_ORIGINS` to a JSON array to replace that allowlist, for example `'["https://workspace.example.com"]'`; an explicit `[]` trusts no browser origins. `FRONTENDURL` defaults to `PROURL` when omitted. Set `WORKSPACE_PORT` when changing the published port, and keep it consistent with the browser-facing URLs. `localhost` and `127.0.0.1` are different browser origins.

Environment changes require container recreation with `up -d`; application source changes require `up --build -d`. Both preserve the named data volume. Keep the Compose project name consistent across commands. A container restart does not apply a changed Compose environment or build application code.

## Separate deployment

Copy the environment example and edit it:

```sh
cp docker/.env.example docker/.env
```

Set `WORKSPACE_CONFIG_DIR` to an absolute directory containing your provisioning TOML files. Use the [provisioning format](../backend/scripts/cfgs/config.toml) and set your administrator credentials. The provisioning directory is mounted read-only and is excluded from the image build. With a single TOML file, that organization supplies registration defaults. For multiple organizations, override the bootstrap service's command with `["bootstrap", "--config-dir", "/config", "--default-entity", "My Organization"]` to choose the registration default.

Set the database password consistently in `READ_DB_PASSWORD` and `WRITE_DB_PASSWORD`. Generate secrets with Python from your activated virtual environment:

```sh
python -c 'import secrets; print(secrets.token_urlsafe(48))'
python -c 'import secrets; print(secrets.token_hex(16))'
```

Use separate random values for `JWT_SECRET` and `LOCAL_STORAGE_SECRET_KEY`; use the 32-character hex value for `OPENBB_AES_KEY`. Keep these values across container recreation. When `OPENBB_AUTH_TOKEN` is absent, the backend entrypoint derives it from `JWT_SECRET`; a supplied token is preserved.

Set `SELFURL` to the browser-facing API URL, including `/api`, and `FRONTENDURL` and `PROURL` to your Workspace origin. The example sets `BACKEND_CORS_ORIGINS` explicitly; keep it consistent with your browser origin or remove it to use the frontend URL defaults. Set `WORKSPACE_PORT` to the published frontend port. Then start the deployment:

```sh
docker compose --env-file docker/.env -f docker/docker-compose.yml up --build -d --wait
```

Compose starts MySQL and Redis, applies migrations and provisions accounts, then starts the worker, API, and frontend. Bootstrap failure prevents application startup. MySQL, Redis, uploaded files, and `user_create.json` use named volumes; `down` keeps these volumes, while `down -v` deletes them.

The backend reads `docker/.env`. Set `BACKEND_ENV_FILE` to an absolute backend environment file to use a separate file; `--env-file` still supplies Compose settings such as the database password, provisioning path, and published port. Change `DATABASE_TYPE`, database connection fields, and storage settings in the backend environment file to use external services. The MySQL and Redis services in this example are deployment-local services. The [backend settings template](../backend/envs/.env.example) lists database TLS and Redis settings. For object storage, set `STORAGE_PROVIDER=aws` and the existing `S3_*` settings, including `S3_FILE_BUCKET`, `S3_REGION`, and `S3_ENDPOINT_URL` when using an S3-compatible server. Mount database certificates through a Compose override when using certificate paths.

The shared `/data` volume holds the bootstrap file and folder storage. API and worker containers must use the same storage and secrets. For horizontally scaled hosts, use shared storage or object storage and make the generated bootstrap file available to every backend container.

To manage accounts through the installed CLI:

```sh
docker compose --env-file docker/.env -f docker/docker-compose.yml exec backend openbb-admin auth login --api-url http://127.0.0.1:8000
```

Subsequent CLI commands use the same `exec backend openbb-admin` prefix. The CLI stores its authentication in the container user's home directory; sign in again after container recreation.

## Frontend runtime settings

The frontend writes `/config.js` at startup using [scripts/render-frontend-config.sh](../scripts/render-frontend-config.sh). `BACKEND_URL` defaults to `/api`; nginx forwards that prefix to `BACKEND_UPSTREAM`, which defaults to `backend:8000`. The browser-facing backend URL and nginx upstream are separate settings. The proxy preserves WebSocket upgrades and streams responses without buffering. It preserves supplied `Origin` headers and fills missing ones from the Workspace origin for same-origin GET requests. When TLS terminates at an upstream proxy, that proxy must supply `X-Forwarded-Proto`.

Set frontend environment variables in a Compose override to configure authentication, UI, AI, or branding. The example exposes plugin settings through `RUNTIME_PLUGINS_ENABLED` and `PLUGINS_MANIFEST_URL`. See [runtime plugin installation](../docs/plugins.md#installing-plugins-at-runtime). Recreate the frontend container to apply environment changes; the application image is reused.

## Plugin installation

Plugins live in independent repositories and produce a `dist/` directory containing `plugin.json`, `entry.js`, and declared assets. Build a plugin using its repository's instructions. The [basic widget example](../docs/plugins.md#building-a-plugin) is available without licensed libraries. Library-specific installation, keys, and datafeed requirements belong in each plugin's README.

| Loading mode | Installation | Applying plugin changes |
| --- | --- | --- |
| Runtime | Serve compiled plugins and select their descriptors in an administrator manifest. | Replace the served files or edit the manifest, then reload Workspace. |
| Build-time (hardened) | Prepare selected plugins before building the application image. | Prepare the selection again and rebuild the image. |

Both modes run trusted plugin code in the Workspace page and use the same SDK and host dependencies. Runtime plugins have the same browser access as application code. Build-time installation fixes plugin code in the application image; changes to the source repository or an external plugin server do not change that image. Bundling does not isolate plugin code. See [host interfaces and registration](../docs/plugins.md) for developer details.

### Runtime plugins

After building the basic widget example, copy its output into a server directory and create the administrator manifest:

```sh
mkdir -p .build/runtime-plugins/basic-widget
cp -R examples/plugins/basic-widget/dist/. .build/runtime-plugins/basic-widget/
cp docker/plugins/plugins.example.json .build/runtime-plugins/plugins.json

PLUGINS_ROOT="$PWD/.build/runtime-plugins" \
WORKSPACE_ORIGIN=http://localhost:8080 \
docker compose -p workspace-plugins -f docker/docker-compose.plugins.yml up -d
```

The nginx service serves the directory read-only with CORS headers and caching disabled. Its manifest is available at `http://localhost:8090/plugins.json`. Add each plugin's compiled output in its own subdirectory; add a `mode: "runtime"` entry with the corresponding `descriptorUrl` to `plugins.json`. Descriptor URLs resolve beside the manifest, such as `basic-widget/plugin.json`.

Add these environment variables to the Workspace service in the override above:

```yaml
      RUNTIME_PLUGINS_ENABLED: "true"
      PLUGINS_MANIFEST_URL: "http://localhost:8090/plugins.json"
```

Run the override's `up -d --wait` command, then reload Workspace. The plugin URL must be reachable from the browser. Set the plugin server's `WORKSPACE_ORIGIN` to the Workspace browser origin. HTTPS deployments require HTTPS plugin URLs. No application rebuild is needed to change runtime settings or hosted plugin code.

To disable an individual runtime plugin, remove its entry from `plugins.json` and reload Workspace. To disable all runtime loading, set `RUNTIME_PLUGINS_ENABLED` to `"false"`, recreate the application container, and reload. Bundled plugins still load. Plugin code is not unloaded from an open page; changes take effect on a full reload. Saved widget definitions and settings remain intact; widgets requiring an absent plugin display an installation message and recover when it is restored. Grid features supplied by a plugin also depend on its availability.

### Build-time plugins

After building the basic widget example, create a build selection:

```sh
mkdir -p .build
cat > .build/plugins.build.json <<'EOF'
{
  "plugins": [
    {"mode": "build", "source": {"dist": "../examples/plugins/basic-widget/dist"}}
  ]
}
EOF

bun scripts/prepare-frontend.ts --manifest .build/plugins.build.json
```

Preparation copies compiled descriptors, modules, and assets into ignored `.build/plugins/`. Paths in the manifest resolve beside that manifest. Source paths and Git repository references are also supported; see [plugin preparation](../docs/plugins.md#including-plugins-in-a-frontend-build).

Set `RUNTIME_PLUGINS_ENABLED` to `"false"` in the Workspace override and rebuild using the override's Compose command with `--build`. The Docker build includes the prepared output in both the `workspace` and `frontend` targets. No plugin server or runtime manifest is needed. Updating, adding, or removing bundled plugins requires another preparation and application build. To prepare an empty selection, run `bun scripts/prepare-frontend.ts` before rebuilding.

## Development and verification

The `docker-compose-local-dev*.yml` examples build the same backend target and mount `backend/` for source editing. See [backend development setup](../backend/DEVELOPMENT_SETUP.md) for provisioning and reload commands.

Use the existing browser scenarios against the deployment with a test account created through `openbb-admin`:

```sh
cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:8080 \
PLAYWRIGHT_API_URL=http://localhost:8080/api \
PLAYWRIGHT_EMAIL=playwright@example.com \
PLAYWRIGHT_PASSWORD='WorkspaceTest123!' \
bun run playwright test tests/e2e/auth.spec.ts tests/e2e/data-conectors.spec.ts tests/e2e/dashboards.spec.ts
```

These scenarios check login settings, uploads, exports, and saved dashboards. The [browser test guide](../frontend/tests/e2e/README.md#run-against-a-deployment) describes account setup and deployment options. Worker startup and completed jobs appear in `docker compose logs worker` for the separate deployment and `docker compose -f docker/docker-compose.workspace.yml logs workspace` for the combined deployment.
