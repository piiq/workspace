import { describe, expect, it, vi } from "vitest";
import {
  createCustomTemplateTab,
  extractCustomTemplateInfo,
} from "~/lib/utils/createTemplates";

vi.mock("~/api/auth.api", () => ({
  getExternalCopilotHolders: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/api/dashboard.api", () => ({
  saveDashboards: vi.fn(),
}));

vi.mock("~/lib/state/copilot", () => ({
  useCopilotStore: {
    getState: () => ({
      setSelectedCopilot: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: () => ({
      setPromptsSuggestionsMenuOpen: vi.fn(),
    }),
  },
}));

describe("createTemplates utility functions", () => {
  describe("createCustomTemplateTab", () => {
    const source = {
      id: "source-1",
      name: "Source",
      widgets: {
        "declared-widget": {
          name: "Declared widget",
          type: "table",
          endpoint: "/data",
        },
      },
    } as any;
    const template = { name: "My App", description: "Desc", tabs: {} } as any;

    it("redirects to an existing untouched app dashboard instead of creating another one", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "My App",
            templateId: "custom-source-1-my-app",
            type: "template",
            numberOfChanges: 0,
            currentTab: "overview",
            widgets: [{ id: "widget-1" }],
          },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source,
      });

      expect(id).toBe("existing");
      expect(navigate).toHaveBeenCalledWith("/app/existing?tab=overview");
      expect(addTab).not.toHaveBeenCalled();
    });

    it("uses source uuid when source id is unavailable", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "My App",
            templateId: "custom-source-uuid-my-app",
            type: "template",
            numberOfChanges: 0,
            widgets: [{ id: "widget-1" }],
          },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source: { uuid: "source-uuid", name: "Source" } as any,
      });

      expect(id).toBe("existing");
      expect(navigate).toHaveBeenCalledWith("/app/existing");
      expect(addTab).not.toHaveBeenCalled();
    });

    it("does not reuse a dashboard when the user changed its name", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "Renamed App",
            templateId: "custom-source-1-my-app",
            type: "template",
            numberOfChanges: 0,
            widgets: [{ id: "widget-1" }],
          },
        },
        empty: {
          index: "empty",
          data: {
            name: "Empty",
            widgets: [],
          },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source,
        currentDashboard: "empty",
      });

      expect(id).toBe("empty");
      expect(navigate).toHaveBeenCalledWith("/app/empty");
      expect(addTab).toHaveBeenCalledWith(
        expect.objectContaining({
          index: "empty",
          data: expect.objectContaining({
            name: "My App",
            templateId: "custom-source-1-my-app",
          }),
        }),
        true,
      );
    });

    it("does not reuse a dashboard with recorded changes", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "My App",
            templateId: "custom-source-1-my-app",
            type: "template",
            numberOfChanges: 1,
            widgets: [{ id: "widget-1" }],
          },
        },
        empty: {
          index: "empty",
          data: {
            name: "Empty",
            widgets: [],
          },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source,
        currentDashboard: "empty",
      });

      expect(id).toBe("empty");
      expect(navigate).toHaveBeenCalledWith("/app/empty");
      expect(addTab).toHaveBeenCalled();
    });

    it("marks newly created app widgets so startup sync writes do not count as user changes", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const appTemplate = {
        name: "My App",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [
              {
                i: "declared-widget",
                x: 0,
                y: 0,
                w: 12,
                h: 8,
                groups: [],
              },
            ],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        navigate,
        items: {} as any,
        template: appTemplate,
        source,
      });

      const createdTab = addTab.mock.calls[0][0];
      const widgetIds = createdTab.data.widgets.map((widget) => widget.id);

      expect(createdTab.data.numberOfChanges).toBeUndefined();
    });

    it("restores minimized state from the `minimized` flag in apps.json layout", async () => {
      const addTab = vi.fn();
      const minimizedTemplate = {
        name: "Min App",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [
              {
                i: "declared-widget",
                x: 0,
                y: 0,
                w: 20,
                h: 12,
                minimized: true,
                groups: [],
              },
            ],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: minimizedTemplate,
        source,
      });

      const tab = addTab.mock.calls[0][0];
      const widget = tab.data.widgets[0];
      const gridEntry = tab.data.gridLayout.overview[0];

      expect(widget.isMinimized).toBe(true);
      expect(widget.originalH).toBe(12);
      expect(gridEntry.h).toBe(1.4);
      expect(gridEntry.minH).toBe(1.4);
    });

    it("keeps backward-compat with legacy minimized layouts where h === 1", async () => {
      const addTab = vi.fn();
      const legacyTemplate = {
        name: "Legacy",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [{ i: "declared-widget", x: 0, y: 0, w: 20, h: 1, groups: [] }],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: legacyTemplate,
        source,
      });

      const tab = addTab.mock.calls[0][0];
      expect(tab.data.widgets[0].isMinimized).toBe(true);
      expect(tab.data.gridLayout.overview[0].h).toBe(1.4);
    });

    it("does not mark non-minimized widgets as minimized", async () => {
      const addTab = vi.fn();
      const normalTemplate = {
        name: "Normal",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [{ i: "declared-widget", x: 0, y: 0, w: 20, h: 12, groups: [] }],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: normalTemplate,
        source,
      });

      const tab = addTab.mock.calls[0][0];
      expect(tab.data.widgets[0].isMinimized).toBe(false);
      expect(tab.data.gridLayout.overview[0].h).toBe(12);
    });

    it("resolves each widget against its own source when resolveWidgetSource is provided", async () => {
      const addTab = vi.fn();
      const sourceA = {
        id: "a",
        uuid: "a",
        name: "Backend A",
        url: "https://a.test",
        endpointHeaders: [{ key: "x", value: "from-a", location: "headers" }],
        widgets: { price: { name: "Price", endpoint: "/price" } },
      } as any;
      const sourceB = {
        id: "b",
        uuid: "b",
        name: "Backend B",
        url: "https://b.test",
        endpointHeaders: [{ key: "x", value: "from-b", location: "headers" }],
        widgets: { news: { name: "News", endpoint: "/news" } },
      } as any;
      const multiOriginTemplate = {
        name: "Multi",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [
              { i: "price", x: 0, y: 0, w: 20, h: 8, groups: [] },
              { i: "news", x: 20, y: 0, w: 20, h: 8, groups: [] },
            ],
          },
        },
      } as any;

      const resolveWidgetSource = (widgetId: string) =>
        widgetId === "price" ? sourceA : widgetId === "news" ? sourceB : undefined;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: multiOriginTemplate,
        source: { uuid: "rep", name: "rep", url: "", endpointHeaders: null } as any,
        resolveWidgetSource,
      });

      const widgets = addTab.mock.calls[0][0].data.widgets;
      const price = widgets.find((widget) => widget.widgetId === "price");
      const news = widgets.find((widget) => widget.widgetId === "news");

      expect(price.sourceName).toBe("Backend A");
      expect(price.endpointHeaders).toEqual([
        { key: "x", value: "from-a", location: "headers" },
      ]);
      expect(news.sourceName).toBe("Backend B");
      expect(news.endpointHeaders).toEqual([
        { key: "x", value: "from-b", location: "headers" },
      ]);
    });

    it("ignores an existing untouched dashboard when dashboardBehavior is 'new'", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "My App",
            templateId: "custom-source-1-my-app",
            type: "template",
            numberOfChanges: 0,
            currentTab: "overview",
            widgets: [{ id: "widget-1" }],
          },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source,
        dashboardBehavior: "new",
      });

      expect(id).not.toBe("existing");
      expect(navigate).not.toHaveBeenCalledWith("/app/existing?tab=overview");
      expect(addTab).toHaveBeenCalled();
    });

    it("targets the current dashboard for dashboardBehavior 'current', even when it has widgets and an untouched dashboard exists", async () => {
      const addTab = vi.fn();
      const navigate = vi.fn();
      const items = {
        existing: {
          index: "existing",
          data: {
            name: "My App",
            templateId: "custom-source-1-my-app",
            type: "template",
            numberOfChanges: 0,
            widgets: [{ id: "widget-1" }],
          },
        },
        current: {
          index: "current",
          data: { name: "Current", widgets: [{ id: "existing-widget" }] },
        },
      } as any;

      const id = await createCustomTemplateTab({
        addTab,
        navigate,
        items,
        template,
        source,
        currentDashboard: "current",
        dashboardBehavior: "current",
      });

      expect(id).toBe("current");
      expect(navigate).toHaveBeenCalledWith("/app/current");
      expect(addTab).toHaveBeenCalledWith(
        expect.objectContaining({ index: "current" }),
        true,
      );
    });

    it("throws when a widget cannot be resolved and a resolver is provided", async () => {
      const addTab = vi.fn();
      const appTemplate = {
        name: "My App",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [
              {
                i: "definitely_not_a_real_widget",
                x: 0,
                y: 0,
                w: 12,
                h: 8,
                groups: [],
              },
            ],
          },
        },
      } as any;

      await expect(
        createCustomTemplateTab({
          addTab,
          items: {} as any,
          template: appTemplate,
          source: { uuid: "rep", name: "rep", url: "", endpointHeaders: null } as any,
          resolveWidgetSource: () => undefined,
        }),
      ).rejects.toThrow(/unavailable/);

      expect(addTab).not.toHaveBeenCalled();
    });

    it("prefers resolveWidget over the bundled widget registry", async () => {
      const addTab = vi.fn();
      const appTemplate = {
        name: "My App",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [{ i: "declared-widget", x: 0, y: 0, w: 12, h: 8, groups: [] }],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: appTemplate,
        source,
        resolveWidget: (widgetId) =>
          widgetId === "declared-widget"
            ? ({
                widgetId: "declared-widget",
                name: "Resolved Widget",
                params: [],
              } as any)
            : undefined,
      });

      const widgets = addTab.mock.calls[0][0].data.widgets;
      const widget = widgets.find((w: any) => w.widgetId === "declared-widget");
      expect(widget?.name).toBe("Resolved Widget");
    });

    it("preserves a declared ticker parameter without fetching provider metadata", async () => {
      const addTab = vi.fn();
      const appTemplate = {
        name: "My App",
        description: "Desc",
        tabs: {
          overview: {
            id: "overview",
            name: "Overview",
            layout: [
              {
                i: "declared-widget",
                x: 0,
                y: 0,
                w: 12,
                h: 8,
                groups: [],
                state: { params: { symbol: "aapl" } },
              },
            ],
          },
        },
      } as any;

      await createCustomTemplateTab({
        addTab,
        items: {} as any,
        template: appTemplate,
        source,
        resolveWidget: () =>
          ({
            widgetId: "declared-widget",
            name: "Ticker Info",
            params: [{ paramName: "symbol", type: "ticker" }],
          }) as any,
      });

      const widgets = addTab.mock.calls[0][0].data.widgets;
      const widget = widgets.find((w: any) => w.widgetId === "declared-widget");
      expect(widget?.data?.mainTicker?.symbol).toBe("aapl");
      expect(widget?.storage?.params?.symbol).toBe("aapl");
    });
  });

  describe("extractCustomTemplateInfo", () => {
    describe("valid custom template IDs", () => {
      it("should extract sourceId and templateName from valid template ID", () => {
        const templateId = "custom-550e8400-e29b-41d4-a716-446655440000-my-template";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(result.templateName).toBe("my-template");
      });

      it("should extract template name with multiple hyphens", () => {
        const templateId =
          "custom-550e8400-e29b-41d4-a716-446655440000-my-complex-template-name";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(result.templateName).toBe("my-complex-template-name");
      });

      it("should extract simple template name", () => {
        const templateId = "custom-123e4567-e89b-12d3-a456-426614174000-simple";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBe("123e4567-e89b-12d3-a456-426614174000");
        expect(result.templateName).toBe("simple");
      });

      it("should extract template name with underscores", () => {
        const templateId =
          "custom-550e8400-e29b-41d4-a716-446655440000-my_template_name";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.templateName).toBe("my_template_name");
      });

      it("should extract template name with numbers", () => {
        const templateId = "custom-550e8400-e29b-41d4-a716-446655440000-template123";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.templateName).toBe("template123");
      });
    });

    describe("invalid template IDs", () => {
      it("should return null values for non-custom template ID", () => {
        const templateId = "equity";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for empty string", () => {
        const result = extractCustomTemplateInfo("");

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for undefined", () => {
        const result = extractCustomTemplateInfo(undefined);

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for malformed custom prefix without UUID", () => {
        const templateId = "custom-not-a-uuid-template";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for custom prefix with incomplete UUID", () => {
        const templateId = "custom-550e8400-e29b-template";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for 'charting' template ID", () => {
        const result = extractCustomTemplateInfo("charting");

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for 'etf' template ID", () => {
        const result = extractCustomTemplateInfo("etf");

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should return null values for 'onboarding' template ID", () => {
        const result = extractCustomTemplateInfo("onboarding");

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });
    });

    describe("edge cases", () => {
      it("should handle UUID with uppercase letters (standard UUID)", () => {
        const templateId = "custom-550E8400-E29B-41D4-A716-446655440000-my-template";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });

      it("should handle template name with special characters", () => {
        const templateId =
          "custom-550e8400-e29b-41d4-a716-446655440000-template@special";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.templateName).toBe("template@special");
      });

      it("should handle template name that starts with number", () => {
        const templateId = "custom-550e8400-e29b-41d4-a716-446655440000-123template";

        const result = extractCustomTemplateInfo(templateId);

        expect(result.templateName).toBe("123template");
      });

      it("should handle very long template names", () => {
        const longName = "a".repeat(100);
        const templateId = `custom-550e8400-e29b-41d4-a716-446655440000-${longName}`;

        const result = extractCustomTemplateInfo(templateId);

        expect(result.templateName).toBe(longName);
      });

      it("should return null for template ID with empty template name", () => {
        // The regex requires at least one character after the final hyphen for templateName
        const templateId = "custom-550e8400-e29b-41d4-a716-446655440000-";

        const result = extractCustomTemplateInfo(templateId);

        // Returns null because .+ requires at least one character for templateName
        expect(result.sourceId).toBeNull();
        expect(result.templateName).toBeNull();
      });
    });
  });
});
