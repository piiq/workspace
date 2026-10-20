import selections from "virtual:workspace-plugins";
import { loadPlugin } from "./loadPlugin";

export async function loadBuiltPlugins() {
  for (const plugin of selections) await loadPlugin(plugin);
}
