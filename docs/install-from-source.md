# Install from source

Build the combined Workspace image from this repository. For a published image, use the [quickstart](quickstart.md).

## Requirements

- Docker with Buildx. Docker Desktop provides it on macOS and Windows.
- Git to clone the repository.

Docker must be running. Python, uv, Node, and Bun are not required on the host for this build.

## Build Workspace

```sh
git clone https://github.com/piiq/workspace.git workspace-oss
cd workspace-oss
docker buildx build --load -f docker/Dockerfile --target workspace -t workspace:dev .
```

For an existing checkout, run the build command from its repository root. Prepare [build-time plugins](plugin-installation.md#including-plugins-in-a-frontend-build) before building to include them in the image.

Follow the [quickstart launch and login instructions](quickstart.md#run-workspace), replacing `ghcr.io/piiq/workspace:latest` with `workspace:dev` in the launch command. Keep the same local data folder when replacing an existing container.

After changing source code, rebuild the image and use the [container replacement instructions](operations.md#replace-a-docker-container) to replace the container. A restart does not rebuild the image. For building all image targets and running their checks, see [development](development.md#container-images).
