/**
 * Service worker for the Hypher Chrome extension (MV3).
 * Handles three capture modes:
 *   1. Hotkey  — Cmd+Shift+H / Ctrl+Shift+H
 *   2. Context menu — right-click "Send to Hypher"
 *   3. Queue replay — chrome.alarms every 2 minutes
 *
 * State (queue, auth-mode, API key, lastProjectId) lives in chrome.storage.local
 * so it survives service-worker shutdowns (MV3 workers can terminate after ~30s idle).
 */

import { captureToHypher, replayQueue } from "./lib/capture";
import { HYPHER_PUBLIC_API_ORIGIN } from "./lib/origins";

type PageSelectionResult = {
  selection: string;
  pageTitle: string;
  pageUrl: string;
};

// ── Hotkey: Cmd+Shift+H ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-highlight") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Inject the selection helper on-demand (not auto-injected).
  let result: chrome.scripting.InjectionResult<PageSelectionResult>[];
  try {
    result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        selection: window.getSelection()?.toString() ?? "",
        pageTitle: document.title ?? "",
        pageUrl: window.location.href ?? "",
      }),
    });
  } catch {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/48.png",
      title: "Hypher",
      message: "Could not read this page. Try a different tab.",
    });
    return;
  }

  const data = result?.[0]?.result;
  if (!data?.selection) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/48.png",
      title: "Nothing selected",
      message: "Highlight some text first, then press Cmd+Shift+H.",
    });
    return;
  }

  await captureToHypher({
    content: data.selection,
    sourceUrl: data.pageUrl,
    sourceTitle: data.pageTitle,
  });
});

// ── Context menu ───────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "send-to-hypher",
    title: "Send to Hypher",
    contexts: ["selection", "link", "image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const content =
    info.selectionText ??
    info.linkUrl ??
    info.srcUrl ??
    "";
  if (!content) return;

  await captureToHypher({
    content,
    sourceUrl: tab?.url ?? info.linkUrl ?? "",
    sourceTitle: tab?.title ?? "",
  });
});

// ── Queue replay alarm ─────────────────────────────────────────────────────────
chrome.alarms.create("queue-replay", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "queue-replay") {
    replayQueue().catch(console.error);
  }
});

// ── Notification button handler ────────────────────────────────────────────────
chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
  if (buttonIndex === 0) {
    // "Open hypher.app" button on the sign-in notification
    chrome.tabs.create({ url: HYPHER_PUBLIC_API_ORIGIN });
  }
  chrome.notifications.clear(notifId);
});
