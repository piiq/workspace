import type { GridOptions, Module } from "ag-grid-community";
import type { z } from "zod";
import type {
  agGridCapabilityMetadataSchema,
  PluginDefinition,
  PluginHost,
} from "./index";

export interface AgGridPluginHost extends PluginHost {
  agGrid: typeof import("ag-grid-community");
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
