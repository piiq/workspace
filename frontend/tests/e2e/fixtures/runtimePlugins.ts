import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, resolve } from "node:path";
import { test as base, type Page } from "@playwright/test";
import { RuntimeConfigSchema } from "../../../src/lib/runtimeConfigSchema";

export const runtimeMode = process.env.PLAYWRIGHT_PLUGIN_MODE === "runtime";

export async function serveRuntimePlugins() {
  const dist = resolve(
    import.meta.dirname,
    "../../../../examples/plugins/basic-widget/dist",
  );
  const descriptor = JSON.parse(await readFile(resolve(dist, "plugin.json"), "utf8"));
  const files = new Map<string, Buffer>();
  for (const path of [descriptor.entry, ...descriptor.assets]) {
    files.set(`/bundles/basic-widget/${path}`, await readFile(resolve(dist, path)));
  }
  const state = { installed: true, apiVersion: 1, entryStatus: 200, label: "Refresh" };
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    requests.push(path);
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");
    if (path === "/deployment/plugins.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          plugins: state.installed
            ? [
                {
                  mode: "runtime",
                  descriptorUrl: "../bundles/basic-widget/plugin.json",
                },
              ]
            : [],
        }),
      );
    } else if (path === "/bundles/basic-widget/plugin.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ...descriptor, apiVersion: state.apiVersion }));
    } else if (files.has(path)) {
      response.setHeader(
        "Content-Type",
        extname(path) === ".css" ? "text/css" : "text/javascript",
      );
      if (path.endsWith(`/${descriptor.entry}`)) {
        response.statusCode = state.entryStatus;
        response.end(
          files
            .get(path)!
            .toString()
            .replaceAll('"Refresh"', JSON.stringify(state.label)),
        );
      } else response.end(files.get(path));
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/deployment/plugins.json`;
  return {
    url,
    state,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

export async function configureRuntimePlugins(page: Page, manifestUrl: string) {
  const config = RuntimeConfigSchema.parse({
    ...Object.fromEntries(
      Object.keys(RuntimeConfigSchema.shape).map((name) => [name, {}]),
    ),
    urls: { backend: process.env.PLAYWRIGHT_API_URL ?? "http://127.0.0.1:8000" },
    authentication: { allowRegistration: false, allowForgotPassword: false },
    copilot: { enabled: true, openbbCopilot: false, aiEnhancements: false },
    ui: { showOnboardingQuestions: false, showTos: false, showChangelog: false },
    plugins: { runtimeEnabled: true, manifestUrl },
  });
  await page.addInitScript((config) => {
    window.__APP_CONFIG__ = config;
  }, config);
  await page.route("**/config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.__APP_CONFIG__ = ${JSON.stringify(config)};`,
    }),
  );
}

type RuntimePlugins = Awaited<ReturnType<typeof serveRuntimePlugins>>;

export const test = base.extend<{ runtimePlugins: RuntimePlugins | undefined }>({
  runtimePlugins: [
    async ({ page }, use) => {
      if (!runtimeMode) return use(undefined);
      const server = await serveRuntimePlugins();
      try {
        await configureRuntimePlugins(page, server.url);
        await use(server);
      } finally {
        await server.close();
      }
    },
    { auto: true },
  ],
});
