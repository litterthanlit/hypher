import { describe, expect, it } from "vitest";
import {
  CANONICAL_HYPHER_OAUTH_RESOURCE,
  canonicalizeOAuthResource,
  hypherOAuthResourceAliases,
  isAllowedOAuthResource,
  mcpServerResourceUrl,
  oauthResourcesEquivalent,
} from "./oauthResources";

const PRODUCTION_ALIASES = [
  "https://hypher.app",
  "https://www.hypher.app",
  "https://hypher.app/api/mcp",
  "https://www.hypher.app/api/mcp",
] as const;

describe("Hypher OAuth resource aliases", () => {
  it("canonicalizes apex, www, and /api/mcp identifiers to the www origin", () => {
    for (const resource of PRODUCTION_ALIASES) {
      expect(canonicalizeOAuthResource(resource)).toBe(CANONICAL_HYPHER_OAUTH_RESOURCE);
    }
    expect(canonicalizeOAuthResource("https://www.hypher.app/")).toBe(CANONICAL_HYPHER_OAUTH_RESOURCE);
    expect(canonicalizeOAuthResource("https://www.hypher.app/api/mcp/")).toBe(
      CANONICAL_HYPHER_OAUTH_RESOURCE
    );
  });

  it("treats every production alias as equivalent, including ChatGPT origin-bound tokens", () => {
    for (const left of PRODUCTION_ALIASES) {
      for (const right of PRODUCTION_ALIASES) {
        expect(oauthResourcesEquivalent(left, right)).toBe(true);
        expect(isAllowedOAuthResource(left, right)).toBe(true);
      }
    }
  });

  it("rejects resources outside the Hypher host family or MCP path", () => {
    expect(canonicalizeOAuthResource("https://evil.example")).toBe("https://evil.example");
    expect(oauthResourcesEquivalent("https://evil.example", "https://www.hypher.app")).toBe(false);
    expect(isAllowedOAuthResource("https://evil.example", "https://www.hypher.app")).toBe(false);
    expect(isAllowedOAuthResource("https://www.hypher.app/api/other", "https://www.hypher.app")).toBe(
      false
    );
    expect(isAllowedOAuthResource("https://hypher.app.attacker.com", "https://www.hypher.app")).toBe(
      false
    );
    expect(canonicalizeOAuthResource("https://www.hypher.app/api/mcp?x=1")).toBeNull();
  });

  it("lists the four production aliases from either www or apex expected resources", () => {
    expect(hypherOAuthResourceAliases("https://www.hypher.app")).toEqual([...PRODUCTION_ALIASES]);
    expect(hypherOAuthResourceAliases("https://hypher.app/api/mcp")).toEqual([...PRODUCTION_ALIASES]);
  });

  it("keeps localhost origin and /api/mcp equivalent without mapping them to production", () => {
    expect(canonicalizeOAuthResource("http://localhost:3000/api/mcp")).toBe("http://localhost:3000");
    expect(oauthResourcesEquivalent("http://localhost:3000", "http://localhost:3000/api/mcp")).toBe(
      true
    );
    expect(oauthResourcesEquivalent("http://localhost:3000", "https://www.hypher.app")).toBe(false);
    expect(hypherOAuthResourceAliases("http://localhost:3000")).toEqual([
      "http://localhost:3000",
      "http://localhost:3000/api/mcp",
    ]);
  });

  it("builds the MCP server resource URL from an origin", () => {
    expect(mcpServerResourceUrl("https://www.hypher.app")).toBe("https://www.hypher.app/api/mcp");
    expect(mcpServerResourceUrl("https://hypher.app/")).toBe("https://hypher.app/api/mcp");
  });
});
