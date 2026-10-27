import type {
  ServerSideTableData,
  UseServerSideDataSource,
} from "@piiq/workspace-plugin-sdk/ag-grid";
import type { GridOptions, PaginationChangedEvent } from "ag-grid-community";
import { memo, useCallback, useMemo, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { getContextMenuItems, onPivotModeChanged } from "./AgGridUtils";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "./Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  useAgExportFuncs,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import type { AgGridEvents } from "./hooks/types";
import { useSizeColumns } from "./hooks/useUpdateColumnState";
import { useWidgetParamsPositions } from "./NavBar/QueryParams";
import { FormulasToolDef } from "./SubMenus/FormulasToolPanel";
import TableSettings from "./SubMenus/TableSettings";

const paginationPageSizeSelector = [500, 1000, 5000];
export type AgGridSSRGridOptionsReturn = ServerSideTableData;
export function AgGridSSRTable({
  useDataSource,
}: {
  useDataSource: UseServerSideDataSource;
}) {
  const widget = useWidgetContext()?.widget;
  const chartView = widget.storage?.chartView?.enabled;

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;
  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const ssrmGridOptions = useDataSource();

  const exportFns = useAgExportFuncs();
  const quickActions = useQuickActionsSettings();
  const ChartToolPanelActions = useChartToolPanelAction();

  const extraSettings = useMemo(() => {
    return [quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();
  const handleSave = useColumnVisibility(decimalDigitsSettings);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      loading={ssrmGridOptions.isLoading}
      error={ssrmGridOptions.error}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={decimalDigitsSettings}
          setDecimalDigitsSettings={setDecimalDigitsSettings}
        />
      }
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      exportFns={exportFns}
      extraNavbarElements={<ChartViewButton />}
      extraSettings={extraSettings}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("flex grow h-full", {
          "h-[calc(100%-6px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridSSRTableProvider ssrmGridOptions={ssrmGridOptions} />
      </div>
    </DraggableCard>
  );
}

export const AgGridSSRTableProvider = memo(
  (props: { ssrmGridOptions: AgGridSSRGridOptionsReturn }) => {
    const {
      Datasource,
      tableData,
      onRowGroupOpened,
      gridOptions: sourceOptions,
    } = props.ssrmGridOptions;

    const { widget, updateWidget } = useWidgetContext();

    const contextMenuItems = useCallback(
      (params) =>
        getContextMenuItems(params, { enableChart: true, widgetId: widget?.id }),
      [],
    );

    const agChartViewProps = useChartOptions();

    const onPaginationChanged = useCallback((event: PaginationChangedEvent) => {
      const pageSize = event.api?.paginationGetPageSize();
      if (pageSize) {
        event.api?.setGridOption("cacheBlockSize", pageSize);
      }
    }, []);

    const gridOptions = useMemo(() => {
      if (
        widget.storage?.isPivotMode ||
        !sourceOptions.sideBar ||
        typeof sourceOptions.sideBar !== "object" ||
        Array.isArray(sourceOptions.sideBar)
      )
        return sourceOptions;
      return {
        ...sourceOptions,
        sideBar: {
          ...sourceOptions.sideBar,
          toolPanels: [...(sourceOptions.sideBar.toolPanels ?? []), FormulasToolDef],
        },
      };
    }, [sourceOptions, widget.storage?.isPivotMode]);

    const sizeColumns = useSizeColumns();

    const onEventProps = useMemo(() => {
      return {
        onColumnRowGroupChanged: sizeColumns,
        onColumnValueChanged: sizeColumns,
        onColumnPivotChanged: sizeColumns,
        onColumnPivotModeChanged: (event: AgGridEvents) =>
          onPivotModeChanged(event, updateWidget),
      } as Partial<GridOptions<any>>;
    }, [sizeColumns, updateWidget]);

    return (
      <AgGridProvider
        rowData={tableData.rowData}
        columnDefs={tableData.columnDefs}
        gridOptions={gridOptions}
        rowGroupPanelShow="onlyWhenGrouping"
        getContextMenuItems={contextMenuItems}
        groupDisplayType="multipleColumns"
        paginationPageSizeSelector={paginationPageSizeSelector}
        paginationPageSize={widget?.storage?.paginationPageSize ?? 500}
        rowModelType="serverSide"
        cacheBlockSize={widget?.storage?.paginationPageSize ?? 500}
        maxBlocksInCache={10}
        serverSideDatasource={Datasource}
        onRowGroupOpened={onRowGroupOpened}
        onPaginationChanged={onPaginationChanged}
        {...onEventProps}
        {...agChartViewProps}
      />
    );
  },
);

export default AgGridSSRTable;
