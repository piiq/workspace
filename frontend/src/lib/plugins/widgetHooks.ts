import type {
  ChartDataResult,
  WidgetContext,
  WidgetDataOptions,
  WidgetDataResult,
  WidgetLifecycle,
} from "@piiq/workspace-plugin-sdk";
import get from "lodash/get";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import { useRawDataToggle } from "~/components/Widgets/charting/useRawDataToggle";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";
import { convertHeadersToRecord } from "~/lib/utils/widgetParams";
import { registerWidgetLifecycle } from "~/lib/widgetData";

export function usePluginWidgetContext(): WidgetContext {
  const { widget, updateWidget } = useWidgetContext();
  const theme = useShallowThemeStore((state) => state.theme);
  if (!widget) throw new Error("Plugin widget hooks require a WidgetProvider.");
  const endpoint = widget.endpoint;
  const request =
    endpoint && convertHeadersToRecord({ ...endpoint.headers }, { ...endpoint.query });

  return {
    id: widget.id,
    rendererId: widget.type,
    endpoint: endpoint
      ? { ...endpoint, headers: request.headers, query: request.newParams }
      : undefined,
    parameters: widget.storage?.params ?? {},
    options: widget.data,
    state: widget.storage?.pluginState ?? {},
    theme,
    setParameters: (parameters) =>
      updateWidget(
        (previous) => ({
          ...previous,
          storage: {
            ...previous.storage,
            params: { ...previous.storage?.params, ...parameters },
          },
        }),
        true,
      ),
    setState: (state) =>
      updateWidget(
        (previous) => ({
          ...previous,
          storage: {
            ...previous.storage,
            pluginState: { ...previous.storage?.pluginState, ...state },
          },
        }),
        true,
      ),
  };
}

export function usePluginWidgetData<Data = unknown>(
  options: WidgetDataOptions = {},
): WidgetDataResult<Data> {
  const { widget } = useWidgetContext();
  if (!widget) throw new Error("Plugin widget hooks require a WidgetProvider.");

  const query = useJsonData<unknown>(
    {
      url: widget.endpoint?.url ?? "",
      method: widget.endpoint?.method ?? widget.endpointMethod ?? "GET",
      endpointHeaders: widget.endpoint?.headers,
      params: Object.fromEntries(
        Object.entries({
          ...widget.endpoint?.query,
          ...options.query,
          ...widget.storage?.params,
        }).filter(([, value]) => value !== "" && value !== undefined),
      ),
      body: options.body,
      asText: options.asText,
    },
    { enabled: options.enabled !== false && !!widget.endpoint?.url },
  );
  const refetch = useCallback(async () => {
    await query.refetch({ throwOnError: true });
  }, [query.refetch]);

  return {
    data: get(query.data, widget.data?.dataKey, query.data) as Data | undefined,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    lastUpdated: query.dataUpdatedAt,
    refetch,
  };
}

export function usePluginWidgetLifecycle(lifecycle: WidgetLifecycle): void {
  const { widget } = useWidgetContext();
  if (!widget) throw new Error("Plugin widget hooks require a WidgetProvider.");
  const current = useRef(lifecycle);
  current.current = lifecycle;

  useEffect(
    () =>
      registerWidgetLifecycle(widget.id, {
        refresh: () => current.current.refresh(),
        get exportData() {
          return current.current.exportData
            ? () => current.current.exportData!()
            : undefined;
        },
        dispose: () => current.current.dispose?.(),
      }),
    [widget.id],
  );
}

export function usePluginChartData<Data = unknown>(): ChartDataResult<Data> {
  const { widget } = useWidgetContext();
  const theme = useShallowThemeStore((state) => state.theme);
  if (!widget) throw new Error("Plugin widget hooks require a WidgetProvider.");

  const options = useMemo(() => {
    const params = Object.fromEntries(
      Object.entries({
        ...widget.endpoint?.query,
        ...widget.storage?.params,
      }).filter(([, value]) => value !== "" && value !== undefined),
    );
    params.theme = theme;
    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params,
    };
  }, [widget.endpoint, widget.storage?.params, theme]);

  const raw = useRawDataToggle({ baseOptions: options });
  const query = useJsonData<Data>(options, {
    enabled: !raw.showTable,
    staleTime: widget.staleTime ?? 1000 * 60 * 15,
  });
  const refetch = useCallback(async () => {
    if (raw.showTable) {
      return ((await raw.rawRefetch()) ?? undefined) as Data | unknown[] | undefined;
    }
    return (await query.refetch({ throwOnError: true })).data;
  }, [raw.showTable, raw.rawRefetch, query.refetch]);

  return {
    data: (raw.showTable ? (raw.rawData ?? undefined) : query.data) as
      | Data
      | unknown[]
      | undefined,
    showTable: raw.showTable,
    toggle: raw.toggle,
    isLoading: raw.showTable ? raw.rawLoading : query.isLoading,
    error: raw.showTable ? (raw.rawError ?? null) : query.error,
    lastUpdated: raw.showTable ? raw.rawLastUpdated : query.dataUpdatedAt,
    refetch,
  };
}
