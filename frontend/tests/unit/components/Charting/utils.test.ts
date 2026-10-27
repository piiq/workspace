import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadData, downloadTableData } from "~/components/Charting/utils";

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockClear().mockReturnValue("blob:export");
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

async function downloadedSheet() {
  await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
}

describe("XLSX downloads", () => {
  it("preserves duplicate headers, numeric header order, and cell values", async () => {
    const columns = ["Price", "Price", "2024", "2023"];
    const data = [[42, "$84.00", 100, 90]];

    await downloadTableData({ columns, data }, "Prices", "excel");

    const sheet = await downloadedSheet();
    expect(sheet.columnCount).toBe(4);
    expect(columns.map((_, index) => sheet.getCell(1, index + 1).value)).toEqual(
      columns,
    );
    expect(columns.map((_, index) => sheet.getCell(2, index + 1).value)).toEqual(
      data[0],
    );
  });

  it("exports headers when the table has no rows", async () => {
    await downloadTableData(
      { columns: ["Price", "Price"], data: [] },
      "Prices",
      "excel",
    );

    const sheet = await downloadedSheet();
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getCell("A1").value).toBe("Price");
    expect(sheet.getCell("B1").value).toBe("Price");
  });

  it("exports record data through the shared download function", async () => {
    await downloadData([{ symbol: "AAPL", price: 42 }], "Prices", "excel", false);

    const sheet = await downloadedSheet();
    expect(sheet.getCell("A1").value).toBe("symbol");
    expect(sheet.getCell("B1").value).toBe("price");
    expect(sheet.getCell("A2").value).toBe("AAPL");
    expect(sheet.getCell("B2").value).toBe(42);
  });
});
