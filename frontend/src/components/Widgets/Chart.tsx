import { get } from "lodash";
import type { PlotlyHTMLElement } from "plotly.js-dist-min";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadData,
  getExportData,
  lazyLoadPlotly,
} from "~/components/Charting/utils";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";
import PlotlyChart from "../Charting/PlotlyChart";
import DraggableCard, { SetLoadingOnResize } from "../DraggableCard";
import { useWidgetContext } from "../Widget.context";
import { useRawDataToggle } from "./charting/useRawDataToggle";

type PlotData = {
  data?: any[];
  layout?: any;
  config?: any;
};

export async function getChartWidgetData(results: any) {
  const exportData = await getExportData(results ?? { data: [], layout: {} });
  return { data: results, exportData };
}

export default function Chart() {
  const { widget } = useWidgetContext();
  const [plotData, setPlotData] = useState<PlotData>({
    data: [],
    layout: {},
    config: {},
  });

  const theme = useShallowThemeStore((s) => s.theme);
  const [plotDiv, setPlotDiv] = useState<PlotlyHTMLElement | null>(null);
  const [exportOutput, setExportOutput] = useState(null);
  const [failingUrl, setFailingUrl] = useState<string | undefined>(undefined);

  const chartOptions = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    newParams.theme = theme;

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
      onError: (error: Error) => {
        if (error?.message === "Failed to fetch") {
          setFailingUrl(widget.endpoint?.url);
        }
      },
    };
  }, [widget?.endpoint, widget?.storage?.params, theme]);

  const {
    hasRawFlag,
    showTable,
    toggle: rawDataToggle,
    tableNode,
    rawData,
    rawLoading,
    rawError,
  } = useRawDataToggle({
    baseOptions: chartOptions,
    icon: "plotly-icon",
    chartLabel: "Plotly chart",
  });

  const {
    isLoading: chartLoading,
    data: chartQueryData,
    dataUpdatedAt,
    error: chartError,
  } = useJsonData(chartOptions, {
    enabled: !showTable,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const data = useMemo(() => {
    if (showTable) return rawData;
    if (!chartQueryData) return;

    if (widget?.external && widget?.data?.dataKey) {
      return get(chartQueryData, widget?.data?.dataKey, chartQueryData);
    }
    return chartQueryData?.results ?? chartQueryData;
  }, [chartQueryData, rawData, showTable, widget?.external, widget?.data?.dataKey]);

  const handleCallback = useCallback(async (results: any) => {
    const { data, exportData } = await getChartWidgetData(results);

    if (data?.data?.length > 0) setPlotData(data);
    if (exportData) setExportOutput(exportData);
  }, []);

  useEffect(() => {
    if (!data) return;
    handleCallback(data);
  }, [data, handleCallback]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const isLoading = showTable ? rawLoading : chartLoading;
  const error = showTable ? rawError : chartError;

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={hasRawFlag && rawData ? rawData : exportOutput}
      lastUpdated={dataUpdatedAt}
      failingUrl={failingUrl}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={rawDataToggle}
      exportFns={{
        ...(exportOutput
          ? {
              csvFunction: (title = "report") => {
                downloadData(exportOutput, title, "csv", false);
              },
              excelFunction: (title = "report") => {
                downloadData(exportOutput, title, "excel", false);
              },
            }
          : {}),
        pngFunction: (
          title = widget?.widgetId
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
        ) => {
          lazyLoadPlotly().then((Plotly) => {
            if (!plotDiv) return;
            // Use Plotly's native downloadImage with proper configuration for quality
            Plotly.downloadImage(plotDiv, {
              format: "png",
              filename: title.replace(/-/g, "").replace(/ /g, "_"),
              width: plotDiv.clientWidth || plotDiv.layout.width || 800,
              height: plotDiv.clientHeight || plotDiv.layout.height || 600,
              // @ts-expect-error
              scale: 2, // Higher scale for better quality
            });
          });
        },
      }}
      loading={isLoading}
      error={error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <SetLoadingOnResize>
        {showTable
          ? tableNode
          : !isLoading &&
            plotData?.data?.length > 0 && (
              <PlotlyChart
                isExternal={widget.external}
                reduceSize={0}
                initialData={plotData}
                margin={{
                  t: plotData?.layout?.margin?.t || 10,
                  b: plotData?.layout?.margin?.b || 10,
                }}
                setPlotDiv={(div) => setPlotDiv(div)}
              />
            )}
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
