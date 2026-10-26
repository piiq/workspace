import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "bun";
import {
  createPluginDescriptor,
  type PluginDefinition,
  type PluginDescriptor,
} from "./index";

export interface BuildPluginOptions {
  /** Plugin project containing its own package.json and installed dependencies. */
  root?: string;
  /** Default export: PluginDefinition. Paths are relative to root. */
  entry: string;
  /** Files or directories copied to dist at their project-relative paths. */
  assets?: string[];
  /** Stylesheets loaded in the Workspace page. Defaults to all CSS assets. */
  styles?: string[];
}

const hostModules = {
  react: "react",
  "react-dom": "reactDom",
  "react-dom/client": "reactDomClient",
  "react/jsx-runtime": "jsxRuntime",
  "ag-grid-community": "agGrid",
} as const;

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

export async function buildPlugin(
  options: BuildPluginOptions,
): Promise<PluginDescriptor> {
  const root = resolve(options.root ?? process.cwd());
  const entry = resolve(root, options.entry);
  const output = join(root, "dist");
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const plugin: PluginDefinition = (await import(pathToFileURL(entry).href)).default;
  if (!plugin || typeof plugin !== "object") {
    throw new Error(`${options.entry} must default-export a PluginDefinition.`);
  }
  if (plugin.name !== packageJson.name || plugin.version !== packageJson.version) {
    throw new Error(
      "Plugin name and version must match its package.json. Use definePlugin(packageJson, declarations).",
    );
  }
  createPluginDescriptor(plugin, { entry: "entry.js" });

  // Each registration evaluates the bundle against that host's dependency instances.
  const result = await build({
    entrypoints: [entry],
    target: "browser",
    format: "cjs",
    throw: false,
    external: Object.keys(hostModules),
    plugins: [
      {
        name: "browser-plugin-imports",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, ({ path }) => {
            if (isBuiltin(path))
              throw new Error(
                `Node builtin modules are unavailable in browser plugins: ${path}`,
              );
            return undefined;
          });
        },
      },
    ],
    define: {
      "import.meta.url": "pluginEntryUrl",
      "process.env.NODE_ENV": '"production"',
    },
    naming: { entry: "plugin.cjs", asset: "assets/[name]-[hash].[ext]" },
  });
  if (!result.success) {
    throw new Error(
      `Failed to build ${packageJson.name}:\n${result.logs.map(String).join("\n")}`,
    );
  }
  const bundle = result.outputs.find((artifact) => artifact.kind === "entry-point");
  if (!bundle)
    throw new Error(`Build produced no entry module for ${packageJson.name}.`);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const artifact of result.outputs) {
    if (artifact === bundle) continue;
    const destination = join(output, artifact.path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, new Uint8Array(await artifact.arrayBuffer()));
  }
  for (const asset of options.assets ?? []) {
    const source = resolve(root, asset);
    const path = relative(root, source);
    if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) {
      throw new Error(
        `Asset paths must refer to files or directories inside the plugin project: ${asset}`,
      );
    }
    if (path === "dist" || path.startsWith(`dist${sep}`)) {
      throw new Error("Plugin assets must be outside dist.");
    }
    await cp(source, join(output, path), { recursive: true });
  }
  await writeFile(
    join(output, "entry.js"),
    `
const pluginEntryUrl = import.meta.url;
export async function register(api) {
  const bindings = ${JSON.stringify(hostModules)};
  const require = (name) => {
    const binding = bindings[name];
    if (!binding || !api.host[binding]) {
      throw new Error("Plugin dependency is unavailable from the host: " + name);
    }
    return api.host[binding];
  };
  const module = { exports: {} };
  ((module, exports, require) => {
${await bundle.text()}
  })(module, module.exports, require);
  await api.registerPlugin(module.exports.default);
}
`,
  );
  const assets = (await listFiles(output))
    .map((path) => relative(output, path).replaceAll("\\", "/"))
    .filter((path) => path !== "entry.js")
    .sort();
  const styles = options.styles ?? assets.filter((asset) => asset.endsWith(".css"));
  const descriptor = createPluginDescriptor(plugin, {
    entry: "entry.js",
    assets,
    styles,
  });
  await writeFile(
    join(output, "plugin.json"),
    `${JSON.stringify(descriptor, null, 2)}\n`,
  );
  return descriptor;
}
