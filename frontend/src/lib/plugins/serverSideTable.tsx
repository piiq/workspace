import type {
  ServerSideContext,
  ServerSideRequestOptions,
  ServerSideTableData,
  UseServerSideDataSource,
} from "@piiq/workspace-plugin-sdk/ag-grid";
import type {
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest,
} from "ag-grid-community";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { TOTAL_CELL_LIMIT } from "~/components/General/Table/AgGrid";
import { AgGridSSRTable } from "~/components/General/Table/AgGridSSRM";
import AgGridSSRMAdvanced from "~/components/General/Table/AgGridSSRMAdvanced";
import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import { useAgGridContext } from "~/components/General/Table/hooks";
import { getSelectedRangeData } from "~/components/General/Table/hooks/useCreateChart";
import {
  ensureAgGrid,
  getNewQuery,
  getSSRRows,
  getTableData,
} from "~/components/General/Table/utils";
import { useWidgetContext } from "~/components/Widget.context";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { type QueryOptions, useJsonData } from "~/lib/api";
import {
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { dispatchRunParams, isSSRMType } from "~/lib/utils";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";

export function ServerSideTable({
  advanced = false,
  useDataSource,
}: {
  advanced?: boolean;
  useDataSource: UseServerSideDataSource;
}) {
  const Component = advanced ? AgGridSSRMAdvanced : AgGridSSRTable;
  return <Component useDataSource={useDataSource} />;
}

export function useServerSideContext(): ServerSideContext {
  const { widget, isPreview, getWidget, updateWidget } = useWidgetContext();
  const storage = widget.storage ?? {};
  const gridRef = useAgGridContext().gridRef;
  const publishData = useAddCopilotWidgetData();
  const beginExecution = useShallowCopilotDataStore(
    (state) => state.beginWidgetCopilotExecution,
  );
  const advanced =
    widget.type !== "ssrm_table" && !widget.type.endsWith("/server-side-table");
  const queryParameters = useMemo(
    () => storage.sqlParamDefs ?? [],
    [storage.sqlParamDefs],
  );
  const prepareData = useCallback(
    (rows: Record<string, any>[]): ServerSideTableData["tableData"] => {
      const rowData = getTableData(rows, widget);
      return { rowData, columnDefs: getColumnDefs(rowData, widget) };
    },
    [widget.data?.table?.columnsDefs, widget.data?.dataKey],
  );
  return {
    advanced,
    parameters: storage.params,
    queryParameters,
    request: storage.ssmRequest,
    disabled: !!storage.ssrmDisabled,
    pivotMode: !!storage.isPivotMode,
    pageSize: storage.paginationPageSize ?? 500,
    openedToolPanel: storage.openedToolPanel,
    refreshQuery: widget.refreshQuery,
    isPreview,
    gridRef,
    prepareData,
    resolveQuery: getNewQuery,
    setRequest: (request) =>
      updateWidget((previous) => ({
        ...previous,
        storage: { ...previous.storage, ssmRequest: request },
      })),
    fetchRows: (parameters, request) =>
      getSSRRows(getWidget().endpoint, parameters, request),
    beginExecution: () => {
      const current = getWidget();
      beginExecution(current.id, { ...current.storage?.params });
    },
    run: () => {
      if (advanced) dispatchRunParams(widget.id);
      else updateWidget((previous) => ({ ...previous, refreshQuery: Date.now() }));
    },
    publishData: (params, captureExecutedParams, rowData) =>
      publishData(params, { captureExecutedParams, rowData }),
    reportError: (message) =>
      toast.error("Error fetching data", { description: message }),
  };
}

export function useServerSideRequest({
  parameters,
  body,
  enabled,
}: ServerSideRequestOptions) {
  const { getWidget } = useWidgetContext();
  const options = useMemo<QueryOptions>(() => {
    const widget = getWidget();
    return {
      url: widget.endpoint?.url,
      endpointHeaders: {
        "Content-Type": "application/json",
        ...widget.endpoint?.headers,
      },
      method: "POST",
      params: parameters,
      body,
    };
  }, [getWidget, parameters, body]);
  return useJsonData(options, {
    enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: undefined,
    retry: 0,
  });
}

type CopilotSnapshotOptions = {
  captureExecutedParams?: boolean;
  rowData?: Record<string, any>[];
};

function useAddCopilotWidgetData() {
  const { widget, widgetFromJSON } = useWidgetContext();
  const language = useMemo(
    () =>
      isSSRMType(widget.type) &&
      widget.params?.find((p) => p.paramName === "query")?.language,
    [widget.params],
  );

  const backendSchemas = useShallowBackendConnectorStore(
    (state) =>
      isSSRMType(widget.type) && state.getApiSourceById(widget.sourceId || "")?.schemas,
  );

  const sqlSchemas = useMemo(() => {
    const schemaName = widget.schemaName;
    if (language !== "sql" || !backendSchemas) {
      return { schema: undefined, allSchemas: undefined };
    }

    if (schemaName === "ALL_DATABASES_ALL_SCHEMAS_ALL_TABLES") {
      return { schema: undefined, allSchemas: backendSchemas };
    }

    return { schema: backendSchemas[schemaName], allSchemas: undefined };
  }, [language, widget.schemaName, backendSchemas]);

  const widgetInfo = useMemo(() => {
    const widgetdata = handleWidgetMetadata<WidgetMetadataItem>(widget);
    const { widgetConfig, ...widgetMetadata } = widgetdata || {};

    const name = widget?.name || widgetFromJSON?.name;
    const description = widget?.description || widgetFromJSON?.description;
    const source = widgetFromJSON?.source || widget?.source;
    return {
      name,
      description,
      source: Array.isArray(source) ? source[0] : source || "",
      metadata: {
        ...(widgetMetadata || {}),
        ...(widget?.metadata || {}),
        ...{ params: widget?.storage?.params || {} },
        ...(sqlSchemas.schema ? { schema: sqlSchemas.schema } : {}),
      },
    };
  }, [
    widget?.name,
    widget?.description,
    widget?.widgetId,
    widget?.storage?.params,
    widget?.metadata,
    widgetFromJSON,
    sqlSchemas,
  ]);

  const addDataOnDashboardWidget = useShallowCopilotDataStore(
    (state) => state?.addDataOnDashboardWidget,
  );

  const addWidgetFullData = useCallbackRef(
    (
      data: any[],
      request: IServerSideGetRowsRequest,
      options: CopilotSnapshotOptions = {},
    ) => {
      const columnCount = Object.keys(data?.[0] || {}).length;
      if (columnCount * data?.length > TOTAL_CELL_LIMIT) return Promise.resolve();

      const { name, description, source, metadata } = widgetInfo;

      const { groupKeys, ...ssmRequest } = request || {};
      return new Promise<void>((resolve) =>
        queueMicrotask(() => {
          setTimeout(() => {
            addDataOnDashboardWidget(widget.id, {
              data,
              captureExecutedParams: options.captureExecutedParams === true,
              innerTab: widget.innerTab,
              title: name,
              description,
              endpointUrl: widget.endpoint?.url || "",
              metadata: {
                ...(metadata || {}),
                ...(source ? { source } : {}),
                lastUpdated: Date.now(),
                ssmRequest: {
                  ...ssmRequest,
                  groupKeys: [],
                },
              },
            });
            resolve();
          });
        }),
      );
    },
  );

  const addWidgetData = useCallbackRef(
    (params: IServerSideGetRowsParams, options: CopilotSnapshotOptions = {}) => {
      const ssmRequest = params.request;
      if (options.rowData)
        return addWidgetFullData(options.rowData, ssmRequest, options);
      if (!ensureAgGrid(params)) return addWidgetFullData([], ssmRequest, options);
      const hiddenColIds = params.api.getState()?.columnVisibility?.hiddenColIds || [];

      const selectedRowNodes = [] as Record<string, any>[];

      params.api.forEachNode((node) => {
        if (node.group && node.rowGroupColumn) {
          const groupKeys = [
            node.rowGroupColumn.getColId(),
            ...Object.keys(node.aggData || {}),
          ];

          for (const key of groupKeys) {
            if (hiddenColIds.includes(key)) {
              hiddenColIds.splice(hiddenColIds.indexOf(key), 1);
            }
          }
        }
        getSelectedRangeData(node, {
          selectedRowNodes,
          isServerSide: true,
          filterFn: (key, value) =>
            !(hiddenColIds.includes(key) || key.startsWith("ag-Grid-AutoColumn")) &&
            typeof value !== "object",
        });
      });

      return addWidgetFullData(selectedRowNodes, ssmRequest, options);
    },
  );

  return addWidgetData;
}
