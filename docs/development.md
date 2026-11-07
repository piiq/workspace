# Workspace development

Source development uses Bun and the Node version specified in [frontend/package.json](../frontend/package.json), plus Python 3.13 and uv for the backend.

- [Frontend development](../frontend/README.md): dependencies, environment, and the Vite server.
- [Backend development](../backend/DEVELOPMENT_SETUP.md): local containers, provisioning, and reloads.
- [Frontend unit and integration tests](../frontend/TESTING.md): test commands, mocks, and conventions.
- [Browser tests](../frontend/tests/e2e/README.md): source servers, test accounts, plugins, and deployment checks.
- [Backend tests](../backend/tests/README.md): pytest fixtures and database migrations.
- [Plugin development](plugins.md): SDK interfaces and plugin builds.

## Container images

Run the build script from your checkout. Use `./scripts/build-images.sh -h` to list its options:

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

For image publication, see [repository maintenance](maintaining.md#image-publication).

To include plugins, run [plugin preparation](plugin-installation.md#including-plugins-in-a-frontend-build) before building.

For a combined-image build and first launch, see [installation from source](install-from-source.md). The frontend and backend targets use the same Dockerfile and root build context.

## Test images

The image integration tests are [pytest tests under `docker/tests/`](../docker/tests/). Use the activated backend environment with its development dependencies, plus the frontend and SDK dependencies and Chromium from [the browser test guide](../frontend/tests/e2e/README.md#run-from-source). From the repository root, test the default `:dev` images:

```sh
pytest docker/tests -v
```

For images built with a different tag or platform:

```sh
WORKSPACE_IMAGE_TAG=dev-amd64 WORKSPACE_IMAGE_PLATFORM=linux/amd64 pytest docker/tests -v
```

Tests cover login, uploads, dashboards, worker jobs, and persistence in both deployment layouts. Reports and traces are saved under `.build/image-checks/<architecture>/`. Testing another architecture requires Docker support for running it.
