import { v4 as uuidv4 } from "uuid";
import { DEFAULT_MCP_SERVER } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import type { AppState, Items } from "~/lib/state/app";
import { useMcpToolsStore } from "~/lib/state/mcpTools";

export function initializeWorkspace(params: {
  items: Items;
  updateOnlyItems: AppState["updateOnlyItems"];
}): void {
  const { items, updateOnlyItems } = params;

  const rootFolder = items
    ? Object.values(items).find((item) => item.isRoot)
    : undefined;

  if (!rootFolder) {
    const rootId = uuidv4();
    updateOnlyItems({
      [rootId]: {
        index: rootId,
        name: "root",
        isFolder: true,
        isRoot: true,
        children: [],
        data: { name: "root" },
      },
    });
  }

  if (getConfig().mcp.defaultServerEnabled) {
    const currentServers = useMcpToolsStore.getState().servers;
    const hasDefaultServer = currentServers.some(
      (s) => s.id === "openbb-docs-default" || s.url === DEFAULT_MCP_SERVER.url,
    );
    if (!hasDefaultServer) {
      useMcpToolsStore.getState().addServer(DEFAULT_MCP_SERVER);
    }
  }
}
