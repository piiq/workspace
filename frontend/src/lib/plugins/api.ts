import {
  PLUGIN_API_VERSION,
  type PluginApi,
  type PluginHost,
} from "@piiq/workspace-plugin-sdk";
import { type BuiltinRenderer, type PluginRegistry, widgetRegistry } from "./registry";

export function createPluginApi(
  host: PluginHost,
  registry: PluginRegistry = widgetRegistry,
): PluginApi {
  return {
    apiVersion: PLUGIN_API_VERSION,
    host,
    registerPlugin: (plugin) => registry.registerPlugin(plugin, host),
  };
}

export function registerBuiltinRenderers(renderers: BuiltinRenderer[]) {
  widgetRegistry.registerBuiltins(renderers);
}
