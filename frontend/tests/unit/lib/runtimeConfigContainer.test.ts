import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";
import { RuntimeConfigSchema } from "~/lib/runtimeConfigSchema";

const run = promisify(execFile);
const renderer = resolve(
  import.meta.dirname,
  "../../../../lite/render-frontend-config.full.sh",
);
const roots: string[] = [];

async function render(environment: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "workspace-container-config-"));
  roots.push(root);
  const output = join(root, "config.js");
  await run("bash", [renderer], {
    env: {
      ...process.env,
      CONFIG_OUT: output,
      RUNTIME_PLUGINS_ENABLED: "",
      PLUGINS_MANIFEST_URL: "",
      ...environment,
    },
  });
  const context = { window: {} as { __APP_CONFIG__?: unknown } };
  runInNewContext(await readFile(output, "utf8"), context);
  return RuntimeConfigSchema.parse(context.window.__APP_CONFIG__);
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("frontend container configuration", () => {
  it("disables runtime plugins when no settings are supplied", async () => {
    expect((await render({})).plugins).toEqual({
      runtimeEnabled: false,
      manifestUrl: "",
    });
  });

  it("renders deployment settings from the same script without rebuilding", async () => {
    for (const manifestUrl of [
      "https://plugins.test/first/plugins.json",
      "https://plugins.test/second/plugins.json",
    ]) {
      const config = await render({
        RUNTIME_PLUGINS_ENABLED: "true",
        PLUGINS_MANIFEST_URL: manifestUrl,
        BACKEND_URL: "https://workspace.test/api",
      });
      expect(config.plugins).toEqual({ runtimeEnabled: true, manifestUrl });
      expect(config.urls.backend).toBe("https://workspace.test/api");
    }
  });
});
