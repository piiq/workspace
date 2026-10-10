import type { WidgetDataExportOptions } from "@piiq/workspace-plugin-sdk";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import {
  createWidgetDataMetadata,
  useWidgetDataExport,
} from "~/hooks/useWidgetDataExport";
import { useCopilotDataStore } from "~/lib/state/copilotData";

const context = vi.hoisted(() => ({
  widget: null as WidgetT | null,
  dashboardId: "dashboard-1",
  source: ["test-source"],
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: context.dashboardId }),
}));
vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({ widget: context.widget, widgetFromJSON: null }),
}));
vi.mock("~/lib/constants", () => ({ inSnowflakeNativeApp: false }));
vi.mock("~/components/AI/hooks/utils", () => ({
  compareSignatures: vi.fn(),
  createSignatureMap: vi.fn(() => ({})),
}));
vi.mock("~/lib/sources.json", () => ({
  default: { "test-source": { name: "Test Source" } },
}));
vi.mock("~/lib/utils", () => ({
  getJsonWidget: vi.fn(() => null),
  useWidgetDataSource: () => context.source,
  extractColumns: (data: unknown) =>
    Array.isArray(data) && data[0] && typeof data[0] === "object"
      ? Object.keys(data[0])
      : null,
}));
vi.mock("~/utils/dataConnectorsHelpers", () => ({
  handleWidgetMetadata: () => ({ origin: "connector", priority: "connector" }),
}));

const readData = () =>
  useCopilotDataStore.getState().getDashboardWidgetData("widget-1");

describe("useWidgetDataExport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    context.dashboardId = "dashboard-1";
    context.widget = {
      id: "widget-1",
      widgetId: "data-table",
      type: "table",
      name: "Revenue",
      description: "Quarterly revenue",
      innerTab: "tab-1",
      endpoint: { url: "https://example.test/revenue", method: "GET" },
      storage: { params: { symbol: "AAPL" } },
      metadata: { priority: "widget" },
    } as WidgetT;
    useCopilotDataStore.getState().clearState();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("publishes data without Copilot selection or an active chat", () => {
    const data = [{ quarter: "Q1", revenue: 42 }];
    renderHook(() => useWidgetDataExport({ data, enabled: true, lastUpdated: 100 }));
    expect(readData()).toMatchObject({
      data,
      title: "Revenue",
      description: "Quarterly revenue",
      innerTab: "tab-1",
      endpointUrl: "https://example.test/revenue",
      dashboardId: "dashboard-1",
      metadata: {
        params: { symbol: "AAPL" },
        source: "Test Source",
        columns: ["quarter", "revenue"],
        lastUpdated: 100,
        origin: "connector",
        priority: "widget",
      },
    });
    expect(useCopilotDataStore.getState().selectedWidgetIDs).toEqual([]);
    expect(useCopilotDataStore.getState().copilotWidgets.allWidgets).toEqual([]);
  });

  it("keeps executed parameters while metadata and draft parameters change", () => {
    const data = [{ revenue: 42 }];
    const { rerender } = renderHook(() =>
      useWidgetDataExport({ data, enabled: true, lastUpdated: 100 }),
    );
    context.widget = {
      ...context.widget,
      name: "Updated revenue",
      description: "Updated description",
      metadata: { priority: "updated" },
      storage: { params: { symbol: "MSFT" } },
    } as WidgetT;
    rerender();
    expect(readData()).toMatchObject({
      title: "Updated revenue",
      description: "Updated description",
      metadata: { params: { symbol: "AAPL" }, priority: "updated", lastUpdated: 100 },
    });
  });

  it("captures executed parameters when fresh data arrives", () => {
    const { rerender } = renderHook(
      (options: WidgetDataExportOptions) => useWidgetDataExport(options),
      { initialProps: { data: [{ revenue: 42 }], enabled: true } },
    );
    context.widget = {
      ...context.widget,
      storage: { params: { symbol: "MSFT" } },
    } as WidgetT;
    rerender({ data: [{ revenue: 84 }], enabled: true });
    expect(readData().metadata.params).toEqual({ symbol: "MSFT" });
  });

  it("captures executed parameters on refresh with unchanged data", () => {
    const data = [{ revenue: 42 }];
    const { rerender } = renderHook(
      (options: WidgetDataExportOptions) => useWidgetDataExport(options),
      { initialProps: { data, enabled: true, lastUpdated: 100 } },
    );
    context.widget = {
      ...context.widget,
      storage: { params: { symbol: "MSFT" } },
    } as WidgetT;
    rerender({ data, enabled: true, lastUpdated: 200 });
    expect(readData().metadata).toMatchObject({
      params: { symbol: "MSFT" },
      lastUpdated: 200,
    });
  });

  it("preserves executed-parameter promotion for Copilot consumers", () => {
    act(() => {
      useCopilotDataStore
        .getState()
        .beginWidgetCopilotExecution("widget-1", { symbol: "AAPL" });
    });
    renderHook(() => useWidgetDataExport({ data: [{ revenue: 42 }], enabled: true }));
    expect(
      useCopilotDataStore.getState().getWidgetRuntimeState("widget-1"),
    ).toMatchObject({
      copilotExecutedParams: { symbol: "AAPL" },
      copilotPendingParams: undefined,
    });
  });

  it("publishes file type and additional metadata", () => {
    context.widget = {
      ...context.widget,
      connectionType: "file",
      endpoint: { url: "report.csv" },
    } as WidgetT;
    renderHook(() =>
      useWidgetDataExport({
        data: [{ revenue: 42 }],
        enabled: true,
        additionalMetadata: { options: { report: ["report.csv"] } },
      }),
    );
    expect(readData().metadata).toMatchObject({
      fileType: "csv",
      options: { report: ["report.csv"] },
    });
  });

  it("does not publish disabled data or the card's boolean placeholder", () => {
    const { rerender } = renderHook(
      (options: WidgetDataExportOptions) => useWidgetDataExport(options),
      { initialProps: { data: [{ revenue: 42 }], enabled: false } },
    );
    expect(readData()).toBeUndefined();
    rerender({ data: true, enabled: true });
    expect(readData()).toBeUndefined();
  });

  it("updates the dashboard location without requiring new data", () => {
    const data = [{ revenue: 42 }];
    const { rerender } = renderHook(() => useWidgetDataExport({ data, enabled: true }));
    context.dashboardId = "dashboard-2";
    context.widget = { ...context.widget, innerTab: "tab-2" } as WidgetT;
    rerender();
    expect(readData()).toMatchObject({ dashboardId: "dashboard-2", innerTab: "tab-2" });
  });
});

describe("createWidgetDataMetadata", () => {
  it("uses the declaration when no widget instance exists", () => {
    expect(
      createWidgetDataMetadata({
        widget: null,
        widgetFromJSON: {
          name: "Declared widget",
          description: "Declared description",
          source: ["test-source"],
        },
        additionalMetadata: { unit: "USD" },
      }),
    ).toEqual({
      name: "Declared widget",
      description: "Declared description",
      source: "test-source",
      metadata: { unit: "USD", params: {} },
    });
  });
});
