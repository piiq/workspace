import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { saveDashboard, waitForWorkspace } from "../helpers";

export async function connectPluginBackend(page: Page) {
  const name = `Plugin data ${randomUUID().slice(0, 8)}`;
  const url = `http://workspace-plugin.test/${randomUUID()}`;
  let price = 123;
  let reads = 0;
  let toolCalls = 0;
  const agentResults: unknown[] = [];
  const tools = [
    {
      name: "update-price",
      description: "Update the fixture price",
      inputSchema: { type: "object", properties: {} },
      annotations: { destructiveHint: true },
    },
  ];
  const widget = {
    name: "Plugin prices",
    description: "Prices from the browser fixture",
    type: "@example/basic-widget/table",
    endpoint: "prices",
    params: [{ paramName: "symbol", type: "text", label: "Symbol", value: "AAPL" }],
    gridData: { w: 20, h: 8 },
    mcp_tool: { mcp_server: name, tool_id: "update-price" },
  };
  const event = (name: string, data: unknown) =>
    `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

  await page.route(`${url}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/").at(-1);
    if (path === "widgets.json") {
      await route.fulfill({
        json: {
          prices: widget,
          core: {
            ...widget,
            name: "Core prices",
            type: "table",
            params: [],
            mcp_tool: undefined,
          },
        },
      });
    } else if (path === "prices") {
      reads++;
      await route.fulfill({
        json: [
          {
            symbol: new URL(request.url()).searchParams.get("symbol") ?? "AAPL",
            price,
          },
        ],
      });
    } else if (path === "agents.json") {
      await route.fulfill({
        json: {
          "plugin-agent": {
            name: "Plugin test agent",
            description: "Deterministic widget and MCP requests",
            endpoints: { query: `${url}/query` },
            features: {
              streaming: true,
              "widget-dashboard-search": true,
              "widget-dashboard-select": true,
              "mcp-tools": true,
            },
          },
        },
      });
    } else if (path === "query") {
      const body = request.postDataJSON();
      const last = body.messages.at(-1);
      let response: string;
      if (last.role === "tool") {
        agentResults.push(last.data);
        response =
          event("copilotMessageChunk", { delta: "Fixture request complete" }) +
          event("done", {});
      } else if (last.content.includes("Update price")) {
        const tool = body.tools?.find((tool: { name?: string; tool_name?: string }) =>
          (tool.name ?? tool.tool_name ?? "").includes("update-price"),
        );
        response = event("copilotFunctionCall", {
          function: "execute_agent_tool",
          input_arguments: {
            server_id: tool?.server_id,
            tool_name: tool?.name ?? tool?.tool_name,
            parameters: {},
          },
          extra_state: {
            copilot_function_call_arguments: { summary: "Update the fixture price" },
          },
        });
      } else {
        const selected =
          body.widgets?.primary?.find(
            (widget: { name: string }) => widget.name === "Plugin prices",
          ) ??
          body.widgets?.secondary?.find(
            (widget: { name: string }) => widget.name === "Plugin prices",
          );
        response = event("copilotFunctionCall", {
          function: "get_widget_data",
          input_arguments: {
            data_sources: [
              {
                origin: selected?.origin ?? name,
                id: selected?.widget_id ?? "prices",
                widget_uuid: selected?.uuid,
                input_args: { symbol: "MSFT" },
              },
            ],
          },
          extra_state: {
            copilot_function_call_arguments: {
              widget_queries: [{ widget_uuid: selected?.uuid }],
            },
          },
        });
      }
      await route.fulfill({ contentType: "text/event-stream", body: response });
    } else {
      await route.fulfill({ status: 404, json: {} });
    }
  });
  await page.route("**/pro/mcp-proxy", async (route) => {
    const proxy = route.request().postDataJSON();
    if (!proxy.url.startsWith(url)) return route.continue();
    if (proxy.method === "GET") return route.fulfill({ status: 405, body: "" });
    const rpc = proxy.body;
    if (rpc?.id === undefined) return route.fulfill({ status: 202, body: "" });
    let result: unknown;
    if (rpc.method === "initialize")
      result = {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name, version: "1.0.0" },
      };
    else if (rpc.method === "tools/list") result = { tools };
    else if (rpc.method === "tools/call") {
      toolCalls++;
      price = 456;
      result = { content: [{ type: "text", text: "Price updated" }] };
    } else result = {};
    await route.fulfill({ json: { jsonrpc: "2.0", id: rpc.id, result } });
  });

  await page.goto("/app/widgets");
  await waitForWorkspace(page);
  await page.getByTestId("widgets-library-add-data").click();
  await page.getByRole("tab", { name: "Apps", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("URL", { exact: true }).fill(url);
  await dialog.getByRole("button", { name: "Test", exact: true }).click();
  await expect(dialog.getByText("2 Widgets found", { exact: false })).toBeVisible();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Add to new dashboard", exact: true }).click();
  await page.waitForURL(/\/app\/[a-f0-9-]+$/);
  const dashboardUrl = page.url();
  const plugin = page
    .locator(".group\\/widget")
    .filter({ has: page.getByText("Plugin prices", { exact: true }) });
  await expect(plugin.getByRole("table")).toBeVisible();
  await saveDashboard(page);
  return {
    name,
    url,
    plugin,
    dashboardUrl,
    agentResults,
    reads: () => reads,
    toolCalls: () => toolCalls,
  };
}
