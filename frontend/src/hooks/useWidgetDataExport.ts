import type { WidgetDataExportOptions } from "@piiq/workspace-plugin-sdk";
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { Widget, WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import SOURCES from "~/lib/sources.json";
import { extractColumns, getJsonWidget, useWidgetDataSource } from "~/lib/utils";
import { publishWidgetData } from "~/lib/widgetData";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";

export function createWidgetDataMetadata(params: {
  title?: string;
  widget: WidgetT | null;
  widgetFromJSON?: Partial<Widget>;
  widgetSource?: string[];
  additionalMetadata?: Record<string, unknown>;
}) {
  const {
    title,
    widget,
    widgetFromJSON = getJsonWidget(widget),
    widgetSource,
    additionalMetadata,
  } = params;

  const widgetMetadata = widget ? handleWidgetMetadata(widget) : undefined;

  const name = title || widget?.name || widgetFromJSON?.name;
  const description = widget?.description || widgetFromJSON?.description;
  const source = widgetSource || widgetFromJSON?.source || widget?.source;
  const metadata = {
    ...(additionalMetadata || {}),
    ...(widgetMetadata || {}),
    ...(widget?.metadata || {}),
    ...{ params: widget?.storage?.params || {} },
  };

  return {
    name,
    description,
    source: Array.isArray(source) ? source[0] : source || "",
    metadata,
  };
}

export function useWidgetDataExport({
  data,
  title,
  enabled,
  lastUpdated: dataUpdatedAt,
  additionalMetadata,
  captureExecutedParams = true,
}: WidgetDataExportOptions) {
  const { id: currentDashboardId = "" } = useParams();
  const { widget, widgetFromJSON } = useWidgetContext(true);
  const widgetSource = useWidgetDataSource();
  const filtered = typeof data === "boolean";

  const { name, description, source, metadata } = useMemo(() => {
    return createWidgetDataMetadata({
      title,
      widget,
      widgetFromJSON,
      widgetSource,
      additionalMetadata,
    });
  }, [
    title,
    widgetSource,
    widget?.name,
    widget?.connectionType,
    widget?.storage?.params,
    widget?.description,
    widget?.widgetId,
    widget?.metadata,
    widgetFromJSON,
    additionalMetadata,
  ]);

  const executedParamsSnapshot = useMemo(
    () => ({ ...(widget?.storage?.params || {}) }),
    [data, dataUpdatedAt, widget?.id],
  );
  const lastUpdated = useMemo(() => dataUpdatedAt ?? Date.now(), [data, dataUpdatedAt]);

  useEffect(() => {
    if (!(enabled && widget?.id) || filtered) return;
    const fileType =
      widget?.connectionType === "file" && widget?.endpoint?.url?.split(".")?.pop();
    const columns = extractColumns(data);

    publishWidgetData(widget.id, {
      data,
      captureExecutedParams,
      innerTab: widget.innerTab,
      title: name,
      description: description || "",
      endpointUrl: widget.endpoint?.url || "",
      metadata: {
        ...(metadata || {}),
        params: executedParamsSnapshot,
        ...(SOURCES?.[source]?.name ? { source: SOURCES[source].name } : {}),
        ...(lastUpdated ? { lastUpdated } : {}),
        ...(fileType ? { fileType } : {}),
        ...(columns ? { columns } : {}),
      },
      dashboardId: currentDashboardId,
    });
  }, [
    enabled,
    widget?.id,
    widget?.innerTab,
    widget?.connectionType,
    widget?.endpoint?.url,
    currentDashboardId,
    data,
    name,
    description,
    source,
    metadata,
    lastUpdated,
    executedParamsSnapshot,
    captureExecutedParams,
  ]);
}

export default useWidgetDataExport;
