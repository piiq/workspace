import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider, Table } from "~/components/General/Table/hooks";
import { getTableData } from "~/components/General/Table/utils";
import { useWidgetContext } from "~/components/Widget.context";

export default function RawDataTable({ data }: { data: unknown[] }) {
  const { widget } = useWidgetContext();
  const rowData = getTableData(data, widget);
  const columnDefs = getColumnDefs(rowData, widget);
  return (
    <Table>
      <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
    </Table>
  );
}
