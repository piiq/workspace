import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import TickerInput from "~/components/Widgets/Helpers/TickerInput";

vi.mock("~/components/Widgets/Helpers/GroupDropdown", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="ticker-group">{children}</div>
  ),
}));

vi.mock("~/components/General/Table/AgSQL", () => ({
  measureTextWidth: (text: string) => text.length * 8,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("TickerInput", () => {
  const ticker = { id: "AAPL", symbol: "AAPL", category: "equity", type: "stock" } as const;

  it("commits a typed symbol and keeps the grouping control", () => {
    const onChange = vi.fn();
    render(<TickerInput ticker={ticker} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Ticker symbol" });
    expect(screen.getByTestId("ticker-group")).toContainElement(input);
    fireEvent.change(input, { target: { value: " ACME " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({
      id: "ACME", symbol: "ACME", category: "equity", type: "stock",
    });
  });

  it("does not replace the current ticker for an empty or unchanged value", () => {
    const onChange = vi.fn();
    render(<TickerInput ticker={ticker} onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Ticker symbol" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
