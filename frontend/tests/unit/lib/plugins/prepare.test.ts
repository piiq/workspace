import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const run = promisify(execFile);
const workspace = resolve(import.meta.dirname, "../../../../..");
const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "workspace-preparation-"));
  roots.push(root);
  const dist = join(root, "compiled");
  await mkdir(join(dist, "assets"), { recursive: true });
  const descriptor = {
    name: "@test/example",
    version: "1.0.0",
    apiVersion: 1,
    renderers: [],
    entry: "entry.js",
    assets: ["assets/style.css"],
  };
  await writeFile(join(dist, "plugin.json"), JSON.stringify(descriptor));
  await writeFile(join(dist, "entry.js"), "export async function register(api) {}\n");
  await writeFile(join(dist, "assets/style.css"), ".example { color: red; }\n");
  const runner = join(root, "prepare.ts");
  await writeFile(
    runner,
    `import { prepareFrontend } from ${JSON.stringify(join(workspace, "scripts/prepare-frontend.ts"))}; await prepareFrontend(process.argv[2], process.argv[3]);`,
  );
  async function prepare(plugins: unknown[]) {
    const manifest = join(root, "plugins.json");
    await writeFile(manifest, JSON.stringify({ plugins }));
    return run("bun", [runner, manifest, root]);
  }
  return { root, dist, descriptor, prepare };
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("frontend plugin preparation", () => {
  it("copies compiled selections and removes omitted plugins", async () => {
    const { root, dist, prepare } = await fixture();
    await prepare([{ mode: "build", source: { dist: "compiled" } }]);
    const output = join(root, ".build/plugins");
    expect(await readFile(join(output, "bundles/test/example/entry.js"), "utf8")).toBe(
      await readFile(join(dist, "entry.js"), "utf8"),
    );
    expect(await readFile(join(output, "index.js"), "utf8")).toContain(
      "plugins/test/example/entry.js",
    );
    expect(
      await readFile(join(output, "bundles/test/example/assets/style.css"), "utf8"),
    ).toContain("red");
    await prepare([
      { mode: "runtime", descriptorUrl: "https://plugins.example/plugin.json" },
    ]);
    expect(await readFile(join(output, "index.js"), "utf8")).toBe(
      "export default [];\n",
    );
    await expect(
      readFile(join(output, "bundles/test/example/plugin.json")),
    ).rejects.toThrow();
  });

  it.each([
    "duplicate",
    "missing-entry",
    "incompatible-api",
    "absolute-asset",
  ])("fails preparation for %s", async (failure) => {
    const { dist, descriptor, prepare } = await fixture();
    const plugin = { mode: "build", source: { dist: "compiled" } };
    if (failure === "missing-entry") await rm(join(dist, "entry.js"));
    if (failure === "incompatible-api") descriptor.apiVersion = 2;
    if (failure === "absolute-asset") descriptor.assets = ["/assets/style.css"];
    await writeFile(join(dist, "plugin.json"), JSON.stringify(descriptor));
    await expect(
      prepare(failure === "duplicate" ? [plugin, plugin] : [plugin]),
    ).rejects.toThrow();
  });

  it("installs, typechecks, and builds the source example", async () => {
    const { root, prepare } = await fixture();
    await prepare([
      {
        mode: "build",
        source: { path: join(workspace, "examples/plugins/basic-widget") },
      },
    ]);
    const descriptor = JSON.parse(
      await readFile(
        join(root, ".build/plugins/bundles/example/basic-widget/plugin.json"),
        "utf8",
      ),
    );
    expect(descriptor).toMatchObject({
      name: "@example/basic-widget",
      assets: ["assets/style.css"],
    });
  }, 30000);

  it("builds the selected Git ref using the repository's dependencies", async () => {
    const { root, prepare } = await fixture();
    const repository = join(root, "repository");
    await cp(join(workspace, "examples/plugins/basic-widget"), repository, {
      recursive: true,
      filter: (path) =>
        !["node_modules", "dist"].includes(path.split("/").at(-1) ?? ""),
    });
    for (const file of ["package.json", "bun.lock"]) {
      const contents = await readFile(join(repository, file), "utf8");
      await writeFile(
        join(repository, file),
        contents.replaceAll(
          "../../../packages/plugin-sdk",
          join(workspace, "packages/plugin-sdk"),
        ),
      );
    }
    await run("git", ["init", repository]);
    await run("git", ["-C", repository, "add", "."]);
    await run("git", [
      "-C",
      repository,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-m",
      "Example plugin fixture",
    ]);
    const { stdout } = await run("git", ["-C", repository, "rev-parse", "HEAD"]);
    await run("git", ["-C", repository, "branch", "plugin-release"]);
    for (const ref of [stdout.trim(), "plugin-release"]) {
      await prepare([{ mode: "build", source: { repository, ref } }]);
    }
    const descriptor = JSON.parse(
      await readFile(
        join(root, ".build/plugins/bundles/example/basic-widget/plugin.json"),
        "utf8",
      ),
    );
    expect(descriptor.name).toBe("@example/basic-widget");
    await expect(
      prepare([{ mode: "build", source: { repository, ref: "missing-ref" } }]),
    ).rejects.toThrow("missing-ref");
  }, 30000);
});
