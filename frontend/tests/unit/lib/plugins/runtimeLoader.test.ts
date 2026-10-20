import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPlugin } from "~/lib/plugins/loadPlugin";
import { loadRuntimePlugins } from "~/lib/plugins/runtimeLoader";

vi.mock("~/lib/plugins/host", () => ({ pluginApi: undefined }));
vi.mock("~/lib/plugins/loadPlugin", () => ({ loadPlugin: vi.fn() }));

const config = {
  runtimeEnabled: true,
  manifestUrl: "https://plugins.test/plugins.json",
};

function response(data: unknown, status = 200, url = "") {
  const result = new Response(JSON.stringify(data), { status });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(loadPlugin).mockReset();
});

describe("runtime plugin selections", () => {
  it("does not fetch when runtime loading is disabled", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await loadRuntimePlugins({ ...config, runtimeEnabled: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(loadPlugin).not.toHaveBeenCalled();
  });

  it("resolves descriptor URLs beside the final manifest URL and ignores build selections", async () => {
    const descriptor = { name: "@test/example", entry: "entry.js" };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          {
            plugins: [
              { mode: "build", source: { path: "../plugin" } },
              { mode: "runtime", descriptorUrl: "../example/plugin.json" },
              { mode: "runtime", descriptorUrl: "https://other.test/plugin.json" },
            ],
          },
          200,
          "https://cdn.test/deployment/plugins.json",
        ),
      )
      .mockResolvedValueOnce(
        response(descriptor, 200, "https://assets.test/example/plugin.json"),
      )
      .mockResolvedValueOnce(response(descriptor));
    vi.stubGlobal("fetch", fetch);
    await loadRuntimePlugins(config);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      config.manifestUrl,
      "https://cdn.test/example/plugin.json",
      "https://other.test/plugin.json",
    ]);
    expect(fetch).toHaveBeenCalledWith(config.manifestUrl, { cache: "no-store" });
    expect(vi.mocked(loadPlugin).mock.calls[0][0]).toMatchObject({
      descriptor,
      baseUrl: "https://assets.test/example/plugin.json",
    });
    expect(vi.mocked(loadPlugin).mock.calls[1][0].baseUrl).toBe(
      "https://other.test/plugin.json",
    );
  });

  it.each([
    "missing-url",
    "http",
    "invalid-manifest",
  ])("reports %s without preventing application startup", async (failure) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValue(
        response(
          failure === "invalid-manifest" ? { plugins: [{}] } : {},
          failure === "http" ? 503 : 200,
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await loadRuntimePlugins({
      ...config,
      manifestUrl: failure === "missing-url" ? "" : config.manifestUrl,
    });
    expect(error).toHaveBeenCalledWith(
      "Could not load runtime plugin manifest",
      expect.any(Error),
    );
    expect(loadPlugin).not.toHaveBeenCalled();
  });

  it("continues to other selections after a descriptor request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const descriptor = { name: "@test/other", entry: "entry.js" };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          plugins: [
            { mode: "runtime", descriptorUrl: "http://[" },
            { mode: "runtime", descriptorUrl: "missing/plugin.json" },
            { mode: "runtime", descriptorUrl: "other/plugin.json" },
          ],
        }),
      )
      .mockResolvedValueOnce(response({}, 404))
      .mockResolvedValueOnce(response(descriptor));
    vi.stubGlobal("fetch", fetch);
    await loadRuntimePlugins(config);
    expect(loadPlugin).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadPlugin).mock.calls[0][0].descriptor).toEqual(descriptor);
  });
});
