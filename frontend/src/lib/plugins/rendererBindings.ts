// Aliases for saved widget types; plugin authors reference their own qualified renderer IDs directly.
export const RENDERER_BINDINGS: Readonly<Record<string, string>> = {
  table: "ag_grid_table",
  charting: "@piiq/tradingview/chart",
  advanced_charting: "@piiq/tradingview/chart",
  ssrm_table: "@piiq/ag-enterprise/server-side-table",
  ssrm_advanced: "@piiq/ag-enterprise/advanced-server-side-table",
  "chart-highcharts": "@piiq/highcharts/chart",
};

export function getBoundRendererId(id: string): string {
  return RENDERER_BINDINGS[id] ?? id;
}
