import type {
  WidgetContext,
  WidgetDataOptions,
  WidgetDataResult,
  WidgetLifecycle,
} from "@piiq/workspace-plugin-sdk";
import get from "lodash/get";
import { useCallback, useEffect, useRef } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import { useShallowThemeStore } from "~/lib/state/theme";
import { registerWidgetLifecycle } from "~/lib/widgetData";

export function usePluginWidgetContext(): WidgetContext {
  const { widget, updateWidget } = useWidgetContext();
  const theme = useShallowThemeStore((state) => state.theme);
  if (!widget) throw new Error("Plugin widget hooks require a WidgetProvider.");

  return {
    id: widget.id,
    rendererId: widget.type,
    endpoint: widget.endpoint,
    parameters: widget.storage?.params ?? {},
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
