import { getAgGrid } from "@piiq/workspace-plugin-sdk/ag-grid";
import { act, renderHook } from "@testing-library/react";
import { ModuleRegistry } from "ag-grid-community";
import { useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { pluginApi, pluginHost } from "~/lib/plugins/host";
import { useThemeStore } from "~/lib/state/theme";

const originalTheme = useThemeStore.getState().theme;
afterEach(() => useThemeStore.setState({ theme: originalTheme }));

describe("plugin host bindings", () => {
  it("shares application React, ReactDOM, and the AG Community registry", () => {
    expect(pluginApi.host).toBe(pluginHost);
    expect(pluginHost.react.useState).toBe(useState);
    expect(pluginHost.reactDom.createPortal).toBe(createPortal);
    expect(pluginHost.reactDomClient.createRoot).toBe(createRoot);
    expect(getAgGrid(pluginApi.host).ModuleRegistry).toBe(ModuleRegistry);
  });

  it("updates plugin consumers when the application theme changes", () => {
    useThemeStore.setState({ theme: "dark" });
    const { result } = renderHook(() => pluginHost.useTheme());
    expect(result.current).toBe("dark");
    act(() => useThemeStore.setState({ theme: "light" }));
    expect(result.current).toBe("light");
  });

  it("reports a missing AG Grid host binding", () => {
    expect(() => getAgGrid({} as typeof pluginApi.host)).toThrow(
      "The plugin host does not provide AG Grid.",
    );
  });
});
