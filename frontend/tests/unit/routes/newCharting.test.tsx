import { definePlugin, type PluginHost } from "@piiq/workspace-plugin-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useWidgetContext } from "~/components/Widget.context";
import { widgetRegistry } from "~/lib/plugins/registry";
import { PluginWidgetShell } from "~/lib/plugins/ui";
import NewCharting from "~/routes/newCharting";

vi.unmock("~/components/General/Table/Chart/hooks/useChartOptions");

describe("standalone Advanced Charts", () => {
  it("reports a missing plugin", () => {
    render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Install a compatible @piiq/tradingview plugin",
    );
  });

  it("passes the supplied endpoint and URL parameters to the registered renderer", async () => {
    window.history.replaceState(
      null,
      "",
      "/app/charting?ticker=MSFT&secondTickers=GOOG",
    );
    const plugin = definePlugin(
      { name: "@piiq/tradingview", version: "0.1.0" },
      {
        renderers: [
          {
            name: "chart",
            title: "Chart",
            Component() {
              const { widget } = useWidgetContext();
              return (
                <PluginWidgetShell data={[]}>
                  <div role="status">
                    {JSON.stringify({
                      endpoint: widget.endpoint,
                      parameters: widget.storage.params,
                    })}
                  </div>
                </PluginWidgetShell>
              );
            },
          },
        ],
      },
    );
    await widgetRegistry.registerPlugin(plugin, {} as PluginHost);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <NewCharting />
        </BrowserRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Connect a UDF-compatible datafeed",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Datafeed URL" }), {
      target: { value: "https://data.test/udf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect datafeed" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      '"url":"https://data.test/udf"',
    );
    expect(screen.getByRole("status")).toHaveTextContent('"symbol":"MSFT"');
    expect(screen.getByRole("status")).toHaveTextContent('"secondTickers":["GOOG"]');
  });
});
