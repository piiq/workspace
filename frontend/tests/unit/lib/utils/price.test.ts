import { describe, expect, it } from "vitest";
import { formatPrice } from "~/lib/utils/price";

describe("formatPrice", () => {
  it.each([
    [1234.567, "1,234.57"],
    [1, "1.00"],
    [0.99999, "1.0000"],
    [0.01, "0.0100"],
    [0.0099999, "0.010000"],
    [0.0001, "0.000100"],
    [0.000099999, "0.00010000"],
    [0, "0.00000000"],
    [-1.234567891, "-1.23456789"],
  ])("formats %s as %s", (price, expected) => {
    expect(formatPrice(price)).toBe(expected);
  });

  it.each([Number.NaN, undefined, null, "1"])("returns N/A for %s", (price) => {
    expect(formatPrice(price as number)).toBe("N/A");
  });
});
