import { describe, expect, it, vi } from "vitest";
import { getChartWidgetData } from "~/components/Widgets/Chart";

vi.mock("~/components/Charting/utils", () => ({
  downloadData: vi.fn(),
  getExportData: vi.fn(async (data) => data),
}));

describe("getChartWidgetData function", () => {
  it("returns chart data and export data", async () => {
    const results = { data: [{ x: 1, y: 2 }], layout: {} };

    const { data, exportData } = await getChartWidgetData(results);

    expect(data).toEqual(results);
    expect(exportData).toEqual(results);
  });

  it("uses an empty export for undefined chart data", async () => {

    const { data, exportData } = await getChartWidgetData(undefined);

    expect(data).toBeUndefined();
    expect(exportData).toEqual({ data: [], layout: {} });
  });
});
