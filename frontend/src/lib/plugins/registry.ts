import {
  createPluginDescriptor,
  getRendererId,
  PLUGIN_API_VERSION,
  type PluginDefinition,
  type PluginDescriptor,
  type PluginHost,
  pluginIdSchema,
  type RendererMetadata,
} from "@piiq/workspace-plugin-sdk";
import {
  type AgGridCapabilityDefinition,
  type AgGridPluginDefinition,
  getAgGrid,
} from "@piiq/workspace-plugin-sdk/ag-grid";
import type { GridOptions } from "ag-grid-community";
import type { ComponentType } from "react";
import { getBoundRendererId } from "./rendererBindings";

export interface RegisteredRenderer extends RendererMetadata {
  id: string;
  pluginId?: string;
  Component: ComponentType;
  Toolbar?: ComponentType;
}

export type BuiltinRenderer = Omit<
  RegisteredRenderer,
  "name" | "capabilities" | "kind"
> & {
  kind?: RegisteredRenderer["kind"];
  capabilities?: string[];
};

type PluginState =
  | { status: "pending"; ready: Promise<void> }
  | { status: "ready" }
  | { status: "failed"; message: string };

export type RendererState =
  | { status: "ready"; renderer: RegisteredRenderer }
  | { status: "pending"; ready: Promise<void> }
  | { status: "failed" | "unavailable"; message: string };

export class PluginRegistry {
  private renderers = new Map<string, RegisteredRenderer>();
  private plugins = new Map<string, PluginState>();
  private agGridCapabilities = new Map<string, AgGridCapabilityDefinition>();
  private listeners = new Set<() => void>();
  private revision = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.revision;

  private emit() {
    this.revision += 1;
    for (const listener of this.listeners) listener();
  }

  private failPlugin(name: string, error: unknown) {
    this.plugins.set(name, {
      status: "failed",
      message: `Plugin ${name} failed: ${error instanceof Error ? error.message : String(error)}. Check the installed plugin and reload Workspace.`,
    });
  }

  registerBuiltins(entries: BuiltinRenderer[]) {
    const ids = new Set<string>();
    for (const entry of entries) {
      if (this.renderers.has(entry.id) || ids.has(entry.id)) {
        throw new Error(`Renderer already registered: ${entry.id}`);
      }
      ids.add(entry.id);
    }
    for (const entry of entries) {
      this.renderers.set(entry.id, {
        ...entry,
        name: entry.id,
        kind: entry.kind ?? "content",
        capabilities: entry.capabilities ?? [],
      });
    }
    this.emit();
  }

  registerPlugin(
    plugin: PluginDefinition | AgGridPluginDefinition,
    host: PluginHost,
  ): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
    let descriptor: PluginDescriptor;
    try {
      if (plugin.apiVersion !== PLUGIN_API_VERSION) {
        throw new Error(
          `Plugin requires API ${plugin.apiVersion}; Workspace supports API ${PLUGIN_API_VERSION}. Install a compatible plugin version`,
        );
      }
      descriptor = createPluginDescriptor(plugin, { entry: "entry.js" });
      for (const renderer of plugin.renderers) {
        if (!renderer.Component) {
          throw new Error(
            `Renderer has no component: ${getRendererId(plugin.name, renderer.name)}`,
          );
        }
      }
    } catch (error) {
      if (pluginIdSchema.safeParse(plugin.name).success) {
        this.failPlugin(plugin.name, error);
        this.emit();
      }
      throw error;
    }
    for (const renderer of descriptor.renderers) {
      const id = getRendererId(plugin.name, renderer.name);
      if (this.renderers.has(id)) throw new Error(`Renderer already registered: ${id}`);
    }
    const ready = Promise.resolve().then(async () => {
      try {
        await plugin.setup?.(host);
        const capabilities =
          "agGridCapabilities" in plugin ? (plugin.agGridCapabilities ?? []) : [];
        for (const capability of capabilities) {
          getAgGrid(host).ModuleRegistry.registerModules(capability.modules);
        }
        for (const metadata of descriptor.renderers) {
          const definition = plugin.renderers.find(
            (item) => item.name === metadata.name,
          )!;
          const id = getRendererId(plugin.name, metadata.name);
          this.renderers.set(id, {
            ...metadata,
            id,
            pluginId: plugin.name,
            Component: definition.Component,
            Toolbar: definition.Toolbar,
          });
        }
        for (const capability of capabilities) {
          this.agGridCapabilities.set(
            getRendererId(plugin.name, capability.name),
            capability,
          );
        }
        this.plugins.set(plugin.name, { status: "ready" });
      } catch (error) {
        this.failPlugin(plugin.name, error);
        throw error;
      } finally {
        this.emit();
      }
    });
    this.plugins.set(plugin.name, { status: "pending", ready });
    this.emit();
    return ready;
  }

  getRendererState(id: string): RendererState {
    const boundId = getBoundRendererId(id);
    const renderer = this.renderers.get(id) ?? this.renderers.get(boundId);
    if (renderer) return { status: "ready", renderer };
    const pluginId = boundId.startsWith("@")
      ? boundId.slice(0, boundId.lastIndexOf("/"))
      : undefined;
    const plugin = pluginId && this.plugins.get(pluginId);
    if (plugin?.status === "pending") return plugin;
    if (plugin?.status === "failed") return plugin;
    return {
      status: "unavailable",
      message: pluginId
        ? `Renderer ${boundId} is unavailable. Install a compatible ${pluginId} plugin and reload Workspace.`
        : `Renderer ${id} is not registered.`,
    };
  }

  async resolveRenderer(id: string): Promise<RendererState> {
    const state = this.getRendererState(id);
    if (state.status === "pending") {
      await state.ready.catch(() => {});
      return this.getRendererState(id);
    }
    return state;
  }

  getRenderers(): RegisteredRenderer[] {
    return [...this.renderers.values()];
  }

  hasAgGridCapability(id: string): boolean {
    return this.agGridCapabilities.has(id);
  }

  configureGrid(options: GridOptions | undefined): GridOptions | undefined {
    for (const capability of this.agGridCapabilities.values()) {
      if (capability.configureGrid) options = capability.configureGrid(options ?? {});
    }
    return options;
  }
}

export const widgetRegistry = new PluginRegistry();
