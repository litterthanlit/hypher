import { describe, expect, it } from "vitest";
import {
  ONBOARDING_TARGETS,
  ONBOARDING_TOUR_STEPS,
  getNextOnboardingTourIndex,
  getOnboardingTourStep,
  shouldRunOnboardingTour,
  shouldShowOnboardingWelcome,
  type OnboardingState,
} from "./onboarding";

const signedInReady = {
  isSignedIn: true,
  isReady: true,
  hasWorkspaceData: true,
};

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    demoSeeded: true,
    ...overrides,
  };
}

describe("onboarding welcome state", () => {
  it("shows welcome when onboardingWelcomeSeenAt is missing", () => {
    expect(shouldShowOnboardingWelcome(state(), signedInReady)).toBe(true);
  });

  it("hides welcome after it is marked seen", () => {
    expect(
      shouldShowOnboardingWelcome(
        state({ onboardingWelcomeSeenAt: 1_700_000_000_000 }),
        signedInReady
      )
    ).toBe(false);
  });

  it("does not show before app data is ready", () => {
    expect(
      shouldShowOnboardingWelcome(state(), {
        ...signedInReady,
        isReady: false,
      })
    ).toBe(false);
  });

  it("does not let demoSeeded false block existing users forever", () => {
    expect(
      shouldShowOnboardingWelcome(
        state({ demoSeeded: false }),
        { ...signedInReady, hasWorkspaceData: true }
      )
    ).toBe(true);
  });
});

describe("onboarding tour state", () => {
  it("runs after welcome is seen and before tour completion", () => {
    expect(shouldRunOnboardingTour(state({ onboardingWelcomeSeenAt: 1 }))).toBe(true);
  });

  it("hides after completion", () => {
    expect(
      shouldRunOnboardingTour(
        state({ onboardingWelcomeSeenAt: 1, onboardingTourCompletedAt: 2 })
      )
    ).toBe(false);
  });
});

describe("onboarding tour steps", () => {
  it("orders capture, dashboard memory, then digest", () => {
    expect(ONBOARDING_TOUR_STEPS.map((step) => step.id)).toEqual([
      "capture",
      "memory",
      "digest",
    ]);
  });

  it("uses stable target ids", () => {
    expect(ONBOARDING_TOUR_STEPS.map((step) => step.target)).toEqual([
      ONBOARDING_TARGETS.captureInput,
      ONBOARDING_TARGETS.dashboardMemory,
      ONBOARDING_TARGETS.dailyDigest,
    ]);
  });

  it("returns null after the final step instead of looping", () => {
    expect(getOnboardingTourStep(0)?.id).toBe("capture");
    expect(getNextOnboardingTourIndex(0)).toBe(1);
    expect(getNextOnboardingTourIndex(1)).toBe(2);
    expect(getNextOnboardingTourIndex(2)).toBeNull();
  });
});
