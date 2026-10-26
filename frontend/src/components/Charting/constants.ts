export type SecurityType = {
  id: string;
  symbol: string;
  label: string;
  color: string;
  category: "securities" | "crypto" | "indices";
  metrics: MetricType[];
  active: boolean;
};

export type MetricType = {
  id: string;
  dataKey?: string;
  callBack?: (data: any, plotlyData: any, security: SecurityType) => any;
  label: string;
  color: string;
  active: boolean;
  tvId?: string;
  period?: "annual" | "quarter";
  newPane?: string;
  prevPane?: string;
};

export const CHARTING_COLORS = [
  "#005CA9",
  "#4ADE80",
  "#16A34A",
  "#33BBFF",
  "#F5B166",
  "#EF7D00",
  "#991B1B",
  "#FACCD8",
  "#E93361",
  "#CCBE00",
];

// We might want to create new mockup colors for metrics :D
export const METRIC_COLORS = [
  "#ef7d00",
  "#005ca9",
  "#9b30d9",
  "#af005f",
  "#26481f",
  "#822661",
  "#af87ff",
];

export const ICONS = {
  sunIcon: {
    viewBox: "0 0 16 16",
    width: 16,
    height: 16,
    path: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z",
  },
  moonIcon: {
    viewBox: "0 0 25 25",
    width: 25,
    height: 25,
    path: "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z",
  },
};

export const layout_defaults = {
  overlaying: "y",
  side: "left",
  tickfont: { size: 12 },
  tickpadding: 5,
  showgrid: false,
  showline: false,
  showticklabels: true,
  showlegend: true,
  zeroline: false,
  anchor: "x",
  type: "linear",
  autorange: true,
  automargin: true,
};

export const TEMPLATES = {
  major: {
    label: "Major Asset Classes",
    children: [
      {
        label: "Commodities ETFs",
        description: "Major commodities performance",
        id: "major-commodities-etfs",
      },
    ],
  },
  economic: {
    label: "Economic",
    children: [
      {
        label: "Commodities",
        description: "Major commodities performance",
        id: "assets-commodities",
      },
      {
        label: "Currencies",
        description: "Major commodities performance",
        id: "assets-currencies",
      },
    ],
  },
  misc: {
    label: "Misc",
    children: [
      {
        label: "AAPL+BTC",
        description: "Apple and Bitcoin Prices",
        id: "aapl-btc",
        values: {
          securities: [
            {
              id: "BTC",
              label: "Bitcoin",
              category: "crypto",
              color: "#e6e227",
              metrics: [
                {
                  id: "total-return-price",
                  label: "Total Return",
                  color: "#e6e227",
                  active: true,
                },
              ],
              active: true,
            },
            {
              id: "AAPL",
              label: "Apple Inc.",
              category: "securities",
              color: "#171c45",
              metrics: [
                {
                  id: "total-return-price",
                  label: "Total Return",
                  color: "#171c45",
                  active: true,
                },
              ],
              active: true,
            },
          ],
        },
      },
    ],
  },
};
