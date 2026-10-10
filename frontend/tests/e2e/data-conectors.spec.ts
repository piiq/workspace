import { expect, test } from "@playwright/test";
import { uploadFileToDashboard, waitForWorkspace } from "./helpers";

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
