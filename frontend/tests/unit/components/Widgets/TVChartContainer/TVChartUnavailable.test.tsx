import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TVChartUnavailable from "~/components/Widgets/TVChartContainer/TVChartUnavailable";

describe("TVChartUnavailable", () => {
  it("explains how to enable charts", () => {
    render(<TVChartUnavailable extraClassName="h-full" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Install the TradingView plugin and connect a UDF-compatible datafeed.",
    );
    expect(screen.getByRole("alert")).toHaveClass("h-full");
  });
});
