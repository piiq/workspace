import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("visiting homepage redirects to login", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});

test("login follows the deployment authentication settings", async ({ page }) => {
  await page.goto("/login");
  const registration = page.getByRole("link", {
    name: "Don't have an account? Register",
  });
  const forgotPassword = page.getByRole("link", { name: "Forgot password?" });
  const google = page.getByRole("button", { name: "Sign in with Google" });
  await expect(registration).toHaveCount(
    process.env.PLAYWRIGHT_ALLOW_REGISTRATION === "true" ? 1 : 0,
  );
  await expect(forgotPassword).toHaveCount(
    process.env.PLAYWRIGHT_ALLOW_FORGOT_PASSWORD === "true" ? 1 : 0,
  );
  await expect(google).toHaveCount(
    process.env.PLAYWRIGHT_IDENTITY_PROVIDERS?.split(",").includes("google") ? 1 : 0,
  );
});
