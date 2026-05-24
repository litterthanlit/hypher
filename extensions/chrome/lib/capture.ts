/**
 * Core capture logic, queue management, and retry scheduler.
 * All state lives in chrome.storage.local so it survives service-worker restarts.
 */

import { getConfiguredApiOrigin, getConfiguredAppOrigin } from "./origins";

export interface PendingCapture {
  id: string;
  content: string;
  projectId?: string | null;
  tags?: string[];
  sourceUrl: string;
  sourceTitle: string;
  createdAt: number;
  attempts: number;
  nextRetryAt?: number;
}

const MAX_ATTEMPTS_DROP_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours
const BACKOFF_BASE_MS = 2 * 60 * 1000; // 2 minutes base
const BACKOFF_MAX_MS = 30 * 60 * 1000; // 30 minute cap
const FETCH_TIMEOUT_MS = 15_000;

function backoffMs(attempts: number): number {
  const ms = BACKOFF_BASE_MS * Math.pow(2, attempts - 1);
  return Math.min(ms, BACKOFF_MAX_MS);
}

function appendSourceFooter(content: string, url: string, title: string): string {
  if (!url) return content;
  return `${content}\n\n— from [${title || url}](${url})`;
}

async function fetchWithTimeout(url: string, opts: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type AuthMode = "session" | "api-key";

async function getAuthMode(): Promise<{ mode: AuthMode; apiKey?: string }> {
  const { authMode, apiKey } = await chrome.storage.local.get(["authMode", "apiKey"]);
  return {
    mode: (authMode as AuthMode) || "session",
    apiKey: apiKey as string | undefined,
  };
}

async function getLastProjectId(): Promise<string | null> {
  const { lastProjectId } = await chrome.storage.local.get("lastProjectId");
  return (lastProjectId as string) || null;
}

export async function setLastProjectId(id: string | null): Promise<void> {
  await chrome.storage.local.set({ lastProjectId: id });
}

async function enqueue(capture: Omit<PendingCapture, "id" | "attempts" | "createdAt">): Promise<void> {
  const { queue } = await chrome.storage.local.get("queue");
  const existing: PendingCapture[] = (queue as PendingCapture[]) || [];
  const item: PendingCapture = {
    ...capture,
    id: crypto.randomUUID(),
    attempts: 0,
    createdAt: Date.now(),
  };
  await chrome.storage.local.set({ queue: [...existing, item] });
}

export async function getQueue(): Promise<PendingCapture[]> {
  const { queue } = await chrome.storage.local.get("queue");
  return (queue as PendingCapture[]) || [];
}

async function setQueue(queue: PendingCapture[]): Promise<void> {
  await chrome.storage.local.set({ queue });
}

function notify(title: string, message: string, buttons?: chrome.notifications.ButtonOptions[]): void {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/48.png",
    title,
    message,
    buttons,
  });
}

async function sendCapture(
  body: { content: string; projectId: string | null; tags: string[] },
  auth: { mode: AuthMode; apiKey?: string },
  host: string,
): Promise<Response> {
  if (auth.mode === "api-key" && auth.apiKey) {
    // API-key path: POST to the Convex HTTP endpoint, never cookies.
    const convexUrl = `${host}/api/capture`;
    return fetchWithTimeout(convexUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.apiKey}`,
      },
      credentials: "omit",
      body: JSON.stringify(body),
      redirect: "manual",
    });
  }

  // Default: session-cookie path
  return fetchWithTimeout(`${host}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
    redirect: "manual",
  });
}

/**
 * Core capture function. All three modes (hotkey, popup, context-menu) call this.
 */
export async function captureToHypher(input: {
  content: string;
  sourceUrl: string;
  sourceTitle: string;
  projectId?: string | null;
  tags?: string[];
}): Promise<void> {
  const auth = await getAuthMode();
  const lastProject = await getLastProjectId();
  const projectId = input.projectId !== undefined ? input.projectId : lastProject;
  const body = {
    content: appendSourceFooter(input.content, input.sourceUrl, input.sourceTitle),
    projectId: projectId ?? null,
    tags: input.tags ?? [],
  };

  try {
    const host = auth.mode === "api-key" ? await getConfiguredApiOrigin() : await getConfiguredAppOrigin();
    const res = await sendCapture(body, auth, host);

    // opaqueredirect = 302 to /sign-in (session-cookie path, signed-out user)
    if (res.type === "opaqueredirect" || res.status === 302 || res.status === 0) {
      await enqueue(input);
      notify(
        "Sign in to Hypher",
        "Open hypher.app and sign in to send your captures.",
        [{ title: "Open hypher.app" }],
      );
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    flashBadge();
    notify("Captured to Hypher", input.content.slice(0, 80));
  } catch {
    await enqueue(input);
    notify("Capture queued", "Will retry when network is available.");
  }
}

function flashBadge(): void {
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#2d9d6a" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 800);
}

/**
 * Replay the offline queue. Called by the alarm every 2 minutes.
 * Processes head-first; on success removes entry; on failure increments attempts + backoff.
 * Drops entries older than 24h.
 */
export async function replayQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const now = Date.now();
  const auth = await getAuthMode();

  const nextQueue: PendingCapture[] = [];
  let dropped = 0;

  for (const item of queue) {
    // Drop items older than 24h
    if (now - item.createdAt > MAX_ATTEMPTS_DROP_AFTER_MS) {
      dropped++;
      continue;
    }

    // Skip if not yet time to retry
    if (item.nextRetryAt && now < item.nextRetryAt) {
      nextQueue.push(item);
      continue;
    }

    const body = {
      content: item.content,
      projectId: item.projectId ?? null,
      tags: item.tags ?? [],
    };

    try {
      const host = auth.mode === "api-key" ? await getConfiguredApiOrigin() : await getConfiguredAppOrigin();
      const res = await sendCapture(body, auth, host);

      if (res.type === "opaqueredirect" || res.status === 302 || res.status === 0) {
        // Still signed out — keep in queue
        const updated: PendingCapture = {
          ...item,
          attempts: item.attempts + 1,
          nextRetryAt: now + backoffMs(item.attempts + 1),
        };
        nextQueue.push(updated);
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      // Success — don't push back to queue
    } catch {
      const updated: PendingCapture = {
        ...item,
        attempts: item.attempts + 1,
        nextRetryAt: now + backoffMs(item.attempts + 1),
      };
      nextQueue.push(updated);
    }
  }

  await setQueue(nextQueue);

  if (dropped > 0) {
    notify(
      "Captures not delivered",
      `${dropped} capture${dropped > 1 ? "s" : ""} couldn't reach Hypher after 24 hours. Check extension options.`,
    );
  }
}
