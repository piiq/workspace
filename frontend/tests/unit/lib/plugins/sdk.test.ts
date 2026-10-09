import {
  createPluginDescriptor,
  definePlugin,
  getRendererId,
  type PluginDefinition,
  pluginDescriptorSchema,
  pluginsManifestSchema,
} from "@piiq/workspace-plugin-sdk";
import type { AgGridCapabilityDefinition } from "@piiq/workspace-plugin-sdk/ag-grid";
import { describe, expect, it } from "vitest";

const Component = () => null;

describe("plugin SDK", () => {
  it("takes package identity from package.json and generates serializable metadata", () => {
    const plugin = definePlugin(
      { name: "@example/price-chart", version: "1.2.3" },
      {
        renderers: [
          {
            name: "chart",
            title: "Price chart",
            stateSchema: { type: "object", properties: { zoom: { type: "number" } } },
            capabilities: ["data-export", "refresh"],
            Component,
          },
        ],
      },
    );
    const descriptor = createPluginDescriptor(plugin, {
      entry: "entry.js",
      assets: ["assets/chart.css"],
    });
    expect(descriptor).toEqual({
      name: "@example/price-chart",
      version: "1.2.3",
      apiVersion: 1,
      entry: "entry.js",
      assets: ["assets/chart.css"],
      renderers: [
        {
          name: "chart",
          title: "Price chart",
          kind: "content",
          stateSchema: { type: "object", properties: { zoom: { type: "number" } } },
          capabilities: ["data-export", "refresh"],
        },
      ],
      agGridCapabilities: [],
    });
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
    expect(getRendererId(plugin.name, "chart")).toBe("@example/price-chart/chart");
  });

  it.each([
    ["unscoped", "chart"],
    ["@Example/plugin", "chart"],
    ["@example/plugin_name", "chart"],
    ["@example/plugin", "Chart"],
    ["@example/plugin", "price_chart"],
    ["@example/plugin", "chart/child"],
  ])("rejects invalid renderer identity %s/%s", (pluginId, name) => {
    expect(() => getRendererId(pluginId, name)).toThrow();
  });

  it("rejects incompatible descriptors and invalid schemas", () => {
    const descriptor = createPluginDescriptor(
      definePlugin({ name: "@example/chart", version: "1.0.0" }, { renderers: [] }),
      { entry: "entry.js" },
    );
    expect(
      pluginDescriptorSchema.safeParse({ ...descriptor, apiVersion: 2 }).success,
    ).toBe(false);
    expect(
      pluginDescriptorSchema.safeParse({
        ...descriptor,
        renderers: [{ name: "chart", title: "Chart", inputSchema: "string" }],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate declarations in descriptors", () => {
    const plugin = definePlugin(
      { name: "@example/chart", version: "1.0.0" },
      {
        renderers: [{ name: "chart", title: "Chart", Component }],
      },
    );
    const descriptor = createPluginDescriptor(plugin, { entry: "entry.js" });
    expect(() =>
      pluginDescriptorSchema.parse({
        ...descriptor,
        renderers: [...descriptor.renderers, ...descriptor.renderers],
      }),
    ).toThrow("Duplicate declaration");
    expect(() =>
      createPluginDescriptor(
        {
          ...plugin,
          agGridCapabilities: [
            { name: "chart", title: "Chart capability", modules: [] },
          ],
        },
        { entry: "entry.js" },
      ),
    ).toThrow("Duplicate declaration");
  });

  it("preserves AG capability declarations and serializes their metadata", () => {
    const capability: AgGridCapabilityDefinition = {
      name: "integrated-charts",
      title: "Integrated charts",
      modules: [],
      configureGrid: (options) => ({ ...options, enableCharts: true }),
    };
    const plugin = definePlugin(
      { name: "@example/ag-enterprise", version: "1.0.0" },
      { renderers: [], agGridCapabilities: [capability] },
    );
    expect(plugin.agGridCapabilities[0]).toBe(capability);
    expect(
      createPluginDescriptor(plugin, { entry: "entry.js" }).agGridCapabilities,
    ).toEqual([{ name: "integrated-charts", title: "Integrated charts" }]);
  });

  it("validates build and runtime selections without duplicating metadata", () => {
    const manifest = {
      plugins: [
        { mode: "build", source: { path: "../my-plugin" } },
        {
          mode: "build",
          source: { repository: "ssh://git.example/plugin.git", ref: "v1.0.0" },
        },
        { mode: "build", source: { dist: "../my-plugin/dist" } },
        { mode: "runtime", descriptorUrl: "/plugins/chart/plugin.json" },
      ],
    };
    expect(pluginsManifestSchema.parse(manifest)).toEqual(manifest);
    expect(pluginsManifestSchema.parse({ plugins: [] })).toEqual({ plugins: [] });
    expect(
      pluginsManifestSchema.safeParse({
        plugins: [
          {
            mode: "build",
            source: { path: "../plugin", dist: "../plugin/dist" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      pluginsManifestSchema.safeParse({
        plugins: [
          {
            mode: "runtime",
            descriptorUrl: "/plugins/chart/plugin.json",
            renderers: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects incompatible API versions at descriptor generation", () => {
    const plugin = {
      name: "@example/chart",
      version: "1.0.0",
      apiVersion: 2,
      renderers: [],
    };
    expect(() =>
      createPluginDescriptor(plugin as unknown as PluginDefinition, {
        entry: "entry.js",
      }),
    ).toThrow();
  });
});
