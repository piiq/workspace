import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "~/api/api";
import { getUserSubscriptions, SUBSCRIPTIONS_QUERY_KEY } from "~/api/auth.api";
import { createURLString } from "~/lib/utils/widgetParams";
import type { ListedApp } from "~/types/listedApps";

async function fetchListedApps(): Promise<ListedApp[]> {
  const { data } = await apiClient.get<ListedApp[]>("/marketplace/apps");
  for (const app of data) {
    for (const img_key of ["img", "img_dark", "img_light"]) {
      if (!app?.appImages?.[img_key]) continue;
      app.appImages[img_key] = createURLString(app.appImages[img_key], app.backendUrl);
    }
  }

  return data;
}

export function useListedApps() {
  return useQuery({
    queryKey: ["listedApps"],
    queryFn: fetchListedApps,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
  });
}

export function useUserSubscriptions() {
  return useQuery({
    queryKey: SUBSCRIPTIONS_QUERY_KEY,
    queryFn: getUserSubscriptions,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });
}
