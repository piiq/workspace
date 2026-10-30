import { getConfig } from "~/lib/runtimeConfig";
import { useCopilotStore } from "~/lib/state/copilot";
import useGetAiAgents, { selectExternalCopilots } from "./useGetAiAgents";

/** Show Copilot entry points when enabled and at least one agent is available. */
export function useCopilotAvailable(): boolean {
  const agents = useGetAiAgents();
  return getConfig().copilot.enabled && agents.length > 0;
}

/** Imperative variant for event handlers / non-hook utils (reads current store state). */
export function isCopilotAvailable(): boolean {
  if (!getConfig().copilot.enabled) return false;
  const openbb = getConfig().copilot.openbbCopilot ? 1 : 0;
  const custom = selectExternalCopilots(
    useCopilotStore.getState().externalCopilotHolders,
  ).length;
  return openbb + custom > 0;
}
