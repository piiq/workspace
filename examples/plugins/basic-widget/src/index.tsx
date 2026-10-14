import { definePlugin, type PluginHost } from "@piiq/workspace-plugin-sdk";
import { useMemo } from "react";
import packageJson from "../package.json";

let host: PluginHost;

function BasicWidget() {
  const { parameters, state, setParameters, setState } = host.useWidgetContext();
  const response = host.useWidgetData<Record<string, unknown>[]>();
  const rows = response.data ?? [];
  const columns = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);
  const { Button, WidgetShell } = host.ui;
  host.useWidgetLifecycle({
    refresh: response.refetch,
    exportData: () => ({ data: rows, columns }),
  });

  return (
    <WidgetShell
      loading={response.isLoading}
      error={Boolean(response.error)}
      errorMessage={response.error?.message}
      data={rows}
      lastUpdated={response.lastUpdated}
      toolbar={
        <label>
          Symbol
          <input
            aria-label="Symbol"
            value={typeof parameters.symbol === "string" ? parameters.symbol : ""}
            onChange={(event) => setParameters({ symbol: event.target.value })}
          />
        </label>
      }
    >
      <div className="basic-widget">
        <Button onClick={() => void response.refetch()} disabled={response.isFetching}>
          Refresh
        </Button>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} aria-selected={state.selectedRow === index}>
                {columns.map((column) => (
                  <td key={column}>
                    <button
                      type="button"
                      onClick={() => setState({ selectedRow: index })}
                    >
                      {typeof row[column] === "object"
                        ? JSON.stringify(row[column])
                        : String(row[column] ?? "")}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

export default definePlugin(packageJson, {
  setup(pluginHost) {
    host = pluginHost;
  },
  renderers: [
    {
      name: "table",
      title: "Basic table",
      kind: "table",
      inputSchema: { type: "array", items: { type: "object" } },
      parameterSchema: { type: "object", properties: { symbol: { type: "string" } } },
      stateSchema: {
        type: "object",
        properties: { selectedRow: { type: "integer", minimum: 0 } },
      },
      capabilities: ["data-export", "refresh"],
      Component: BasicWidget,
    },
  ],
});
