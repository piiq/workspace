import { describe, expect, it } from "vitest";
import { getWidgetOrigin } from "~/components/AI/hooks/utils";
import type { WidgetT } from "~/components/types";

const widget = (properties: Partial<WidgetT>) => properties as WidgetT;

describe("getWidgetOrigin", () => {
  it("identifies built-in utilities as Workspace widgets", () => {
    expect(getWidgetOrigin(widget({ widgetId: "clock" }))).toBe("OpenBB Workspace");
  });

  it("uses the connected backend name for external declarations", () => {
    expect(getWidgetOrigin(widget({ external: true, sourceName: "My Backend" }))).toBe(
      "My Backend",
    );
  });

  it("keeps file and widget studio origins", () => {
    expect(getWidgetOrigin(widget({ connectionType: "file" }))).toBe("OpenBB Hub");
    expect(getWidgetOrigin(widget({ widgetId: "widget_studio-example" }))).toBe(
      "Widget Studio",
    );
  });
});
