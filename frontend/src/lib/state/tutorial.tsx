import dayjs from "dayjs";
import isEqual from "lodash.isequal";

import posthog from "posthog-js";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { updateZeroToHero } from "~/api/auth.api";
import type { Challenges } from "~/types/auth.type";
import type { KeySelector, Selector } from "./app";

const TUTORIALS: Challenges = {
  data_connectors: null,
};

function combineVersions(oldTutorial: Challenges, newTutorial: Challenges): Challenges {
  const cleaned = Object.entries(newTutorial).map(([key, value]) => [
    key,
    value || oldTutorial[key] || null,
  ]);
  return Object.fromEntries(cleaned);
}

export const TUTORIAL_STEPS = {
  data_connectors: [
    {
      title: "Import your data",
      targetElementSelector: "._add_data_button",
      description: `<div>
        <img src="/assets/images/home/tutorials/Data-Connectors.gif" class="w-full h-[182px] rounded mb-2" />
        Import data into the Workspace from JSON-enabled endpoints, unlocking OpenBB's powerful features like generative AI and chart creation
        </div>`,
    },
    {
      title: "Step 1 of 5",
      targetElementSelector: "._add_data_button",
      description: "Click '+ Add Data' to see all of the different data you can add.",
    },
    {
      title: "Step 2 of 5",
      targetElementSelector: "._button_single",
      description: "Click 'Add Single Widget' and complete all required fields.",
    },
    {
      title: "Step 3 of 5",
      targetElementSelector: "._test-single-widget",
      description: `<div>
      After filling in the fields, always run a test for validation.
      <br />
      <div>
        Here are some examples for the fields:
        <ul class="mt-1 space-y-1">
          <li>
            <strong class="mr-0.5">Name:</strong> <code class="text-[11px]">Crypto Top Protocols</code>
          </li>
          <li>
            <strong class="mr-0.5">Endpoint URL:</strong> <code class="text-[11px]">https://api.llama.fi/protocols</code>
          </li>
          </ul>
      </div>
      </div>`,
      side: "bottom",
    },
    {
      title: "Step 4 of 5",
      targetElementSelector: "._add-single-widget",
      description:
        "If the test is successful, you can add the widget to the Workspace.",
      side: "bottom",
    },
    {
      title: "Step 5 of 5",
      targetElementSelector: "._toast-success",
      description: "Now you can add the widget to your dashboard.",
    },
  ],
};

interface TutorialState {
  currentTutorial: string | null;
  currentStep: number;
  tutorials: Challenges;
  startTutorial: (tutorialName: string) => void;
  restartTutorial: (tutorialName: string) => void;
  endTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setCompletedDates: (challenges: Challenges) => void;
}

export interface TutorialStep {
  targetElementSelector: string;
  title: string;
  description: string;
  side?: "top" | "bottom";
  delay?: number;
  onBeforeNext?: () => void;
}

export const useTutorialStore = createWithEqualityFn<TutorialState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        currentTutorial: null,
        currentStep: 0,
        tutorials: TUTORIALS,
        restartTutorial: (tutorialName) => {
          if (posthog) {
            posthog.capture("Started_Tutorial", {
              tutorial: tutorialName,
            });
          }
          set((state) => {
            return {
              currentTutorial: tutorialName,
              currentStep: 0,
              tutorials: {
                ...state.tutorials,
                [tutorialName]: null,
              },
            };
          });
        },
        startTutorial: (tutorialName) => {
          set((state) => {
            if (!state.tutorials[tutorialName]) {
              return { currentTutorial: tutorialName, currentStep: 0 };
            }
            return {};
          });
        },
        setCompletedDates: (challenges: Challenges) => {
          // This overcomplication can be removed in the future, for now we need to sync
          // users existing localstorage save with their new save in the cloud
          const { tutorials } = useTutorialStore.getState();
          const combined = combineVersions(tutorials, challenges);
          if (!isEqual(challenges, combined)) {
            updateZeroToHero(combined);
          }
          set({ tutorials: combined });
        },
        endTutorial: () => {
          const state = useTutorialStore.getState();
          const tutorials = {
            ...state.tutorials,
            [state.currentTutorial]: dayjs().toISOString(),
          };
          updateZeroToHero(tutorials);

          set((state) => {
            if (state.currentTutorial) {
              return {
                currentTutorial: null,
                currentStep: 0,
                tutorials,
              };
            }
            return {};
          });
        },
        nextStep: () =>
          set((state) => {
            return { currentStep: state.currentStep + 1 };
          }),
        prevStep: () =>
          set((state) => {
            return { currentStep: state.currentStep - 1 };
          }),
        goToStep: (step: number) => set({ currentStep: step }),
      }),
      {
        name: "tutorial-storage",
        version: 4,
        migrate: async (persistedState: any, version: number) => {
          if (version < 4) {
            persistedState.tutorials = Object.fromEntries(
              Object.entries(persistedState.tutorials).map(([key, value]) => [
                key,
                // @ts-expect-error
                value?.completedDate || null,
              ]),
            );
          } else {
            persistedState.tutorials = TUTORIALS;
          }
          return persistedState;
        },
      },
    ),
  ),
  shallow,
);

export function useShallowTutorialStore<S extends TutorialState, T>(
  selector: Selector<S, T>,
): T {
  return useTutorialStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

// POC

// Instead of:
//      const { tutorials, startTutorial } = useShallowTutorialStore((state) => ({
//        tutorials: state.tutorials,
//        startTutorial: state.startTutorial,
//      }));

// We can use:
//      const { tutorials, startTutorial } = useShallowKeySelector("tutorials","startTutorial");
//
export function useShallowKeySelector<S extends TutorialState, K extends keyof S>(
  ...selector: KeySelector<S, K>[]
): Pick<S, K> {
  return useTutorialStore(
    useShallow((state: S) => {
      const result: any = {};
      for (const key of selector) {
        result[key] = state[key];
      }
      return result;
    }),
  );
}
