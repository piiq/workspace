import { act, renderHook } from "@testing-library/react";
import type { GridOptions } from "ag-grid-community";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AG_ENTERPRISE_CAPABILITY,
  configureAgGrid,
  useAgEnterprise,
} from "~/lib/plugins/agGrid";
import { widgetRegistry } from "~/lib/plugins/registry";

afterEach(() => vi.restoreAllMocks());

describe("AG Grid plugin availability", () => {
  it("keeps Community options and removes Enterprise options without changing input", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(false);
    const options: GridOptions = {
      rowData: [{ price: 42 }],
      columnDefs: [{ field: "price" }],
      pagination: true,
      cellSelection: true,
      enableCharts: true,
      sideBar: true,
      statusBar: { statusPanels: [] },
      getContextMenuItems: () => ["copy"],
      chartThemes: ["openbb-dark"],
    };

    expect(configureAgGrid(options)).toEqual({
      rowData: options.rowData,
      columnDefs: options.columnDefs,
      pagination: true,
    });
    expect(options.enableCharts).toBe(true);
    expect(options.sideBar).toBe(true);
  });

  it("passes caller options to the installed capability", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(true);
    const configure = vi
      .spyOn(widgetRegistry, "configureGrid")
      .mockImplementation((options) => ({ cellSelection: true, ...options }));
    const options: GridOptions = { enableCharts: false, sideBar: true };

    expect(configureAgGrid(options, true)).toEqual({
      cellSelection: true,
      enableCharts: false,
      sideBar: true,
    });
    expect(configure).toHaveBeenCalledWith(options);
  });

  it("keeps API updates free of initial grid defaults", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(true);
    const configure = vi
      .spyOn(widgetRegistry, "configureGrid")
      .mockImplementation((options) => ({
        columnMenu: "legacy",
        cellSelection: true,
        enableCharts: true,
        ...options,
      }));
    const options: GridOptions = { loading: false };

    expect(configureAgGrid(options)).toEqual(options);
    expect(configure).not.toHaveBeenCalled();
    expect(configureAgGrid({ enableCharts: false }, true)).toEqual({
      columnMenu: "legacy",
      cellSelection: true,
      enableCharts: false,
    });
  });

  it("applies other Community grid capabilities without Enterprise", () => {
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockReturnValue(false);
    vi.spyOn(widgetRegistry, "configureGrid").mockImplementation((options) => ({
      ...options,
      rowHeight: 40,
    }));
    expect(configureAgGrid({ pagination: true }, true)).toEqual({
      pagination: true,
      rowHeight: 40,
    });
  });

  it("updates mounted controls when the capability is registered", () => {
    let available = false;
    let revision = 0;
    let listener: () => void;
    vi.spyOn(widgetRegistry, "hasAgGridCapability").mockImplementation(
      (id) => id === AG_ENTERPRISE_CAPABILITY && available,
    );
    vi.spyOn(widgetRegistry, "getSnapshot").mockImplementation(() => revision);
    vi.spyOn(widgetRegistry, "subscribe").mockImplementation((callback) => {
      listener = callback;
      return () => false;
    });
    const { result } = renderHook(useAgEnterprise);
    expect(result.current).toBe(false);

    act(() => {
      available = true;
      revision += 1;
      listener();
    });
    expect(result.current).toBe(true);
  });
});
