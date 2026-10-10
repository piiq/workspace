import { definePlugin, type PluginHost } from "@piiq/workspace-plugin-sdk";
import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { WidgetComponent } from "~/components/Widget";
import { widgetRegistry } from "~/lib/plugins/registry";
import { WidgetTestWrapper } from "./Widgets/WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children }: any) => <section>{children}</section>,
}));
vi.mock("~/components/General/Table/hooks/useTableContext", () => ({
  Table: ({ children }: any) => <div data-testid="ag-grid-wrapper">{children}</div>,
}));
vi.mock("~/components/Widgets/Metric", () => ({
  default: () => <span>Metric content</span>,
}));

function renderWidget(type: string, widgetId = "example-data") {
  return render(
    <WidgetTestWrapper
      widgetOverrides={{
        id: type,
        widgetId,
        type,
        external: true,
        connectionType: "advanced-backend",
        endpoint: { url: "https://data.example/rows", method: "GET" },
        storage: { params: { symbol: "AAPL" }, pluginState: { expanded: true } },
      }}
    >
      <Suspense fallback={<span>Loading renderer</span>}>
        <WidgetComponent />
      </Suspense>
    </WidgetTestWrapper>,
  );
}

const host = {} as PluginHost;

describe("widget renderer availability", () => {
  it("shows a widget-local diagnostic instead of substituting a table", () => {
    renderWidget("@test/absent/chart");
    expect(screen.getByText("Widget renderer unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/Install a compatible @test\/absent plugin/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ag-grid-wrapper")).not.toBeInTheDocument();
  });

  it("uses a declared plugin renderer even when the widget ID matches a built-in", async () => {
    await widgetRegistry.registerPlugin(
      definePlugin(
        { name: "@test/explicit", version: "1.0.0" },
        {
          renderers: [
            {
              name: "chart",
              title: "Chart",
              Component: () => <span>Plugin content</span>,
            },
          ],
        },
      ),
      host,
    );
    renderWidget("@test/explicit/chart", "metric");
    expect(screen.getByText("Plugin content")).toBeInTheDocument();
    expect(screen.queryByText("Metric content")).not.toBeInTheDocument();
  });

  it("recovers a mounted widget after its renderer is registered", async () => {
    renderWidget("@test/recovery/chart");
    expect(screen.getByText("Widget renderer unavailable")).toBeInTheDocument();
    await act(async () => {
      await widgetRegistry.registerPlugin(
        definePlugin(
          { name: "@test/recovery", version: "1.0.0" },
          {
            renderers: [
              {
                name: "chart",
                title: "Chart",
                Component: () => <span>Recovered content</span>,
              },
            ],
          },
        ),
        host,
      );
    });
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Widget renderer unavailable")).not.toBeInTheDocument();
  });

  it("waits for pending registration before showing the renderer", async () => {
    let finish: () => void;
    const setupDone = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const registration = widgetRegistry.registerPlugin(
      definePlugin(
        { name: "@test/pending-widget", version: "1.0.0" },
        {
          setup: () => setupDone,
          renderers: [
            {
              name: "chart",
              title: "Chart",
              Component: () => <span>Ready content</span>,
            },
          ],
        },
      ),
      host,
    );
    renderWidget("@test/pending-widget/chart");
    expect(screen.getByText("Loading renderer")).toBeInTheDocument();
    expect(screen.queryByText("Widget renderer unavailable")).not.toBeInTheDocument();
    await act(async () => {
      finish();
      await registration;
    });
    expect(screen.getByText("Ready content")).toBeInTheDocument();
  });

  it("shows a failed plugin's error while a built-in sibling stays usable", async () => {
    const registration = widgetRegistry.registerPlugin(
      definePlugin(
        { name: "@test/failed-widget", version: "1.0.0" },
        {
          setup: () => {
            throw new Error("Chart assets missing");
          },
          renderers: [{ name: "chart", title: "Chart", Component: () => null }],
        },
      ),
      host,
    );
    await expect(registration).rejects.toThrow("Chart assets missing");
    renderWidget("@test/failed-widget/chart");
    renderWidget("metric", "metric-data");
    expect(screen.getByText(/Chart assets missing/)).toBeInTheDocument();
    expect(await screen.findByText("Metric content")).toBeInTheDocument();
  });

  it("shows the required API version for an incompatible plugin", () => {
    const incompatible = {
      ...definePlugin(
        { name: "@test/incompatible-widget", version: "1.0.0" },
        {
          renderers: [{ name: "chart", title: "Chart", Component: () => null }],
        },
      ),
      apiVersion: 2,
    } as any;
    expect(() => widgetRegistry.registerPlugin(incompatible, host)).toThrow(
      "Workspace supports API 1",
    );
    renderWidget("@test/incompatible-widget/chart");
    expect(screen.getByText(/Install a compatible plugin version/)).toBeInTheDocument();
  });
});
