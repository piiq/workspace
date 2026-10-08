import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../mocks/runtimeConfig";
import { PackagedDataTab } from "~/components/DataConnectors/PackagedDataTab";

const mockToggleBundle = vi.fn();
const mockToggleWidgetDisabled = vi.fn();

vi.mock("~/lib/widget_bundles.json", async (importOriginal) => ({
  default: {
    ...(
      await importOriginal<{
        default: typeof import("~/lib/widget_bundles.json");
      }>()
    ).default,
    "equity-data": {
      name: "Equity Data",
      description: "Equity quotes",
      enabled_by_default: true,
      widgets: ["quotes"],
    },
    "economic-data": {
      name: "Economic Data",
      description: "Economic indicators",
      enabled_by_default: false,
      widgets: ["indicators"],
    },
  },
}));

vi.mock("~/lib/widgets.json", async (importOriginal) => ({
  default: {
    ...(await importOriginal<{ default: typeof import("~/lib/widgets.json") }>())
      .default,
    quotes: {
      widgetId: "quotes",
      name: "Quote Table",
      description: "Quotes for selected symbols",
      category: "Equity",
    },
    indicators: {
      widgetId: "indicators",
      name: "Indicator Table",
      description: "Economic indicator values",
      category: "Economy",
    },
  },
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: any) =>
    selector({
      enabledBundles: ["equity-data"],
      disabledWidgets: [],
      toggleBundle: mockToggleBundle,
      toggleWidgetDisabled: mockToggleWidgetDisabled,
    }),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: (selector: any) =>
    selector({
      featureFlags: { tier: "pro" },
    }),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: any) =>
    selector({
      theme: "dark",
    }),
}));

vi.mock("~/lib/onPremFeatureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/onPremFeatureFlags")>();
  return {
    ...actual,
    getAllowedDataVendors: () => ["equity-data", "economic-data"],
  };
});

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: any) => <div title={message}>{children}</div>,
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({ checked, onClick, disabled }: any) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={() => {}}
      onClick={onClick}
      data-testid="checkbox"
    />
  ),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}));

vi.mock("~/components/General/TerminalProOnlyTag", () => ({
  default: () => <span>Pro Only</span>,
}));

vi.mock("~/components/General/WidgetInfoTooltip", () => ({
  default: ({ name }: any) => <div data-testid="widget-info-tooltip">{name}</div>,
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: () => <div data-testid="no-results">No Results Found</div>,
}));

describe("PackagedDataTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders search input and all allowed data vendor bundles", () => {
    render(<PackagedDataTab />);

    expect(screen.getByPlaceholderText("Search for data")).toBeInTheDocument();
    expect(screen.getByText("Equity Data")).toBeInTheDocument();
    expect(screen.getByText("Economic Data")).toBeInTheDocument();
  });

  it("filters bundles by bundle name", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PackagedDataTab />);

    const searchInput = screen.getByPlaceholderText("Search for data");
    await user.type(searchInput, "Economic Data");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Economic Data")).toBeInTheDocument();
    expect(screen.queryByText("Equity Data")).not.toBeInTheDocument();
  });

  it("filters bundles by widget name", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PackagedDataTab />);

    const searchInput = screen.getByPlaceholderText("Search for data");
    await user.type(searchInput, "quote");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Equity Data")).toBeInTheDocument();
    expect(screen.queryByText("Economic Data")).not.toBeInTheDocument();
  });

  it("shows search results not found UI when query matches nothing", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PackagedDataTab />);

    const searchInput = screen.getByPlaceholderText("Search for data");
    await user.type(searchInput, "nonexistent");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId("no-results")).toBeInTheDocument();
    expect(screen.queryByText("Equity Data")).not.toBeInTheDocument();
    expect(screen.queryByText("Economic Data")).not.toBeInTheDocument();
  });

  it("auto-expands matched accordion section during search", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<PackagedDataTab />);

    // By default, widgets shouldn't be rendered because accordion is closed
    expect(screen.queryByText("Quote Table")).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Search for data");
    await user.type(searchInput, "quote");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Accordion should expand automatically, rendering matched widget
    expect(screen.getByText("Quote Table")).toBeInTheDocument();
  });
});
