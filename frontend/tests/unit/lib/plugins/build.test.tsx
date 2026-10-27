import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { type PluginHost, pluginDescriptorSchema } from "@piiq/workspace-plugin-sdk";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as reactDom from "react-dom";
import * as reactDomClient from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginApi } from "~/lib/plugins/api";
import { PluginRegistry } from "~/lib/plugins/registry";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../../../../..");
const example = join(root, "examples/plugins/basic-widget");
const projects: string[] = [];

async function createProject() {
  const directory = await mkdtemp(join(tmpdir(), "workspace-plugin-build-"));
  projects.push(directory);
  await cp(example, directory, {
    recursive: true,
    filter: (path) => !["node_modules", "dist"].includes(path.split("/").at(-1) ?? ""),
  });
  await mkdir(join(directory, "node_modules/@piiq"), { recursive: true });
  await symlink(
    join(root, "packages/plugin-sdk"),
    join(directory, "node_modules/@piiq/workspace-plugin-sdk"),
  );
  for (const dependency of ["react", "react-dom"]) {
    await symlink(
      join(root, "frontend/node_modules", dependency),
      join(directory, "node_modules", dependency),
    );
  }
  return directory;
}

async function compile(directory: string, assets = ["assets"]) {
  await run("bun", [
    join(root, "scripts/build-plugin.ts"),
    "--path",
    directory,
    ...assets.flatMap((asset) => ["--asset", asset]),
  ]);
  const descriptor = pluginDescriptorSchema.parse(
    JSON.parse(await readFile(join(directory, "dist/plugin.json"), "utf8")),
  );
  const module = createRequire(import.meta.url)(
    join(directory, "dist", descriptor.entry),
  );
  return {
    descriptor,
    register: module.register as (
      api: ReturnType<typeof createPluginApi>,
    ) => Promise<void>,
  };
}

function createHost() {
  const rows = [{ symbol: "AAPL", price: 123 }];
  const lifecycle = vi.fn();
  const refetch = vi.fn().mockResolvedValue(undefined);
  const host: PluginHost = {
    react: React,
    reactDom,
    reactDomClient,
    jsxRuntime,
    useTheme: () => "dark",
    useWidgetContext: () => ({
      id: "saved-widget",
      rendererId: "@example/basic-widget/table",
      parameters: { symbol: "AAPL" },
      state: { selectedRow: 0 },
      theme: "dark",
      setParameters: vi.fn(),
      setState: vi.fn(),
    }),
    useWidgetData: vi.fn().mockReturnValue({
      data: rows,
      isLoading: false,
      isFetching: false,
      error: null,
      lastUpdated: 42,
      refetch,
    }),
    useWidgetDataExport: vi.fn(),
    useWidgetLifecycle: lifecycle,
    ui: {
      Button: ({ children, ...props }) =>
        React.createElement("button", props, children),
      Icon: () => null,
      Tooltip: ({ children }) => React.createElement(React.Fragment, null, children),
      RawDataTable: () => null,
      WidgetShell: ({ children, toolbar, data }) => {
        host.useWidgetDataExport({ data, enabled: true });
        return React.createElement("section", null, toolbar, children);
      },
    },
  };
  return { host, rows, lifecycle, refetch };
}

afterEach(async () => {
  for (const project of projects.splice(0))
    await rm(project, { recursive: true, force: true });
});

describe("independent plugin builds", () => {
  it("registers compiled example code and uses host data, state, export, and refresh", async () => {
    const directory = await createProject();
    const { descriptor, register } = await compile(directory);
    expect(descriptor).toMatchObject({
      name: "@example/basic-widget",
      version: "0.1.0",
      entry: "entry.js",
      assets: ["assets/style.css"],
      styles: ["assets/style.css"],
      renderers: [{ name: "table", capabilities: ["data-export", "refresh"] }],
    });
    expect(await readFile(join(directory, "dist/assets/style.css"), "utf8")).toContain(
      ".basic-widget",
    );
    const { host, rows, lifecycle, refetch } = createHost();
    const registry = new PluginRegistry();
    await register(createPluginApi(host, registry));
    const state = registry.getRendererState("@example/basic-widget/table");
    expect(state.status).toBe("ready");
    if (state.status !== "ready")
      throw new Error("Example renderer was not registered.");
    const html = renderToStaticMarkup(React.createElement(state.renderer.Component));
    expect(html).toContain('value="AAPL"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("123");
    expect(host.useWidgetData).toHaveBeenCalled();
    expect(host.useWidgetDataExport).toHaveBeenCalledWith({
      data: rows,
      enabled: true,
    });
    const callbacks = lifecycle.mock.calls[0][0];
    expect(callbacks.exportData()).toEqual({
      data: rows,
      columns: ["symbol", "price"],
    });
    await callbacks.refresh();
    expect(refetch).toHaveBeenCalledOnce();
  }, 15000);

  it("copies library CSS without marking it for loading in the host page", async () => {
    const directory = await createProject();
    await run(
      "bun",
      [
        "-e",
        `import { buildPlugin } from "@piiq/workspace-plugin-sdk/build"; await buildPlugin({ root: ${JSON.stringify(directory)}, entry: "src/index.tsx", assets: ["assets"], styles: [] });`,
      ],
      { cwd: directory },
    );
    const descriptor = JSON.parse(
      await readFile(join(directory, "dist/plugin.json"), "utf8"),
    );
    expect(descriptor.assets).toEqual(["assets/style.css"]);
    expect(descriptor.styles).toEqual([]);
  });

  it("shares React, JSX, ReactDOM, and AG modules and resolves emitted assets beside entry.js", async () => {
    const directory = await createProject();
    for (const dependency of [
      "ag-grid-community",
      "ag-charts-community",
      "ag-charts-core",
    ]) {
      await symlink(
        join(root, "frontend/node_modules", dependency),
        join(directory, "node_modules", dependency),
      );
    }
    await writeFile(
      join(directory, "assets/mark.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    );
    await writeFile(
      join(directory, "src/index.tsx"),
      `
import { definePlugin } from "@piiq/workspace-plugin-sdk";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as Client from "react-dom/client";
import * as JSX from "react/jsx-runtime";
import * as AG from "ag-grid-community";
import * as Charts from "ag-charts-community";
import * as ChartsCore from "ag-charts-core";
import image from "../assets/mark.svg";
import packageJson from "../package.json";
const context = React.createContext(null);
export default definePlugin(packageJson, {
  setup(host) {
    if (
      React.createContext !== host.react.createContext ||
      ReactDOM.createPortal !== host.reactDom.createPortal ||
      Client.createRoot !== host.reactDomClient.createRoot ||
      JSX.jsx !== host.jsxRuntime.jsx ||
      AG.ModuleRegistry !== host.agGrid.ModuleRegistry ||
      Charts.AgCharts !== host.agCharts.AgCharts ||
      ChartsCore.EventEmitter !== host.agChartsCore.EventEmitter
    ) throw new Error("Host dependency instances differ");
  },
  renderers: [{ name: "image", title: "Image", Component: () => JSX.jsx(context.Provider, { value: null, children: JSX.jsx("img", { src: new URL(image, import.meta.url).href }) }) }],
});
`,
    );
    const { descriptor, register } = await compile(directory);
    const { host } = createHost();
    const registry = new PluginRegistry();
    const agGrid = await import("ag-grid-community");
    const agCharts = await import("ag-charts-community");
    const agChartsCore = await import("ag-charts-core");
    const gridHost = { ...host, agGrid, agCharts, agChartsCore };
    await register(createPluginApi(gridHost, registry));
    const state = registry.getRendererState("@example/basic-widget/image");
    if (state.status !== "ready") throw new Error("Image renderer was not registered.");
    const html = renderToStaticMarkup(React.createElement(state.renderer.Component));
    const imagePath = descriptor.assets.find((path) => /mark-.*\.svg$/.test(path));
    expect(imagePath).toBeDefined();
    expect(html).toContain(
      new URL(
        imagePath!,
        pathToFileURL(await realpath(join(directory, "dist/entry.js"))),
      ).href,
    );
    expect(await readFile(join(directory, "dist", imagePath!), "utf8")).toContain(
      "<svg",
    );
  }, 15000);

  it.each([
    { failure: "incompatible-api", message: "Invalid input: expected 1" },
    { failure: "missing-asset", message: "missing-assets" },
    {
      failure: "browser-import",
      message: "Node builtin modules are unavailable in browser plugins: node:fs",
    },
  ])("fails the build for $failure", async ({ failure, message }) => {
    const directory = await createProject();
    let assets = ["assets"];
    if (failure === "incompatible-api") {
      await writeFile(
        join(directory, "src/index.tsx"),
        'export default { name: "@example/basic-widget", version: "0.1.0", apiVersion: 2, renderers: [] };',
      );
    } else if (failure === "missing-asset") {
      assets = ["missing-assets"];
    } else {
      await writeFile(
        join(directory, "src/index.tsx"),
        `
import { readFileSync } from "node:fs";
export default { name: "@example/basic-widget", version: "0.1.0", apiVersion: 1, renderers: [{ name: "file", title: "File", Component: () => readFileSync("file.txt") }] };
`,
      );
    }
    await expect(compile(directory, assets)).rejects.toThrow(message);
    await expect(
      readFile(join(directory, "dist/plugin.json"), "utf8"),
    ).rejects.toThrow();
  }, 15000);

  it("shows CLI help and rejects unknown options", async () => {
    const script = join(root, "scripts/build-plugin.ts");
    const { stdout } = await run("bun", [script, "--help"]);
    expect(stdout).toContain("--asset");
    await expect(run("bun", [script, "--unknown-option"])).rejects.toThrow(
      "Unknown option",
    );
  });
});
