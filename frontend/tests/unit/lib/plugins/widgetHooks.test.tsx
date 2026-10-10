import { definePlugin } from "@piiq/workspace-plugin-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type PropsWithChildren, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewWidgetT, WidgetT } from "~/components/types";
import { WidgetContext } from "~/components/Widget.context";
import { pluginHost } from "~/lib/plugins/host";
import { PluginRegistry } from "~/lib/plugins/registry";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { useThemeStore } from "~/lib/state/theme";
import { exportWidgetData, getWidgetData, refreshWidgetData } from "~/lib/widgetData";

const originalTheme = useThemeStore.getState().theme;
afterEach(() => {
  vi.unstubAllGlobals();
  useThemeStore.setState({ theme: originalTheme });
  useCopilotDataStore.setState({ dashboardWidgetsData: {} });
});

describe("plugin widget hooks", () => {
  it("fetches, publishes, saves state, and refreshes a registered renderer", async () => {
    const fetchData = vi.fn(async (_url: string, _options?: RequestInit) =>
      Response.json({ result: [{ price: fetchData.mock.calls.length * 10 }] }),
    );
    vi.stubGlobal("fetch", fetchData);
    useCopilotDataStore.setState({
      copilotWidgets: {
        ...useCopilotDataStore.getState().copilotWidgets,
        selectedWidgets: [],
      },
    });
    const dispose = vi.fn();
    const save = vi.fn();
    const queryClient = new QueryClient();
    const id = "plugin-widget-1";
    const initialWidget = {
      id,
      widgetId: "prices",
      name: "Prices",
      type: "@test/prices/table",
      endpoint: {
        url: "https://data.example/prices",
        method: "POST",
        headers: { "X-Data-Key": "test-key" },
        query: { region: "us", symbol: "initial" },
      },
      storage: {
        params: { symbol: "AAPL", empty: "" },
        pluginState: { expanded: false },
        otherSetting: "preserved",
      },
      data: { dataKey: "result" },
      external: true,
    } as unknown as WidgetT;

    function Fixture({ children }: PropsWithChildren) {
      const [widget, setWidget] = useState(initialWidget);
      const updateWidget = (update: NewWidgetT, forceStoreUpdate?: boolean) => {
        save(forceStoreUpdate);
        setWidget((previous) =>
          typeof update === "function" ? update(previous) : update,
        );
      };
      return (
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/dashboard/test-dashboard-id"]}>
            <Routes>
              <Route
                path="/dashboard/:id"
                element={
                  <WidgetContext.Provider
                    value={{
                      widget,
                      updateWidget,
                      activeDashboardId: "test-dashboard-id",
                    }}
                  >
                    {children}
                    <pre data-testid="storage">{JSON.stringify(widget.storage)}</pre>
                  </WidgetContext.Provider>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
    }

    function Prices() {
      const context = pluginHost.useWidgetContext();
      const [customExport, setCustomExport] = useState(true);
      const query = pluginHost.useWidgetData<{ price: number }[]>({
        body: { limit: 5 },
        query: { symbol: "ignored", limit: 5 },
      });
      pluginHost.useWidgetDataExport({
        data: query.data,
        enabled: !!query.data,
        lastUpdated: query.lastUpdated,
      });
      pluginHost.useWidgetLifecycle({
        refresh: query.refetch,
        exportData: customExport
          ? () => ({ data: query.data, columns: ["formatted-price"] })
          : undefined,
        dispose,
      });
      return (
        <>
          <span>{context.theme}</span>
          <span>{String(context.state.expanded)}</span>
          <span>{query.data?.[0]?.price}</span>
          <button onClick={() => context.setParameters({ symbol: "MSFT" })}>
            Change symbol
          </button>
          <button onClick={() => context.setState({ expanded: true })}>Expand</button>
          <button onClick={() => setCustomExport((enabled) => !enabled)}>
            Toggle custom export
          </button>
        </>
      );
    }

    const registry = new PluginRegistry();
    await registry.registerPlugin(
      definePlugin(
        { name: "@test/prices", version: "1.0.0" },
        {
          renderers: [
            { name: "table", title: "Prices", kind: "table", Component: Prices },
          ],
        },
      ),
      pluginHost,
    );
    const Renderer = registry
      .getRenderers()
      .find((renderer) => renderer.id === "@test/prices/table")!.Component;
    const { unmount } = render(
      <Fixture>
        <Renderer />
      </Fixture>,
    );

    expect(await screen.findByText("10")).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledWith(
      "https://data.example/prices?region=us&symbol=AAPL&limit=5",
      expect.objectContaining({
        method: "POST",
        headers: { "X-Data-Key": "test-key" },
        body: '{"limit":5}',
      }),
    );
    await waitFor(() => expect(getWidgetData(id)?.data).toEqual([{ price: 10 }]));
    expect(getWidgetData(id)?.metadata.params).toEqual({ symbol: "AAPL", empty: "" });
    expect(await exportWidgetData(id)).toEqual({
      data: [{ price: 10 }],
      columns: ["formatted-price"],
    });

    fireEvent.click(screen.getByText("Expand"));
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId("storage").textContent)).toEqual({
      params: { symbol: "AAPL", empty: "" },
      pluginState: { expanded: true },
      otherSetting: "preserved",
    });
    expect(save).toHaveBeenCalledWith(true);
    act(() => useThemeStore.setState({ theme: "light" }));
    expect(screen.getByText("light")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Change symbol"));
    expect(await screen.findByText("20")).toBeInTheDocument();
    expect(fetchData.mock.calls[1][0]).toBe(
      "https://data.example/prices?region=us&symbol=MSFT&limit=5",
    );
    await act(async () => expect(await refreshWidgetData(id)).toBe(true));
    expect(await screen.findByText("30")).toBeInTheDocument();
    expect(await exportWidgetData(id)).toEqual({
      data: [{ price: 30 }],
      columns: ["formatted-price"],
    });
    fireEvent.click(screen.getByText("Toggle custom export"));
    expect(await exportWidgetData(id)).toEqual({
      data: [{ price: 30 }],
      columns: ["price"],
    });
    fireEvent.click(screen.getByText("Toggle custom export"));
    expect(await exportWidgetData(id)).toEqual({
      data: [{ price: 30 }],
      columns: ["formatted-price"],
    });
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(await refreshWidgetData(id)).toBe(false);
    queryClient.clear();
  });
});
