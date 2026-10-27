import { act, renderHook } from "@testing-library/react";
import type { IServerSideGetRowsParams } from "ag-grid-community";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import { WidgetContext } from "~/components/Widget.context";
import { useServerSideContext } from "~/lib/plugins/serverSideTable";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { getWidgetData } from "~/lib/widgetData";

vi.mock("~/components/General/Table/AgGridSSRM", () => ({
  AgGridSSRTable: () => null,
}));
vi.mock("~/components/General/Table/AgGridSSRMAdvanced", () => ({
  default: () => null,
}));
vi.mock("~/components/General/Table/hooks", () => ({
  useAgGridContext: () => ({ gridRef: { current: null } }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  useCopilotDataStore.setState({ dashboardWidgetsData: {} });
});

function fixture(widget: WidgetT, updateWidget = vi.fn()) {
  return ({ children }: PropsWithChildren) => (
    <WidgetContext.Provider value={{ widget, getWidget: () => widget, updateWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

describe("server-side table host adapter", () => {
  it("preserves query definitions and unrelated storage when saving a request", () => {
    const widget = {
      id: "query-table",
      widgetId: "query-table",
      name: "Query table",
      type: "ssrm_advanced",
      storage: {
        params: { query: "select * from prices where symbol = '{{symbol}}'" },
        sqlParamDefs: [{ type: "text", paramName: "symbol", value: "AAPL" }],
        paginationPageSize: 1000,
        openedToolPanel: "columns",
        ssmRequest: { startRow: 0, endRow: 1000 },
        pluginState: { custom: true },
      },
    } as WidgetT;
    const updateWidget = vi.fn();
    const { result } = renderHook(useServerSideContext, {
      wrapper: fixture(widget, updateWidget),
    });

    expect(result.current.advanced).toBe(true);
    expect(result.current.queryParameters).toEqual(widget.storage.sqlParamDefs);
    expect(result.current.pageSize).toBe(1000);
    expect(
      result.current.resolveQuery(widget.storage.params.query, { symbol: "MSFT" }),
    ).toBe("select * from prices where symbol = 'MSFT'");

    const request = { startRow: 1000, endRow: 2000 };
    act(() => result.current.setRequest(request));
    expect(updateWidget.mock.calls[0][0](widget).storage).toEqual({
      ...widget.storage,
      ssmRequest: request,
    });
  });

  it("sends POST rows requests with configured headers and query parameters", async () => {
    const response = { rowData: [{ symbol: "AAPL" }], rowCount: 1 };
    const fetchRows = vi.fn(async () => Response.json(response));
    vi.stubGlobal("fetch", fetchRows);
    const widget = {
      id: "server-table",
      widgetId: "server-table",
      name: "Server table",
      type: "ssrm_table",
      endpoint: {
        url: "https://data.example/rows",
        method: "POST",
        headers: { "X-Data-Key": "test-key" },
      },
      storage: {},
    } as WidgetT;
    const { result } = renderHook(useServerSideContext, {
      wrapper: fixture(widget),
    });
    const body = { startRow: 0, endRow: 500, query: "select * from prices" };

    await expect(result.current.fetchRows({ region: "us" }, body)).resolves.toEqual(
      response,
    );
    expect(fetchRows).toHaveBeenCalledWith(
      "https://data.example/rows?region=us",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Data-Key": "test-key" },
        body: JSON.stringify(body),
      }),
    );
  });

  it("publishes visible rows and the executed server request for agents", async () => {
    const widget = {
      id: "visible-table",
      widgetId: "visible-table",
      name: "Prices",
      type: "ssrm_table",
      storage: { params: { region: "us" } },
      endpoint: { url: "https://data.example/rows", method: "POST" },
    } as WidgetT;
    const { result } = renderHook(useServerSideContext, {
      wrapper: fixture(widget),
    });
    const request = { startRow: 0, endRow: 500, groupKeys: ["technology"] };
    const params = {
      request,
      api: {
        isDestroyed: () => false,
        getState: () => ({ columnVisibility: { hiddenColIds: ["secret"] } }),
        forEachNode: (callback) =>
          callback({
            rowIndex: 0,
            displayed: true,
            data: { symbol: "AAPL", price: 42, secret: "hidden" },
          }),
      },
    } as unknown as IServerSideGetRowsParams;

    await act(async () => {
      await result.current.publishData(params, true);
    });
    expect(getWidgetData(widget.id)?.data).toEqual([{ symbol: "AAPL", price: 42 }]);
    expect(getWidgetData(widget.id)?.metadata.ssmRequest).toEqual({
      ...request,
      groupKeys: [],
    });
    expect(getWidgetData(widget.id)?.metadata.params).toEqual({ region: "us" });
  });
});
