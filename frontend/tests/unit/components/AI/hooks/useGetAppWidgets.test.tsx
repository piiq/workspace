import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useGetAppWidgets,
  useGetWidgetsStore,
} from "~/components/AI/hooks/useGetAppWidgets";

const { connections, coreWidgets, sharedWidgets } = vi.hoisted(() => ({
  connections: {
    singleWidgets: [],
    storedFiles: [],
    apiSources: [],
    widgetMetadata: [],
  } as Record<string, any[]>,
  coreWidgets: [{ widgetId: "clock", name: "Clock", type: "clock" }],
  sharedWidgets: [] as any[],
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: (state: unknown) => unknown) =>
    selector(connections),
}));
vi.mock("~/lib/state/userApps", () => ({
  useShallowUserAppsStore: (selector: (state: unknown) => unknown) =>
    selector({ getAllSharedUserApps: () => [] }),
}));
vi.mock("~/components/LayoutAuth/Search/hooks/useSharedResources", () => ({
  default: () => sharedWidgets,
}));
vi.mock("~/components/DataConnectors/common/helpers", () => ({
  getCleanedCategory: (category: string) => category || "My Data",
  patchSnowflakeEndpoint: (endpoint: unknown) => endpoint,
}));
vi.mock("~/components/DataConnectors/WidgetsBuilder/utils", () => ({
  isTableWidgetType: (type: string) => type === "table",
}));
vi.mock("~/lib/utils", () => ({
  getBuiltinWidgets: () => coreWidgets,
  convertAdvancedBackend: (source: { name: string; widgets: object[] }) =>
    source.widgets.map((widget) => ({ ...widget, sourceName: source.name })),
}));

beforeEach(() => {
  for (const key of Object.keys(connections)) connections[key] = [];
  sharedWidgets.length = 0;
  useGetWidgetsStore.setState({ backendNameToWidgetMap: new Map() });
});

describe("useGetAppWidgets", () => {
  it("lists core utilities for an account without connections", () => {
    renderHook(() => useGetAppWidgets());
    expect(useGetWidgetsStore.getState().getAllAppWidgets()).toEqual(coreWidgets);
  });

  it("keeps connected plugin declarations and source names without packaged metadata", () => {
    const widget = {
      widgetId: "custom-chart",
      name: "Custom Chart",
      type: "@example/charts/chart",
      external: true,
    };
    connections.apiSources = [{ id: "root", name: "My Backend", widgets: [widget] }];
    renderHook(() => useGetAppWidgets());

    expect(
      useGetWidgetsStore.getState().getAppWidget("custom-chart", "My Backend"),
    ).toEqual({ ...widget, sourceName: "My Backend" });
    expect(useGetWidgetsStore.getState().getAllAppWidgets()).toHaveLength(2);
  });

  it("keeps individual endpoints and shared backend widgets", () => {
    connections.singleWidgets = [
      { widgetId: "local-table", name: "Local Table", type: "table" },
    ];
    sharedWidgets.push({
      widgetId: "shared-table",
      name: "Shared Table",
      type: "table",
      sourceName: "Team Backend",
      isSharedWidget: true,
    });
    renderHook(() => useGetAppWidgets());

    const store = useGetWidgetsStore.getState();
    expect(store.getAppWidget("local-table", "API Endpoints")).toMatchObject({
      external: true,
      connectionType: "single",
    });
    expect(store.getAppWidget("shared-table", "Team Backend")).toMatchObject({
      isSharedWidget: true,
    });
  });
});
