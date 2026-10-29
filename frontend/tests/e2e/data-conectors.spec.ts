import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { uploadFileToDashboard, waitForWorkspace } from "./helpers";

test("members can export table data", async ({ page }, testInfo) => {
  await uploadFileToDashboard(page, "csv");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Export widget", exact: true }) });
  await dialog.getByRole("radio", { name: "CSV", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const output = testInfo.outputPath("export.csv");
  await download.saveAs(output);
  expect(await readFile(output, "utf8")).toContain("2024-01-01");
});

for (const extension of ["csv", "json"] as const) {
  test(`${extension} upload survives saving and reopening a dashboard`, async ({
    page,
  }) => {
    const { name, url } = await uploadFileToDashboard(page, extension);
    await page.goto("/app/widgets");
    await page.goto(url);
    await waitForWorkspace(page);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("gridcell").filter({ hasText: "2024-01-01" }),
    ).toHaveCount(1);
    await page.reload();
    await waitForWorkspace(page);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("gridcell").filter({ hasText: "2024-01-01" }),
    ).toHaveCount(1);
  });
}
