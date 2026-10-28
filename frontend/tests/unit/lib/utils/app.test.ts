import { describe, expect, it, vi } from "vitest";
import { createSourceWidget } from "~/components/DataConnectors/common/helpers";
import type { Source } from "~/lib/state/backendConnector";
import type { WidgetType } from "~/utils/zodForms";
import {
  checkIfWidgetsHaveMainTickerAndAreTheSame,
  createRootFolder,
  createTab,
  getWidgetData,
  recursiveCleanKeys,
  updateWidgetGridLayout,
} from "~/lib/utils/app";

describe("app utils", () => {
  describe("checkIfWidgetsHaveMainTickerAndAreTheSame", () => {
    it("returns correct flags for widgets with same ticker", () => {
      const widgets = [
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
      ] as any;
      const result = checkIfWidgetsHaveMainTickerAndAreTheSame(widgets);
      expect(result.someHaveMainTicker).toBe(true);
      expect(result.allTheSame).toBe(true);
      expect(result.mainTicker.id).toBe("AAPL");
    });

    it("returns allTheSame false for different tickers", () => {
      const widgets = [
        { data: { mainTicker: { id: "AAPL", type: "stock" } } },
        { data: { mainTicker: { id: "MSFT", type: "stock" } } },
      ] as any;
      const result = checkIfWidgetsHaveMainTickerAndAreTheSame(widgets);
      expect(result.someHaveMainTicker).toBe(true);
      expect(result.allTheSame).toBe(false);
    });
  });

  describe("createTab", () => {
    it("calls addTab with new uuid and random name", () => {
      const addTab = vi.fn();
      createTab(addTab);
      expect(addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          index: expect.any(String),
          data: expect.objectContaining({
            name: expect.any(String),
            type: "custom",
          }),
        }),
      );
    });
  });

  describe("createRootFolder", () => {
    it("creates a root folder structure", () => {
      const folder = createRootFolder();
      expect(folder.isRoot).toBe(true);
      expect(folder.name).toBe("root");
      expect(folder.isFolder).toBe(true);
    });
  });

  describe("recursiveCleanKeys", () => {
    it("removes _undefined from keys", () => {
      const data = {
        foo_undefined: "bar",
        nested: {
          baz_undefined: "qux",
        },
      };
      const cleaned = recursiveCleanKeys(data);
      expect(cleaned.foo).toBe("bar");
      expect(cleaned.nested.baz).toBe("qux");
      expect(cleaned.foo_undefined).toBeUndefined();
    });
  });

  describe("updateWidgetGridLayout", () => {
    it("removes the empty-dashboard-cta placeholder when a widget is added to the tab", () => {
      const gridLayout = {
        charts: [
          { i: "nav-bar", x: 0, y: 0, w: 40, h: 2, static: true },
          {
            i: "empty-dashboard-cta",
            x: 0,
            y: 2,
            w: 40,
            h: 20,
            isResizable: false,
            isDraggable: false,
          },
        ],
      } as any;

      const result = updateWidgetGridLayout({
        widget: { id: "chart-1", innerTab: "charts" } as any,
        gridLayout,
        currentTab: "charts",
      });

      const chartsLayout = result.charts;
      expect(chartsLayout.some((l) => l.i === "empty-dashboard-cta")).toBe(false);
      expect(chartsLayout.some((l) => l.i === "chart-1")).toBe(true);
    });
  });
});


describe("backend widget creation", () => {
  const source: Source = { id: "backend", name: "My backend", url: "http://backend.test", endpointHeaders: [] };
  const definition: WidgetType = {
    widgetId: "quotes", name: "Quotes", description: "Declared quotes", type: "table", endpoint: "/quotes",
    params: [{ paramName: "symbol", type: "ticker", value: "AAPL", show: true }],
  };

  it.each([undefined, "MSFT"])("uses the declared or stored ticker symbol (%s) without a lookup", (symbol) => {
    const widget = createSourceWidget({ ...definition, ...(symbol && { storage: { params: { symbol } } }) }, source);
    expect(widget.data?.mainTicker).toBeUndefined();
    const created = getWidgetData({ widget });
    expect(created.storage.params.symbol).toBe(symbol ?? "AAPL");
    expect(created.data.mainTicker.symbol).toBe(symbol ?? "AAPL");
    expect(created.params.find((param) => param.paramName === "symbol").show).toBe(true);
  });

  it.each(["defaultTicker", "mainTicker"])("uses the supplied %s before the parameter default", (location) => {
    const ticker = { id: "MSFT", symbol: "MSFT", category: "equity", type: "stock" } as const;
    const widget = createSourceWidget(definition, source);
    if (location === "mainTicker") widget.data = { mainTicker: ticker };
    const created = getWidgetData({ widget, ...(location === "defaultTicker" && { defaultTicker: ticker }) });
    expect(created.storage.params.symbol).toBe("MSFT");
    expect(created.data.mainTicker).toEqual(ticker);
  });

  it("keeps a ticker input available when the declaration has no default symbol", () => {
    const widget = createSourceWidget({ ...definition, params: [{ paramName: "symbol", type: "ticker", show: true }] }, source);
    const created = getWidgetData({ widget });
    expect(created.data.mainTicker.symbol).toBe("");
    expect(created.storage.params.symbol).toBe("");
  });

  it("preserves declared currency parameters instead of injecting provider defaults", () => {
    const widget = createSourceWidget({ ...definition, widgetId: "currency_snapshot", params: [{ paramName: "base", type: "text", value: "JPY" }, { paramName: "region", type: "text", value: "asia" }] }, source);
    expect(getWidgetData({ widget }).storage.params).toEqual({ base: "JPY", region: "asia" });
  });
});
