import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect } from "@playwright/test";
import { connectPluginBackend } from "./fixtures/pluginBackend";
import {
  configureRuntimePlugins,
  runtimeMode,
  serveRuntimePlugins,
  test,
} from "./fixtures/runtimePlugins";
import { saveDashboard, waitForWorkspace } from "./helpers";

test.skip(
  !!process.env.PLAYWRIGHT_BASE_URL && process.env.PLAYWRIGHT_PLUGIN_TESTS !== "true",
  "Set PLAYWRIGHT_PLUGIN_TESTS=true for a deployment with the example plugin installed.",
);

test("compiled plugin parameters and selection survive reopening", async ({ page }) => {
  const { plugin, dashboardUrl } = await connectPluginBackend(page);
  await plugin.getByLabel("Symbol", { exact: true }).fill("MSFT");
  await expect(plugin.getByRole("cell", { name: "MSFT", exact: true })).toBeVisible();
  await plugin
    .getByRole("cell", { name: "MSFT", exact: true })
    .getByRole("button")
    .click();
  await expect(plugin.locator('tr[aria-selected="true"]')).toHaveCount(1);
  await expect(plugin.getByRole("cell", { name: "MSFT", exact: true })).toHaveCSS(
    "padding-left",
    "8px",
  );
  await saveDashboard(page);
  await page.goto("/app/widgets");
  await page.goto(dashboardUrl);
  await waitForWorkspace(page);
  await expect(plugin.getByLabel("Symbol", { exact: true })).toHaveValue("MSFT");
  await expect(plugin.locator('tr[aria-selected="true"]')).toHaveCount(1);
  await page.reload();
  await waitForWorkspace(page);
  await expect(plugin.getByLabel("Symbol", { exact: true })).toHaveValue("MSFT");
  await expect(plugin.locator('tr[aria-selected="true"]')).toHaveCount(1);
});

test("saved plugin widget reports omission and recovers with its settings", async ({
  page,
  runtimePlugins,
}) => {
  test.skip(
    !runtimeMode &&
      (!!process.env.PLAYWRIGHT_BASE_URL ||
        process.env.PLAYWRIGHT_FRONTEND_BUILD === "true"),
    "Selection changes use the source server; production selections require a new build.",
  );
  const { plugin } = await connectPluginBackend(page);
  await plugin.getByLabel("Symbol", { exact: true }).fill("MSFT");
  await expect(plugin.getByRole("cell", { name: "MSFT", exact: true })).toBeVisible();
  await plugin
    .getByRole("cell", { name: "MSFT", exact: true })
    .getByRole("button")
    .click();
  await saveDashboard(page);
  const run = promisify(execFile);
  try {
    if (runtimePlugins) runtimePlugins.state.installed = false;
    else
      await run("bun", [
        "../scripts/prepare-frontend.ts",
        "--manifest",
        "tests/e2e/fixtures/empty-plugins.json",
      ]);
    await page.reload();
    await waitForWorkspace(page);
    await expect(
      plugin.getByText("Install a compatible @example/basic-widget plugin", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
  } finally {
    if (runtimePlugins) runtimePlugins.state.installed = true;
    else
      await run("bun", [
        "../scripts/prepare-frontend.ts",
        "--manifest",
        "tests/e2e/fixtures/plugins.json",
      ]);
  }
  await page.reload();
  await waitForWorkspace(page);
  await expect(plugin.getByLabel("Symbol", { exact: true })).toHaveValue("MSFT");
  await expect(plugin.locator('tr[aria-selected="true"]')).toHaveCount(1);
});

test("an agent exports plugin data and an MCP call refreshes the mounted widget", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixture = await connectPluginBackend(page);
  await fixture.plugin.getByLabel("Symbol", { exact: true }).fill("MSFT");
  await expect(
    fixture.plugin.getByRole("cell", { name: "MSFT", exact: true }),
  ).toBeVisible();
  await saveDashboard(page);

  await page.goto("/app/ai?tab=ai-agents");
  await page.getByRole("button", { name: "Add Agent", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("URL", { exact: true }).fill(fixture.url);
  await dialog.getByRole("button", { name: "Test", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).not.toBeVisible();

  await page.goto("/app/ai?tab=mcp-servers");
  await page.getByRole("button", { name: "Add Server", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(fixture.name);
  await dialog.getByLabel("URL", { exact: true }).fill(`${fixture.url}/mcp`);
  const savedServer = page.waitForResponse(
    (response) =>
      response.url().endsWith("/pro/mcp-servers") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`${fixture.name} \\(1\\)`) }),
  ).toBeVisible({ timeout: 30_000 });

  expect((await savedServer).ok()).toBeTruthy();
  await page.goto(fixture.dashboardUrl);
  await waitForWorkspace(page);
  await expect(
    fixture.plugin.getByRole("cell", { name: "MSFT", exact: true }),
  ).toBeVisible();
  const reads = fixture.reads();
  await page
    .locator("#expand-copilot-btn")
    .evaluate((button: HTMLButtonElement) => button.click());
  const input = page.locator("#copilot-input");
  await input.fill("Export plugin prices");
  await page.locator("#send-copilot-message").click();
  await expect.poll(() => fixture.agentResults.length).toBe(1);
  expect(JSON.stringify(fixture.agentResults[0])).toContain("MSFT");
  expect(JSON.stringify(fixture.agentResults[0])).toContain("123");
  expect(fixture.reads()).toBe(reads);

  await expect(
    page.getByText("Fixture request complete", { exact: true }),
  ).toBeVisible();
  await expect(input).toBeFocused();
  await page.locator("#mcp-tools-btn").click();
  await page.getByPlaceholder("Search servers and tools").fill("update-price");
  await page.getByRole("checkbox", { name: "update-price", exact: false }).check();
  await page.keyboard.press("Escape");
  await input.fill("Update price");
  await page.locator("#send-copilot-message").click();
  await expect.poll(fixture.toolCalls).toBe(1);
  await expect(
    fixture.plugin.getByRole("cell", { name: "456", exact: true }),
  ).toBeVisible();
  expect(fixture.reads()).toBeGreaterThan(reads);
});

test("runtime plugins recover from failures and load replacements after a reload", async ({
  page,
  runtimePlugins,
}) => {
  test.skip(!runtimePlugins, "Requires runtime plugin loading.");
  test.setTimeout(120_000);
  const server = runtimePlugins!;
  const { plugin } = await connectPluginBackend(page);
  await plugin.getByLabel("Symbol", { exact: true }).fill("MSFT");
  await expect(plugin.getByRole("cell", { name: "MSFT", exact: true })).toBeVisible();
  await saveDashboard(page);
  expect(new URL(server.url).origin).not.toBe(new URL(page.url()).origin);
  for (const failure of ["api", "entry"]) {
    server.state.apiVersion = failure === "api" ? 2 : 1;
    server.state.entryStatus = failure === "entry" ? 404 : 200;
    await page.reload();
    await waitForWorkspace(page);
    await expect(
      plugin.getByText("Plugin @example/basic-widget failed:", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
    server.state.apiVersion = 1;
    server.state.entryStatus = 200;
    await page.reload();
    await waitForWorkspace(page);
    await expect(plugin.getByLabel("Symbol", { exact: true })).toHaveValue("MSFT");
  }
  server.state.label = "Reload prices";
  await page.reload();
  await waitForWorkspace(page);
  await expect(
    plugin.getByRole("button", { name: "Reload prices", exact: true }),
  ).toBeVisible();
  await expect(plugin.getByLabel("Symbol", { exact: true })).toHaveValue("MSFT");
});

test("a runtime selection cannot replace an already bundled plugin", async ({
  page,
}) => {
  test.skip(runtimeMode, "Requires the example in the frontend build.");
  const server = await serveRuntimePlugins();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  try {
    await configureRuntimePlugins(page, server.url);
    const { plugin } = await connectPluginBackend(page);
    await expect
      .poll(() =>
        errors.some((error) =>
          error.includes("Plugin already registered: @example/basic-widget"),
        ),
      )
      .toBe(true);
    await expect(plugin.getByRole("cell", { name: "AAPL", exact: true })).toBeVisible();
  } finally {
    await server.close();
  }
});
