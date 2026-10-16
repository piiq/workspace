import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";

const prepared = resolve(import.meta.dirname, "../.build/plugins");
const imports = join(prepared, "index.js");

export function buildPluginImports(): Plugin {
  return {
    name: "workspace-build-plugins",
    resolveId(id) {
      if (id === "virtual:workspace-plugins") return "\0virtual:workspace-plugins";
    },
    load(id) {
      if (id !== "\0virtual:workspace-plugins") return;
      return existsSync(imports) ? readFileSync(imports, "utf8") : "export default [];";
    },
    configureServer(server) {
      server.watcher.add(imports);
    },
    handleHotUpdate(context) {
      if (context.file !== imports) return;
      const module = context.server.moduleGraph.getModuleById(
        "\0virtual:workspace-plugins",
      );
      if (module) context.server.moduleGraph.invalidateModule(module);
      context.server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

export function buildPluginAssets() {
  const bundles = join(prepared, "bundles");
  mkdirSync(bundles, { recursive: true });
  return [{ src: bundles, dest: ".", rename: "plugins" }];
}
