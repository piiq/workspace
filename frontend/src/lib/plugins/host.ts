import type { AgGridPluginHost } from "@piiq/workspace-plugin-sdk/ag-grid";
import * as agCharts from "ag-charts-community";
import * as agChartsCore from "ag-charts-core";
import * as agGrid from "ag-grid-community";
import * as react from "react";
import { lazy } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import * as reactDom from "react-dom";
import * as reactDomClient from "react-dom/client";
import { useWidgetDataExport } from "~/hooks/useWidgetDataExport";
import { useShallowThemeStore } from "~/lib/state/theme";
import { createPluginApi } from "./api";
import {
  ServerSideTable,
  useServerSideContext,
  useServerSideRequest,
} from "./serverSideTable";
import {
  usePluginWidgetContext,
  usePluginWidgetData,
  usePluginWidgetLifecycle,
} from "./widgetHooks";

export const pluginHost: AgGridPluginHost = {
  react,
  reactDom,
  reactDomClient,
  jsxRuntime,
  agGrid,
  agCharts,
  agChartsCore,
  agGridUi: { ServerSideTable, useServerSideContext, useServerSideRequest },
  useTheme: () => useShallowThemeStore((state) => state.theme),
  useWidgetContext: usePluginWidgetContext,
  useWidgetData: usePluginWidgetData,
  useWidgetDataExport,
  useWidgetLifecycle: usePluginWidgetLifecycle,
  ui: {
    Button: lazy(() =>
      import("~/components/ds/atoms/Button").then((module) => ({
        default: module.Button,
      })),
    ),
    Icon: lazy(() => import("./ui").then((module) => ({ default: module.PluginIcon }))),
    Tooltip: lazy(() => import("~/components/Tooltip")),
    WidgetShell: lazy(() =>
      import("./ui").then((module) => ({ default: module.PluginWidgetShell })),
    ),
    RawDataTable: lazy(() => import("~/components/Widgets/charting/RawDataTable")),
  },
};

export const pluginApi = createPluginApi(pluginHost);
