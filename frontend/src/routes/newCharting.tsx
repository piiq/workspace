import { useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import type { NewWidgetT, WidgetT } from "~/components/types";
import { useWidgetContext, WidgetContext } from "~/components/Widget.context";
import TVChartUnavailable from "~/components/Widgets/TVChartContainer/TVChartUnavailable";
import { TabProvider } from "~/lib/contexts/TabContext";
import { widgetRegistry } from "~/lib/plugins/registry";

export default function NewCharting() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parent = useWidgetContext(true);
  const datafeed = searchParams.get("datafeed") ?? "";
  const [widget, setWidget] = useState<WidgetT>(() => ({
    id: "charting_page",
    widgetId: "charting",
    name: "Advanced Charts",
    type: "advanced_charting",
    external: true,
    data: {},
    endpoint: { url: datafeed, method: "GET" },
    storage: {
      params: {
        symbol: searchParams.get("ticker") ?? "AAPL",
        secondTickers:
          searchParams.get("secondTickers")?.split(",").filter(Boolean) ?? [],
      },
    },
  }));
  const widgetRef = useRef(widget);
  widgetRef.current = widget;
  const updateWidget = (next: NewWidgetT) =>
    setWidget((previous) => (typeof next === "function" ? next(previous) : next));
  useSyncExternalStore(
    widgetRegistry.subscribe,
    widgetRegistry.getSnapshot,
    widgetRegistry.getSnapshot,
  );
  const renderer = widgetRegistry.getRendererState("advanced_charting");
  if (renderer.status === "pending") throw renderer.ready;

  return (
    <div className="mx-[22px] my-[10px] bg-white dark:bg-[#151518] rounded h-[96.5vh]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const url = String(new FormData(event.currentTarget).get("datafeed"));
          setSearchParams((previous) => {
            previous.set("datafeed", url);
            return previous;
          });
          setWidget((previous) => ({ ...previous, endpoint: { url, method: "GET" } }));
        }}
      >
        <label>
          Datafeed URL{" "}
          <input name="datafeed" type="url" defaultValue={datafeed} required />
        </label>
        <button type="submit">Connect datafeed</button>
      </form>
      {renderer.status !== "ready" ? (
        <TVChartUnavailable message={renderer.message} />
      ) : !widget.endpoint.url ? (
        <TVChartUnavailable message="Connect a UDF-compatible datafeed to view Advanced Charts." />
      ) : (
        <TabProvider currentTab="charting" tabId="" layouts={[]}>
          <WidgetContext.Provider
            value={{
              ...parent,
              widget,
              widgetRef,
              widgetFromJSON: widget,
              uuid: widget.id,
              getWidget: () => widgetRef.current,
              updateWidget,
            }}
          >
            <renderer.renderer.Component />
          </WidgetContext.Provider>
        </TabProvider>
      )}
    </div>
  );
}
