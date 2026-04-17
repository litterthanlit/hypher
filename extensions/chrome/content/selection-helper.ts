/**
 * Selection helper — injected on-demand via chrome.scripting.executeScript.
 * Runs as a one-shot function; returns the current page selection + metadata.
 * No auto-injection, no message listeners — see security notes in spec #08.
 */
export function getPageSelection(): {
  selection: string;
  pageTitle: string;
  pageUrl: string;
} {
  return {
    selection: window.getSelection()?.toString() ?? "",
    pageTitle: document.title ?? "",
    pageUrl: window.location.href ?? "",
  };
}
