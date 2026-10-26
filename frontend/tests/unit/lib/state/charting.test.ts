/**
 * Tests for charting Zustand store
 *
 * Tests the charting state management including:
 * - Symbol management per widget
 * - Security metrics tracking
 * - Widget data cleanup
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useChartingStore } from "~/lib/state/charting";

describe("useChartingStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useChartingStore.setState({
        widgetStates: {
          charting_page: {
            symbol: "AAPL",
            prevSymbol: "",
          },
        },
        widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
      });
    });
  });

  describe("initial state", () => {
    it("should have default charting_page widget state", () => {
      const state = useChartingStore.getState();

      expect(state.widgetStates.charting_page).toEqual({
        symbol: "AAPL",
        prevSymbol: "",
      });
    });

    it("should have default charting_page securities", () => {
      const state = useChartingStore.getState();

      expect(state.widgetSecurities.charting_page).toEqual({
        AAPL: { metrics: [] },
      });
    });
  });

  describe("getSymbol", () => {
    it("should return symbol for existing widget", () => {
      expect(useChartingStore.getState().getSymbol("charting_page")).toBe("AAPL");
    });

    it("should return AAPL for non-existent widget", () => {
      expect(useChartingStore.getState().getSymbol("unknown-widget")).toBe("AAPL");
    });

    it("should return updated symbol after change", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "MSFT");
      });

      expect(useChartingStore.getState().getSymbol("charting_page")).toBe("MSFT");
    });
  });

  describe("changeSymbol", () => {
    it("should change symbol for widget", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "GOOGL");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates.charting_page.symbol).toBe("GOOGL");
      expect(state.widgetStates.charting_page.prevSymbol).toBe("AAPL");
    });

    it("should not change if symbol is the same", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "AAPL");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates.charting_page.symbol).toBe("AAPL");
      expect(state.widgetStates.charting_page.prevSymbol).toBe("");
    });

    it("should create new widget state if widget does not exist", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("new-widget", "TSLA");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["new-widget"].symbol).toBe("TSLA");
      expect(state.widgetStates["new-widget"].prevSymbol).toBe("AAPL");
    });

    it("should track previous symbol correctly through multiple changes", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "MSFT");
      });

      expect(useChartingStore.getState().widgetStates.charting_page.prevSymbol).toBe(
        "AAPL",
      );

      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "GOOGL");
      });

      expect(useChartingStore.getState().widgetStates.charting_page.prevSymbol).toBe(
        "MSFT",
      );
    });
  });

  describe("getSecurityMetrics", () => {
    it("should return empty array for widget with no metrics", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "AAPL"),
      ).toEqual([]);
    });

    it("should return empty array for non-existent widget", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("unknown-widget", "AAPL"),
      ).toEqual([]);
    });

    it("should return empty array for non-existent symbol", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "UNKNOWN"),
      ).toEqual([]);
    });

    it("should return metrics after update", () => {
      const metrics = ["price", "volume"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics);
      });

      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "AAPL"),
      ).toEqual(metrics);
    });
  });

  describe("updateSecurityMetrics", () => {
    it("should update metrics for existing widget and symbol", () => {
      const metrics = ["price", "volume", "marketCap"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics);
      });

      expect(
        useChartingStore.getState().widgetSecurities.charting_page.AAPL.metrics,
      ).toEqual(metrics);
    });

    it("should create widget securities if widget does not exist", () => {
      const metrics = ["price"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("new-widget", "MSFT", metrics);
      });

      expect(
        useChartingStore.getState().widgetSecurities["new-widget"].MSFT.metrics,
      ).toEqual(metrics);
    });

    it("should add new symbol to existing widget", () => {
      const metrics = ["volume"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "MSFT", metrics);
      });

      const state = useChartingStore.getState();
      expect(state.widgetSecurities.charting_page.MSFT.metrics).toEqual(metrics);
      expect(state.widgetSecurities.charting_page.AAPL.metrics).toEqual([]);
    });

    it("should replace existing metrics", () => {
      const metrics1 = ["price"] as any;
      const metrics2 = ["volume", "marketCap"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics1);
      });

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics2);
      });

      expect(
        useChartingStore.getState().widgetSecurities.charting_page.AAPL.metrics,
      ).toEqual(metrics2);
    });
  });

  describe("removeWidgetData", () => {
    it("should remove widget state and securities", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-to-remove": { symbol: "MSFT", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-to-remove": { MSFT: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore.getState().removeWidgetData("widget-to-remove");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-to-remove"]).toBeUndefined();
      expect(state.widgetSecurities["widget-to-remove"]).toBeUndefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });

    it("should not throw when removing non-existent widget", () => {
      expect(() => {
        act(() => {
          useChartingStore.getState().removeWidgetData("non-existent");
        });
      }).not.toThrow();
    });
  });

  describe("removeTabWidgetsData", () => {
    it("should remove multiple widgets at once", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-1": { symbol: "MSFT", prevSymbol: "" },
            "widget-2": { symbol: "GOOGL", prevSymbol: "" },
            "widget-3": { symbol: "TSLA", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-1": { MSFT: { metrics: [] } },
            "widget-2": { GOOGL: { metrics: [] } },
            "widget-3": { TSLA: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore.getState().removeTabWidgetsData(["widget-1", "widget-2"]);
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-1"]).toBeUndefined();
      expect(state.widgetStates["widget-2"]).toBeUndefined();
      expect(state.widgetStates["widget-3"]).toBeDefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });

    it("should not modify state when empty array is passed", () => {
      const stateBefore = useChartingStore.getState();

      act(() => {
        useChartingStore.getState().removeTabWidgetsData([]);
      });

      const stateAfter = useChartingStore.getState();
      expect(stateAfter.widgetStates).toEqual(stateBefore.widgetStates);
    });

    it("should handle mixed existent and non-existent widgets", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-1": { symbol: "MSFT", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-1": { MSFT: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore.getState().removeTabWidgetsData(["widget-1", "non-existent"]);
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-1"]).toBeUndefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });
  });
});
