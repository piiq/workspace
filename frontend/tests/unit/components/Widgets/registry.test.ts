import { definePlugin, type PluginHost } from "@piiq/workspace-plugin-sdk";
import { describe, expect, it } from "vitest";
import { getWidgetComponent, isAgGridWidget } from "~/components/Widgets";
import { createPluginApi } from "~/lib/plugins/api";

describe("widget renderer wrapping", () => {
  it("keeps the AG Grid wrapper for built-in grid renderers", () => {
    expect(isAgGridWidget("ag_grid_table")).toBe(true);
    expect(isAgGridWidget("metric")).toBe(false);
  });

  it("registers tables without AG Grid and wraps explicit AG Grid renderers", async () => {
    const Component = () => null;
    const api = createPluginApi({} as PluginHost);
    const plugin = definePlugin(
      { name: "@example/table-renderers", version: "1.0.0" },
      {
        renderers: [
          { name: "perspective", title: "Perspective", kind: "table", Component },
          {
            name: "grid",
            title: "AG Grid",
            kind: "table",
            wrapper: "ag-grid",
            Component,
          },
        ],
      },
    );
    await api.registerPlugin(plugin);
    expect(getWidgetComponent("@example/table-renderers/perspective")).toBe(Component);
    expect(isAgGridWidget("@example/table-renderers/perspective")).toBe(false);
    expect(isAgGridWidget("@example/table-renderers/grid")).toBe(true);
  });
});
