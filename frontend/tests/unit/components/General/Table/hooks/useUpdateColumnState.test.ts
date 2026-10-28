import { describe, expect, it } from "vitest";
import { needsAutoFitOnRestore } from "~/components/General/Table/hooks/useUpdateColumnState";

describe("needsAutoFitOnRestore", () => {
  it("auto-fits when there is no saved column sizing", () => {
    expect(needsAutoFitOnRestore(undefined)).toBe(true);
    expect(needsAutoFitOnRestore([])).toBe(true);
  });

  it("keeps saved column widths even for tables with few columns", () => {
    // Regression: restoring used to force sizeColumnsToFit whenever the saved
    // sizing model had fewer columns than the auto-fit threshold (6/10),
    // wiping user-autosized widths on every chart-view toggle
    const sevenColumns = Array.from({ length: 7 }, (_, i) => ({
      colId: `col${i}`,
      width: 120,
    }));
    expect(needsAutoFitOnRestore(sevenColumns)).toBe(false);

    const twoColumns = sevenColumns.slice(0, 2);
    expect(needsAutoFitOnRestore(twoColumns)).toBe(false);
  });

  it("uses the configured column count when deciding to auto-fit", () => {
    const saved = [{ colId: "a", width: 100 }];
    expect(needsAutoFitOnRestore(saved, 6)).toBe(true);
    expect(needsAutoFitOnRestore(saved, 1)).toBe(false);
  });
});
