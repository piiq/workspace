# Repository maintenance

For local image builds and tests, see [development](development.md#container-images).

## Image publication

The [Workspace Images workflow](../.github/workflows/workspace-images.yml) publishes images after image-related changes merge into `main`. For a manual build, leave `publish` disabled to test images or enable it to publish. Optional `release_tags` accepts comma-separated tags such as `v1.0.0,stable`.

For this repository, publication uses these names:

| Image | Contents |
| --- | --- |
| `ghcr.io/piiq/workspace` | Combined application |
| `ghcr.io/piiq/workspace-frontend` | Frontend and nginx |
| `ghcr.io/piiq/workspace-backend` | API, worker, migrations, and admin CLI |

Forks use their own lowercase `owner/repository` as the combined image name, with `-frontend` and `-backend` suffixes for the other targets.

Images support AMD64 and ARM64. Use `latest` for the latest build or `sha-<full-commit>` for a specific revision.

After the first publication, set each container package to Public in GitHub's package settings to allow anonymous pulls. See [GitHub's container registry documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Verify an image's source revision and publishing workflow using its [GitHub attestation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations):

```sh
gh attestation verify oci://ghcr.io/piiq/workspace:latest \
  --repo piiq/workspace \
  --signer-workflow piiq/workspace/.github/workflows/workspace-images.yml
```

Use `workspace-frontend` or `workspace-backend` to verify the separate images.

## Plugin SDK releases

The [Plugin SDK Package workflow](../.github/workflows/plugin-sdk-release.yml) publishes releases when PRs changing SDK code, dependencies, or the release workflow merge into `main`.

Plugins can use the [latest plugin SDK tarball](https://github.com/piiq/workspace/releases/latest/download/workspace-plugin-sdk.tgz) as a dependency. Refresh cached downloads and lockfiles when updating it.

## Repository security

Enable Dependabot alerts and security updates, secret scanning, and push protection in GitHub's security settings. Update schedules are in [dependabot.yml](../.github/dependabot.yml).

Use advanced setup in GitHub's security settings for the [CodeQL workflow](../.github/workflows/codeql.yml). To suppress a finding, put `# codeql[py/rule-id] Reason` or `// codeql[js/rule-id] Reason` immediately before the flagged expression. Include a specific reason.

The [Dependabot PR Descriptions workflow](../.github/workflows/dependabot-pr-descriptions.yml) formats Dependabot descriptions for squash commits. Run it manually to format existing PRs. Allow `pull_request_target` in the repository's Actions event policy.

Check Insights > Dependency graph for recognized manifests and dependencies. See [GitHub's coverage](https://docs.github.com/en/code-security/reference/supply-chain-security/dependency-graph-supported-package-ecosystems); assess operating-system packages in images separately.
