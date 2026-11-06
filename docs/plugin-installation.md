# Install Workspace plugins

Plugins produce a `dist/` directory containing `plugin.json`, `entry.js`, and declared assets. Obtain compiled output or build it using the plugin repository's instructions. Library keys and datafeed requirements belong in each plugin's README. See [plugin development](plugins.md) for SDK interfaces and building the basic widget example.

| Loading mode | Installation | Applying plugin changes |
| --- | --- | --- |
| Runtime | Serve compiled plugins and select their descriptors in an administrator manifest. | Replace the served files or edit the manifest, then reload Workspace. |
| Build-time (hardened) | Prepare selected plugins before building the application image. | Prepare the selection again and rebuild the image. |

Runtime modules run as administrator-trusted application code in the Workspace page for every deployment user, with the same access to browser data. Widget declarations reference installed renderer IDs and cannot select executable URLs. Build-time installation fixes plugin code in the image; changes to external plugin files cannot change that image. Neither mode isolates plugin code.

## Installing plugins at runtime

Add these settings to your Workspace service's `environment` in the [Compose deployment](deployment.md#combined-container):

```yaml
      RUNTIME_PLUGINS_ENABLED: "true"
      PLUGINS_MANIFEST_URL: "http://localhost:8090/plugins.json"
```

Recreate the container with `docker compose up -d --wait` and reload Workspace.

`PLUGINS_MANIFEST_URL` is fetched by the user's browser, so use a URL reachable from that browser. Changing these environment variables and recreating the container requires no application rebuild. Runtime loading is disabled by default. With runtime loading disabled, Workspace skips the manifest and loads bundled plugins. A build can lock `plugins.runtimeEnabled` to `false` through its existing locked configuration policy.

The [example manifest](../docker/plugins/plugins.example.json) selects the basic widget's generated descriptor. Deployment manifests belong with the deployment configuration; plugin source projects keep their own repositories.

Descriptor URLs resolve beside the manifest. Entry modules and stylesheet URLs resolve beside their descriptor. Redirected manifests and descriptors use their final response URL. Build selections in a runtime manifest are ignored. Both loaders use the same registration code, supported API version, host dependencies, and registry; duplicate registrations cannot replace an installed renderer.

The [plugin server Compose service](../docker/docker-compose.plugins.yml) uses nginx Alpine with the [nginx configuration](../docker/plugins/nginx.conf.template). It serves `PLUGINS_ROOT` through a read-only mount and sets CORS and `Cache-Control: no-store` headers.

Deployment machines need compiled plugin files, not their source repositories. Serve the files from a web server or a plugin-server image containing that output. The manifest and module URLs must use HTTPS for an HTTPS Workspace and provide JavaScript MIME types, CORS headers for a separate origin, and disabled caching for mutable files.

For a local example using the source checkout, build the basic widget using [the plugin development guide](plugins.md#building-a-plugin), then run from the Workspace root:

```sh
mkdir -p .build/runtime-plugins/basic-widget
cp docker/plugins/plugins.example.json .build/runtime-plugins/plugins.json
cp -R examples/plugins/basic-widget/dist/. .build/runtime-plugins/basic-widget/
PLUGINS_ROOT="$PWD/.build/runtime-plugins" \
WORKSPACE_ORIGIN=http://localhost:8080 \
docker compose -f docker/docker-compose.plugins.yml up
```

`PLUGINS_ROOT` is an absolute path containing `plugins.json` and compiled plugin bundles. Keep that directory in place when replacing its contents. Source repositories can live anywhere; deploy their compiled `dist/` output into named subdirectories and reference their descriptors in the manifest. The nginx configuration and Compose service belong to Workspace; deployment selections and compiled bundles stay outside tracked configuration.

`PLUGINS_PORT` defaults to `8090`. Set `WORKSPACE_ORIGIN` to the Workspace browser origin; use `http://127.0.0.1:1420` for Vite development. The manifest in this example is available at `http://localhost:8090/plugins.json`. Same-origin hosting through the frontend nginx can use a relative manifest URL.

Replace plugin files and the manifest, then reload Workspace to apply changes. Keep HTTP caching disabled for these mutable URLs, as in the example, so a reload retrieves replacement code and stylesheets. No Workspace rebuild is required. To disable all runtime loading, set `RUNTIME_PLUGINS_ENABLED` to `"false"`, recreate the container, and reload. Bundled plugins still load. Plugin code stays in an open page until a full reload. Removing a selection preserves saved widget settings and shows a missing-plugin message; restoring it and reloading recovers the widget. For registration failures and widget diagnostics, see [renderer IDs](plugins.md#widget-renderer-ids).

## Including plugins in a frontend build

From the Workspace root, prepare the administrator's selection before starting Vite or building the frontend:

```sh
bun scripts/prepare-frontend.ts --manifest /path/to/plugins.json
```

Manifest paths resolve beside `plugins.json`. A build selection accepts `source.path` for a local project, `source.repository` and `source.ref` for a Git checkout, or `source.dist` for compiled output. Source projects use Bun and their own `bun.lock`, `typecheck` script, and `build` script; the build script calls the SDK helper. Repository selections require dependencies accessible from the cloned project, including its SDK dependency. Preparation runs installation, typechecking, and building in that project without changing Workspace's manifests or lockfiles. Runtime selections are left out of this build.

Preparation validates descriptors and copies `plugin.json`, the entry module, and every declared asset into ignored `.build/plugins/bundles/<scope>/<package>/`. Missing files, incompatible API versions, duplicate selections, and failed source commands fail preparation. `.build/plugins/index.js` imports the selected descriptors and module imports to Vite through `virtual:workspace-plugins`.

Vite serves the compiled files at `/plugins/<scope>/<package>/` during development and copies them to that directory in `dist/`. Entry modules retain their own `import.meta.url`, so asset URLs resolve beside the compiled module in both cases. The loader loads stylesheets and awaits registration before mounting Workspace. Loading or registration failures appear on affected widgets; other plugins and core widgets remain available.

Use `bun run dev` after preparation for source development. Re-run preparation and reload Workspace when changing the selection. To remove all selected plugins, run `bun scripts/prepare-frontend.ts` from the repository root. A checkout with no prepared output also uses an empty selection.

After preparation, build using the [frontend development commands](../frontend/README.md#building-and-running) or container images. The frontend Dockerfile includes the same prepared output from the repository root context. Prepare plugins on the host, then use the [image build command](development.md#container-images). Plugin repositories and their dependency installations are not needed inside that image build.
