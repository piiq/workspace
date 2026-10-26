import {
  createPluginDescriptor,
  definePlugin,
  type PluginHost,
} from "@piiq/workspace-plugin-sdk";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginApi } from "~/lib/plugins/api";
import { loadPlugin, type PluginBundle } from "~/lib/plugins/loadPlugin";
import { PluginRegistry } from "~/lib/plugins/registry";

vi.mock("~/lib/plugins/host", () => ({ pluginApi: undefined }));

function selection(name = "@test/example"): PluginBundle {
  const definition = definePlugin(
    { name, version: "1.0.0" },
    {
      renderers: [{ name: "table", title: "Example", Component: () => null }],
    },
  );
  return {
    descriptor: createPluginDescriptor(definition, { entry: "entry.js" }),
    baseUrl: "/plugins/test/example/",
    load: vi.fn(async () => ({ register: (api) => api.registerPlugin(definition) })),
  };
}

afterEach(() => {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => link.remove());
  vi.restoreAllMocks();
});

describe("plugin registration", () => {
  it("awaits setup when an entry registers without returning the registration promise", async () => {
    const registry = new PluginRegistry();
    const api = createPluginApi({} as PluginHost, registry);
    let finishSetup!: () => void;
    const setup = new Promise<void>((resolve) => {
      finishSetup = resolve;
    });
    const definition = definePlugin(
      { name: "@test/example", version: "1.0.0" },
      {
        setup: () => setup,
        renderers: [{ name: "table", title: "Example", Component: () => null }],
      },
    );
    const plugin = selection();
    plugin.load = async () => ({
      register(api) {
        void api.registerPlugin(definition);
      },
    });
    let finished = false;
    const loaded = loadPlugin(plugin, api, registry).then(() => {
      finished = true;
    });
    await waitFor(() =>
      expect(registry.getRendererState("@test/example/table").status).toBe("pending"),
    );
    expect(finished).toBe(false);
    finishSetup();
    await loaded;
    expect(registry.getRendererState("@test/example/table").status).toBe("ready");
  });

  it("awaits registration and loads descriptor-relative styles", async () => {
    const registry = new PluginRegistry();
    const api = createPluginApi({} as PluginHost, registry);
    const plugin = selection();
    plugin.descriptor.assets = [
      "assets/style.css",
      "vendor/library.css",
      "assets/image.svg",
    ];
    plugin.descriptor.styles = ["assets/style.css"];
    const loaded = loadPlugin(plugin, api, registry);
    await waitFor(() => expect(document.querySelector("link")).not.toBeNull());
    const link = document.querySelector("link")!;
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(1);
    expect(link.getAttribute("href")).toContain(
      "/plugins/test/example/assets/style.css",
    );
    expect(plugin.load).not.toHaveBeenCalled();
    link.dispatchEvent(new Event("load"));
    await loaded;
    expect(registry.getRendererState("@test/example/table").status).toBe("ready");
  });

  it.each([
    "import",
    "stylesheet",
    "missing-registration",
    "wrong-identity",
    "incompatible-api",
  ])("reports %s failures and loads other plugins", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = new PluginRegistry();
    const api = createPluginApi({} as PluginHost, registry);
    const plugin = selection();
    if (failure === "import")
      plugin.load = async () => {
        throw new Error("Missing entry.js");
      };
    if (failure === "stylesheet") plugin.descriptor.styles = ["missing.css"];
    if (failure === "missing-registration")
      plugin.load = async () => ({ register() {} });
    if (failure === "wrong-identity") plugin.descriptor.version = "2.0.0";
    if (failure === "incompatible-api") plugin.descriptor.apiVersion = 2 as 1;
    const loaded = (async () => {
      await loadPlugin(plugin, api, registry);
      await loadPlugin(selection("@test/other"), api, registry);
    })();
    if (failure === "stylesheet") {
      await waitFor(() => expect(document.querySelector("link")).not.toBeNull());
      document.querySelector("link")!.dispatchEvent(new Event("error"));
    }
    await loaded;
    expect(registry.getRendererState("@test/example/table")).toMatchObject({
      status: "failed",
    });
    expect(registry.getRendererState("@test/other/table").status).toBe("ready");
  });

  it("rejects duplicate registration without replacing the available renderer", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const registry = new PluginRegistry();
    const api = createPluginApi({} as PluginHost, registry);
    await loadPlugin(selection(), api, registry);
    await loadPlugin(selection(), api, registry);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Plugin already registered: @test/example" }),
    );
    expect(registry.getRendererState("@test/example/table").status).toBe("ready");
  });
});
