import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import { WidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import { usePluginChartData } from "~/lib/plugins/widgetHooks";
import { useThemeStore } from "~/lib/state/theme";

vi.mock("~/lib/api", () => ({ useJsonData: vi.fn() }));
vi.mock("~/components/Widgets/charting/RawDataTable", () => ({ default: () => null }));

const originalTheme = useThemeStore.getState().theme;
const chartData = {
  constructorType: "chart",
  userOptions: { title: { text: "Prices" } },
};
const records = [{ symbol: "AAPL", price: 42 }];
const chartQuery = {
  data: chartData,
  isLoading: false,
  error: null as Error | null,
  dataUpdatedAt: 100,
  refetch: vi.fn(),
};
const rawQuery = {
  data: { results: records },
  isLoading: false,
  error: null as Error | null,
  dataUpdatedAt: 200,
  refetch: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useThemeStore.setState({ theme: "dark" });
  chartQuery.isLoading = false;
  chartQuery.error = null;
  rawQuery.isLoading = false;
  rawQuery.error = null;
  chartQuery.refetch.mockResolvedValue({ data: chartData });
  rawQuery.refetch.mockResolvedValue({ data: { results: records } });
  vi.mocked(useJsonData).mockImplementation(
    (options) => (options.params?.raw === true ? rawQuery : chartQuery) as never,
  );
});

afterEach(() => {
  useThemeStore.setState({ theme: originalTheme });
  vi.restoreAllMocks();
});

function fixture(overrides: Partial<WidgetT> = {}) {
  const widget: WidgetT = {
    id: "chart-one",
    widgetId: "external-chart",
    name: "Prices",
    type: "@test/charts/chart",
    endpoint: { url: "https://data.example/prices", method: "GET" },
    raw: true,
    ...overrides,
    storage: {
      params: { symbol: "AAPL" },
      rawDataView: false,
      otherSetting: "preserved",
      ...overrides.storage,
    },
  };
  const updateWidget = vi.fn();
  return {
    widget,
    updateWidget,
    wrapper: ({ children }: PropsWithChildren) => (
      <WidgetContext.Provider value={{ widget, updateWidget }}>
        {children}
      </WidgetContext.Provider>
    ),
  };
}

describe("plugin chart data", () => {
  it.each([
    undefined,
    120_000,
  ])("uses endpoint parameters and the current theme with chart cache %s", (staleTime) => {
    const context = fixture({
      staleTime,
      endpoint: {
        url: "https://data.example/prices",
        method: "POST",
        headers: { "X-Data-Key": "test-key" },
        query: { region: "us", symbol: "initial", theme: "ignored" },
      },
      storage: {
        params: { symbol: "AAPL", theme: "ignored", empty: "", missing: undefined },
      },
    });
    const { result } = renderHook(() => usePluginChartData(), context);

    expect(result.current.data).toEqual(chartData);
    expect(result.current.lastUpdated).toBe(100);
    expect(useJsonData).toHaveBeenNthCalledWith(
      2,
      {
        url: "https://data.example/prices",
        method: "POST",
        endpointHeaders: { "X-Data-Key": "test-key" },
        params: { region: "us", symbol: "AAPL", theme: "dark" },
      },
      { enabled: true, staleTime: staleTime ?? 900_000 },
    );

    act(() => useThemeStore.setState({ theme: "light" }));
    expect(vi.mocked(useJsonData).mock.calls.at(-1)?.[0].params?.theme).toBe("light");
  });

  it("requires the raw flag before using the saved table view", () => {
    const context = fixture({ raw: false, storage: { rawDataView: true } });
    const { result } = renderHook(() => usePluginChartData(), context);

    expect(result.current.showTable).toBe(false);
    expect(result.current.toggle).toBeNull();
    expect(result.current.data).toEqual(chartData);
    expect(useJsonData).toHaveBeenNthCalledWith(
      1,
      {},
      { enabled: false, staleTime: 0 },
    );
  });

  it("preserves other settings when saving the raw-data toggle", () => {
    const context = fixture();
    const { result } = renderHook(() => usePluginChartData(), context);
    render(result.current.toggle);

    fireEvent.click(screen.getByRole("button", { name: "Switch to raw data view" }));

    const update = context.updateWidget.mock.calls[0][0];
    expect(update(context.widget)).toEqual({
      ...context.widget,
      storage: { ...context.widget.storage, rawDataView: true },
    });
  });

  it("selects the uncached raw response and forces its raw query parameter", () => {
    const context = fixture({
      storage: { rawDataView: true, params: { raw: false, symbol: "AAPL" } },
    });
    rawQuery.isLoading = true;
    rawQuery.error = new Error("Raw data failed");
    const { result } = renderHook(() => usePluginChartData(), context);

    expect(result.current.data).toEqual(records);
    expect(result.current.showTable).toBe(true);
    expect(result.current.lastUpdated).toBe(200);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(rawQuery.error);
    expect(useJsonData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ params: { symbol: "AAPL", raw: true, theme: "dark" } }),
      { enabled: true, staleTime: 0 },
    );
    expect(vi.mocked(useJsonData).mock.calls[1][1]?.enabled).toBe(false);
  });

  it("returns fresh chart data directly from refresh", async () => {
    const fresh = {
      constructorType: "chart",
      userOptions: { title: { text: "Fresh" } },
    };
    chartQuery.refetch.mockResolvedValue({ data: fresh });
    const { result } = renderHook(() => usePluginChartData(), fixture());

    await expect(result.current.refetch()).resolves.toEqual(fresh);
    expect(chartQuery.refetch).toHaveBeenCalledWith({ throwOnError: true });
    expect(rawQuery.refetch).not.toHaveBeenCalled();
  });

  it.each([
    false,
    true,
  ])("normalizes refreshed raw data (wrapped=%s)", async (wrapped) => {
    const fresh = [{ symbol: "AAPL", price: 84 }];
    rawQuery.refetch.mockResolvedValue({ data: wrapped ? { results: fresh } : fresh });
    const { result } = renderHook(
      () => usePluginChartData(),
      fixture({ storage: { rawDataView: true } }),
    );

    await expect(result.current.refetch()).resolves.toEqual(fresh);
    expect(rawQuery.refetch).toHaveBeenCalledWith({ throwOnError: true });
    expect(chartQuery.refetch).not.toHaveBeenCalled();
  });

  it.each([
    false,
    true,
  ])("rejects a failed active refresh (raw=%s)", async (rawDataView) => {
    (rawDataView ? rawQuery : chartQuery).refetch.mockRejectedValue(
      new Error("Fetch failed"),
    );
    const { result } = renderHook(
      () => usePluginChartData(),
      fixture({ storage: { rawDataView } }),
    );

    await expect(result.current.refetch()).rejects.toThrow("Fetch failed");
  });
});
