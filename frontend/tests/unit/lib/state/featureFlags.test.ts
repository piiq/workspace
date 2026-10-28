import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type FeatureFlags,
  type Usage,
  useFeatureFlagsStore,
} from "~/lib/state/featureFlags";

const createMockFeatureFlags = (
  overrides: Partial<FeatureFlags> = {},
): FeatureFlags => ({
  admin_access: true,
  bring_your_own_copilot: true,
  bring_your_own_data: true,
  excel_add_in: true,
  number_copilot_calls_day: 100,
  share_widgets: "private",
  support: true,
  tier: "pro",
  total_file_upload_size_gb: 50,
  is_trial: false,
  can_submit_marketplace: false,
  ...overrides,
});

const createMockUsage = (overrides: Partial<Usage> = {}): Usage => ({
  number_copilot_calls_day_count: 10,
  total_file_upload_size_gb_count: 5,
  copilot_calls_limit: 100,
  file_upload_size_limit: 50,
  ...overrides,
});

describe("useFeatureFlagsStore", () => {
  beforeEach(() => {
    useFeatureFlagsStore.setState({
      featureFlags: null,
      usage: null,
    });
  });

  afterEach(() => {
    useFeatureFlagsStore.setState({
      featureFlags: null,
      usage: null,
    });
  });

  describe("initial state", () => {
    it("should have null featureFlags initially", () => {
      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags).toBeNull();
    });

    it("should have null usage initially", () => {
      const { usage } = useFeatureFlagsStore.getState();
      expect(usage).toBeNull();
    });

    it("should have all required action functions", () => {
      const state = useFeatureFlagsStore.getState();
      expect(typeof state.setFeatureFlags).toBe("function");
      expect(typeof state.setUsage).toBe("function");
      expect(typeof state.updateFeatureFlagsAndUsage).toBe("function");
      expect(typeof state.setFeatureFlagsAndUsage).toBe("function");
    });
  });

  describe("setFeatureFlags", () => {
    it("should set feature flags from null state", () => {
      const flags = createMockFeatureFlags();
      useFeatureFlagsStore.getState().setFeatureFlags(flags);

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags).toEqual(flags);
    });

    it("should merge partial feature flags with existing state", () => {
      const initialFlags = createMockFeatureFlags({ tier: "pro", admin_access: true });
      useFeatureFlagsStore.setState({ featureFlags: initialFlags });

      useFeatureFlagsStore
        .getState()
        .setFeatureFlags({ tier: "terminal", support: false });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.tier).toBe("terminal");
      expect(featureFlags?.support).toBe(false);
      expect(featureFlags?.admin_access).toBe(true);
    });

    it("should update only specified fields", () => {
      const initialFlags = createMockFeatureFlags({
        number_copilot_calls_day: 100,
        total_file_upload_size_gb: 50,
      });
      useFeatureFlagsStore.setState({ featureFlags: initialFlags });

      useFeatureFlagsStore
        .getState()
        .setFeatureFlags({ number_copilot_calls_day: 200 });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.number_copilot_calls_day).toBe(200);
      expect(featureFlags?.total_file_upload_size_gb).toBe(50);
    });

    it("should handle changing share_widgets from private to public", () => {
      const flags = createMockFeatureFlags({ share_widgets: "private" });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      useFeatureFlagsStore.getState().setFeatureFlags({ share_widgets: "public" });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.share_widgets).toBe("public");
    });
  });

  describe("setUsage", () => {
    it("should set usage from null state", () => {
      const usage = createMockUsage();
      useFeatureFlagsStore.getState().setUsage(usage);

      const state = useFeatureFlagsStore.getState();
      expect(state.usage).toEqual(usage);
    });

    it("should merge partial usage with existing state", () => {
      const initialUsage = createMockUsage({
        number_copilot_calls_day_count: 10,
        total_file_upload_size_gb_count: 5,
      });
      useFeatureFlagsStore.setState({ usage: initialUsage });

      useFeatureFlagsStore
        .getState()
        .setUsage({ number_copilot_calls_day_count: 20 } as Usage);

      const { usage } = useFeatureFlagsStore.getState();
      expect(usage?.number_copilot_calls_day_count).toBe(20);
      expect(usage?.total_file_upload_size_gb_count).toBe(5);
    });

    it("should update copilot calls limit", () => {
      const initialUsage = createMockUsage({ copilot_calls_limit: 100 });
      useFeatureFlagsStore.setState({ usage: initialUsage });

      useFeatureFlagsStore.getState().setUsage({ copilot_calls_limit: 200 } as Usage);

      const { usage } = useFeatureFlagsStore.getState();
      expect(usage?.copilot_calls_limit).toBe(200);
    });

    it("should update file upload size limit", () => {
      const initialUsage = createMockUsage({ file_upload_size_limit: 50 });
      useFeatureFlagsStore.setState({ usage: initialUsage });

      useFeatureFlagsStore
        .getState()
        .setUsage({ file_upload_size_limit: 100 } as Usage);

      const { usage } = useFeatureFlagsStore.getState();
      expect(usage?.file_upload_size_limit).toBe(100);
    });
  });

  describe("setFeatureFlagsAndUsage", () => {
    it("should set both feature flags and usage at once", () => {
      const flags = createMockFeatureFlags();
      const usage = createMockUsage();

      useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(flags, usage);

      const state = useFeatureFlagsStore.getState();
      expect(state.featureFlags).toEqual(flags);
      expect(state.usage).toEqual(usage);
    });

    it("should completely replace existing feature flags", () => {
      const initialFlags = createMockFeatureFlags({ tier: "pro", admin_access: true });
      const initialUsage = createMockUsage();
      useFeatureFlagsStore.setState({
        featureFlags: initialFlags,
        usage: initialUsage,
      });

      const newFlags = createMockFeatureFlags({
        tier: "terminal",
        admin_access: false,
      });
      const newUsage = createMockUsage({ number_copilot_calls_day_count: 50 });

      useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(newFlags, newUsage);

      const state = useFeatureFlagsStore.getState();
      expect(state.featureFlags).toEqual(newFlags);
      expect(state.usage).toEqual(newUsage);
    });

    it("should handle initial login scenario", () => {
      expect(useFeatureFlagsStore.getState().featureFlags).toBeNull();
      expect(useFeatureFlagsStore.getState().usage).toBeNull();

      const flags = createMockFeatureFlags({ tier: "pro", is_trial: true });
      const usage = createMockUsage({ number_copilot_calls_day_count: 0 });

      useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(flags, usage);

      const state = useFeatureFlagsStore.getState();
      expect(state.featureFlags?.tier).toBe("pro");
      expect(state.featureFlags?.is_trial).toBe(true);
      expect(state.usage?.number_copilot_calls_day_count).toBe(0);
    });
  });

  describe("updateFeatureFlagsAndUsage", () => {
    it("should partially update both feature flags and usage", () => {
      const initialFlags = createMockFeatureFlags({
        tier: "pro",
        number_copilot_calls_day: 100,
      });
      const initialUsage = createMockUsage({
        number_copilot_calls_day_count: 10,
        copilot_calls_limit: 100,
      });
      useFeatureFlagsStore.setState({
        featureFlags: initialFlags,
        usage: initialUsage,
      });

      useFeatureFlagsStore
        .getState()
        .updateFeatureFlagsAndUsage(
          { number_copilot_calls_day: 200 },
          { copilot_calls_limit: 200 },
        );

      const state = useFeatureFlagsStore.getState();
      expect(state.featureFlags?.tier).toBe("pro");
      expect(state.featureFlags?.number_copilot_calls_day).toBe(200);
      expect(state.usage?.number_copilot_calls_day_count).toBe(10);
      expect(state.usage?.copilot_calls_limit).toBe(200);
    });

    it("should preserve unmodified fields in both states", () => {
      const initialFlags = createMockFeatureFlags();
      const initialUsage = createMockUsage();
      useFeatureFlagsStore.setState({
        featureFlags: initialFlags,
        usage: initialUsage,
      });

      useFeatureFlagsStore
        .getState()
        .updateFeatureFlagsAndUsage({ support: false }, {});

      const state = useFeatureFlagsStore.getState();
      expect(state.featureFlags?.admin_access).toBe(true);
      expect(state.featureFlags?.bring_your_own_copilot).toBe(true);
      expect(state.featureFlags?.support).toBe(false);
      expect(state.usage).toEqual(initialUsage);
    });
  });

  describe("tier-based feature access logic", () => {
    it("should correctly identify pro tier", () => {
      const flags = createMockFeatureFlags({ tier: "pro" });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.tier).toBe("pro");
    });

    it("should correctly identify terminal tier", () => {
      const flags = createMockFeatureFlags({ tier: "terminal" });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.tier).toBe("terminal");
    });

    it("should handle pro tier with limited features", () => {
      const flags = createMockFeatureFlags({
        tier: "pro",
        admin_access: false,
        bring_your_own_copilot: false,
        bring_your_own_data: false,
        excel_add_in: false,
        support: false,
      });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.tier).toBe("pro");
      expect(featureFlags?.admin_access).toBe(false);
      expect(featureFlags?.bring_your_own_copilot).toBe(false);
    });

    it("should handle terminal tier with full features", () => {
      const flags = createMockFeatureFlags({
        tier: "terminal",
        admin_access: true,
        bring_your_own_copilot: true,
        bring_your_own_data: true,
        excel_add_in: true,
        support: true,
        share_widgets: "public",
      });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.tier).toBe("terminal");
      expect(featureFlags?.admin_access).toBe(true);
      expect(featureFlags?.share_widgets).toBe("public");
    });

    it("should handle trial state correctly", () => {
      const flags = createMockFeatureFlags({
        tier: "pro",
        is_trial: true,
      });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.is_trial).toBe(true);
    });

    it("should handle non-trial state correctly", () => {
      const flags = createMockFeatureFlags({
        tier: "terminal",
        is_trial: false,
      });
      useFeatureFlagsStore.setState({ featureFlags: flags });

      const { featureFlags } = useFeatureFlagsStore.getState();
      expect(featureFlags?.is_trial).toBe(false);
    });
  });

  describe("usage limits and tracking", () => {
    it("should track copilot calls approaching limit", () => {
      const usage = createMockUsage({
        number_copilot_calls_day_count: 95,
        copilot_calls_limit: 100,
      });
      useFeatureFlagsStore.setState({ usage });

      const state = useFeatureFlagsStore.getState();
      expect(state.usage?.number_copilot_calls_day_count).toBe(95);
      expect(state.usage?.copilot_calls_limit).toBe(100);

      const remainingCalls =
        state.usage!.copilot_calls_limit - state.usage!.number_copilot_calls_day_count;
      expect(remainingCalls).toBe(5);
    });

    it("should track file upload usage", () => {
      const usage = createMockUsage({
        total_file_upload_size_gb_count: 45,
        file_upload_size_limit: 50,
      });
      useFeatureFlagsStore.setState({ usage });

      const state = useFeatureFlagsStore.getState();
      expect(state.usage?.total_file_upload_size_gb_count).toBe(45);
      expect(state.usage?.file_upload_size_limit).toBe(50);

      const remainingStorage =
        state.usage!.file_upload_size_limit -
        state.usage!.total_file_upload_size_gb_count;
      expect(remainingStorage).toBe(5);
    });

    it("should handle usage at limit", () => {
      const usage = createMockUsage({
        number_copilot_calls_day_count: 100,
        copilot_calls_limit: 100,
      });
      useFeatureFlagsStore.setState({ usage });

      const state = useFeatureFlagsStore.getState();
      const remaining =
        state.usage!.copilot_calls_limit - state.usage!.number_copilot_calls_day_count;
      expect(remaining).toBe(0);
    });

    it("should handle usage exceeding limit", () => {
      const usage = createMockUsage({
        number_copilot_calls_day_count: 105,
        copilot_calls_limit: 100,
      });
      useFeatureFlagsStore.setState({ usage });

      const state = useFeatureFlagsStore.getState();
      const remaining =
        state.usage!.copilot_calls_limit - state.usage!.number_copilot_calls_day_count;
      expect(remaining).toBe(-5);
    });
  });

  describe("store subscription behavior", () => {
    it("should support selector subscriptions", () => {
      let tierUpdates = 0;
      const unsubscribe = useFeatureFlagsStore.subscribe(
        (state) => state.featureFlags?.tier,
        () => {
          tierUpdates++;
        },
      );

      useFeatureFlagsStore
        .getState()
        .setFeatureFlags(createMockFeatureFlags({ tier: "pro" }));
      useFeatureFlagsStore.getState().setFeatureFlags({ tier: "terminal" });

      expect(tierUpdates).toBe(2);

      unsubscribe();
    });

    it("should not trigger subscription when value unchanged", () => {
      let tierUpdates = 0;
      useFeatureFlagsStore
        .getState()
        .setFeatureFlags(createMockFeatureFlags({ tier: "pro" }));

      const unsubscribe = useFeatureFlagsStore.subscribe(
        (state) => state.featureFlags?.tier,
        () => {
          tierUpdates++;
        },
      );

      useFeatureFlagsStore.getState().setFeatureFlags({ admin_access: false });

      expect(tierUpdates).toBe(0);

      unsubscribe();
    });
  });
});
