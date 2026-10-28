import get from "lodash/get";
import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import { getTableData } from "~/components/General/Table/utils";
import type { WidgetT } from "~/components/types";
import { getWidgetColumnDefs, getWidgetDefinition } from "~/lib/utils";

export function processAgGridTableData(
  queryData: any,
  widget: WidgetT,
  decimalDigitsToUse: number,
) {
  const columnDefsFromJSON = getWidgetColumnDefs(widget);
  const widgetFromJSON = getWidgetDefinition(widget);

  let data = queryData?.results ?? queryData;
  if (widget?.external) {
    const dataKey = widget?.data?.dataKey;
    const results = get(queryData, dataKey, queryData);
    data = Array.isArray(results) ? results : [results];
  }

  if (!data?.length) return { rowData: [], columnDefs: [] };

  const showAll = widget.data?.table?.showAll ?? widgetFromJSON.data?.table?.showAll;
  const formatterFn =
    widget.data?.table?.formatterFn ?? widgetFromJSON.data?.table?.formatterFn;

  const rowData = getTableData(data, {
    data: {
      table: {
        transpose: widget?.storage?.transpose,
        columnsDefs: columnDefsFromJSON,
        showAll,
        formatterFn,
      },
    },
    external: widget?.external,
    widgetId: widget?.widgetId,
  } as WidgetT);

  if (rowData?.length) {
    const columnDefs = getColumnDefs(
      rowData,
      {
        widgetId: widget?.widgetId,
        external: widget?.external,
        storage: { enableAdvanced: widget?.storage?.enableAdvanced },
        data: {
          table: {
            columnsDefs: columnDefsFromJSON,
            transpose: widgetFromJSON?.data?.table?.transpose,
            formatterFn,
          },
        },
      },
      decimalDigitsToUse,
    );

    return { rowData, columnDefs };
  }
  return { rowData: [], columnDefs: [] };
}
