# Repository maintenance

This guide covers image and plugin SDK publication, repository security, and dependency pull requests. For local image builds and verification, see [development](development.md#container-images).

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

## Plugin SDK releases

The [Plugin SDK Package workflow](../.github/workflows/plugin-sdk-release.yml) publishes `workspace-plugin-sdk.tgz` when changes to the plugin SDK, its license files, or the workflow reach `main`. It creates a GitHub release tagged `plugin-sdk-<commit SHA>` and marks it latest. A manual run from `main` publishes the same way. No existing release is required. Pull requests check package contents without publishing.

The tarball contains the plugin SDK sources, package metadata, license, and attribution. Publishing a GitHub release also attaches the plugin SDK from that release's tag.

Plugins can install the plugin SDK from `https://github.com/piiq/workspace/releases/latest/download/workspace-plugin-sdk.tgz`. The filename stays the same between releases. Dependency caches and lockfiles can retain an earlier download; refresh the dependency to obtain a newer plugin SDK.

## Repository security

[Dependabot configuration](../.github/dependabot.yml) schedules weekly updates for Python, JavaScript, GitHub Actions, Docker base images, and Compose image references, with one open version-update pull request per ecosystem. Dependabot alerts and security updates, secret scanning, and push protection are configured in the repository's GitHub security settings. Fork owners enable these settings for their repositories.

The [CodeQL workflow](../.github/workflows/codeql.yml) scans Python, JavaScript/TypeScript, and GitHub Actions on main pushes, pull requests, manual runs, and a weekly schedule. Use advanced setup in GitHub's security settings for this workflow. The [Python](../.github/codeql/python.yml) and [JavaScript/TypeScript](../.github/codeql/javascript.yml) configs add CodeQL's inline suppression queries to the default security queries. Put a rule-specific comment immediately before the flagged expression, such as `# codeql[py/clear-text-storage-sensitive-data] Credentials belong to this temporary test deployment.` Use `// codeql[js/rule-id] Reason` in JavaScript or TypeScript. The workflow removes results marked by those comments before uploading SARIF; the rule remains active elsewhere. Include the reason in each comment.

The [Dependabot PR Descriptions workflow](../.github/workflows/dependabot-pr-descriptions.yml) keeps dependency summaries and removes generated changelog HTML, badges, and bot instructions so descriptions can be used as squash commit messages. It processes Dependabot-authored PRs when Dependabot opens or updates them. Run it manually to format existing open Dependabot PRs. Its formatting job reads and edits PR metadata with `pull-requests: write`. The repository's Actions event policy must allow `pull_request_target` for this workflow.

Dependabot alerts depend on GitHub's dependency graph. Check Insights > Dependency graph for recognized manifests and resolved dependencies. Bun and uv update support does not establish complete transitive alert coverage. Docker and Compose updates cover image references. Operating-system packages installed inside images require separate vulnerability assessment. See [GitHub's supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) and [dependency graph coverage](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems).
