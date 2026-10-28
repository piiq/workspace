import { afterEach, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import { useCopilotDataStore } from "~/lib/state/copilotData";

afterEach(() => {
  useCopilotDataStore.getState().clearState();
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("matches published data before the debounced signature index updates", () => {
  vi.useFakeTimers();
  const widget = {
    id: "widget-1",
    widgetId: "prices",
    name: "Prices",
    type: "table",
    external: true,
    sourceName: "My backend",
    connectionType: "advanced-backend",
    params: [{ paramName: "symbol", type: "text", value: "AAPL" }],
    storage: { params: { symbol: "MSFT" } },
  } as WidgetT;
  const signature = {
    origin: "My backend",
    widgetId: "prices",
    args: { symbol: "MSFT" },
  };
  useCopilotDataStore.setState({
    widgetsInCurrentDashboard: [widget],
    dashboardWidgetsData: {},
    signaturesMap: {
      "widget-1": { ...signature, args: { symbol: "AAPL" } },
    },
  });
  useCopilotDataStore.getState().addDataOnDashboardWidget("widget-1", {
    data: [{ symbol: "MSFT", price: 123 }],
    description: "Prices",
    metadata: { params: { symbol: "MSFT" } },
  });

  expect(
    useCopilotDataStore.getState().checkWidgetSignature("widget-1", signature),
  ).toBe(true);
  expect(
    useCopilotDataStore.getState().checkWidgetSignature("widget-1", {
      ...signature,
      args: { symbol: "AAPL" },
    }),
  ).toBe(false);
});
