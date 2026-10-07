import { expect, test } from "@playwright/test";
import { login, proUrl } from "./helpers";

test("charting-testing-stock", async ({ page }) => {
  test.setTimeout(40000);
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Click on Charting Dashboard
  await page.getByText("Charting Dashboard").first().waitFor({ timeout: 10000 });
  await page.getByText("Charting Dashboard").first().click();

  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("abnb");
  await tradingViewFrame.getByText("ABNB", { exact: true }).click();

  // Wait for chart to load before adding financials
  await tradingViewFrame.getByRole("button", { name: "Financials" }).waitFor({ timeout: 10000 });
  await tradingViewFrame.getByRole("button", { name: "Financials" }).click();
  await page.getByText("Revenue").nth(1).click();
  await page.getByText("Cost of Revenue").first().click();
  await page.getByRole("button", { name: "Add" }).click();

  // Verify financials were added
  await expect(tradingViewFrame.getByText("annually cost_of_revenue")).toBeVisible({ timeout: 10000 });
  await expect(tradingViewFrame.getByText("annually revenue")).toBeVisible();

  // Add indicator
  await tradingViewFrame.getByRole("button", { name: "Indicators & Strategies" }).click();
  await tradingViewFrame.getByText("Week High/Low").click();

  // Verify indicator was added
  await expect(tradingViewFrame.getByText("52W H/L")).toBeVisible({ timeout: 10000 });
});

test("charting-testing-economy", async ({ page }) => {
  test.setTimeout(40000);
  await page.goto(`${proUrl}/app`);
  await page.getByRole("link", { name: "Charting" }).click();
  await page.waitForLoadState("networkidle");

  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByText("Economy").click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("fed");
  await tradingViewFrame.getByText("FEDFUNDS").click();

  // Verify chart loaded
  await expect(
    tradingViewFrame.getByLabel("Chart for $FEDFUNDS, 1 month"),
  ).toBeVisible({ timeout: 10000 });
});

// This test verifies that dashboard and chart states are independent:
// - Create an equity template with ADBE ticker
// - Go to charting and change ticker
// - Return to template and verify ADBE is still selected
test("verify-state-dash-and-chart", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);
  await page.waitForSelector("#tabs", { timeout: 30000 });

  // Create new dashboard with equity template
  await page.locator("#tabs").getByRole("button").first().click();
  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();
  await page.getByRole("button", { name: "Equity Template" }).click();

  // Wait for template to load and change ticker to ADBE
  await page.waitForLoadState("networkidle");
  await page
    .locator(
      "button.obb-minimal-input.flex.items-center.justify-between.gap-1.bg-light-50._select-ticker",
    )
    .nth(4)
    .click();
  await page.getByText("ADBE", { exact: true }).click();

  // Verify ADBE is shown in the widgets
  await expect(page.getByText("1Ticker InformationADBE")).toBeVisible();
  await expect(page.getByText("1Price PerformanceADBE")).toBeVisible();

  // Go to charting page and change ticker to ABNB
  await page.getByRole("link", { name: "Charting" }).click();
  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("abnb");
  await tradingViewFrame.getByText("ABNB", { exact: true }).click();

  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").fill("adbe");
  await tradingViewFrame.getByText("AADBE", { exact: true }).click();

  // Go back to equity template and verify group is still ADBE
  await page.getByText("Equity TemplateADBE").click();
  await expect(page.getByText("1Ticker InformationADBE")).toBeVisible();
  await expect(page.getByText("1Price PerformanceADBE")).toBeVisible();

  // Go back to charting - should still be ABNB
  await page.getByRole("link", { name: "Charting" }).click();

  // Wait for TradingView iframe to load again
  const tradingViewFrame2 = page.frameLocator('iframe[name^="tradingview_"]');
  await tradingViewFrame2.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame2.getByRole("button", { name: "Symbol Search" }).click();

  // Verify ABNB is still selected
  await expect(
    tradingViewFrame2
      .locator("#overlap-manager-root")
      .getByText("AABNB", { exact: true }),
  ).toBeVisible();
});
