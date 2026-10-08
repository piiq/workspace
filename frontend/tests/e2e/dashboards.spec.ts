import { expect, test } from "@playwright/test";
import { createDashboard, saveDashboard } from "./helpers";

test("dashboard rename persists after reload", async ({ page }) => {
  const { name } = await createDashboard(page, "Renamed dashboard");
  await page.reload();
  await expect(
    page.getByTestId("sidebar").getByText(name, { exact: true }),
  ).toBeVisible();
});

test("delete a dashboard", async ({ page }) => {
  const { name } = await createDashboard(page, "Dashboard to delete");
  await page
    .getByTestId("sidebar")
    .getByText(name, { exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(
    page.getByTestId("sidebar").getByText(name, { exact: true }),
  ).toHaveCount(0);
  await saveDashboard(page);
  await page.reload();
  await expect(
    page.getByTestId("sidebar").getByText(name, { exact: true }),
  ).toHaveCount(0);
});

test("export a dashboard to PDF", async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_HOSTED_TESTS !== "true",
    "PDF export requires the deployment's Pro-tier feature configuration.",
  );
  const { name } = await createDashboard(page, "PDF export");
  await page
    .getByTestId("sidebar")
    .getByText(name, { exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Export PDF", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect(await (await download).path()).not.toBeNull();
});
