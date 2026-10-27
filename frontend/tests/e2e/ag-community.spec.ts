import { randomUUID } from "node:crypto";
import { expect, type Request, test } from "@playwright/test";
import { uploadFileToDashboard, waitForWorkspace } from "./helpers";

test("Community tables and charts work without Enterprise modules", async ({
  page,
}) => {
  let syncRequest: Request | undefined;
  page.on("request", (request) => {
    if (request.url().endsWith("/pro/dash/sync") && request.method() === "POST") {
      syncRequest = request;
    }
  });
  const { url } = await uploadFileToDashboard(page, "csv");
  await expect(page.locator("#chart-view-button")).toHaveCount(0);
  const headers = {
    authorization: syncRequest!.headers().authorization,
    origin: new URL(url).origin,
  };
  const saved = await page.request.get(syncRequest!.url(), { headers });
  expect(saved.ok()).toBe(true);
  const tabId = new URL(url).pathname.split("/").at(-1)!;
  const dashboard = (await saved.json()).owned[tabId].content;
  const id = randomUUID();
  const innerTab = dashboard.data.currentTab ?? "";
  dashboard.data.widgets.push({
    id,
    widgetId: "ag_chart-community",
    name: "Community chart",
    type: "custom",
    innerTab,
    gridData: { w: 24, h: 12 },
    storage: {
      content: [
        { symbol: "AAPL", price: 123 },
        { symbol: "MSFT", price: 200 },
      ],
      chart_params: { chartType: "bar", xKey: "symbol", yKey: ["price"] },
    },
  });
  dashboard.data.gridLayout[innerTab].push({ i: id, x: 0, y: 20, w: 24, h: 12 });
  const savedChart = await page.request.post(syncRequest!.url(), {
    headers,
    data: { items: { [tabId]: dashboard } },
  });
  expect(savedChart.ok()).toBe(true);
  await page.reload();
  await waitForWorkspace(page);
  const chart = page
    .locator(".group\\/widget")
    .filter({ has: page.getByText("Community chart", { exact: true }) });
  await expect(chart.locator("canvas").first()).toBeVisible();
  await page.goto("/app/widgets");
  await page.goto(url);
  await waitForWorkspace(page);
  await expect(chart.locator("canvas").first()).toBeVisible();
  await expect(
    page.getByRole("gridcell").filter({ hasText: "2024-01-01" }),
  ).toHaveCount(1);
});
