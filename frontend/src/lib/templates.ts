import type { WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";

type WidgetState = {
  paramOrder?: string[];
  params?: Record<string, any>;
  chartView?: WidgetT["storage"]["chartView"];
  chartModel?: WidgetT["storage"]["chartModel"];
  columnState?: WidgetT["data"]["table"]["columnState"];
  filterModel?: Record<string, any>;
  storage?: { text?: string; html?: string };
};

export type TabLayout<Extra = {}> = {
  i: WidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: WidgetState;
} & Extra;
