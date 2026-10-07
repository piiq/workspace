export interface TVChartContainerProps {
  ticker?: string;
  extraClassName?: string;
  simpleChart?: boolean;
  secondTickers?: string[];
  showTA?: boolean;
}

export interface ChartExportData {
  schema: Array<
    | { type: "time" }
    | {
        type: string;
        plotTitle: string;
        sourceType: string;
        sourceTitle?: string;
      }
  >;
  displayedData: Array<Array<string | number>>;
}

export interface ChartingLibraryWidget {
  setOnDataHandler: (callback: (data: unknown[]) => void) => void;
  getTvWidget: () => {
    activeChart: () => {
      chartType: () => number;
      exportData: (options: {
        includeDisplayedValues: boolean;
      }) => Promise<ChartExportData>;
    };
  };
}

export interface ChartMetaInfo {
  id: string | number;
  name: string;
  symbol: string;
  resolution: string;
  timestamp: number;
}

export interface ChartData {
  id?: string | number;
  name: string;
  symbol: string;
  resolution: string;
  content: string;
  timestamp?: number;
}

export interface StudyTemplateMetaInfo {
  name: string;
}

export interface StudyTemplateData extends StudyTemplateMetaInfo {
  content: string;
}

export type ChartTemplateContent = object;

export interface ChartTemplate {
  content?: ChartTemplateContent;
}

export interface SavedStateMetaInfo {
  uid?: string | number;
  name?: string;
  description?: string;
}

export interface LineToolsAndGroupsState {
  sources: Map<string, object | null>;
}

export type LineToolsAndGroupsLoadRequestType = string;
export type LineToolsAndGroupsLoadRequestContext = object;
