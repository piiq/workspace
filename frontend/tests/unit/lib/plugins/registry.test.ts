import { definePlugin, type PluginHost } from "@piiq/workspace-plugin-sdk";
import type { AgGridPluginDefinition } from "@piiq/workspace-plugin-sdk/ag-grid";
import { AllCommunityModule } from "ag-grid-community";
import { describe, expect, it, vi } from "vitest";
import { createPluginApi } from "~/lib/plugins/api";
import { PluginRegistry } from "~/lib/plugins/registry";
import { RENDERER_BINDINGS } from "~/lib/plugins/rendererBindings";

const Component = () => null;
const plugin = (name = "@example/chart") =>
  definePlugin(
    { name, version: "1.0.0" },
    {
      renderers: [
        { name: "chart", title: "Chart", Component, capabilities: ["refresh"] },
      ],
    },
  );

function setup() {
  const registry = new PluginRegistry();
  const registerModules = vi.fn();
  const host = {
    agGrid: { ModuleRegistry: { registerModules } },
  } as unknown as PluginHost;
  return { registry, host, registerModules, api: createPluginApi(host, registry) };
}

describe("plugin registry", () => {
  it("resolves table through the registered Community renderer", () => {
    const { registry } = setup();
    registry.registerBuiltins([{ id: "ag_grid_table", title: "Table", Component }]);
    expect(registry.getRendererState("table")).toMatchObject({
      status: "ready",
      renderer: { id: "ag_grid_table", Component },
    });
  });

  it.each(
    Object.entries(RENDERER_BINDINGS).filter(([id]) => id !== "table"),
  )("keeps the fixed binding for %s when its plugin is absent or installed", async (id, boundId) => {
    const { registry, api } = setup();
    const packageId = boundId.slice(0, boundId.lastIndexOf("/"));
    const name = boundId.slice(boundId.lastIndexOf("/") + 1);
    expect(registry.getRendererState(id)).toMatchObject({
      status: "unavailable",
      message: expect.stringContaining(packageId),
    });
    await api.registerPlugin(
      definePlugin(
        { name: packageId, version: "1.0.0" },
        {
          renderers: [{ name, title: name, Component }],
        },
      ),
    );
    expect(registry.getRendererState(id)).toMatchObject({
      status: "ready",
      renderer: { id: boundId, Component },
    });
  });

  it("uses an existing built-in registration for a bound ID", () => {
    const { registry } = setup();
    registry.registerBuiltins([{ id: "charting", title: "Charting", Component }]);
    expect(registry.getRendererState("charting")).toMatchObject({
      status: "ready",
      renderer: { id: "charting", Component },
    });
  });

  it("reports incompatible API versions on affected renderers", () => {
    const { registry, api } = setup();
    registry.registerBuiltins([{ id: "clock", title: "Clock", Component }]);
    const incompatible = { ...plugin(), apiVersion: 2 } as unknown as ReturnType<
      typeof plugin
    >;
    expect(() => api.registerPlugin(incompatible)).toThrow("Workspace supports API 1");
    expect(registry.getRendererState("@example/chart/chart")).toMatchObject({
      status: "failed",
      message: expect.stringContaining("Install a compatible plugin version"),
    });
    expect(registry.getRendererState("clock").status).toBe("ready");
  });
  it("reports a missing component on affected renderers", () => {
    const { registry, api } = setup();
    registry.registerBuiltins([{ id: "clock", title: "Clock", Component }]);
    const definition = plugin();
    definition.renderers[0].Component = undefined as any;
    expect(() => api.registerPlugin(definition)).toThrow("Renderer has no component");
    expect(registry.getRendererState("@example/chart/chart")).toMatchObject({
      status: "failed",
      message: expect.stringContaining("Renderer has no component"),
    });
    expect(registry.getRendererState("clock").status).toBe("ready");
  });

  it("preserves core IDs and uses qualified IDs for plugins", async () => {
    const { registry, api } = setup();
    registry.registerBuiltins([
      {
        id: "ag_grid_table",
        title: "Table",
        Component,
        kind: "table",
        wrapper: "ag-grid",
      },
    ]);
    await api.registerPlugin(plugin());
    expect(registry.getRendererState("ag_grid_table")).toMatchObject({
      status: "ready",
      renderer: { kind: "table", wrapper: "ag-grid", Component },
    });
    expect(registry.getRendererState("@example/chart/chart")).toMatchObject({
      status: "ready",
      renderer: { pluginId: "@example/chart", capabilities: ["refresh"], Component },
    });
    expect(registry.getRendererState("chart").status).toBe("unavailable");
  });

  it("allows the same local renderer name in separate plugins", async () => {
    const { registry, api } = setup();
    await api.registerPlugin(plugin("@example/first"));
    await api.registerPlugin(plugin("@example/second"));
    expect(registry.getRenderers().map((renderer) => renderer.id)).toEqual([
      "@example/first/chart",
      "@example/second/chart",
    ]);
  });

  it("rejects a plugin selected through both loaders, including pending registration", async () => {
    const { registry, host, api } = setup();
    const runtimeApi = createPluginApi(host, registry);
    const pending = api.registerPlugin(plugin());
    expect(() => runtimeApi.registerPlugin(plugin())).toThrow(
      "Plugin already registered",
    );
    await pending;
    expect(() => runtimeApi.registerPlugin(plugin())).toThrow(
      "Plugin already registered",
    );
  });

  it("rejects renderer collisions without partially publishing a core batch", () => {
    const { registry } = setup();
    registry.registerBuiltins([{ id: "clock", title: "Clock", Component }]);
    expect(() =>
      registry.registerBuiltins([
        { id: "new", title: "New", Component },
        { id: "clock", title: "Clock", Component },
      ]),
    ).toThrow("Renderer already registered");
    expect(registry.getRendererState("new").status).toBe("unavailable");
  });

  it("waits for setup and AG module registration before exposing a renderer", async () => {
    const { registry, host, api, registerModules } = setup();
    let finishSetup: () => void;
    const setupDone = new Promise<void>((resolve) => {
      finishSetup = resolve;
    });
    const definition: AgGridPluginDefinition = plugin();
    definition.setup = vi.fn(async (bindings) => {
      expect(bindings).toBe(host);
      await setupDone;
    });
    definition.agGridCapabilities = [
      {
        name: "integrated-charts",
        title: "Integrated charts",
        modules: [AllCommunityModule],
        configureGrid: (options) => ({ ...options, enableCharts: true }),
      },
    ];
    const changed = vi.fn();
    const unsubscribe = registry.subscribe(changed);
    const pending = api.registerPlugin(definition);
    const resolved = registry.resolveRenderer("@example/chart/chart");
    expect(registry.getRendererState("@example/chart/chart").status).toBe("pending");
    expect(registry.hasAgGridCapability("@example/chart/integrated-charts")).toBe(
      false,
    );
    registerModules.mockImplementation(() => {
      expect(registry.getRendererState("@example/chart/chart").status).toBe("pending");
    });
    finishSetup();
    await pending;
    expect(registerModules).toHaveBeenCalledWith([AllCommunityModule]);
    expect((await resolved).status).toBe("ready");
    expect(registry.hasAgGridCapability("@example/chart/integrated-charts")).toBe(true);
    expect(registry.configureGrid({ rowModelType: "clientSide" })).toEqual({
      rowModelType: "clientSide",
      enableCharts: true,
    });
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("reports failed setup on affected renderers and preserves unrelated widgets", async () => {
    const { registry, api } = setup();
    registry.registerBuiltins([{ id: "clock", title: "Clock", Component }]);
    const definition = plugin();
    definition.setup = () => {
      throw new Error("Library assets are missing");
    };
    const registration = api.registerPlugin(definition);
    const resolved = registry.resolveRenderer("@example/chart/chart");
    await expect(registration).rejects.toThrow("Library assets are missing");
    expect(await resolved).toMatchObject({
      status: "failed",
      message: expect.stringContaining("Library assets are missing"),
    });
    expect(registry.getRendererState("clock").status).toBe("ready");
    expect(registry.getRenderers()).toHaveLength(1);
  });

  it("gives an actionable diagnostic for an absent plugin", () => {
    const { registry } = setup();
    expect(registry.getRendererState("@example/chart/chart")).toEqual({
      status: "unavailable",
      message:
        "Renderer @example/chart/chart is unavailable. Install a compatible @example/chart plugin and reload Workspace.",
    });
    expect(registry.configureGrid(undefined)).toBeUndefined();
  });
});
