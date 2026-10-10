import type { WidgetDataExport, WidgetLifecycle } from "@piiq/workspace-plugin-sdk";
import { type DashboardWidgetData, useCopilotDataStore } from "./state/copilotData";

const lifecycles = new Map<string, WidgetLifecycle>();

export function publishWidgetData(id: string, data: DashboardWidgetData): void {
  useCopilotDataStore.getState().addDataOnDashboardWidget(id, data);
}

export function getWidgetData(id: string): DashboardWidgetData | undefined {
  return useCopilotDataStore.getState().getDashboardWidgetData(id) ?? undefined;
}

export function getWidgetsData(): Record<string, DashboardWidgetData> {
  return useCopilotDataStore.getState().getDashboardWidgetsData() ?? {};
}

export function registerWidgetLifecycle(
  id: string,
  lifecycle: WidgetLifecycle,
): () => void {
  if (lifecycles.has(id)) throw new Error(`Widget lifecycle already registered: ${id}`);
  lifecycles.set(id, lifecycle);
  return () => {
    lifecycles.delete(id);
    lifecycle.dispose?.();
  };
}

export async function refreshWidgetData(id: string): Promise<boolean> {
  const lifecycle = lifecycles.get(id);
  if (!lifecycle) return false;
  await lifecycle.refresh();
  return true;
}

export async function exportWidgetData(
  id: string,
): Promise<WidgetDataExport | undefined> {
  const lifecycle = lifecycles.get(id);
  if (lifecycle?.exportData) return lifecycle.exportData();
  const published = getWidgetData(id);
  if (!published) return undefined;
  return { data: published.data, columns: published.metadata?.columns };
}
