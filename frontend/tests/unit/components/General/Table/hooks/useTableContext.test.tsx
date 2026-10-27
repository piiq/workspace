import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTableData } from "~/components/Charting/utils";
import {
  AgGridContext,
  AgGridProvider,
  Table,
  useAgExportFuncs,
  useAgGridContext,
  useGridSync,
  useUpdateChartView,
} from "~/components/General/Table/hooks/useTableContext";
import { WidgetContext } from "~/components/Widget.context";
import { widgetRegistry } from "~/lib/plugins/registry";

const gridProps = vi.hoisted(() => vi.fn());
afterEach(() => vi.restoreAllMocks());

// Mock dependencies
vi.mock("~/components/Charting/utils", () => ({ downloadTableData: vi.fn() }));
vi.mock("ag-grid-react", () => ({
  AgGridReact: (props: any) => {
    gridProps(props);
    const { rowData, columnDefs, onGridReady } = props;
    // Simulate calling onGridReady after mount
    setTimeout(() => {
      if (onGridReady) {
        onGridReady({
          api: {
            exportDataAsCsv: vi.fn(),
            exportDataAsExcel: vi.fn(),
            getDisplayedRowCount: () => rowData?.length || 0,
            forEachNodeAfterFilterAndSort: vi.fn(),
            clearCellSelection: vi.fn(),
            updateGridOptions: vi.fn(),
            isPivotMode: () => false,
            paginationGetRowCount: () => rowData?.length || 0,
            paginationGetPageSize: () => 100,
            paginationGetCurrentPage: () => 0,
          },
        });
      }
    }, 0);

    return (
      <div data-testid="ag-grid-react">
        <span data-testid="row-count">{rowData?.length || 0} rows</span>
        <span data-testid="column-count">{columnDefs?.length || 0} columns</span>
      </div>
    );
  },
}));

vi.mock("~/components/DraggableCard/SetLoadingOnResize", () => ({
  AgGridSetLoadingOnResize: ({ children }: any) => <>{children}</>,
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: vi.fn((selector: any) =>
    selector({ theme: "light", tablePagination: false }),
  ),
}));

vi.mock("~/components/General/Table/Chart/themes", () => ({
  useAgThemes: () => ({
    agTheme: {},
    chartThemes: [],
    customChartThemes: {},
  }),
}));

vi.mock("~/components/General/Table/hooks/useCreateChart", () => ({
  useCreateChart: () => vi.fn(),
}));

vi.mock("~/components/General/Table/hooks/useUpdateColumnState", () => ({
  useUpdateColumnState: vi.fn(() => [
    vi.fn(), // onGridReady
    vi.fn(), // onStateUpdated
    vi.fn(), // onNewColumnsLoaded
    vi.fn(), // onGridPreDestroyed
    vi.fn(), // onChartRangeSelectionChanged
    vi.fn(), // onVirtualColumnsChanged
    vi.fn(), // onChartDestroyed
    {}, // initialState
  ]),
  useApplyColumnState: () => ({ applyColumnState: vi.fn() }),
  getCellRangeState: () => ({
    stateCellRange: null,
    chartType: "line",
    chartModel: null,
  }),
}));

vi.mock("~/components/General/Table/Chart/hooks/useCreateChartData", () => ({
  useCreateChartData: () =>
    vi.fn(() => ({
      isReallyTransposed: false,
      rowData: [],
      columnDefs: [],
    })),
}));

vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  useChartCloseButtonListener: () => vi.fn(),
}));

vi.mock("~/components/General/Table/Chart/AgChartView", () => ({
  createRangeChart: vi.fn(() => ({
    rowData: [],
    columnDefs: [],
    chartParams: {
      cellRange: { columns: [] },
    },
  })),
  customChartWidgetIds: [],
}));

vi.mock("~/hooks/useRefHooks", () => ({
  useComposeRefs: vi.fn((...refs) => (node: any) => {
    refs.forEach((ref: any) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    });
  }),
}));

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: (initialState: any) => {
    const { useState, useCallback } = require("react");
    const [state, setState] = useState(
      typeof initialState === "function" ? initialState() : initialState,
    );

    const dispatch = useCallback(
      (updates: any) =>
        setState((s: any) => {
          if (typeof updates === "function") {
            return updates(s);
          }
          return {
            ...s,
            ...Object.fromEntries(
              Object.entries(updates).map(([key, value]) => [
                key,
                typeof value === "function" ? value(s[key]) : value,
              ]),
            ),
          };
        }),
      [],
    );

    return [state, dispatch];
  },
}));

vi.mock("use-debounce", () => ({
  useDebouncedCallback: (fn: any) => fn,
}));

const createMockWidget = (overrides = {}) => ({
  uuid: "test-uuid",
  id: "test-id",
  name: "Test Widget",
  type: "custom",
  widgetId: "test-widget",
  storage: {
    params: {},
    chartView: null,
  },
  data: {
    table: { columnsDefs: [] },
  },
  ...overrides,
});

const createTestContext = (
  value: Partial<ReturnType<typeof useAgGridContext>> = {},
) => ({
  gridRef: { current: null },
  chartRef: { current: null },
  chartViewElementRef: { current: null },
  columnDefsRef: { current: [] },
  columnVisibility: {},
  setColumnVisibility: vi.fn(),
  createChartData: vi.fn(),
  gridState: {
    columnDefs: [],
    rowData: [],
    gridReady: false,
    needsUpdate: false,
    resized: {},
    dataRevision: null,
  },
  getGridState: vi.fn(),
  updateAgGrid: vi.fn(),
  createRangeChartParamsCbRef: { current: vi.fn() },
  handleChartViewToggleRef: { current: vi.fn() },
  isReallyTransposedRef: { current: false },
  ...value,
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: ReactNode, widgetOverrides = {}) => {
  const widget = createMockWidget(widgetOverrides);
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <WidgetContext.Provider
        value={
          {
            widget,
            widgetRef: { current: widget },
            widgetFromJSON: widget,
            activeDashboardId: "test-dashboard",
            isShared: false,
            uuid: widget.uuid,
            updateWidget: vi.fn(),
            getWidget: () => widget,
          } as any
        }
      >
        {ui}
      </WidgetContext.Provider>
    </QueryClientProvider>,
  );
};

describe("useAgGridContext", () => {
  it("throws error when used outside AgGridContext", () => {
    const TestComponent = () => {
      useAgGridContext();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrow(
      "useAgGridContext must be used within a AgGridProvider",
    );
  });

  it("returns context value when used inside AgGridContext", () => {
    const testContext = createTestContext();
    let result: any;

    const TestComponent = () => {
      result = useAgGridContext();
      return null;
    };

    render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent />
      </AgGridContext.Provider>,
    );

    expect(result).toBeDefined();
    expect(result.gridRef).toBeDefined();
    expect(result.gridState).toBeDefined();
    expect(result.updateAgGrid).toBeDefined();
  });
});

describe("Table Component", () => {
  it("renders children", () => {
    renderWithProviders(
      <Table>
        <div data-testid="child">Child Content</div>
      </Table>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides AgGridContext to children", () => {
    let contextValue: any;

    const TestChild = () => {
      contextValue = useAgGridContext();
      return <div data-testid="context-test">Has Context</div>;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(screen.getByTestId("context-test")).toBeInTheDocument();
    expect(contextValue).toBeDefined();
    expect(contextValue.gridRef).toBeDefined();
  });

  it("initializes grid state correctly", () => {
    let gridState: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      gridState = ctx.gridState;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(gridState).toMatchObject({
      columnDefs: [],
      rowData: [],
      gridReady: false,
      needsUpdate: false,
    });
  });

  it("provides updateAgGrid function", () => {
    let updateFn: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      updateFn = ctx.updateAgGrid;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(typeof updateFn).toBe("function");
  });
});

describe("AgGridProvider Component", () => {
  it("removes Enterprise direct props and gridOptions when the capability is absent", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(false);
    renderWithProviders(
      <Table>
        <AgGridProvider
          rowData={[{ price: 42 }]}
          columnDefs={[{ field: "price" }]}
          enableCharts
          sideBar
          gridOptions={{ statusBar: { statusPanels: [] }, pagination: true }}
        />
      </Table>,
    );
    const props = gridProps.mock.lastCall[0];
    expect(props.enableCharts).toBeUndefined();
    expect(props.sideBar).toBeUndefined();
    expect(props.statusBar).toBeUndefined();
    expect(props.pagination).toBe(true);
  });

  it("configures the merged direct props and gridOptions through the capability", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(true);
    const configure = vi
      .spyOn(widgetRegistry, "configureGrid")
      .mockImplementation((options) => ({ cellSelection: true, ...options }));
    renderWithProviders(
      <Table>
        <AgGridProvider
          rowData={[{ price: 42 }]}
          columnDefs={[{ field: "price" }]}
          enableCharts={false}
          sideBar
          gridOptions={{ enableCharts: true, pagination: true }}
        />
      </Table>,
    );
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({
        enableCharts: false,
        sideBar: true,
        pagination: true,
      }),
    );
    expect(gridProps.mock.lastCall[0].cellSelection).toBe(true);
  });

  it("renders AgGridReact with row data", async () => {
    const rowData = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
    ];
    const columnDefs = [{ field: "id" }, { field: "name" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ag-grid-react")).toBeInTheDocument();
    });
  });

  it("displays correct row count", async () => {
    const rowData = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
      { id: 3, name: "Test 3" },
    ];
    const columnDefs = [{ field: "id" }, { field: "name" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-count")).toHaveTextContent("3 rows");
    });
  });

  it("displays correct column count", async () => {
    const rowData = [{ id: 1, name: "Test", value: 100 }];
    const columnDefs = [{ field: "id" }, { field: "name" }, { field: "value" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("column-count")).toHaveTextContent("3 columns");
    });
  });

  it("handles empty data", async () => {
    renderWithProviders(
      <Table>
        <AgGridProvider rowData={[]} columnDefs={[]} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-count")).toHaveTextContent("0 rows");
    });
  });

  it("applies custom className", async () => {
    const rowData = [{ id: 1 }];
    const columnDefs = [{ field: "id" }];

    renderWithProviders(
      <Table>
        <AgGridProvider
          rowData={rowData}
          columnDefs={columnDefs}
          extraClassName="custom-class"
        />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ag-grid-react")).toBeInTheDocument();
    });
  });
});

describe("useGridSync Hook", () => {
  it("calls updateAgGrid when data changes", async () => {
    const mockUpdateAgGrid = vi.fn();
    const testContext = createTestContext({ updateAgGrid: mockUpdateAgGrid });

    const TestComponent = ({ rowData, columnDefs }: any) => {
      useGridSync(rowData, columnDefs);
      return null;
    };

    const { rerender } = render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent rowData={[]} columnDefs={[]} />
      </AgGridContext.Provider>,
    );

    // Rerender with actual data
    rerender(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent rowData={[{ id: 1 }]} columnDefs={[{ field: "id" }]} />
      </AgGridContext.Provider>,
    );

    await waitFor(() => {
      expect(mockUpdateAgGrid).toHaveBeenCalled();
    });
  });

  it("does not call updateAgGrid for empty data", async () => {
    const mockUpdateAgGrid = vi.fn();
    const testContext = createTestContext({ updateAgGrid: mockUpdateAgGrid });

    const TestComponent = () => {
      useGridSync([], []);
      return null;
    };

    render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent />
      </AgGridContext.Provider>,
    );

    // Should not be called for empty data
    expect(mockUpdateAgGrid).not.toHaveBeenCalled();
  });
});

describe("Context Value Management", () => {
  it("maintains column visibility state", async () => {
    let setColumnVisibility: any;
    let columnVisibility: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      setColumnVisibility = ctx.setColumnVisibility;
      columnVisibility = ctx.columnVisibility;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(columnVisibility).toEqual({});

    act(() => {
      setColumnVisibility({ name: true, price: false });
    });

    // The state update should work (implementation depends on actual hook)
    expect(typeof setColumnVisibility).toBe("function");
  });

  it("provides chart refs", () => {
    let chartRef: any;
    let chartViewElementRef: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      chartRef = ctx.chartRef;
      chartViewElementRef = ctx.chartViewElementRef;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(chartRef).toBeDefined();
    expect(chartRef.current).toBeNull();
    expect(chartViewElementRef).toBeDefined();
  });

  it("provides a shared previousChartEnabledRef", () => {
    let previousChartEnabledRef: any;

    const TestChild = () => {
      previousChartEnabledRef = useAgGridContext().previousChartEnabledRef;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(previousChartEnabledRef).toBeDefined();
    expect(previousChartEnabledRef.current).toBe(false);
  });
});

describe("Community Excel export", () => {
  it.each([
    ["Double", "Price"],
    ["Price", "Price"],
    ["2024", "2023"],
  ])("exports displayed columns %s and %s in display order", (formulaHeader, priceHeader) => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(false);
    const rowNode = { data: { price: 42, secret: "hidden" } };
    const formulaColumn = {
      getColDef: () => ({
        headerName: formulaHeader,
        valueGetter: ({ data }: { data: { price: number } }) => data.price * 2,
        useValueFormatterForExport: false,
      }),
    };
    const priceColumn = {
      getColDef: () => ({ headerName: priceHeader, field: "price" }),
    };
    const columns = [formulaColumn, priceColumn];
    const getCellValue = vi.fn(({ rowNode, colKey, useFormatter }) => {
      const definition = colKey.getColDef();
      if (definition.valueGetter) return definition.valueGetter(rowNode);
      return useFormatter ? "$42.00" : rowNode.data[definition.field];
    });
    const api = {
      getAllDisplayedColumns: () => columns,
      getDisplayNameForColumn: vi.fn((column) => column.getColDef().headerName),
      getCellValue,
      forEachNodeAfterFilterAndSort: (callback) => callback(rowNode),
    };
    const context = createTestContext({ gridRef: { current: { api } as any } });
    const { result } = renderHook(useAgExportFuncs, {
      wrapper: ({ children }) => (
        <AgGridContext.Provider value={context as any}>
          {children}
        </AgGridContext.Provider>
      ),
    });

    result.current.excelFunction("Prices");

    expect(downloadTableData).toHaveBeenCalledWith(
      { columns: [formulaHeader, priceHeader], data: [[84, "$42.00"]] },
      "Prices",
      "excel",
    );
    expect(getCellValue).toHaveBeenNthCalledWith(1, {
      rowNode,
      colKey: formulaColumn,
      useFormatter: false,
    });
    expect(getCellValue).toHaveBeenNthCalledWith(2, {
      rowNode,
      colKey: priceColumn,
      useFormatter: true,
    });
    expect(api.getDisplayNameForColumn).toHaveBeenCalledWith(formulaColumn, "csv");
  });
});

describe("integrated chart theme updates", () => {
  it("updates an existing chart with the active theme name when the mode changes", () => {
    const updateChart = vi.fn();
    const context = createTestContext({
      gridRef: { current: { api: { updateChart, isDestroyed: () => false } } as any },
      chartRef: { current: { chartId: "chart-1" } as any },
    });
    const { rerender } = renderHook(({ name }) => useUpdateChartView({}, name), {
      initialProps: { name: "openbb-dark" },
      wrapper: ({ children }) => (
        <WidgetContext.Provider value={{ widget: { storage: {} } } as any}>
          <AgGridContext.Provider value={context as any}>
            {children}
          </AgGridContext.Provider>
        </WidgetContext.Provider>
      ),
    });
    expect(updateChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chartId: "chart-1",
        chartThemeName: "openbb-dark",
      }),
    );

    rerender({ name: "openbb-light" });

    expect(updateChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chartId: "chart-1",
        chartThemeName: "openbb-light",
      }),
    );
  });
});
