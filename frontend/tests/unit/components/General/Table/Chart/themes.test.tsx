import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgThemes } from "~/components/General/Table/Chart/themes";

const settings = vi.hoisted(() => ({
  dark: { chartTheme: undefined as any },
  light: { chartTheme: undefined as any },
}));

vi.mock("~/lib/state/tableChartThemes", () => ({
  useShallowTableChartThemesStore: (selector) => selector(settings),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({ widget: { storage: {} } }),
}));

beforeEach(() => {
  settings.dark.chartTheme = undefined;
  settings.light.chartTheme = undefined;
});

describe("integrated chart themes", () => {
  it.each([
    false,
    true,
  ])("registers both modes and puts the active theme first (custom=%s)", (custom) => {
    if (custom) {
      for (const mode of ["dark", "light"] as const) {
        settings[mode].chartTheme = {
          baseTheme: mode === "dark" ? "ag-default-dark" : "ag-default",
          palette: { fills: ["#5470c6"], strokes: ["#5470c6"] },
          params: { fontFamily: "Arial" },
        };
      }
    }
    const prefix = custom ? "custom" : "openbb";
    const { result, rerender } = renderHook(
      ({ theme }: { theme: "light" | "dark" }) => useAgThemes(theme),
      { initialProps: { theme: "dark" } },
    );
    expect(result.current.chartThemes).toEqual([`${prefix}-dark`, `${prefix}-light`]);
    expect(Object.keys(result.current.customChartThemes).sort()).toEqual(
      [...result.current.chartThemes].sort(),
    );

    rerender({ theme: "light" });

    expect(result.current.chartThemes).toEqual([`${prefix}-light`, `${prefix}-dark`]);
    expect(Object.keys(result.current.customChartThemes).sort()).toEqual(
      [...result.current.chartThemes].sort(),
    );
    expect(result.current.customChartThemes[`${prefix}-light`].baseTheme).toBe(
      "ag-default",
    );
  });
});
