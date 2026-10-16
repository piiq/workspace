import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs, promisify } from "node:util";
import {
  pluginDescriptorSchema,
  pluginsManifestSchema,
} from "../packages/plugin-sdk/src/index";

const run = promisify(execFile);
const workspace = resolve(import.meta.dirname, "..");

export async function prepareFrontend(manifestPath?: string, root = workspace) {
  const manifest = pluginsManifestSchema.parse(
    manifestPath ? JSON.parse(await readFile(manifestPath, "utf8")) : { plugins: [] },
  );
  const selections = manifest.plugins.filter((plugin) => plugin.mode === "build");
  const base = manifestPath ? dirname(resolve(manifestPath)) : root;
  const output = join(root, ".build/plugins");
  await mkdir(join(root, ".build"), { recursive: true });
  const temporary = await mkdtemp(join(root, ".build/plugin-preparation-"));
  const imports: string[] = [];
  const names = new Set<string>();
  try {
    for (const [index, selection] of selections.entries()) {
      const source = selection.source;
      let dist: string;
      if ("dist" in source) {
        dist = resolve(base, source.dist);
      } else {
        let project: string;
        if ("path" in source) project = resolve(base, source.path);
        else {
          project = join(temporary, "repositories", String(index));
          await run("git", [
            "clone",
            "--no-checkout",
            "--",
            source.repository,
            project,
          ]);
          await run("git", [
            "-C",
            project,
            "fetch",
            "--depth",
            "1",
            "origin",
            source.ref,
          ]);
          await run("git", ["-C", project, "checkout", "--detach", "FETCH_HEAD"]);
        }
        for (const args of [
          ["install", "--frozen-lockfile"],
          ["run", "typecheck"],
          ["run", "build"],
        ]) {
          const { stdout, stderr } = await run("bun", args, { cwd: project });
          process.stdout.write(stdout);
          process.stderr.write(stderr);
        }
        dist = join(project, "dist");
      }
      const descriptor = pluginDescriptorSchema.parse(
        JSON.parse(await readFile(join(dist, "plugin.json"), "utf8")),
      );
      if (names.has(descriptor.name))
        throw new Error(`Plugin selected more than once: ${descriptor.name}`);
      names.add(descriptor.name);
      const directory = descriptor.name.slice(1);
      const destination = join(temporary, "bundles", directory);
      await mkdir(destination, { recursive: true });
      for (const file of ["plugin.json", descriptor.entry, ...descriptor.assets]) {
        const path = relative(dist, resolve(dist, file));
        if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(file))
          throw new Error(`Plugin files must be relative to plugin.json: ${file}`);
        await mkdir(dirname(join(destination, path)), { recursive: true });
        await cp(join(dist, path), join(destination, path));
      }
      const url = `plugins/${directory}/`;
      imports.push(`{
  descriptor: ${JSON.stringify(descriptor)},
  baseUrl: import.meta.env.BASE_URL + ${JSON.stringify(url)},
  load: () => import(/* @vite-ignore */ import.meta.env.BASE_URL + ${JSON.stringify(url + descriptor.entry)})
}`);
    }
    await mkdir(join(temporary, "bundles"), { recursive: true });
    await writeFile(
      join(temporary, "index.js"),
      `export default [${imports.join(",\n")}];\n`,
    );
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    await cp(join(temporary, "bundles"), join(output, "bundles"), { recursive: true });
    await cp(join(temporary, "index.js"), join(output, "index.js"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return names.size;
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: {
        manifest: { type: "string", short: "m" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      console.log(`Prepare build-time plugins for Workspace.

Usage: bun scripts/prepare-frontend.ts [options]

  -m, --manifest FILE  Administrator's plugins.json; paths resolve beside this file
  -h, --help           Show help

Without --manifest, prepare an empty selection. Output: .build/plugins/.
Source projects require bun.lock and typecheck/build scripts in package.json.`);
    } else {
      const count = await prepareFrontend(values.manifest && resolve(values.manifest));
      console.log(`Prepared ${count} plugin(s) in .build/plugins/`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
