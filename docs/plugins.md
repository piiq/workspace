# Plugin development

This guide describes the SDK, plugin builds, and host interfaces. For runtime serving and build-time preparation, see [plugin installation](plugin-installation.md).

`packages/plugin-sdk/` provides `@piiq/workspace-plugin-sdk`. The frontend uses it as a local Bun dependency. Install frontend dependencies using the [frontend development guide](../frontend/README.md#installation) before typechecking or testing. Unit tests also require the SDK runtime and example dependencies described under [Building a plugin](#building-a-plugin). Plugin projects use the SDK package without importing Workspace source files or stores.

## Registration

Use `definePlugin(packageJson, declarations)` to take the plugin name and version from its `package.json`. Declare renderer metadata and components together: `name`, `title`, optional `description`, `kind` (`content` or `table`), input/parameter/state JSON schemas, and optional capability names. `createPluginDescriptor(plugin, { entry, assets, styles })` produces serializable metadata from those declarations.

`kind: "table"` describes the renderer's content and does not select a table library. A renderer that needs the host's AG Grid table context declares `wrapper: "ag-grid"`. A renderer using its own table library, such as Perspective, omits that field. These settings belong to plugin registration; backend `widgets.json` declarations reference renderers through their existing `type` field.

Plugin IDs are scoped package names such as `@piiq/tradingview`. Scope, package, local renderer, and capability names use lowercase kebab-case. A renderer named `chart` becomes `@piiq/tradingview/chart`. Built-in renderers retain identifiers such as `ag_grid_table` and `metric`.

An entry module's `register(api)` function calls `api.registerPlugin(plugin)`. Both loading modes use that API and the same registry. The API supports `apiVersion: 1`; incompatible descriptors and duplicate registrations are rejected. A local renderer name can appear in different plugins because its qualified ID includes the package name.

Optional `setup(host)` finishes before the plugin's renderers become available. Await registration before creating a dependent widget. `resolveRenderer(id)` waits for pending registration and returns a ready renderer or an actionable failure/unavailability message. Failed setup leaves unrelated renderers available. Registration promises reject on failure.

## Widget renderer IDs

Backend `widgets.json` entries select a renderer with `type: "@scope/package/renderer"`. Widget Builder and backend metadata accept qualified IDs without requiring the plugin to be installed. An explicit `type` takes precedence over `defaultViz`; creating, saving, and reopening a widget preserves its renderer ID, parameters, and saved state.

Missing, incompatible, or failed plugins display an actionable message on the affected widget. Other widgets remain usable. Installing the renderer makes a mounted widget render its saved definition without substituting a table or rewriting its ID.

For existing widget definitions, Workspace resolves these renderer IDs:

| Saved renderer ID | Bound renderer ID |
| --- | --- |
| `table` | `ag_grid_table` |
| `charting`, `advanced_charting` | `@piiq/tradingview/chart` |
| `ssrm_table` | `@piiq/ag-enterprise/server-side-table` |
| `ssrm_advanced` | `@piiq/ag-enterprise/advanced-server-side-table` |
| `chart-highcharts` | `@piiq/highcharts/chart` |

A renderer registered under the saved ID takes precedence over its binding. An absent plugin does not invalidate a saved definition.

These aliases select renderers; they do not install plugins or identify file locations. Plugin authors choose their own package and renderer names and use those qualified IDs in widget declarations, such as `@example/perspective/table`. The fixed aliases apply to existing widget types; independent plugins do not need an entry in this table.

## Host interfaces

`api.host` provides the application's React, ReactDOM, ReactDOM client, and JSX runtime. Plugins use these React instances to share the application's hooks. `host.useTheme()` follows the application's light/dark theme. The core SDK has no AG Grid imports; plugins using other rendering libraries do not need to install AG Grid.

`host.ui` provides the application's Button, Icon, Tooltip, WidgetShell, and RawDataTable. These components load lazily and require a React Suspense boundary. WidgetShell uses the existing draggable card, loading/error display, parameter controls, agent access to widget data, CSV/XLSX downloads for array data, and a `toolbar` slot. A plugin renders its library-specific content as children. RawDataTable uses the host's existing grid, column processing, and widget context.

WidgetShell hides its content and shows the host's loading indicator while its widget is being resized.

Renderer declarations can include a Toolbar component. The host provides these hooks inside a widget's renderer:

- `useWidgetContext()` returns the widget instance ID, renderer ID, endpoint configuration, parameters, `options` from the widget's `data` field, saved plugin state, and reactive theme. `setParameters()` merges parameter values into the widget's stored parameters; `setState()` merges values into `storage.pluginState`. Both persist through the host's widget update path.
- `useWidgetData<Data>(options?)` uses the application's fetcher, authentication, query cache, and refresh handling. Endpoint query values, optional `options.query`, and stored parameters merge in that order. Stored parameters take precedence; change them with `setParameters()`. It preserves endpoint headers and method, applies the widget's `data.dataKey`, and returns data, loading/fetching/error state, refresh time, and `refetch()`. Options support POST bodies, text responses, and disabling the query.
- `useChartData<Data>()` supplies chart payloads and the shared raw-data toggle. It merges endpoint query values and stored parameters, then sets `theme` to the current application theme. A declaration's `raw` flag enables the toggle; `storage.rawDataView` saves the selected view. Raw requests force `raw: true` and unwrap `results`. The result includes the active payload, `showTable`, `toggle`, loading/error state, and refresh time. Put `toggle` in WidgetShell's toolbar and render RawDataTable when `showTable` is true. `refetch()` resolves to the refreshed active payload for immediate lifecycle exports. The host interface declares this hook as optional; a plugin that requires it must check availability and report an unsupported host. Chart requests use the widget's `staleTime` or 15 minutes; raw requests use zero stale time.
- `useWidgetDataExport({ data, enabled, lastUpdated, ... })` publishes data and widget metadata for agents independently of an active chat. It records columns and the parameters used for the response; The component using the hook decides whether to include the widget in a Copilot conversation. WidgetShell publishes its `data` prop through the same hook. Use one publication path for a given payload.
- `useWidgetLifecycle({ refresh, exportData?, dispose? })` registers callbacks for the mounted instance. `refresh` can use the data hook's `refetch`. `exportData` returns `{ data, columns? }` for agent requests; without that callback, requests use published data. Callbacks follow renderer updates and are removed on unmount, which also calls `dispose`. Native widget callbacks are separate from the iframe bridge. Backend widget requests with matching parameters use the export callback; requests with different parameters fetch the endpoint. Destructive MCP tools refresh matching mounted widgets using the backend's existing `mcp_tool` mapping. A refresh failure reports a widget error while preserving the tool result.

## AG Grid integration

`@piiq/workspace-plugin-sdk/ag-grid` exports `AgGridPluginDefinition`, `AgGridCapabilityDefinition`, and `getAgGrid(host)`. AG Grid plugins install the SDK's matching `ag-grid-community` peer for development types and use `getAgGrid(api.host)` for the application's Community exports. Their builds use the host instance so module registration applies to the application's grids. AG Grid is an optional SDK peer dependency.

Declare `agGridCapabilities` alongside renderers, using `AgGridCapabilityDefinition` for `name`, `title`, AG `modules`, and an optional `configureGrid(options)` function. Descriptor generation retains capability metadata and excludes executable grid configuration and modules. Registration installs modules through the host's Community registry before exposing renderers or capabilities. The host applies registered configuration functions to its shared grid options. Keep changes specific to the grid behaviour the capability supports.

`getAgGridUi(host)` provides the shared table shell, SQL editor, request handling, saved settings, and agent access to widget data through the `agGridUi` interface. A server-side renderer passes its datasource hook to the interface's `ServerSideTable` component. The host also shares AG Charts Community and Charts Core with plugin bundles so chart modules use the same registries.

## Configuration files

| File | Contents |
| --- | --- |
| `plugins.json` | Administrator selection: `plugins` entries with a loading `mode` and source or descriptor URL. It does not repeat renderer metadata. |
| `plugin.json` | Generated descriptor: package name/version, API version, renderer and AG Grid capability metadata, entry module, and asset paths. |
| `entry.js` | Browser module exporting `register(api)`. |

Selection formats and source choices are documented in [plugin installation](plugin-installation.md). Application flags remain in `frontend/src/lib/runtimeConfigSchema.ts`.

The SDK validates selections and descriptors. Workspace preparation and descriptor loading are separate from building a plugin. Plugin sources retain their own dependencies and lockfiles; generated descriptors, entry modules, and assets belong in their build output.

## Building a plugin

`@piiq/workspace-plugin-sdk/build` exports `buildPlugin({ root, entry, assets, styles })`, using Bun's bundler. `root` defaults to the working directory; `entry` names the definition module, and `assets` contains project-relative files or directories. The helper writes `dist/plugin.json`, `dist/entry.js`, and assets, and returns the validated descriptor. `assets` lists every copied file. The generated descriptor's `styles` lists stylesheets loaded into the Workspace page. The build helper uses all CSS assets by default; an explicit `styles` array selects host stylesheets independently of copied library assets. Use `styles: []` for libraries that load their own CSS inside an iframe. Keep `dist/` and `node_modules/` ignored in each plugin repository.

Default-export a `PluginDefinition` created with `definePlugin(packageJson, declarations)` from the entry module. Its name/version must match the project's `package.json`. The build imports this module in Bun to generate the descriptor from the same declarations used during registration. Put browser initialization in `setup(host)` or the renderer component. Build failures exit with an error; install the plugin's dependencies and run its TypeScript check before building.

The generated browser module exports `register(api)`. It evaluates the compiled plugin using that API's React, ReactDOM, JSX runtime, and optional AG Community exports, then awaits `api.registerPlugin()`. Plugins can use ordinary imports from `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, `ag-grid-community`, `ag-charts-community`, and `ag-charts-core`; these dependencies come from the host during registration. Other dependencies are bundled from the plugin project. The Bun build helper is a separate SDK export and is not included in browser code.

Assets listed in the build options keep their project-relative paths under `dist/`. Imported file assets receive generated names and are included in the descriptor. Use `new URL(assetPath, import.meta.url)` for URLs relative to `entry.js`. Load descriptor assets relative to `plugin.json`; CSS assets accompany the plugin's JavaScript. The same output can be copied into a Workspace build or served for runtime loading.

The [basic widget example](../examples/plugins/basic-widget/) uses the SDK through its own manifest and lockfile. It renders supplied endpoint data with HTML, has a symbol parameter and saved row selection, publishes data through WidgetShell, and provides data export and refresh through the lifecycle API. Its build script also copies `assets/style.css`.

Local Bun dependencies link SDK source files to this checkout, so install the SDK's runtime dependencies before building the example. A packed SDK resolves its dependencies inside the consuming project.

```sh
cd packages/plugin-sdk
bun install --frozen-lockfile --production
cd ../../examples/plugins/basic-widget
bun install --frozen-lockfile
bun run typecheck
bun run build
```

From the Workspace root, the convenience command builds a definition module using the plugin's installed SDK and dependencies:

```sh
bun scripts/build-plugin.ts --path examples/plugins/basic-widget --asset assets
bun scripts/build-plugin.ts --help
```

`--entry` selects a module other than `src/index.tsx`; repeat `--asset` for multiple files or directories. Plugin projects can call the SDK helper from their own build scripts without this command.

For a project outside this checkout, set its SDK dependency to the local `packages/plugin-sdk/` path or a tarball produced by `bun pm pack` in that directory. Install and typecheck in the plugin project, then call its build script. No imports from Workspace source files or stores are required.

## Development configuration

`VITE_RUNTIME_PLUGINS_ENABLED` and `VITE_PLUGINS_MANIFEST_URL` in `frontend/.env` are development/build fallbacks. For a frontend built with `bun run build:runtime` and served outside a container, set `plugins.runtimeEnabled` and `plugins.manifestUrl` in the deployed `config.js`. Container settings and installation commands are in [plugin installation](plugin-installation.md).
