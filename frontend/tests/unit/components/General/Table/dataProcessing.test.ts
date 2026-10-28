import { describe, expect, it } from "vitest";
import { getTableData } from "~/components/General/Table/utils";
import type { Widget } from "~/lib/state/app";

describe("table data declarations", () => {
  it("keeps the supplied row order, fiscal fields and dates", () => {
    const rows = [
      { date: "2025-06-30", value: 1, fiscal_period: "Q3", fiscal_year: 2024 },
      { date: "2025-03-31", value: 2, fiscal_period: "TTM", fiscal_year: 2025 },
    ];
    const expected = structuredClone(rows);
    expect(getTableData(rows)).toEqual(expected);
    expect(rows[0].date).toBe("2025-06-30");
  });

  it("transposes declared fields without assigning fiscal quarters", () => {
    const widget = {
      data: {
        table: {
          transpose: true,
          columnsDefs: [
            { field: "date", headerName: "Date", cellDataType: "date" },
            { field: "period", headerName: "Period" },
            { field: "value", headerName: "Value" },
          ],
        },
      },
    } as Widget;
    const result = getTableData([
      { date: "2025-06-30", period: "TTM", value: 10 },
      { date: "2025-03-31", period: "Q1", value: 20 },
    ], widget);
    expect(result).toEqual([
      { Index: "period", "2025-06-30": "TTM", "2025-03-31": "Q1" },
      { Index: "value", "2025-06-30": 10, "2025-03-31": 20 },
    ]);
  });
});
