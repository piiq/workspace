import type {
  ColDef,
  GridApi,
  GridOptions,
  IServerSideDatasource,
  IServerSideGetRowsParams,
  IServerSideGetRowsRequest,
  Module,
  RowGroupOpenedEvent,
} from "ag-grid-community";
import type { ComponentType, MutableRefObject } from "react";
import type { z } from "zod";
import type {
  agGridCapabilityMetadataSchema,
  PluginDefinition,
  PluginHost,
} from "./index";

export interface AgGridPluginHost extends PluginHost {
  agGrid: typeof import("ag-grid-community");
  agCharts?: typeof import("ag-charts-community");
  agChartsCore?: typeof import("ag-charts-core");
  agGridUi: AgGridUi;
}

export interface ServerSideResponse {
  rowData: Record<string, any>[];
  rowCount: number;
  schema?: Record<string, string>;
  timestamp?: number;
  pivotFields?: string[];
  error?: string;
}

export interface ServerSideRunComplete {
  requestSucceeded: boolean;
  hasData: boolean;
  rowCount: number;
  rowData?: Record<string, any>[];
}

export interface ServerSideDataSourceConfig {
  suppressDefaultErrorToast?: boolean;
  onError?: (message: string) => void;
  onRunComplete?: (detail: ServerSideRunComplete) => void;
}

export interface ServerSideTableData {
  Datasource: IServerSideDatasource;
  tableData: { rowData: Record<string, any>[]; columnDefs: ColDef[] };
  gridOptions: GridOptions;
  isLoading: boolean;
  error: Error | null;
  dataUpdatedAt: number;
  onRowGroupOpened: (event: RowGroupOpenedEvent) => void;
}

export type UseServerSideDataSource = (
  query?: string,
  config?: ServerSideDataSourceConfig,
) => ServerSideTableData;

export interface ServerSideContext {
  advanced: boolean;
  parameters: Record<string, any>;
  queryParameters: { paramName: string; value?: unknown }[];
  request?: Partial<IServerSideGetRowsRequest> & {
    query?: string;
    disableCache?: boolean;
  };
  disabled: boolean;
  pivotMode: boolean;
  pageSize: number;
  openedToolPanel?: string;
  refreshQuery?: number;
  isPreview: boolean;
  gridRef: MutableRefObject<{ api: GridApi } | null>;
  prepareData: (rows: Record<string, any>[]) => ServerSideTableData["tableData"];
  resolveQuery: (query: string, parameters: Record<string, any>) => string;
  setRequest: (request: ServerSideContext["request"]) => void;
  fetchRows: (
    parameters: Record<string, any>,
    request: ServerSideContext["request"],
  ) => Promise<ServerSideResponse | null>;
  beginExecution: () => void;
  run: () => void;
  publishData: (
    params: IServerSideGetRowsParams,
    captureExecutedParams: boolean,
    rows?: Record<string, any>[],
  ) => Promise<void>;
  reportError: (message: string) => void;
}

export interface ServerSideRequestOptions {
  parameters: Record<string, any>;
  body: ServerSideContext["request"];
  enabled: boolean;
}

export interface AgGridUi {
  ServerSideTable: ComponentType<{
    advanced?: boolean;
    useDataSource: UseServerSideDataSource;
  }>;
  useServerSideContext: () => ServerSideContext;
  useServerSideRequest: (options: ServerSideRequestOptions) => {
    data: ServerSideResponse | undefined;
    isLoading: boolean;
    error: Error | null;
    dataUpdatedAt: number;
    refetch: () => Promise<{
      data: ServerSideResponse | undefined;
      error: Error | null;
    }>;
  };
}

export function getAgGridUi(host: PluginHost): AgGridUi {
  const ui = (host as Partial<AgGridPluginHost>).agGridUi;
  if (!ui) throw new Error("The plugin host does not provide AG Grid UI.");
  return ui;
}

export type AgGridCapabilityDefinition = z.input<
  typeof agGridCapabilityMetadataSchema
> & {
  modules: Module[];
  configureGrid?: (options: GridOptions) => GridOptions;
};

export interface AgGridPluginDefinition extends PluginDefinition {
  agGridCapabilities?: AgGridCapabilityDefinition[];
}

export function getAgGrid(host: PluginHost): AgGridPluginHost["agGrid"] {
  const agGrid = (host as Partial<AgGridPluginHost>).agGrid;
  if (!agGrid) throw new Error("The plugin host does not provide AG Grid.");
  return agGrid;
}
