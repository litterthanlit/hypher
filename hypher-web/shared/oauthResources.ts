/** Production hosts that identify the same Hypher OAuth resource. */
export const HYPHER_OAUTH_RESOURCE_HOSTS = ["hypher.app", "www.hypher.app"] as const;

/** Canonical origin for the production Hypher host family. */
export const CANONICAL_HYPHER_OAUTH_RESOURCE = "https://www.hypher.app";

const PRODUCTION_HOSTS = new Set<string>(HYPHER_OAUTH_RESOURCE_HOSTS);

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizedPathname(pathname: string): string {
  const trimmed = stripTrailingSlashes(pathname);
  return trimmed === "" ? "/" : trimmed;
}

function isOriginOrMcpPath(pathname: string): boolean {
  const path = normalizedPathname(pathname);
  return path === "/" || path === "/api/mcp";
}

function parseResourceUrl(resource: string): URL | null {
  try {
    return new URL(resource);
  } catch {
    return null;
  }
}

/**
 * Maps equivalent Hypher resource identifiers to one comparison key.
 * Production aliases: apex, www, and each host's /api/mcp URL.
 * ChatGPT tokens bound to either origin stay equivalent to MCP URLs.
 */
export function canonicalizeOAuthResource(resource: string): string | null {
  const url = parseResourceUrl(resource);
  if (!url) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (!isOriginOrMcpPath(url.pathname)) return null;

  if (PRODUCTION_HOSTS.has(url.hostname)) {
    if (url.protocol !== "https:") return null;
    return CANONICAL_HYPHER_OAUTH_RESOURCE;
  }

  return url.origin;
}

export function oauthResourcesEquivalent(left: string, right: string): boolean {
  const canonicalLeft = canonicalizeOAuthResource(left);
  const canonicalRight = canonicalizeOAuthResource(right);
  return canonicalLeft !== null && canonicalLeft === canonicalRight;
}

export function isAllowedOAuthResource(resource: string, expectedResource: string): boolean {
  return oauthResourcesEquivalent(resource, expectedResource);
}

export function mcpServerResourceUrl(baseUrl: string): string {
  return `${stripTrailingSlashes(baseUrl)}/api/mcp`;
}

export function hypherOAuthResourceAliases(baseUrl: string): string[] {
  const canonical = canonicalizeOAuthResource(baseUrl);
  if (!canonical) return [];
  if (canonical === CANONICAL_HYPHER_OAUTH_RESOURCE) {
    return [
      "https://hypher.app",
      "https://www.hypher.app",
      "https://hypher.app/api/mcp",
      "https://www.hypher.app/api/mcp",
    ];
  }
  return [canonical, mcpServerResourceUrl(canonical)];
}
