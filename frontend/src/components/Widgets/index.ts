import { lazy } from "react";
import { registerBuiltinRenderers } from "~/lib/plugins/api";
import { builtinWidgets } from "~/lib/plugins/builtinWidgets";
import { widgetRegistry } from "~/lib/plugins/registry";

const AgChartFC = lazy(() => import("./AgChart"));
const AgWebSocketsFC = lazy(() => import("../General/Table/AgWebSockets"));
const MarkdownFC = lazy(() => import("./custom/Markdown"));
const AgChartFromTableFC = lazy(() => import("../General/Table/AgChartFromTable"));
const AgGridFileFC = lazy(() => import("../General/Table/AgGridFile"));
const AgGridSQLFC = lazy(() => import("../General/Table/AgGridSQL"));
const AgGridTableFC = lazy(() => import("../General/Table/AgGridTable"));
const ChartFC = lazy(() => import("./Chart"));
const ChartVegaLiteFC = lazy(() => import("./charting/ChartVegaLite"));

const MetricWidgetFC = lazy(() => import("./Metric"));
const FileViewerWidgetFC = lazy(() => import("./FileView"));
const OmniWidgetFC = lazy(() => import("./OmniWidget"));
const ClockWidgetFC = lazy(() => import("./Clock"));
const CopilotTableFC = lazy(() => import("./AI/CopilotTable"));
const CustomNewsFC = lazy(() => import("./custom/News"));
const IframeFC = lazy(() => import("./Iframe"));
const YouTubeFC = lazy(() => import("./YouTube"));
const MarkdownEditorFC = lazy(() => import("./Misc/Editing/MarkdownEditor"));
const RSSViewerFC = lazy(() => import("./RssViewer"));
const XMLViewerFC = lazy(() => import("./XmlViewer"));
const NavigationBarFC = lazy(() => import("./ui/NavigationBar"));
const PdfViewerFC = lazy(() => import("./PdfViewer"));
const ImageViewerFC = lazy(() => import("./ImageViewer"));
const HtmlViewerFC = lazy(() => import("./custom/HtmlViewer"));
const MultiFileViewerFC = lazy(() => import("./MultiFileViewer"));

export const AgGridComponents = {
  ag_grid_file: "AgGridFile",
  ag_grid_sql: "AgGridSQL",
  ag_grid_table: "AgGridTable",
  xml_viewer: "XMLViewer",
  copilot_table: "CopilotTable",
  live_grid: "AgWebSockets",
  omni: "OmniWidget",
} as const;

export const NonAgGridComponents = {
  chart: "Chart",
  "chart-vegalite": "ChartVegaLite",
  clock: "ClockWidget",
  metric: "MetricWidget",
  file_viewer: "FileViewerWidget",
  iframe: "Iframe",
  youtube: "YouTube",
  rss_viewer: "RSSViewer",
  rich_note: "MarkdownEditor",
  markdown: "Markdown",
  pdf: "PdfViewer",
  html: "HtmlViewer",
  navigation_bar: "NavigationBar",
  ag_chart_from_table: "AgChartFromTable",
  ag_chart: "AgChart",
  multi_file_viewer: "MultiFileViewer",
  newsfeed: "CustomNews",
} as const;

export const Widgets = {
  AgChart: AgChartFC,
  AgWebSockets: AgWebSocketsFC,
  Markdown: MarkdownFC,
  AgChartFromTable: AgChartFromTableFC,
  AgGridFile: AgGridFileFC,
  AgGridSQL: AgGridSQLFC,
  AgGridTable: AgGridTableFC,
  Chart: ChartFC,
  ChartVegaLite: ChartVegaLiteFC,
  MetricWidget: MetricWidgetFC,
  FileViewerWidget: FileViewerWidgetFC,
  OmniWidget: OmniWidgetFC,
  ClockWidget: ClockWidgetFC,
  CopilotTable: CopilotTableFC,
  CustomNews: CustomNewsFC,
  Iframe: IframeFC,
  YouTube: YouTubeFC,
  MarkdownEditor: MarkdownEditorFC,
  RSSViewer: RSSViewerFC,
  XMLViewer: XMLViewerFC,
  NavigationBar: NavigationBarFC,
  PdfViewer: PdfViewerFC,
  ImageViewer: ImageViewerFC,
  HtmlViewer: HtmlViewerFC,
  MultiFileViewer: MultiFileViewerFC,
} as const;

export default Widgets;

export type WidgetComponentName = keyof typeof Widgets;
export type WidgetComponent<T extends WidgetComponentName> = (typeof Widgets)[T];

export const WidgetComponentMap = {
  ...AgGridComponents,
  ...NonAgGridComponents,
};

registerBuiltinRenderers(
  Object.entries(WidgetComponentMap).map(([id, componentName]) => ({
    id,
    title:
      builtinWidgets[id]?.name ?? componentName.replace(/([a-z])([A-Z])/g, "$1 $2"),
    description: builtinWidgets[id]?.description,
    widget: builtinWidgets[id],
    Component: Widgets[componentName],
    kind: id in AgGridComponents ? "table" : "content",
    wrapper: id in AgGridComponents ? "ag-grid" : undefined,
  })),
);

export type WidgetId = string;

export type WidgetComponentMapT = {
  [key in WidgetId]: WidgetComponentName;
};

export const getWidgetComponent = (widgetId: string) => {
  const state = widgetRegistry.getRendererState(widgetId);
  if (state.status === "pending") throw state.ready;
  return state.status === "ready" ? state.renderer.Component : undefined;
};

export const isAgGridWidget = (widgetId: string): boolean => {
  const state = widgetRegistry.getRendererState(widgetId);
  return state.status === "ready" && state.renderer.wrapper === "ag-grid";
};
