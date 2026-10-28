import { useCallback, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { processAgGridTableData } from "~/components/Widgets/dataProcessors";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, getWidgetColumnDefs } from "~/lib/utils";
import { getContextMenuItems, onPivotModeChanged } from "./AgGridUtils";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "./Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  getSideBarOptions,
  useAgExportFuncs,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import type { AgGridEvents } from "./hooks/types";
import { useCopilotFilteredWidgetData } from "./hooks/useCopilotFilteredData";
import { PeriodParams, useWidgetParamsPositions } from "./NavBar/QueryParams";
import TableSettings, { type EnableSettings } from "./SubMenus/TableSettings";

type AgGridTableState = {
  decimalDigitsSettings: number;
  failingUrl: string | undefined;
  enableSettings?: EnableSettings;
};

export function useGetTableData(
  state: AgGridTableState,
  dispatch: StateDispatch<AgGridTableState>,
) {
  const { widget, getWidget } = useWidgetContext();
  const columnDefsFromJSON = useMemo(
    () => getWidgetColumnDefs(widget),
    [widget.widgetId, widget?.data?.table?.columnsDefs],
  );
  const period: "annual" | "quarter" | "ttm" =
    widget?.storage?.params?.period ?? "annual";

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );
    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
      onError: (error: Error) => {
        if (error?.message === "Failed to fetch") {
          dispatch({ failingUrl: widget.endpoint?.url });
        }
      },
    };
  }, [widget.data?.mainTicker?.symbol, widget?.endpoint, widget?.storage?.params]);

  const {
    data: queryData,
    error,
    isLoading,
    dataUpdatedAt,
  } = useJsonData(options, {
    enabled: true,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const widgetMemo = useMemo(() => {
    const w = getWidget();
    return {
      ...w,
      storage: {
        ...(w.storage ?? {}),
        transpose: widget?.storage?.transpose,
        params: {
          ...(widget.storage?.params ?? {}),
          period,
        },
        enableAdvanced: state.enableSettings.enableAdvanced,
      },
      data: {
        ...w.data,
        table: {
          ...w.data?.table,
          columnsDefs: columnDefsFromJSON,
          showAll: widget?.data?.table?.showAll,
          formatterFn: widget?.data?.table?.formatterFn,
        },
      },
    };
  }, [
    period,
    state.enableSettings.enableAdvanced,
    widget?.storage?.transpose,
    widget?.data?.table?.showAll,
    widget?.data?.table?.formatterFn,
    columnDefsFromJSON,
  ]);

  const { rowData, columnDefs } = useMemo(() => {
    if (!queryData) return { rowData: [], columnDefs: [] };

    if (state.failingUrl) {
      dispatch({ failingUrl: undefined });
    }

    return processAgGridTableData(queryData, widgetMemo, decimalDigitsToUse);
  }, [queryData, widgetMemo, decimalDigitsToUse]);

  const gridOptions = useMemo(() => {
    const sideBar = getSideBarOptions(widget.storage);
    return {
      rowHeight: 32,
      headerHeight:
        period.toLowerCase() === "quarter" && widget?.storage?.transpose ? 22 : 32,
      statusBar: widget.storage.enableStats
        ? {
            statusPanels: [
              {
                statusPanel: "agAggregationComponent",
                statusPanelParams: {
                  aggFuncs: ["count", "sum", "min", "max", "avg"],
                },
              },
              {
                statusPanel: "agTotalRowCountComponent",
              },
            ],
          }
        : undefined,
      sideBar,
    };
  }, [
    period,
    widget.storage.enableStats,
    widget.storage.enableAdvanced,
    widget.storage.enableFormulas,
    widget.storage.transpose,
    widget.storage.openedToolPanel,
    widget.storage.isPivotMode,
  ]);

  useCopilotFilteredWidgetData(rowData, dataUpdatedAt);
  return { rowData, columnDefs, gridOptions, dataUpdatedAt, isLoading, error };
}

export default function AgGridTable() {
  const { updateWidget, widget, widgetFromJSON } = useWidgetContext();

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [state, dispatch] = useStateReducer<AgGridTableState>({
    decimalDigitsSettings: decimalDigitsToUse,
    failingUrl: undefined,
    enableSettings: {
      enableStats: !!widget.storage?.enableStats,
      enableAdvanced: !!widget.storage?.enableAdvanced,
      enablePagination: widget.storage?.enablePagination,
      enableFormulas: !!widget.storage?.enableFormulas,
    },
  });

  const chartView = widget.storage?.chartView?.enabled;

  const { rowData, columnDefs, gridOptions, isLoading, dataUpdatedAt, error } =
    useGetTableData(state, dispatch);

  const quickActions = useQuickActionsSettings(widget?.storage?.transpose);

  const handleSave = useColumnVisibility(
    state.decimalDigitsSettings,
    state.enableSettings,
  );

  const contextMenuItems = useCallback(
    (params) => {
      const enableChart =
        widget?.external ?? widgetFromJSON?.data?.table?.enableCharts ?? false;

      return getContextMenuItems(params, { enableChart, widgetId: widget?.id });
    },
    [widget?.external, widgetFromJSON?.data?.table?.enableCharts],
  );

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();

  const extraSettings = useMemo(() => {
    return [quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);

  const exportFns = useAgExportFuncs();

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const onColumnPivotModeChanged = useCallback(
    (event: AgGridEvents) => onPivotModeChanged(event, updateWidget),
    [updateWidget],
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      failingUrl={state.failingUrl}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={state.decimalDigitsSettings}
          setDecimalDigitsSettings={(decimalDigitsSettings) =>
            dispatch({ decimalDigitsSettings })
          }
          enableSettings={state.enableSettings}
          setEnableSettings={(enabled) =>
            dispatch({ enableSettings: (prev) => ({ ...prev, ...enabled }) })
          }
        />
      }
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      exportFns={exportFns}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      elementNextToTitle={<PeriodParams />}
      extraNavbarElements={
        (!!widget?.storage?.chartView ||
          widget?.external ||
          widgetFromJSON?.data?.table?.enableCharts) && <ChartViewButton />
      }
      error={error || rowData?.length === 0}
      errorMessage={widget?.external ? error?.message : "No results found"}
      extraSettings={extraSettings}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("flex grow h-full", {
          "h-[calc(100%-6px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridProvider
          columnDefs={columnDefs}
          rowData={rowData}
          getContextMenuItems={contextMenuItems}
          gridOptions={gridOptions}
          onColumnPivotModeChanged={onColumnPivotModeChanged}
          {...agChartViewProps}
        />
      </div>
    </DraggableCard>
  );
}
