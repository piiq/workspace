import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

try {
  const { values } = parseArgs({
    options: {
      path: { type: "string", short: "p", default: "." },
      entry: { type: "string", short: "e", default: "src/index.tsx" },
      asset: { type: "string", short: "a", multiple: true },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(`Build a Workspace plugin using its installed project dependencies.

Usage: bun scripts/build-plugin.ts [options]

  -p, --path PATH    Plugin project directory (default: .)
  -e, --entry FILE   Definition module (default: src/index.tsx)
  -a, --asset PATH   Copy a project-relative asset file/directory; repeat as needed
  -h, --help         Show help

Output: the plugin project's dist/plugin.json, entry.js, and assets.`);
  } else {
    const project = resolve(values.path);
    const require = createRequire(join(project, "package.json"));
    let buildModule: string;
    try {
      buildModule = require.resolve("@piiq/workspace-plugin-sdk/build");
    } catch {
      throw new Error(
        `Install @piiq/workspace-plugin-sdk in ${project} before building the plugin.`,
      );
    }
    const { buildPlugin } = await import(pathToFileURL(buildModule).href);
    const descriptor = await buildPlugin({
      root: project,
      entry: values.entry,
      assets: values.asset,
    });
    console.log(
      `Built ${descriptor.name}@${descriptor.version} in ${values.path}/dist`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
