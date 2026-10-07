import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const proUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1420";

export function userInfo(): { username: string; email: string; password: string } {
  if (
    process.env.PLAYWRIGHT_BASE_URL &&
    (!process.env.PLAYWRIGHT_EMAIL || !process.env.PLAYWRIGHT_PASSWORD)
  ) {
    throw new Error(
      "Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD for the deployment account created through the admin CLI.",
    );
  }
  return {
    username: "Playwright",
    email: process.env.PLAYWRIGHT_EMAIL ?? "playwright@example.com",
    password: process.env.PLAYWRIGHT_PASSWORD ?? "WorkspaceTest123!",
  };
}

//set this up for env later - but for now we just want free users
export enum UserType {
  Free = "free",
  Paid = "paid",
}

export const userType: UserType = UserType.Free;

export async function login(page: Page) {
  const user = userInfo();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL(/\/(app|onboarding)(\/|$)/);
  await handleFirstTime(page);
  await expect(page.getByTestId("sidebar")).toBeVisible();
}

export async function createDashboard(page: Page, prefix: string) {
  await page.goto("/app");
  await page
    .getByRole("button", { name: "Create dashboard or folder", exact: true })
    .click();
  await page.getByRole("button", { name: /^New Dashboard/ }).click();
  await page.waitForURL(/\/app\/[a-f0-9-]+$/);
  const url = page.url();
  const dashboard = page.locator(
    `[id="tab-${new URL(url).pathname.split("/").pop()}"]`,
  );
  await dashboard.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const name = `${prefix} ${randomUUID().slice(0, 8)}`;
  await page.getByRole("dialog").getByRole("textbox").fill(name);
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(dashboard).toContainText(name);
  await saveDashboard(page);
  return { name, url };
}

export async function saveDashboard(page: Page) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/pro/dash/sync") &&
      response.request().method() === "POST",
  );
  await page.keyboard.press("Control+Shift+S");
  expect((await response).ok()).toBeTruthy();
}

export async function onboardUser(page: Page) {
  await expect(page).toHaveURL(`${proUrl}/onboarding`);

  // Fill out onboarding form
  await page.getByPlaceholder("Enter your first name").fill("Andrew");
  await page.getByPlaceholder("Enter your last name").fill("Kenreich");

  // Check if onboarding questions are shown (feature flag dependent)
  const organizationDropdown = page.getByRole("combobox").first();
  if (await organizationDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Select Organization Type
    await organizationDropdown.click();
    await page.getByLabel("Hedge Fund").getByText("Hedge Fund").click();

    // Select Job Role
    await page.getByRole("combobox").nth(1).click();
    await page
      .getByLabel("Student / Professor / Researcher")
      .getByText("Student / Professor / Researcher")
      .click();
  }

  // Submit the form
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for navigation away from onboarding
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), {
    timeout: 30000,
  });
}

export async function acceptTermsAndConditions(page: Page) {
  if (userType === UserType.Free) {
    return; // Skip the acceptance process for Free users
  }

  const tosLastElement = page.locator(`p[aria-label="tos-last-element"]`);
  await tosLastElement.scrollIntoViewIfNeeded();

  const tosAccept = page.locator(`button[aria-label="tos-accept-button"]`);
  await tosAccept.click();

  await tosLastElement.waitFor({ state: "hidden" });
}

export async function dismissChangeLog(page: Page) {
  await page.locator("svg.BB-Icon.block.size-4.h-4.w-4").nth(1).click();
}

export async function handleFirstTime(page: Page) {
  // Check if we're on onboarding page
  if (page.url().includes("/onboarding")) {
    await onboardUser(page);
    await acceptTermsAndConditions(page);

    // Wait for the app to be ready
    await page.waitForLoadState("networkidle");
  }
}

export async function clickOnNews(page: Page, tab: string) {
  // change to a given tab on the news page
  await page.getByRole("tab", { name: tab }).click();
  // clicks the 1st element on a given page/tab
  await page
    .locator(".group\\/widget > div:nth-child(2) > div[data-state='closed']")
    .first()
    .click();
}

export async function clickExitButton(page: Page) {
  await page.locator("._dialog-header > div > .flex > button:nth-child(2)").click();
}

export async function uploadFileToDashboard(page: Page, extension: "csv" | "json") {
  const name = `${extension.toUpperCase()} test ${randomUUID().slice(0, 8)}`;
  await page.goto("/app/widgets");
  await page.getByTestId("widgets-library-add-data").click();
  await page.getByRole("tab", { name: "File", exact: true }).click();
  const upload = page.waitForResponse(
    (response) =>
      response.url().endsWith("/pro/files") && response.request().method() === "POST",
  );
  await page
    .locator("#data-connector-upload")
    .setInputFiles(`tests/e2e/mock_data/sample_data.${extension}`);
  expect((await upload).ok()).toBeTruthy();
  await expect(
    page.getByRole("tabpanel", { name: "File", exact: true }).locator("svg#check"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await page.getByRole("button", { name: "Add to new dashboard", exact: true }).click();
  await page.waitForURL(/\/app\/[a-f0-9-]+$/);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("gridcell").filter({ hasText: "2024-01-01" }),
  ).toHaveCount(1);
  await saveDashboard(page);
  return { name, url: page.url() };
}
