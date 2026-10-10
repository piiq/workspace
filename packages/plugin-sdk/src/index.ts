import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
  SVGAttributes,
} from "react";
import { z } from "zod";

export const PLUGIN_API_VERSION = 1;

const localName = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const pluginIdSchema = z
  .string()
  .regex(/^@[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type RendererId = `@${string}/${string}/${string}`;
// Keep this pattern aligned with RENDERER_ID_PATTERN in backend/api/schemas.py.
// Widget Builder's type/defaultViz schemas derive from this through frontend/src/lib/types/app.ts; frontend/tests/unit/utils/zodForms.test.tsx checks their parity.
export const rendererIdSchema = z
  .string()
  .regex(
    /^@[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  ) as z.ZodType<RendererId>;

const jsonSchema = z.record(z.string(), z.unknown());
export const rendererMetadataSchema = z.object({
  name: localName,
  title: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(["content", "table"]).default("content"),
  wrapper: z.literal("ag-grid").optional(),
  inputSchema: jsonSchema.optional(),
  parameterSchema: jsonSchema.optional(),
  stateSchema: jsonSchema.optional(),
  capabilities: z.array(localName).default([]),
});

export const agGridCapabilityMetadataSchema = z.object({
  name: localName,
  title: z.string().min(1),
  description: z.string().optional(),
});

export const pluginDescriptorSchema = z
  .object({
    name: pluginIdSchema,
    version: z.string().min(1),
    apiVersion: z.literal(PLUGIN_API_VERSION),
    renderers: z.array(rendererMetadataSchema),
    agGridCapabilities: z.array(agGridCapabilityMetadataSchema).default([]),
    entry: z.string().min(1),
    assets: z.array(z.string().min(1)).default([]),
  })
  .superRefine((descriptor, context) => {
    const names = new Set<string>();
    for (const declaration of [
      ...descriptor.renderers,
      ...descriptor.agGridCapabilities,
    ]) {
      if (names.has(declaration.name)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate declaration: ${descriptor.name}/${declaration.name}`,
        });
      }
      names.add(declaration.name);
    }
  });

const buildSourceSchema = z.union([
  z.object({ path: z.string().min(1) }).strict(),
  z.object({ repository: z.string().min(1), ref: z.string().min(1) }).strict(),
  z.object({ dist: z.string().min(1) }).strict(),
]);

export const pluginsManifestSchema = z.object({
  plugins: z.array(
    z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("build"), source: buildSourceSchema }).strict(),
      z
        .object({ mode: z.literal("runtime"), descriptorUrl: z.string().min(1) })
        .strict(),
    ]),
  ),
});

export type RendererMetadata = z.output<typeof rendererMetadataSchema>;
export type PluginDescriptor = z.output<typeof pluginDescriptorSchema>;
export type PluginsManifest = z.output<typeof pluginsManifestSchema>;
export type WidgetTheme = "light" | "dark";

export interface WidgetContext {
  id: string;
  rendererId: string;
  endpoint?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    query?: Record<string, unknown>;
  };
  parameters: Record<string, unknown>;
  state: Record<string, unknown>;
  theme: WidgetTheme;
  setParameters: (parameters: Record<string, unknown>) => void;
  setState: (state: Record<string, unknown>) => void;
}

export interface WidgetDataExport {
  data: unknown;
  columns?: string[];
}

export interface WidgetDataOptions {
  query?: Record<string, unknown>;
  body?: object;
  enabled?: boolean;
  asText?: boolean;
}

export interface WidgetDataResult<Data = unknown> {
  data: Data | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  lastUpdated: number;
  refetch: () => Promise<void>;
}

export interface WidgetDataExportOptions {
  data: unknown;
  enabled: boolean;
  title?: string;
  additionalMetadata?: Record<string, unknown>;
  captureExecutedParams?: boolean;
  lastUpdated?: number | null;
}

export interface WidgetLifecycle {
  refresh: () => void | Promise<void>;
  exportData?: () => WidgetDataExport | Promise<WidgetDataExport>;
  dispose?: () => void;
}

export interface WidgetShellProps {
  children: ReactNode;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  data?: unknown;
  lastUpdated?: number;
  toolbar?: ReactNode;
}

export interface PluginHost {
  react: typeof import("react");
  reactDom: typeof import("react-dom");
  reactDomClient: typeof import("react-dom/client");
  jsxRuntime: typeof import("react/jsx-runtime");
  useTheme: () => WidgetTheme;
  useWidgetContext: () => WidgetContext;
  useWidgetData: <Data = unknown>(
    options?: WidgetDataOptions,
  ) => WidgetDataResult<Data>;
  useWidgetDataExport: (options: WidgetDataExportOptions) => void;
  useWidgetLifecycle: (lifecycle: WidgetLifecycle) => void;
  ui: {
    Button: ComponentType<
      ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: "primary" | "secondary" | "outlined" | "warning" | "danger" | "ghost";
        size?: "xs" | "sm" | "md" | "lg" | "xl";
      }
    >;
    Icon: ComponentType<SVGAttributes<SVGSVGElement> & { id: string }>;
    Tooltip: ComponentType<{ children: ReactNode; message: ReactNode }>;
    WidgetShell: ComponentType<WidgetShellProps>;
    RawDataTable: ComponentType<{ data: unknown[] }>;
  };
}

export type RendererDefinition = z.input<typeof rendererMetadataSchema> & {
  Component: ComponentType;
  Toolbar?: ComponentType;
};

export interface PluginDefinition {
  name: string;
  version: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  renderers: RendererDefinition[];
  setup?: (host: PluginHost) => void | Promise<void>;
}

export interface PluginApi {
  apiVersion: typeof PLUGIN_API_VERSION;
  host: PluginHost;
  registerPlugin: (plugin: PluginDefinition) => Promise<void>;
}

export function getRendererId(pluginId: string, rendererName: string): RendererId {
  return `${pluginIdSchema.parse(pluginId)}/${localName.parse(rendererName)}` as RendererId;
}

export function definePlugin<
  Declarations extends Omit<PluginDefinition, "name" | "version" | "apiVersion">,
>(
  packageJson: { name: string; version: string },
  declarations: Declarations,
): Declarations & PluginDefinition {
  const plugin: Declarations & PluginDefinition = {
    ...declarations,
    name: packageJson.name,
    version: packageJson.version,
    apiVersion: PLUGIN_API_VERSION,
  };
  createPluginDescriptor(plugin, { entry: "entry.js" });
  return plugin;
}

export function createPluginDescriptor<Definition extends PluginDefinition>(
  plugin: Definition,
  output: { entry: string; assets?: string[] },
): PluginDescriptor {
  return pluginDescriptorSchema.parse({ ...plugin, ...output });
}
