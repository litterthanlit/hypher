/**
 * Public API origin for extension traffic.
 * Session capture uses /capture; API-key capture uses /api/capture.
 */
export const HYPHER_PUBLIC_API_ORIGIN = "https://hypher.app";

export function normalizeHypherApiOrigin(origin = HYPHER_PUBLIC_API_ORIGIN): string {
  const value = origin.trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported protocol");
    }
    return url.origin;
  } catch {
    throw new Error("Invalid Hypher API origin");
  }
}

export async function getConfiguredAppOrigin(): Promise<string> {
  const { hostOverride } = await chrome.storage.local.get("hostOverride");
  return normalizeHypherApiOrigin((hostOverride as string | undefined) || HYPHER_PUBLIC_API_ORIGIN);
}

export async function getConfiguredApiOrigin(): Promise<string> {
  const { apiHostOverride, hostOverride } = await chrome.storage.local.get([
    "apiHostOverride",
    "hostOverride",
  ]);
  return normalizeHypherApiOrigin(
    (apiHostOverride as string | undefined) ||
      (hostOverride as string | undefined) ||
      HYPHER_PUBLIC_API_ORIGIN,
  );
}
