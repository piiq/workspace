import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const deployed = !!process.env.PLAYWRIGHT_BASE_URL;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:1420";
const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  testIgnore: process.env.PLAYWRIGHT_HOSTED_TESTS === "true" ? [] : [
    "**/onboarding-questions.spec.ts",
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "account", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["account"],
    },
  ],
  webServer: deployed ? undefined : [
    {
      command: "python -m scripts.run_e2e",
      cwd: "../backend",
      url: `${apiURL}/health`,
      gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "bun ../scripts/prepare-frontend.ts --manifest tests/e2e/fixtures/plugins.json && " +
        (process.env.PLAYWRIGHT_PLUGIN_MODE === "runtime"
          ? "bun ../scripts/prepare-frontend.ts && "
          : "") +
        (process.env.PLAYWRIGHT_FRONTEND_BUILD === "true"
          ? "bun run build:runtime && bun run preview --host 127.0.0.1 --port 1420"
          : "bun run dev --host 127.0.0.1"),
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_PAYMENTS_URL: apiURL,
        VITE_AUTHENTICATION_ALLOW_EMAIL_LOGIN: "true",
        VITE_AUTHENTICATION_ALLOW_REGISTRATION: "false",
        VITE_AUTHENTICATION_ALLOW_FORGOT_PASSWORD: "false",
        VITE_AUTHENTICATION_IDENTITY_PROVIDERS: "",
        VITE_UI_SHOW_ONBOARDING_QUESTIONS: "false",
        VITE_UI_SHOW_TOS: "false",
        VITE_UI_SHOW_CHANGELOG: "false",
        VITE_AI_COPILOT_ENABLED: "true",
        VITE_AI_COPILOT_OPENBB_COPILOT: "false",
        VITE_AI_COPILOT_AI_ENHANCEMENTS: "false",
        VITE_RUNTIME_PLUGINS_ENABLED: "false",
        VITE_PLUGINS_MANIFEST_URL: "",
      },
    },
  ],
});
