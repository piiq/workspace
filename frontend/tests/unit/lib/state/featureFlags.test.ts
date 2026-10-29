import { beforeEach, expect, it } from "vitest";
import { type Usage, useFeatureFlagsStore } from "~/lib/state/featureFlags";

const usage: Usage = {
  number_copilot_calls_day_count: 10,
  total_file_upload_size_gb_count: 5,
  copilot_calls_limit: 100,
  file_upload_size_limit: 50,
};

beforeEach(() => {
  useFeatureFlagsStore.setState({ featureFlags: null, usage: null });
});

it("keeps account permissions separate from resource limits", () => {
  const permissions = { admin_access: false, allow_custom_backends: true, can_submit_marketplace: true };
  useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(permissions, usage);
  expect(useFeatureFlagsStore.getState().featureFlags).toEqual(permissions);
  expect(useFeatureFlagsStore.getState().usage).toEqual(usage);
});

it("merges permission updates without changing usage", () => {
  useFeatureFlagsStore
    .getState()
    .setFeatureFlagsAndUsage(
      { admin_access: false, allow_custom_backends: true, can_submit_marketplace: true },
      usage,
    );
  useFeatureFlagsStore.getState().setFeatureFlags({ admin_access: true });
  expect(useFeatureFlagsStore.getState().featureFlags).toEqual({
    admin_access: true, allow_custom_backends: true,
    can_submit_marketplace: true,
  });
  expect(useFeatureFlagsStore.getState().usage).toEqual(usage);
});

it("merges usage updates without changing account permissions", () => {
  const permissions = { admin_access: false, allow_custom_backends: true, can_submit_marketplace: false };
  useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(permissions, usage);
  useFeatureFlagsStore
    .getState()
    .setUsage({ number_copilot_calls_day_count: 20 } as Usage);
  expect(useFeatureFlagsStore.getState().usage).toEqual({
    ...usage,
    number_copilot_calls_day_count: 20,
  });
  expect(useFeatureFlagsStore.getState().featureFlags).toEqual(permissions);
});

it("updates permissions and usage together", () => {
  useFeatureFlagsStore
    .getState()
    .setFeatureFlagsAndUsage(
      { admin_access: true, allow_custom_backends: true, can_submit_marketplace: false },
      usage,
    );
  useFeatureFlagsStore
    .getState()
    .updateFeatureFlagsAndUsage(
      { can_submit_marketplace: true },
      { total_file_upload_size_gb_count: 8 },
    );
  expect(useFeatureFlagsStore.getState().featureFlags).toEqual({
    admin_access: true, allow_custom_backends: true,
    can_submit_marketplace: true,
  });
  expect(useFeatureFlagsStore.getState().usage).toEqual({
    ...usage,
    total_file_upload_size_gb_count: 8,
  });
});
