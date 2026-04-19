export const ONBOARDING_TARGETS = {
  captureInput: "capture-input",
  dashboardMemory: "dashboard-memory",
  dailyDigest: "daily-digest",
} as const;

export type OnboardingTarget =
  typeof ONBOARDING_TARGETS[keyof typeof ONBOARDING_TARGETS];

export type OnboardingDestination = "capture" | "dashboard";

export interface OnboardingState {
  demoSeeded: boolean;
  onboardingWelcomeSeenAt?: number;
  onboardingTourCompletedAt?: number;
}

export interface OnboardingTourStep {
  id: "capture" | "memory" | "digest";
  target: OnboardingTarget;
  destination: OnboardingDestination;
  title: string;
  body: string;
}

export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "capture",
    target: ONBOARDING_TARGETS.captureInput,
    destination: "capture",
    title: "Dump the idea first",
    body: "Write the thought before you decide where it belongs. Hypher will ask where to sort it after capture.",
  },
  {
    id: "memory",
    target: ONBOARDING_TARGETS.dashboardMemory,
    destination: "dashboard",
    title: "Let projects keep memory",
    body: "Project cards can summarize what changed, what is open, and the next action worth considering.",
  },
  {
    id: "digest",
    target: ONBOARDING_TARGETS.dailyDigest,
    destination: "dashboard",
    title: "Resurface what matters",
    body: "The digest turns your projects into a short daily briefing so quiet work does not disappear.",
  },
];

export function shouldShowOnboardingWelcome(
  state: OnboardingState | null | undefined,
  options: { isSignedIn: boolean; isReady: boolean; hasWorkspaceData: boolean }
): boolean {
  if (!options.isSignedIn || !options.isReady || !state) return false;
  if (state.onboardingWelcomeSeenAt) return false;
  return state.demoSeeded || options.hasWorkspaceData;
}

export function shouldRunOnboardingTour(
  state: OnboardingState | null | undefined
): boolean {
  if (!state?.onboardingWelcomeSeenAt) return false;
  return !state.onboardingTourCompletedAt;
}

export function getOnboardingTourStep(index: number): OnboardingTourStep | null {
  return ONBOARDING_TOUR_STEPS[index] ?? null;
}

export function getNextOnboardingTourIndex(index: number): number | null {
  const next = index + 1;
  return next < ONBOARDING_TOUR_STEPS.length ? next : null;
}
