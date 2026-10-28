import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateZeroToHero } from "~/api/auth.api";
import { TUTORIAL_STEPS, useTutorialStore } from "~/lib/state/tutorial";

vi.mock("~/api/auth.api", () => ({
  updateZeroToHero: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

import posthog from "posthog-js";

describe("Tutorial Store - Additional Tests", () => {
  beforeEach(() => {
    useTutorialStore.setState({
      currentTutorial: null,
      currentStep: 0,
      tutorials: { data_connectors: null },
    });
    vi.clearAllMocks();
  });

  describe("TUTORIAL_STEPS", () => {
    it("defines the data connector tutorial", () => {
      expect(TUTORIAL_STEPS.data_connectors.length).toBeGreaterThan(0);
    });

    it("each step has required properties", () => {
      for (const steps of Object.values(TUTORIAL_STEPS)) {
        for (const step of steps) {
          expect(step.title).toBeDefined();
          expect(step.description).toBeDefined();
        }
      }
    });
  });

  describe("restartTutorial", () => {
    it("should track posthog event when restarting", () => {
      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("data_connectors");

      expect(posthog.capture).toHaveBeenCalledWith("Started_Tutorial", {
        tutorial: "data_connectors",
      });
    });

    it("should clear existing completion date", () => {
      useTutorialStore.setState({
        tutorials: { data_connectors: "2023-01-01" },
      });

      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("data_connectors");

      expect(useTutorialStore.getState().tutorials.data_connectors).toBeNull();
    });

    it("should set currentStep to 0", () => {
      useTutorialStore.setState({ currentStep: 5 });

      const { restartTutorial } = useTutorialStore.getState();
      restartTutorial("data_connectors");

      expect(useTutorialStore.getState().currentStep).toBe(0);
    });
  });

  describe("startTutorial", () => {
    it("should not change state if tutorial already completed", () => {
      useTutorialStore.setState({
        tutorials: { data_connectors: "2023-06-15" },
        currentTutorial: null,
      });

      const { startTutorial } = useTutorialStore.getState();
      startTutorial("data_connectors");

      expect(useTutorialStore.getState().currentTutorial).toBeNull();
    });

    it("should start tutorial if not completed", () => {
      const { startTutorial } = useTutorialStore.getState();
      startTutorial("data_connectors");

      expect(useTutorialStore.getState().currentTutorial).toBe("data_connectors");
    });
  });

  describe("setCompletedDates", () => {
    it("keeps a local completion date when the backend has no date", () => {
      useTutorialStore.setState({
        tutorials: { data_connectors: "2023-01-15" },
      });
      useTutorialStore.getState().setCompletedDates({ data_connectors: null });
      expect(useTutorialStore.getState().tutorials.data_connectors).toBe("2023-01-15");
    });

    it("does not sync if challenges match", () => {
      const challenges = { data_connectors: "2023-01-15" };

      useTutorialStore.setState({ tutorials: { data_connectors: null } });

      const { setCompletedDates } = useTutorialStore.getState();
      setCompletedDates(challenges);

      expect(updateZeroToHero).not.toHaveBeenCalled();
    });
  });

  describe("endTutorial", () => {
    it("does nothing if no current tutorial", () => {
      useTutorialStore.setState({ currentTutorial: null });

      const { endTutorial } = useTutorialStore.getState();
      endTutorial();

      // Should still be null and no API call
      expect(useTutorialStore.getState().currentTutorial).toBeNull();
    });

    it("sets completion timestamp", () => {
      useTutorialStore.setState({
        currentTutorial: "data_connectors",
        tutorials: { data_connectors: null },
      });

      const { endTutorial } = useTutorialStore.getState();
      endTutorial();

      const tutorials = useTutorialStore.getState().tutorials;
      expect(tutorials.data_connectors).toBeTruthy();
      expect(typeof tutorials.data_connectors).toBe("string");
    });
  });

  describe("step navigation edge cases", () => {
    it("prevStep can go to negative numbers", () => {
      useTutorialStore.setState({ currentStep: 0 });

      const { prevStep } = useTutorialStore.getState();
      prevStep();

      expect(useTutorialStore.getState().currentStep).toBe(-1);
    });

    it("goToStep with very large number works", () => {
      const { goToStep } = useTutorialStore.getState();
      goToStep(999);

      expect(useTutorialStore.getState().currentStep).toBe(999);
    });
  });
});
