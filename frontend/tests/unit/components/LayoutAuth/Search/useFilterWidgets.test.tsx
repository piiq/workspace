import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  useFilterWidgets,
  type WidgetItem,
} from "~/components/LayoutAuth/Search/hooks/useFilterWidgets";
import type { SearchDialogState } from "~/components/LayoutAuth/Search/SearchDialog";

const defaultState: SearchDialogState = {
  selectedWidgets: [],
  selectedCategory: "All",
  selectedOption: "all",
  isShiftPressed: false,
  anchorWidgetId: null,
};

const widgets: WidgetItem[] = [
  { widgetId: "clock", name: "Clock", category: "Utilities" },
  {
    widgetId: "local-prices",
    name: "Prices",
    category: "Markets",
    source: "My Backend",
    external: true,
  },
  {
    widgetId: "shared-prices",
    name: "Shared Prices",
    category: "Markets",
    external: true,
    isSharedWidget: true,
  },
];

function filterWidgets(items = widgets, state = defaultState) {
  return renderHook(() => useFilterWidgets(items, state)).result.current;
}

describe("useFilterWidgets", () => {
  it("includes core utilities and declared widgets without a vendor allowlist", () => {
    expect(filterWidgets().map((widget) => widget.widgetId)).toEqual([
      "local-prices",
      "shared-prices",
      "clock",
    ]);
  });

  it("filters by declared category", () => {
    expect(
      filterWidgets(widgets, {
        ...defaultState,
        selectedCategory: "utilities",
      }).map((widget) => widget.widgetId),
    ).toEqual(["clock"]);
  });

  it("shows owned declarations in My Widgets", () => {
    expect(
      filterWidgets(widgets, {
        ...defaultState,
        selectedOption: "external",
      }).map((widget) => widget.widgetId),
    ).toEqual(["local-prices"]);
  });

  it("uses sharing metadata for Shared With Me regardless of category", () => {
    expect(
      filterWidgets(widgets, {
        ...defaultState,
        selectedOption: "shared",
      }).map((widget) => widget.widgetId),
    ).toEqual(["shared-prices"]);
  });

  it("includes shared file and backend categories", () => {
    const shared: WidgetItem[] = [
      { name: "Report", category: "Shared Files" },
      { name: "Rates", category: "Shared Backends" },
    ];
    expect(
      filterWidgets(shared, { ...defaultState, selectedOption: "shared" }),
    ).toHaveLength(2);
  });

  it("uses My Data for uncategorized external widgets", () => {
    expect(
      filterWidgets([{ name: "Uncategorized", category: "Others", external: true }])[0]
        .category,
    ).toBe("my data");
  });

  it("expands declared supported asset classes", () => {
    const items: WidgetItem[] = [
      {
        name: "Prices",
        uniqueId: "prices",
        supportedAssetClasses: ["equity", "etf"],
      },
    ];
    expect(filterWidgets(items).map((widget) => widget.uniqueId)).toEqual([
      "prices-equity",
      "prices-etf",
    ]);
  });

  it("keeps declared category when all asset classes are supported", () => {
    expect(
      filterWidgets([
        { name: "Prices", category: "Markets", supportedAssetClasses: ["all"] },
      ])[0].category,
    ).toBe("markets");
  });

  it("sorts widgets by category, subcategory and name", () => {
    expect(
      filterWidgets([
        { name: "B", category: "Rates", subCategory: "Latest" },
        { name: "C", category: "Equity" },
        { name: "A", category: "Rates", subCategory: "Latest" },
      ]).map((widget) => widget.name),
    ).toEqual(["C", "A", "B"]);
  });
});
