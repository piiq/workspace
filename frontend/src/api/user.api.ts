import { useThemeStore } from "~/lib/state/theme";
import type { DisplaySettings } from "~/types/auth.type";
import { apiClient } from "./api";

export interface Challenges {
  grouping: boolean;
  table_charting: boolean;
  data_connectors: boolean;
  charting: boolean;
  group_sector_companies: boolean;
}

export async function sendInvite(
  email: string,
  message: string,
): Promise<{
  data: { success: boolean };
  status: number;
}> {
  if (!message) {
    message = null;
  }
  try {
    const { data, status } = await apiClient.post<{ success: boolean }>(
      "/pro/invites/create",
      {
        email,
        message,
      },
    );
    return { data, status };
  } catch (e) {
    return { data: { success: false }, status: e.response.status };
  }
}

export async function updateUserDisplaySettings(settings: DisplaySettings = null) {
  if (!settings) {
    settings = useThemeStore.getState().getDisplaySettings();
  }

  apiClient.post("/pro/display-settings", settings).catch((e) => {
    console.error(e);
  });
}
