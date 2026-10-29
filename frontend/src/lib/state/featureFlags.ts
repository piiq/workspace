import isEqual from "lodash.isequal";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import type { Selector } from "./app";

export type FeatureFlags = {
  admin_access: boolean; // show admin panel
  allow_custom_backends: boolean;
  can_submit_marketplace: boolean; // developer may submit marketplace apps
};

export type Usage = {
  number_copilot_calls_day_count: number;
  total_file_upload_size_gb_count: number;
  copilot_calls_limit: number;
  file_upload_size_limit: number;
};

type FeatureFlagsState = {
  featureFlags: FeatureFlags | null;
  setFeatureFlags: (flags: Partial<FeatureFlags>) => void;
  usage: Usage | null;
  setUsage: (usage: Usage) => void;
  updateFeatureFlagsAndUsage: (
    flags: Partial<FeatureFlags>,
    usage: Partial<Usage>,
  ) => void;
  setFeatureFlagsAndUsage: (flags: FeatureFlags, usage: Usage) => void;
};

export const useFeatureFlagsStore = createWithEqualityFn<FeatureFlagsState>()(
  subscribeWithSelector((set) => ({
    featureFlags: null,
    usage: null,
    setUsage: (usage) => set((state) => ({ usage: { ...state.usage, ...usage } })),
    setFeatureFlags: (flags) =>
      set((state) => ({
        featureFlags: { ...state.featureFlags, ...flags },
      })),
    updateFeatureFlagsAndUsage: (flags, usage) =>
      set((state) => ({
        featureFlags: { ...state.featureFlags, ...flags },
        usage: { ...state.usage, ...usage },
      })),
    setFeatureFlagsAndUsage: (flags, usage) =>
      set(() => ({
        featureFlags: flags,
        usage: usage,
      })),
  })),
  shallow,
);

export function useShallowFeatureFlagsStore<S extends FeatureFlagsState, T>(
  selector: Selector<S, T>,
): T {
  return useFeatureFlagsStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}
