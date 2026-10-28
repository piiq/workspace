import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import type { Widget } from "~/lib/state/app";
import { useBackendConnectorStore, type Source } from "~/lib/state/backendConnector";

const mockWidgets = vi.hoisted(() => ({
  test_widget: {
    widgetId: "test_widget",
    name: "Test Widget",
    type: "table",
    description: "A test widget",
    category: "Test",
    subCategory: "Unit",
    source: ["test_source"],
    supportedAssetClasses: ["equity", "etf"],
    params: [
      { paramName: "symbol", type: "ticker", value: "AAPL" },
      { paramName: "period", type: "text", value: "annual" },
    ],
    data: {
      table: {
        columnsDefs: [
          { field: "date", headerName: "Date" },
          { field: "value", headerName: "Value" },
        ],
      },
    },
  },
  another_widget: {
    widgetId: "another_widget",
    name: "Another Widget",
    type: "chart",
    source: "single_source",
    supportedAssetClasses: ["crypto"],
  },

  widget_with_storage: {
    widgetId: "widget_with_storage",
    name: "Widget With Storage",
    type: "table",
    data: {
      table: {
        columnsDefs: [{ field: "default", headerName: "Default" }],
      },
    },
  },
  per_widget_test: {
    widgetId: "per_widget_test",
    name: "Per Widget Test",
    type: "table",
  },
  copilot_table: {
    widgetId: "copilot_table",
    name: "Copilot Table",
    type: "table",
  },
  charting: {
    widgetId: "charting",
    name: "Charting",
    type: "chart",
  },
  navigation_bar: {
    widgetId: "navigation_bar",
    name: "Navigation Bar",
    type: "table",
  },


}));

vi.mock("~/lib/plugins/registry", () => ({
  widgetRegistry: {
    registerBuiltins: vi.fn(),
    getRendererState: (id: string) => mockWidgets[id]
      ? { status: "ready", renderer: { id, widget: mockWidgets[id] } }
      : { status: "unavailable" },
    getRenderers: () => Object.keys(mockWidgets).map((id) => ({ id })),
  },
}));

vi.mock("~/lib/templates", () => ({
  TEMPLATES: {},
}));

vi.mock("~/hooks/useAllTemplates", () => ({
  useAllTemplates: () => [],
}));

import {
  extractColumns,
  getBuiltinWidgets,
  getAllWidgets,
  getWidgetDataSource,
  getCleanWidgetId,
  getWidgetColumnDefs,
  getWidgetDefinition,
  getUUIDFromWidgetId,
  getWidgetInfo,
  getWidgetSourceInfo,
  isSSRMType,
  METADATA_WIDGETS,
  processWidgetId,
  WIDGETS_CONNECTION_TYPES,
} from "~/lib/utils/widget";

describe("declared widget metadata", () => {
  afterEach(() => {
    useBackendConnectorStore.setState({ apiSources: [], singleWidgets: [], storedFiles: [], widgetMetadata: [] });
  });

  it("does not replace a backend declaration with built-in defaults for the same ID", () => {
    const widget = { widgetId: "test_widget", external: true, name: "My table", source: ["My feed"], params: [{ paramName: "region", type: "text", value: "eu" }] } as Partial<WidgetT>;
    expect(getWidgetDefinition(widget)).toEqual(widget);
  });

  it("lists connected backend declarations, including a backend named root", () => {
    useBackendConnectorStore.setState({ apiSources: [{ id: "root", name: "My backend", url: "http://backend.test", endpointHeaders: [], widgets: { totals: { widgetId: "totals", name: "Totals", description: "Totals", type: "@example/totals/table", endpoint: "/totals" } } } as Source], singleWidgets: [], storedFiles: [], widgetMetadata: [] });
    expect(getAllWidgets(undefined, ["backend"])).toEqual([
      expect.objectContaining({ widgetId: "totals", type: "@example/totals/table", endpoint: "http://backend.test/totals", sourceName: "My backend", external: true }),
    ]);
    expect(getAllWidgets("root", ["backend"])).toEqual([]);
  });

  it("takes source metadata from the declaration or its connected backend", () => {
    useBackendConnectorStore.setState({ apiSources: [{ id: "backend", name: "My backend" } as Source] });
    expect(getWidgetDataSource({ sourceId: "backend", source: ["Declared feed"] })).toEqual(["Declared feed"]);
    expect(getWidgetDataSource({ sourceId: "backend" })).toEqual(["My backend"]);
    expect(getWidgetDataSource({ sourceName: "Uploaded file" })).toEqual(["Uploaded file"]);
    expect(getWidgetDataSource(null)).toEqual([]);
  });

  it("gets independent copies of built-in widget definitions from renderer registration", () => {
    const first = getBuiltinWidgets();
    first[0].name = "Changed";
    expect(getBuiltinWidgets()[0].name).toBe("Test Widget");
  });
});

describe("Widget Utility Functions", () => {
  describe("getWidgetDefinition", () => {
    it("should return widget data when passed a valid widget ID string", () => {
      const result = getWidgetDefinition("test_widget" as any);
      expect(result).not.toBeNull();
      expect(result?.widgetId).toBe("test_widget");
      expect(result?.name).toBe("Test Widget");
    });

    it("should return null for non-existent widget ID", () => {
      const result = getWidgetDefinition("non_existent_widget" as any);
      expect(result).toBeNull();
    });

    it("should return widget data when passed a widget object with widgetId", () => {
      const widgetObj = { widgetId: "test_widget" } as Partial<Widget>;
      const result = getWidgetDefinition(widgetObj as any);
      expect(result).not.toBeNull();
      expect(result?.widgetId).toBe("test_widget");
    });

    it("preserves a user declaration without a built-in definition", () => {
      const customWidget = {
        widgetId: "custom_external",
        name: "Custom External Widget",
        external: true,
      } as Partial<Widget>;
      const result = getWidgetDefinition(customWidget as any);
      expect(result?.widgetId).toBe("custom_external");
      expect(result?.name).toBe("Custom External Widget");
    });

    it("should return a deep clone, not the original object", () => {
      const result1 = getWidgetDefinition("test_widget" as any);
      const result2 = getWidgetDefinition("test_widget" as any);
      expect(result1).not.toBe(result2);
      if (result1 && result2) {
        result1.name = "Modified";
        expect(result2.name).toBe("Test Widget");
      }
    });
  });

  describe("getWidgetColumnDefs", () => {
    it("should return column definitions for a valid widget ID", () => {
      const result = getWidgetColumnDefs("test_widget" as any);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: "date", headerName: "Date" });
    });

    it("should return empty array for non-existent widget", () => {
      const result = getWidgetColumnDefs("non_existent" as any);
      expect(result).toEqual([]);
    });

    it("should prioritize storage.columnDefs over widget.data.table.columnsDefs", () => {
      const widgetWithStorage = {
        widgetId: "widget_with_storage",
        storage: {
          columnDefs: [{ field: "custom", headerName: "Custom" }],
        },
      } as Partial<Widget>;
      const result = getWidgetColumnDefs(widgetWithStorage as any);
      expect(result).toEqual([{ field: "custom", headerName: "Custom" }]);
    });

    it("should use external widget data for external widgets", () => {
      const externalWidget = {
        widgetId: "external_widget",
        external: true,
        data: {
          table: {
            columnsDefs: [{ field: "external_col", headerName: "External" }],
          },
        },
      } as unknown as Partial<Widget>;
      const result = getWidgetColumnDefs(externalWidget as any);
      expect(result).toEqual([{ field: "external_col", headerName: "External" }]);
    });

    it("should return empty array for null widget", () => {
      const result = getWidgetColumnDefs(null as any);
      expect(result).toEqual([]);
    });
  });

  describe("isSSRMType", () => {
    it.each([
      "@piiq/ag-enterprise/server-side-table",
      "@piiq/ag-enterprise/advanced-server-side-table",
    ] as const)("recognizes %s", (id) => {
      expect(isSSRMType(id)).toBe(true);
    });
    it("should return true for ssrm_table type", () => {
      expect(isSSRMType("ssrm_table" as any)).toBe(true);
    });

    it("should return true for ssrm_advanced type", () => {
      expect(isSSRMType("ssrm_advanced" as any)).toBe(true);
    });

    it("should return false for regular table type", () => {
      expect(isSSRMType("table")).toBe(false);
    });

    it("should return false for chart type", () => {
      expect(isSSRMType("chart")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSSRMType(undefined)).toBe(false);
    });
  });

  describe("getWidgetSourceInfo", () => {
    it("should return source info for a widget", () => {
      const widget = {
        widgetId: "test_widget",
        sourceName: "Test Source",
        source: ["provider1"],
      } as unknown as Widget;
      const result = getWidgetSourceInfo(widget);
      expect(result.sourceName).toBe("Test Source");
    });

    it("should handle array source names", () => {
      const widget = {
        widgetId: "test_widget",
        sourceName: ["Source 1", "Source 2"],
        source: ["provider1"],
      } as unknown as Widget;
      const result = getWidgetSourceInfo(widget);
      expect(result.sourceName).toBe("Source 1, Source 2");
    });

    it("should handle null widget", () => {
      const result = getWidgetSourceInfo(null);
      expect(result.source).toBe("");
      expect(result.sourceName).toBe("");
    });
  });

  describe("getWidgetInfo", () => {
    it("should extract widget info fields", () => {
      const widget = {
        type: "table",
        name: "Test Widget",
        description: "A test",
        category: "Category",
        subCategory: "SubCategory",
        source: ["source1"],
      } as Partial<WidgetT>;
      const result = getWidgetInfo(widget);
      expect(result).toEqual({
        type: "table",
        name: "Test Widget",
        description: "A test",
        category: "Category",
        subCategory: "SubCategory",
        source: ["source1"],
      });
    });

    it("should handle partial widget with missing fields", () => {
      const widget = { type: "chart" } as Partial<WidgetT>;
      const result = getWidgetInfo(widget);
      expect(result.type).toBe("chart");
      expect(result.name).toBeUndefined();
    });
  });

  describe("extractColumns", () => {
    it("should extract column names from array of objects", () => {
      const data = [
        { name: "John", age: 30, city: "NYC" },
        { name: "Jane", age: 25, city: "LA" },
      ];
      const result = extractColumns(data);
      expect(result).toEqual(["name", "age", "city"]);
    });

    it("should return null for empty array", () => {
      expect(extractColumns([])).toBeNull();
    });

    it("should return null for non-array data", () => {
      expect(extractColumns({ key: "value" })).toBeNull();
      expect(extractColumns("string")).toBeNull();
      expect(extractColumns(123)).toBeNull();
    });

    it("should return null for null/undefined", () => {
      expect(extractColumns(null)).toBeNull();
      expect(extractColumns(undefined)).toBeNull();
    });

    it("should return null for array of primitives", () => {
      expect(extractColumns([1, 2, 3])).toBeNull();
      expect(extractColumns(["a", "b", "c"])).toBeNull();
    });

    it("should return null for array of arrays", () => {
      expect(
        extractColumns([
          [1, 2],
          [3, 4],
        ]),
      ).toBeNull();
    });

    it("should return null for object with no keys", () => {
      expect(extractColumns([{}])).toBeNull();
    });

    it("should use first row to determine columns", () => {
      const data = [
        { a: 1, b: 2 },
        { a: 3, b: 4, c: 5 },
      ];
      const result = extractColumns(data);
      expect(result).toEqual(["a", "b"]);
    });
  });

  describe("getCleanWidgetId", () => {
    it("should clean file prefix", () => {
      expect(getCleanWidgetId("file-789")).toBe("ag_grid_file");
      expect(getCleanWidgetId("shared_file-abc")).toBe("ag_grid_file");
    });

    it("should clean iframe prefix", () => {
      expect(getCleanWidgetId("iframe-abc123")).toBe("iframe");
    });

    it("should clean rss_viewer prefix", () => {
      expect(getCleanWidgetId("rss_viewer-feed123")).toBe("rss_viewer");
    });

    it("should clean rich_note prefix", () => {
      expect(getCleanWidgetId("rich_note-note123")).toBe("rich_note");
    });

    it("should clean copilot_table prefix", () => {
      expect(getCleanWidgetId("copilot_table-table123")).toBe("copilot_table");
    });





    it("should return original widgetId for advanced-backend connectionType", () => {
      expect(getCleanWidgetId("custom-widget-id", "advanced-backend")).toBe(
        "custom-widget-id",
      );
    });

    it("should return widgetId unchanged if no pattern matches", () => {
      expect(getCleanWidgetId("regular_widget")).toBe("regular_widget");
    });
  });

  describe("getUUIDFromWidgetId", () => {
    it("should extract UUID from iframe widget ID", () => {
      expect(getUUIDFromWidgetId("iframe-abc123")).toBe("abc123");
    });

    it("should extract UUID from file widget ID", () => {
      expect(getUUIDFromWidgetId("file-file123")).toBe("file123");
      expect(getUUIDFromWidgetId("shared_file-shared123")).toBe("shared123");
    });

    it("should extract UUID from rss_viewer widget ID", () => {
      expect(getUUIDFromWidgetId("rss_viewer-feed123")).toBe("feed123");
    });

    it("should extract UUID from rich_note widget ID", () => {
      expect(getUUIDFromWidgetId("rich_note-note123")).toBe("note123");
    });

    it("should extract UUID from copilot_table widget ID", () => {
      expect(getUUIDFromWidgetId("copilot_table-table123")).toBe("table123");
    });





    it("should return original ID if no prefix matches", () => {
      expect(getUUIDFromWidgetId("regular_widget")).toBe("regular_widget");
      expect(getUUIDFromWidgetId("custom-id")).toBe("custom-id");
    });
  });

  describe("processWidgetId", () => {
    it("should return both UUID and cleanWidgetId", () => {
      const result = processWidgetId("iframe-abc123");
      expect(result.uuid).toBe("abc123");
      expect(result.cleanWidgetId).toBe("iframe");
    });

    it("should process file widget ID", () => {
      const result = processWidgetId("file-file123");
      expect(result.uuid).toBe("file123");
      expect(result.cleanWidgetId).toBe("ag_grid_file");
    });

    it("should process copilot_table widget ID", () => {
      const result = processWidgetId("copilot_table-ct123");
      expect(result.uuid).toBe("ct123");
      expect(result.cleanWidgetId).toBe("copilot_table");
    });

    it("should handle regular widget ID without prefix", () => {
      const result = processWidgetId("regular_widget");
      expect(result.uuid).toBe("regular_widget");
      expect(result.cleanWidgetId).toBe("regular_widget");
    });

    it("should respect connectionType for cleanWidgetId", () => {
      const result = processWidgetId("custom-widget", "advanced-backend");
      expect(result.uuid).toBe("custom-widget");
      expect(result.cleanWidgetId).toBe("custom-widget");
    });


  });

  describe("Constants", () => {
    describe("METADATA_WIDGETS", () => {
      it("should contain expected widget types", () => {
        expect(METADATA_WIDGETS).toContain("websites");
        expect(METADATA_WIDGETS).toContain("rss_feeds");
        expect(METADATA_WIDGETS).toContain("notes");
        expect(METADATA_WIDGETS).toContain("copilot_table");
      });

      it("should include legacy widget names", () => {
        expect(METADATA_WIDGETS).toContain("note");
        expect(METADATA_WIDGETS).toContain("website");
        expect(METADATA_WIDGETS).toContain("rss");
      });
    });

    describe("WIDGETS_CONNECTION_TYPES", () => {
      it("should contain all connection types", () => {
        expect(WIDGETS_CONNECTION_TYPES).toContain("individual");
        expect(WIDGETS_CONNECTION_TYPES).toContain("single");
        expect(WIDGETS_CONNECTION_TYPES).toContain("backend");
        expect(WIDGETS_CONNECTION_TYPES).toContain("file");
        expect(WIDGETS_CONNECTION_TYPES).toContain("widgetMetadata");
      });

      it("should have exactly 5 connection types", () => {
        expect(WIDGETS_CONNECTION_TYPES.length).toBe(5);
      });
    });
  });

  describe("Edge Cases", () => {
    describe("getWidgetDefinition edge cases", () => {
      it("should handle empty string widget ID", () => {
        const result = getWidgetDefinition("" as any);
        expect(result).toBeNull();
      });

      it("should handle widget object with undefined widgetId", () => {
        const result = getWidgetDefinition({ widgetId: undefined } as any);
        expect(result).not.toBeNull();
      });
    });

    describe("extractColumns edge cases", () => {
      it("should handle object with Symbol keys", () => {
        const symbolKey = Symbol("test");
        const data = [{ [symbolKey]: "value", normalKey: "normal" }];
        const result = extractColumns(data);
        expect(result).toContain("normalKey");
      });

      it("should handle deeply nested objects as first element", () => {
        const data = [{ nested: { deep: { value: 1 } }, flat: "test" }];
        const result = extractColumns(data);
        expect(result).toEqual(["nested", "flat"]);
      });
    });

    describe("processWidgetId edge cases", () => {
      it("should handle hyphenated UUIDs", () => {
        const result = processWidgetId("iframe-550e8400-e29b-41d4-a716-446655440000");
        expect(result.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(result.cleanWidgetId).toBe("iframe");
      });
    });

    describe("getCleanWidgetId edge cases", () => {
      it("should handle widget ID that is exactly the prefix", () => {
        expect(getCleanWidgetId("file-")).toBe("ag_grid_file");
      });

      it("should handle widget ID with special characters after prefix", () => {
        expect(getCleanWidgetId("iframe-!@#$%")).toBe("iframe");
      });
    });
  });

  describe("Type Guards and Validation", () => {
    describe("isSSRMType type checking", () => {
      it("should correctly identify SSRM types as boolean", () => {
        const result: boolean = isSSRMType("ssrm_table" as any);
        expect(typeof result).toBe("boolean");
      });
    });
  });
});
