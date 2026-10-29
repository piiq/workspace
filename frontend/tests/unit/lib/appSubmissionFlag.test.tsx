import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockInSnowflake = false;

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get inSnowflakeNativeApp() {
      return mockInSnowflake;
    },
  };
});

import { useCanSubmitApp } from "~/lib/appSubmissionFlag";
import type { FeatureFlags } from "~/lib/state/featureFlags";
import { useFeatureFlagsStore } from "~/lib/state/featureFlags";

function setCanSubmit(can_submit_marketplace: boolean | undefined) {
  // Only the field under test matters; the rest is irrelevant to the gate.
  useFeatureFlagsStore.setState({
    featureFlags: { can_submit_marketplace } as FeatureFlags,
  });
}

describe("useCanSubmitApp", () => {
  beforeEach(() => {
    mockInSnowflake = false;
    useFeatureFlagsStore.setState({ featureFlags: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("is true when the store reports can_submit_marketplace", () => {
    setCanSubmit(true);
    const { result } = renderHook(() => useCanSubmitApp());
    expect(result.current).toBe(true);
  });

  it("is false when the flag is absent (store not yet hydrated)", () => {
    const { result } = renderHook(() => useCanSubmitApp());
    expect(result.current).toBe(false);
  });

  it("is false when can_submit_marketplace is false", () => {
    setCanSubmit(false);
    const { result } = renderHook(() => useCanSubmitApp());
    expect(result.current).toBe(false);
  });

  it("is false in the Snowflake native app even when whitelisted", () => {
    setCanSubmit(true);
    mockInSnowflake = true;
    const { result } = renderHook(() => useCanSubmitApp());
    expect(result.current).toBe(false);
  });
});
