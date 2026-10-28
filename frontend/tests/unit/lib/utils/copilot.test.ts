import { describe, expect, it } from "vitest";
import { findMatchingWidget } from "~/lib/utils/copilot";

describe("copilot utils", () => {
  describe("findMatchingWidget", () => {
    const citation = {
      source_info: {
        type: "widget",
        widget_id: "test-widget",
        metadata: {
          input_args: { symbol: "AAPL" },
        },
      },
    } as any;

    const allAppWidgets = new Map([
      ["test-widget", { params: [{ paramName: "symbol" }] }],
    ]) as any;

    it("returns matching widget when type and params match", () => {
      const dashboardWidgets = [
        { widgetId: "test-widget", storage: { params: { symbol: "AAPL" } } },
      ] as any;

      const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
      expect(result).toBeDefined();
      expect(result?.widgetId).toBe("test-widget");
    });

    it("returns undefined if params dont match", () => {
      const dashboardWidgets = [
        { widgetId: "test-widget", storage: { params: { symbol: "MSFT" } } },
      ] as any;

      const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
      expect(result).toBeUndefined();
    });
  });
});
