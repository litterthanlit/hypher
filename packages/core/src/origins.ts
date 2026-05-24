/**
 * Public API origin for browser and SDK traffic.
 * Keep endpoint paths in callers; this value is only the scheme + host.
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
