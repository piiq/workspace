import { expect, test } from "@playwright/test";
import { connectPluginBackend } from "./fixtures/pluginBackend";
import { saveDashboard, waitForWorkspace } from "./helpers";

test("connected backend widgets retain ticker parameters after a reload", async ({
  page,
}) => {
  const editorRequests: string[] = [];
  page.on("request", (request) => {
    if (/dt-sql-parser|starry[-_]night/.test(new URL(request.url()).pathname)) {
      editorRequests.push(request.url());
    }
  });
  const { plugin: widget } = await connectPluginBackend(page, {
    plugin: false,
  });
  await expect(
    widget.getByRole("textbox", { name: "Ticker symbol", exact: true }),
  ).toHaveValue("AAPL");
  await widget
    .getByRole("textbox", { name: "Ticker symbol", exact: true })
    .fill("NVDA");
  await widget
    .getByRole("textbox", { name: "Ticker symbol", exact: true })
    .press("Enter");
  await expect(
    widget.getByRole("gridcell", { name: "NVDA", exact: true }),
  ).toBeVisible();
  await saveDashboard(page);
  await page.reload();
  await waitForWorkspace(page);
  await expect(
    widget.getByRole("textbox", { name: "Ticker symbol", exact: true }),
  ).toHaveValue("NVDA");
  await expect(
    widget.getByRole("gridcell", { name: "NVDA", exact: true }),
  ).toBeVisible();
  expect(editorRequests).toEqual([]);
});

test("connected backend apps retain tab and ticker state after a reload", async ({
  page,
}) => {
  const { dashboardUrl, appName } = await connectPluginBackend(page, {
    plugin: false,
    app: true,
  });
  await page.goto("/app");
  await page
    .locator('[role="button"]')
    .filter({
      has: page.getByText(appName, { exact: true }),
    })
    .click();
  await page.waitForURL((url) => /^\/app\/[a-f0-9-]+$/.test(url.pathname));
  const appUrl = page.url();
  expect(appUrl).not.toBe(dashboardUrl);
  const appWidget = page.locator(".group\\/widget").filter({
    has: page.getByText("Core prices", { exact: true }),
  });
  await expect(
    appWidget.getByRole("gridcell", { name: "MSFT", exact: true }),
  ).toBeVisible();
  await appWidget
    .getByRole("textbox", { name: "Ticker symbol", exact: true })
    .fill("AMD");
  await appWidget
    .getByRole("textbox", { name: "Ticker symbol", exact: true })
    .press("Enter");
  await expect(
    appWidget.getByRole("gridcell", { name: "AMD", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    appWidget.getByRole("gridcell", { name: "AMZN", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    appWidget.getByRole("gridcell", { name: "AMD", exact: true }),
  ).toBeVisible();
  await saveDashboard(page);
  await page.reload();
  await waitForWorkspace(page);
  await expect(
    appWidget.getByRole("textbox", { name: "Ticker symbol", exact: true }),
  ).toHaveValue("AMD");
  await expect(
    appWidget.getByRole("gridcell", { name: "AMD", exact: true }),
  ).toBeVisible();
});
