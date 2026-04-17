/**
 * Auth-mode resolution and storage helpers.
 * The extension supports two auth paths:
 *   1. session  — cookie passthrough via credentials: "include" (default)
 *   2. api-key  — explicit API key stored in chrome.storage.local
 *
 * The API key is NEVER stored in chrome.storage.sync (sync rides Chrome's
 * cloud account → cross-machine leak risk if account is compromised).
 */

export type AuthMode = "session" | "api-key";

export async function getAuthMode(): Promise<AuthMode> {
  const { authMode } = await chrome.storage.local.get("authMode");
  return (authMode as AuthMode) || "session";
}

export async function setAuthMode(mode: AuthMode): Promise<void> {
  await chrome.storage.local.set({ authMode: mode });
}

export async function getApiKey(): Promise<string | undefined> {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  return apiKey as string | undefined;
}

export async function setApiKey(key: string): Promise<void> {
  // Only stored locally — never synced
  await chrome.storage.local.set({ apiKey: key });
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove("apiKey");
}

export async function resetExtension(): Promise<void> {
  await chrome.storage.local.clear();
}
