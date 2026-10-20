import {
  type PluginDescriptor,
  pluginsManifestSchema,
} from "@piiq/workspace-plugin-sdk";
import { getConfig } from "../runtimeConfig";
import { pluginApi } from "./host";
import { loadPlugin } from "./loadPlugin";
import { widgetRegistry } from "./registry";

async function fetchJson(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return { data: await response.json(), url: response.url || url };
}

export async function loadRuntimePlugins(
  config = getConfig().plugins,
  api = pluginApi,
  registry = widgetRegistry,
) {
  if (!config.runtimeEnabled) return;
  try {
    if (!config.manifestUrl)
      throw new Error("RUNTIME_PLUGINS_ENABLED requires PLUGINS_MANIFEST_URL.");
    const manifest = await fetchJson(
      new URL(config.manifestUrl, document.baseURI).href,
    );
    const selections = pluginsManifestSchema.parse(manifest.data);
    for (const selection of selections.plugins) {
      if (selection.mode !== "runtime") continue;
      let url = selection.descriptorUrl;
      try {
        url = new URL(url, manifest.url).href;
        const { data: descriptor, url: descriptorUrl } = await fetchJson(url);
        await loadPlugin(
          {
            descriptor: descriptor as PluginDescriptor,
            baseUrl: descriptorUrl,
            load: () =>
              import(/* @vite-ignore */ new URL(descriptor.entry, descriptorUrl).href),
          },
          api,
          registry,
        );
      } catch (error) {
        console.error(`Could not load runtime plugin descriptor ${url}`, error);
      }
    }
  } catch (error) {
    console.error("Could not load runtime plugin manifest", error);
  }
}
