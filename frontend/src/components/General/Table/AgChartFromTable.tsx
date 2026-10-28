import type {
  ChartRangeSelectionChangedEvent,
  ChartRef,
  ColDef,
  CreateRangeChartParams,
  FirstDataRenderedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import type { NavBarProps } from "~/components/DraggableCard/NavBar";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { ChartViewButton } from "./Chart/AgChartView";
import useChartOptions, { getTotalSeries } from "./Chart/hooks/useChartOptions";
import { createItemStyler, useAgThemes } from "./Chart/themes";
import { Table } from "./hooks";

/// Fixes CellComp crashing widget
function cleanColumnDefs(columnDefs: ColDef[]) {
  return columnDefs.map((col) => {
    const { cellRenderer, ...rest } = col;
    return rest;
  });
}

export function AgChartFromTable() {
  const { widget, updateWidget } = useWidgetContext();
  const theme = useShallowThemeStore((s) => s.theme);

  const [state, setState] = useState({
    rowData: widget.storage.rowData,
    columnDefs: cleanColumnDefs(widget.storage.columnDefs as ColDef[]),
    columns: widget.storage.columns,
  });
  const [chartRef, setChartRef] = useState<ChartRef>(null);
  const ref = useRef<HTMLDivElement>(null);
  const agRef = useRef<AgGridReact>(null);

  const stateKey = `${widget.storage.transpose ? "transposed_CellRange" : "cellRange"}`;
  const stateKeyRef = useRef(stateKey);

  const { themePalette, agTheme, chartThemes, customChartThemes } = useAgThemes(theme);

  useEffect(() => {
    stateKeyRef.current = stateKey;
  }, [stateKey]);

  const chartViewEnabled = widget.storage?.chartView?.enabled ?? true;

  const { chartThemeOverrides } = useChartOptions();
  // Read via ref so this effect doesn't refire every render when chartThemeOverrides
  // gets a new reference — that was clobbering user edits in the Customize panel.
  const chartThemeOverridesRef = useRef(chartThemeOverrides);
  chartThemeOverridesRef.current = chartThemeOverrides;

  const { rowData, columnDefs, columns } =
    widget.storage.transpose && widget.storage.transposedT
      ? widget.storage.transposedT
      : widget.storage;

  useEffect(() => {
    if (!chartViewEnabled) return;

    chartThemeOverridesRef.current.bar.series.itemStyler = createItemStyler(
      themePalette,
      () => widget.storage.chartBarFillEnabled,
    );

    if (chartRef && agRef.current?.api) {
      agRef.current.api.updateChart({
        chartId: chartRef.chartId,
        type: "rangeChartUpdate",
        chartThemeName: chartThemes[0],
        chartThemeOverrides: chartThemeOverridesRef.current,
      });
    }
  }, [
    chartRef,
    chartViewEnabled,
    chartThemes,
    themePalette,
    widget.storage.chartBarFillEnabled,
  ]);

  const onFirstDataRendered = (params: FirstDataRenderedEvent) => {
    const { chartType } = widget.storage.chartModel;
    const cellRange = widget.storage?.[stateKeyRef.current];

    const cellRangeColumns = !!cellRange?.columns;

    const createRangeChartParams = {
      chartType: chartType ?? "groupedColumn",
      chartThemeName: chartThemes[0],
      chartContainer: ref.current,
      suppressChartRanges: true,
      cellRange: {
        columns: columns,
      },
      chartThemeOverrides,
    } as CreateRangeChartParams;

    if (!widget.storage.transposedT) {
      createRangeChartParams.switchCategorySeries = widget.storage.transpose;
    }

    createRangeChartParams.cellRange = cellRangeColumns
      ? cellRange
      : createRangeChartParams.cellRange;

    const colDefs = cleanColumnDefs(columnDefs);
    params.api.updateGridOptions({ rowData, columnDefs: colDefs });
    const chartRef = params.api.createRangeChart(createRangeChartParams);
    const zoomButtons = chartRef?.chartElement?.getElementsByClassName(
      "ag-charts-toolbar ag-charts-toolbar--horizontal ag-charts-zoom-buttons__toolbar--hidden",
    )?.[0] as HTMLDivElement;
    if (zoomButtons?.style) zoomButtons.style.transform = "translateY(54px)";

    setChartRef(chartRef);
  };

  const onChartRangeSelectionChanged = useCallback(
    (params: ChartRangeSelectionChangedEvent) => {
      const { cellRange } = params;
      if (!cellRange) return;

      updateWidget(
        (prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            [stateKeyRef.current]: cellRange,
          },
        }),
        true,
      );
    },
    [stateKeyRef],
  );

  const gridMemo = useMemo(() => {
    return (
      <AgGridReact
        className="ag-grid h-0 w-0 max-h-0"
        theme={agTheme}
        ref={(el) => (agRef.current = el)}
        getChartToolbarItems={(_) => []}
        popupParent={ref.current}
        enableCharts={true}
        chartThemeOverrides={chartThemeOverrides}
        onChartOptionsChanged={(params) => {
          const { chartType, chartOptions } = params;
          const chartModel = params.api
            .getChartModels()
            .find((model) => model.chartId === params.chartId);

          const totalSeries = getTotalSeries(params, chartModel?.cellRange);

          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              totalSeries,
              chartType,
              chartModel: {
                ...prev.storage.chartModel,
                chartType,
              },
              chartOptions,
            },
          }));
        }}
        rowData={state?.rowData}
        columnDefs={state?.columnDefs}
        onFirstDataRendered={onFirstDataRendered}
        onChartRangeSelectionChanged={onChartRangeSelectionChanged}
        customChartThemes={customChartThemes}
        chartThemes={chartThemes}
      />
    );
    // maybe add storage here later if something breaks :D
  }, [
    state,
    theme,
    ref.current,
    updateWidget,
    agRef,
    chartThemes,
    customChartThemes,
    agTheme,
  ]);

  const exportFns = useMemo(() => {
    if (!chartViewEnabled) {
      return {
        csvFunction: (title = "report") => {
          downloadData(rowData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(rowData, title, "excel", false);
        },
      } as NavBarProps["exportFns"];
    }
    return {
      csvFunction: (title = "report") => {
        agRef.current?.api.exportDataAsCsv({
          fileName: `${title}.csv`,
        });
      },
      excelFunction: (title = "report") => {
        agRef.current?.api.exportDataAsExcel({
          fileName: `${title}.xlsx`,
        });
      },
      pngFunction: (title = "report") => {
        agRef.current?.api.downloadChart({
          fileName: `${title}.png`,
          fileFormat: "png",
          chartId: chartRef.chartId,
        });
      },
    } as NavBarProps["exportFns"];
  }, [chartViewEnabled, agRef?.current, rowData]);

  return (
    <Table>
      <DraggableCard
        extraClassName={cn("overflow-hidden -mt-2", {
          "chart-wrapper h-[93%]": chartViewEnabled,
        })}
        showEllipsisMenu={true}
        exportFns={exportFns}
        aiEnabled={true}
        aiData={rowData}
        extraNavbarElements={<ChartViewButton />}
        settings={{
          showMetadata: true,
          showDuplicate: true,
          showExport: true,
          showMove: true,
          showCopyToClipboard: true,
        }}
        extraSettings={
          chartViewEnabled
            ? [
                {
                  icon: "noto-letter-t",
                  id: "transpose-data",
                  label: "Transpose data",
                  onClick: () => {
                    const transpose = !widget?.storage?.transpose;
                    updateWidget((prev) => ({
                      ...prev,
                      storage: {
                        ...prev.storage,
                        transpose,
                      },
                    }));

                    const isOldSchema = !!widget.storage?.transposedT;

                    let cellRange = widget.storage?.cellRange;
                    if (isOldSchema) {
                      const data = transpose
                        ? widget.storage.transposedT
                        : widget.storage;

                      data.columnDefs = cleanColumnDefs(data.columnDefs);
                      const { rowData, columnDefs, columns } = data;

                      cellRange =
                        widget.storage?.[
                          transpose ? "transposed_CellRange" : "cellRange"
                        ];

                      setState({ rowData, columnDefs, columns });
                      agRef.current.api.updateGridOptions({ rowData, columnDefs });
                    }

                    const cellRangeColumns = !!cellRange?.columns;

                    agRef.current.api.updateChart({
                      chartId: chartRef.chartId,
                      type: "rangeChartUpdate",
                      cellRange: cellRangeColumns ? cellRange : { columns },
                      switchCategorySeries: isOldSchema ? undefined : transpose,
                    });
                  },
                },
                {
                  icon: "cog-icon",
                  id: "open-chart-settings",
                  label: "Chart settings",
                  onClick: () => {
                    const agChartMenuCss = (
                      ref?.current?.getElementsByClassName(
                        "ag-chart-docked-container",
                      )?.[0] as HTMLElement
                    )?.style.cssText;

                    const params = { chartId: chartRef.chartId };

                    if (!agChartMenuCss || agChartMenuCss?.includes("min-width: 0px")) {
                      agRef.current.api.openChartToolPanel(params);
                    } else {
                      agRef.current.api.closeChartToolPanel(params);
                    }
                  },
                },
              ]
            : []
        }
      >
        {chartViewEnabled ? (
          <SetLoadingOnResize>
            {gridMemo}
            <div
              ref={ref}
              className={clsx("chart-wrapper-body h-full w-full", {
                "ag-theme-alpine": theme === "light",
                "ag-theme-alpine-dark": theme === "dark",
              })}
            />
          </SetLoadingOnResize>
        ) : (
          <div className="h-[calc(100%-5px)] min-h-[100px]">
            <AgGridReact
              className="ag-grid h-full w-full"
              theme={agTheme}
              rowData={rowData}
              columnDefs={cleanColumnDefs(columnDefs as ColDef[])}
            />
          </div>
        )}
      </DraggableCard>
    </Table>
  );
}

export default memo(AgChartFromTable);
