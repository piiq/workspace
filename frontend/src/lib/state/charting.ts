import { isEqual } from "lodash";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import type { MetricType } from "~/components/Charting/constants";
import type { Selector } from "./app";

interface ChartingState {
  widgetStates: { [widgetId: string]: { symbol: string; prevSymbol: string } };
  widgetSecurities: {
    [widgetId: string]: { [symbol: string]: { metrics: MetricType[] } };
  };
  changeSymbol: (widgetId: string, symbol: string) => void;
  getSymbol: (widgetId: string) => string;
  getSecurityMetrics: (widgetId: string, symbol: string) => MetricType[];
  updateSecurityMetrics: (
    widgetId: string,
    symbol: string,
    metrics: MetricType[],
  ) => void;
  removeWidgetData: (widgetId: string) => void;
  removeTabWidgetsData: (widgetIds: string[]) => void;
}

export const useChartingStore = createWithEqualityFn<ChartingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        widgetStates: {
          charting_page: {
            symbol: "AAPL",
            prevSymbol: "",
          },
        },
        widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
        getSymbol: (widgetId: string) => {
          const { widgetStates } = get();
          return widgetStates[widgetId]?.symbol || "AAPL";
        },
        changeSymbol: (widgetId: string, symbol: string) => {
          const { widgetStates } = get();
          const currentSymbol = widgetStates[widgetId]?.symbol || "AAPL";
          if (symbol === currentSymbol) {
            return;
          }

          set((state) => ({
            widgetStates: {
              ...state.widgetStates,
              [widgetId]: {
                symbol,
                prevSymbol: currentSymbol,
              },
            },
          }));
        },
        getSecurityMetrics: (widgetId: string, symbol: string) => {
          const { widgetSecurities } = get();
          return widgetSecurities[widgetId]?.[symbol]?.metrics || [];
        },
        updateSecurityMetrics: (
          widgetId: string,
          symbol: string,
          metrics: MetricType[],
        ) => {
          set((state) => {
            if (!state.widgetSecurities[widgetId]) {
              state.widgetSecurities[widgetId] = {};
            }
            state.widgetSecurities[widgetId][symbol] = { metrics };
            return state;
          });
        },
        removeWidgetData: (widgetId: string) => {
          const { widgetStates, widgetSecurities } = get();

          const newWidgetStates = Object.fromEntries(
            Object.entries(widgetStates).filter(([wId]) => wId !== widgetId),
          );
          const newWidgetSecurities = Object.fromEntries(
            Object.entries(widgetSecurities).filter(([wId]) => wId !== widgetId),
          );
          set({
            widgetStates: newWidgetStates,
            widgetSecurities: newWidgetSecurities,
          });
        },
        removeTabWidgetsData: (widgetIds: string[]) => {
          if (!widgetIds.length) return;
          const { widgetStates, widgetSecurities } = get();

          const newWidgetStates = Object.fromEntries(
            Object.entries(widgetStates).filter(([wId]) => !widgetIds.includes(wId)),
          );
          const newWidgetSecurities = Object.fromEntries(
            Object.entries(widgetSecurities).filter(
              ([wId]) => !widgetIds.includes(wId),
            ),
          );

          set({
            widgetStates: newWidgetStates,
            widgetSecurities: newWidgetSecurities,
          });
        },
      }),
      {
        version: 2,
        name: "charting-storage",
        migrate(persistedState: any, version) {
          if (version === 1) {
            return {
              widgetStates: {
                charting_page: {
                  symbol: "AAPL",
                  prevSymbol: "",
                },
              },
              widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
            };
          }
          return persistedState;
        },
      },
    ),
  ),
);

export function useShallowChartingStore<S extends ChartingState, T>(
  selector: Selector<S, T>,
): T {
  return useChartingStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
