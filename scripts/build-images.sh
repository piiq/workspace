#!/bin/bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tag=dev
platform=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--tag) tag="${2:?Specify an image tag}"; shift 2 ;;
    -p|--platform) platform="${2:?Specify a platform}"; shift 2 ;;
    -h|--help)
      cat <<'EOF'
Build and load workspace, workspace-frontend, and workspace-backend locally.

Usage: ./scripts/build-images.sh [options]

  -t, --tag TAG            Local image tag (default: dev)
  -p, --platform PLATFORM  linux/amd64 or linux/arm64 (default: Docker's platform)
  -h, --help               Show help

Requires Docker with Buildx.

Environment variables used by CI:
  BUILD_CACHE_FROM  Read saved build layers (Docker's --cache-from option)
  BUILD_CACHE_TO    Save build layers after all images (Docker's --cache-to option)
EOF
      exit 0
      ;;
    *) echo "Unknown argument: $1. Use --help for usage." >&2; exit 2 ;;
  esac
done

case "$platform" in
  ""|linux/amd64|linux/arm64) ;;
  *) echo "Unsupported platform: $platform. Choose linux/amd64 or linux/arm64." >&2; exit 2 ;;
esac

args=(--load --file "$root/docker/Dockerfile")
if [[ -n "$platform" ]]; then args+=(--platform "$platform"); fi
if [[ -n "${BUILD_CACHE_FROM:-}" ]]; then args+=(--cache-from "$BUILD_CACHE_FROM"); fi
if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  args+=(--label "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY")
  args+=(--label "org.opencontainers.image.revision=$GITHUB_SHA")
fi

for target in frontend backend workspace; do
  image=workspace
  if [[ "$target" != workspace ]]; then image="workspace-$target"; fi
  build_args=("${args[@]}" --target "$target" --tag "$image:$tag")
  # The workspace target includes both application builds in the exported cache.
  if [[ "$target" == workspace && -n "${BUILD_CACHE_TO:-}" ]]; then
    build_args+=(--cache-to "$BUILD_CACHE_TO")
  fi
  docker buildx build "${build_args[@]}" "$root"
done
