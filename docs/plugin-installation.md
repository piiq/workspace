# Install Workspace plugins

Compiled plugins contain `plugin.json`, `entry.js`, and assets in an output directory, commonly `dist/`. Obtain these files or build them using the plugin repository's instructions. See each plugin's README for library keys and datafeed requirements, and [plugin development](plugins.md) for plugin SDK interfaces and the basic widget example.

| Loading mode | Installation | Applying plugin changes |
| --- | --- | --- |
| Runtime | Serve compiled plugins and select their descriptors in a manifest. | Replace the files or edit the manifest, then reload Workspace. |
| Build-time (hardened) | Prepare selected plugins before building the application image. | Prepare the selection again and rebuild the image. |

Administrators select runtime modules, which run in the Workspace page for every user with the application's access to browser data. Widget declarations reference installed renderer IDs and cannot select executable URLs. Build-time installation bakes plugin code into the image.

## Installing plugins at runtime

Add these settings to your Workspace service's `environment` in the [Compose deployment](deployment.md#combined-container):

```yaml
      RUNTIME_PLUGINS_ENABLED: "true"
      PLUGINS_MANIFEST_URL: "http://localhost:8090/plugins.json"
```

Recreate the container with `docker compose up -d --wait` and reload Workspace.

The user's browser fetches `PLUGINS_MANIFEST_URL`, so use a URL it can reach. Changing these variables and recreating the container requires no application rebuild. Runtime loading is disabled by default: Workspace skips the manifest and loads bundled plugins. A build can lock `plugins.runtimeEnabled` to `false` through its configuration policy.

The [example manifest](../docker/plugins/plugins.example.json) selects the basic widget's descriptor. Keep manifests with deployment configuration and plugin source in separate repositories.

Descriptor URLs resolve beside the manifest. Entry modules and stylesheets resolve beside their descriptor. Redirects use the final response URL. Runtime manifests ignore build selections.

The [plugin server Compose service](../docker/docker-compose.plugins.yml) uses nginx Alpine with this [configuration](../docker/plugins/nginx.conf.template). It serves `PLUGINS_ROOT` through a read-only mount and sets CORS and `Cache-Control: no-store` headers.

Serve compiled plugins from a web server or plugin-server image. Use HTTPS when Workspace uses HTTPS, JavaScript MIME types for modules, CORS headers for a separate origin, and disabled caching for files you replace.

For a local example, build the basic widget using [the plugin development guide](plugins.md#developing-a-plugin), then run from the Workspace root:

```sh
mkdir -p .build/runtime-plugins/basic-widget
cp docker/plugins/plugins.example.json .build/runtime-plugins/plugins.json
cp -R examples/plugins/basic-widget/dist/. .build/runtime-plugins/basic-widget/
PLUGINS_ROOT="$PWD/.build/runtime-plugins" \
WORKSPACE_ORIGIN=http://localhost:8080 \
docker compose -f docker/docker-compose.plugins.yml up
```

`PLUGINS_ROOT` is an absolute path containing `plugins.json` and compiled plugins. Keep that directory in place when replacing its contents. Source repositories can live anywhere; copy their compiled files into subdirectories and reference their descriptors in the manifest. Keep deployment manifests and compiled plugins outside Workspace's tracked files.

`PLUGINS_PORT` defaults to `8090`. Set `WORKSPACE_ORIGIN` to the Workspace browser origin; use `http://127.0.0.1:1420` for Vite development. The manifest in this example is available at `http://localhost:8090/plugins.json`. Same-origin hosting through the frontend nginx can use a relative manifest URL.

Replace plugin files or edit the manifest, then reload Workspace. To disable runtime loading, set `RUNTIME_PLUGINS_ENABLED` to `"false"`, recreate the container, and reload. Bundled plugins continue to load. Removing a plugin preserves saved widget settings; restoring it and reloading recovers the widget. For loading errors, see [renderer IDs](plugins.md#widget-renderer-ids).

## Including plugins in a frontend build

Use this mode to include plugins while disabling runtime loading. Plugin code stays fixed in the application image until you rebuild it. Set `RUNTIME_PLUGINS_ENABLED` to `"false"` for this hardened deployment.

From the Workspace root, prepare the selected plugins before starting Vite or building the frontend:

```sh
bun scripts/prepare-frontend.ts --manifest /path/to/plugins.json
```

Manifest paths resolve beside `plugins.json`. A build selection accepts `source.path` for a local project, `source.repository` and `source.ref` for a Git checkout, or `source.dist` for compiled output. Source projects use Bun and their own `bun.lock`, `typecheck` script, and `build` script; the build script calls the plugin SDK helper. Dependencies, including the plugin SDK, must be accessible from the project. Preparation installs dependencies, typechecks, and builds the project without changing Workspace's manifests or lockfiles. Runtime selections are excluded.

Prepared files are stored under `.build/plugins/`. Preparation errors must be resolved before building.

For development, run `bun run dev` after preparation. Re-run preparation and reload Workspace when changing the selection. To remove all selected plugins, run `bun scripts/prepare-frontend.ts` from the repository root. A checkout without prepared output bundles no plugins.

After preparation, use the [frontend build commands](../frontend/README.md#building-and-running) or the [image build command](development.md#container-images).
