import { expect, test } from "@playwright/test";

test("help opens without a walkthrough or a generated dashboard", async ({ page }) => {
  await page.goto("/app/help-documentation");
  await expect(page.getByText("Help and Documentation", { exact: true })).toBeVisible();
  await expect(page.getByText("Interactive Walkthrough", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Getting Started", { exact: true })).toHaveCount(0);
});

test("members can configure security", async ({ page }) => {
  await page.goto("/app/settings");
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await expect(page.getByLabel("Enable 2FA", { exact: true })).toBeEnabled();
  await page.getByLabel("Enable 2FA", { exact: true }).click();
  const confirmation = page.getByRole("dialog");
  await expect(confirmation).toContainText("Two-Factor Authentication Configuration");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("organization policy prevents personal backend connections", async ({ page, request }) => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "Requires the source administrator account");
  const api = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";
  const login = await request.post(`${api}/pro/login`, {
    data: { email: "admin@openbb.co", password: "asdQWE123!", source: "pro", remember: false },
  });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).access_token}` };
  const organizations = await request.get(`${api}/entity/entity`, { headers });
  expect(organizations.ok()).toBeTruthy();
  const entity = (await organizations.json()).items.find((item: { name: string }) => item.name === "Browser Tests");
  expect(entity).toBeTruthy();
  const { uuid, entity_type, ...fields } = entity;
  const url = `${api}/entity/entity/${uuid}`;
  const data = { ...fields, entity_code: entity_type.uuid };
  const restricted = await request.put(url, { headers, data: { ...data, allow_custom_backends: false } });
  expect(restricted.ok()).toBeTruthy();
  try {
    await page.goto("/app/connections?modal=connect-backend");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("status")).toHaveText("Your organization requires backends configured by an administrator.");
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
  } finally {
    expect((await request.put(url, { headers, data })).ok()).toBeTruthy();
  }
});
