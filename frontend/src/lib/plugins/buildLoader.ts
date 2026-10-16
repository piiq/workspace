import selections from "virtual:workspace-plugins";
import {
  type PluginApi,
  type PluginDescriptor,
  pluginDescriptorSchema,
} from "@piiq/workspace-plugin-sdk";
import { pluginApi } from "./host";
import { type PluginRegistry, widgetRegistry } from "./registry";

export interface BuiltPlugin {
  descriptor: PluginDescriptor;
  baseUrl: string;
  load: () => Promise<{ register: (api: PluginApi) => void | Promise<void> }>;
}

async function loadStyles(plugin: BuiltPlugin) {
  await Promise.all(
    plugin.descriptor.assets
      .filter((asset) => asset.endsWith(".css"))
      .map(
        (asset) =>
          new Promise<void>((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = new URL(asset, new URL(plugin.baseUrl, document.baseURI)).href;
            link.onload = () => resolve();
            link.onerror = () =>
              reject(new Error(`Could not load plugin stylesheet: ${link.href}`));
            document.head.append(link);
          }),
      ),
  );
}

export async function loadBuiltPlugins(
  plugins: BuiltPlugin[] = selections,
  api: PluginApi = pluginApi,
  registry: PluginRegistry = widgetRegistry,
) {
  for (const plugin of plugins) {
    try {
      const descriptor = pluginDescriptorSchema.parse(plugin.descriptor);
      await loadStyles(plugin);
      const entry = await plugin.load();
      if (typeof entry.register !== "function")
        throw new Error(`Plugin entry ${descriptor.entry} must export register(api).`);
      let registration: Promise<void> | undefined;
      await entry.register({
        ...api,
        registerPlugin(definition) {
          if (
            definition.name !== descriptor.name ||
            definition.version !== descriptor.version
          )
            throw new Error("Registered plugin name/version must match plugin.json.");
          registration = api.registerPlugin(definition);
          return registration;
        },
      });
      if (!registration)
        throw new Error("Plugin entry did not register its declarations.");
      await registration;
    } catch (error) {
      registry.recordPluginFailure(plugin.descriptor.name, error);
      console.error(error);
    }
  }
}
