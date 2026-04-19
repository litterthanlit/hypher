export interface LaunchSmokeTest {
  id: string;
  title: string;
  detail: string;
  href?: string;
  curl?: string;
}

export type LaunchChecklistState = Record<string, boolean>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LAUNCH_CHECKLIST_STORAGE_KEY = "hypher-launch-readiness-checklist-v1";

export const LAUNCH_SMOKE_TESTS: LaunchSmokeTest[] = [
  {
    id: "sign-in",
    title: "Sign in and seed demo",
    detail: "Open the app, sign in as a fresh user, and confirm the Try Hypher workspace appears.",
    href: "/app",
  },
  {
    id: "capture-sort",
    title: "Capture and sort",
    detail: "Capture a note, assign a suggested project, and confirm it leaves the review queue.",
    href: "/app",
  },
  {
    id: "inbox-review",
    title: "Dismiss and review later",
    detail: "Dismiss a capture, open Inbox, then assign it from the review surface.",
    href: "/app",
  },
  {
    id: "project-memory",
    title: "Generate project memory",
    detail: "Open the dashboard, generate memory for an active project, then accept or dismiss a next action.",
    href: "/app",
  },
  {
    id: "daily-digest",
    title: "Daily digest settings",
    detail: "Open API keys, toggle digest preferences, and confirm the save toast appears.",
    href: "/app/settings/api-keys",
  },
  {
    id: "github",
    title: "GitHub integration",
    detail: "Save a PAT, connect a repo to a project, and confirm the first sync completes.",
    href: "/app/settings/integrations",
  },
  {
    id: "stripe",
    title: "Stripe checkout and webhook",
    detail: "Open pricing, complete checkout with a test card, and confirm the subscription row updates.",
    href: "/pricing",
  },
  {
    id: "extension-capture",
    title: "Extension capture",
    detail: "Send an authenticated capture request and confirm the note appears in the inbox.",
    curl: "curl -i https://hypher.app/api/capture -H 'Authorization: Bearer <api-key>' -H 'Content-Type: application/json' --data '{\"content\":\"Smoke test capture\"}'",
  },
];

function defaultChecklist(ids: string[]): LaunchChecklistState {
  return Object.fromEntries(ids.map((id) => [id, false]));
}

export function readLaunchChecklist(
  storage: StorageLike | undefined,
  tests: LaunchSmokeTest[] = LAUNCH_SMOKE_TESTS
): LaunchChecklistState {
  const ids = tests.map((test) => test.id);
  const defaults = defaultChecklist(ids);
  if (!storage) return defaults;

  try {
    const raw = storage.getItem(LAUNCH_CHECKLIST_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      ids.map((id) => [id, parsed[id] === true])
    );
  } catch {
    return defaults;
  }
}

export function writeLaunchChecklist(
  storage: StorageLike | undefined,
  state: LaunchChecklistState
): void {
  if (!storage) return;
  storage.setItem(LAUNCH_CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

export function toggleLaunchChecklistItem(
  state: LaunchChecklistState,
  id: string
): LaunchChecklistState {
  return {
    ...state,
    [id]: !state[id],
  };
}
