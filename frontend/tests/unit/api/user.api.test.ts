import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import { sendInvite, updateUserDisplaySettings } from "~/api/user.api";

// Mock apiClient
vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock useThemeStore
vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: vi.fn().mockReturnValue({
      getDisplaySettings: vi.fn().mockReturnValue({ theme: "dark" }),
    }),
  },
}));

describe("User API functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendInvite", () => {
    it("should send an invite successfully", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValue({
        data: { success: true },
        status: 200,
      });

      const response = await sendInvite("test@example.com", "Welcome!");
      expect(response).toEqual({ data: { success: true }, status: 200 });
      expect(apiClient.post).toHaveBeenCalledWith("/pro/invites/create", {
        email: "test@example.com",
        message: "Welcome!",
      });
    });

    it("should handle errors when sending an invite", async () => {
      const error = { response: { status: 500 } };
      vi.spyOn(apiClient, "post").mockRejectedValue(error);

      const response = await sendInvite("test@example.com", "Welcome!");
      expect(response).toEqual({ data: { success: false }, status: 500 });
    });
  });

  describe("updateUserDisplaySettings", () => {
    it("should update display settings with provided settings", async () => {
      const settings = { theme: "light" };
      vi.spyOn(apiClient, "post").mockResolvedValue({});

      // @ts-expect-error - theme: string is not assignable to DisplaySettings object
      await updateUserDisplaySettings(settings);
      expect(apiClient.post).toHaveBeenCalledWith("/pro/display-settings", settings);
    });

    it("should update display settings with default settings if none provided", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValue({});

      await updateUserDisplaySettings();
      expect(apiClient.post).toHaveBeenCalledWith("/pro/display-settings", {
        theme: "dark",
      });
    });

    it("should log an error if updating display settings fails", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Network error");
      vi.spyOn(apiClient, "post").mockRejectedValue(error);

      await updateUserDisplaySettings();
      expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    });
  });
});
