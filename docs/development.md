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

This produces the same three local image names with `:dev-amd64` tags. A tag identifies an image version; it does not choose a registry. The build script leaves the images local. Publication is a separate operation described in [repository maintenance](maintaining.md#image-publication).

Local builds reuse Docker's build cache automatically. CI restores saved build layers into a directory and sets `BUILD_CACHE_FROM` to read them through Docker's `--cache-from` option. `BUILD_CACHE_TO` supplies Docker's `--cache-to` option to save layers for subsequent runs. The workflow provides these environment variables.

Prepare build-time plugins with [the plugin preparation command](plugin-installation.md#including-plugins-in-a-frontend-build) before building. Compiled output under `.build/plugins/` is included without copying plugin repositories into the image. A checkout without prepared output builds with no optional plugins.

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

The tests run the existing login, upload/export, and dashboard browser scenarios against isolated combined and separate deployments, check worker execution, and check combined-container persistence across recreation. They use loaded images without building or pushing. Test projects and volumes are removed afterward; reports and traces remain under ignored `.build/image-checks/<architecture>/`. Building and testing another architecture locally requires Docker support for running it.

Image publication and GitHub security settings are covered in [repository maintenance](maintaining.md).
