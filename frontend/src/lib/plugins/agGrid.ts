import type { GridOptions } from "ag-grid-community";
import { useSyncExternalStore } from "react";
import { widgetRegistry } from "./registry";

export const AG_ENTERPRISE_CAPABILITY = "@piiq/ag-enterprise/enterprise";

export function hasAgEnterprise() {
  return widgetRegistry.hasAgGridCapability(AG_ENTERPRISE_CAPABILITY);
}

export function useAgEnterprise() {
  useSyncExternalStore(widgetRegistry.subscribe, widgetRegistry.getSnapshot);
  return hasAgEnterprise();
}

export function configureAgGrid(options: GridOptions, initial = false): GridOptions {
  const configuredOptions = initial
    ? (widgetRegistry.configureGrid(options) ?? options)
    : options;
  if (hasAgEnterprise()) return configuredOptions;

  const communityOptions = { ...configuredOptions };
  for (const key of [
    "cellSelection",
    "enableCharts",
    "statusBar",
    "sideBar",
    "rowGroupPanelShow",
    "pivotPanelShow",
    "groupDisplayType",
    "getContextMenuItems",
    "getMainMenuItems",
    "columnMenu",
    "getChartToolbarItems",
    "createChartContainer",
    "customChartThemes",
    "chartThemes",
    "chartThemeOverrides",
  ] as const) {
    delete communityOptions[key];
  }
  return communityOptions;
}
