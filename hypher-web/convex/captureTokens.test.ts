import { describe, expect, it } from "vitest";
import {
  CAPTURE_TOKEN_DEFAULT_TTL_MS,
  CAPTURE_TOKEN_MAX_TTL_MS,
  CAPTURE_TOKEN_MIN_TTL_MS,
  buildCaptureTokenExpiry,
  createCaptureTokenMaterial,
  normalizeAllowedOrigin,
  normalizeCaptureTokenScopes,
  validateCaptureTokenGrant,
} from "./captureTokens";

describe("HYP-SEC-006 capture token helpers", () => {
  it("generates opaque token material and stores only hashes", async () => {
    const material = await createCaptureTokenMaterial();

    expect(material.token).toMatch(/^hct_[a-f0-9]{32}_[a-f0-9]{64}$/);
    expect(material.tokenId).toMatch(/^[a-f0-9]{32}$/);
    expect(material.tokenIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(material.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(material.tokenIdHash).not.toBe(material.tokenId);
    expect(material.tokenHash).not.toContain(material.token);
  });

  it("normalizes scopes to capture:create plus optional projects:list", () => {
    expect(normalizeCaptureTokenScopes(undefined)).toEqual(["capture:create"]);
    expect(normalizeCaptureTokenScopes(["projects:list", "capture:create", "projects:list"])).toEqual([
      "capture:create",
      "projects:list",
    ]);
    expect(() => normalizeCaptureTokenScopes(["objects:delete"])).toThrow("Invalid capture token scope");
  });

  it("defaults to 10 minutes, clamps short TTLs, and caps browser TTLs at 1 hour", () => {
    const now = 1_800_000_000_000;

    expect(buildCaptureTokenExpiry(undefined, now)).toBe(now + CAPTURE_TOKEN_DEFAULT_TTL_MS);
    expect(buildCaptureTokenExpiry(60, now)).toBe(now + CAPTURE_TOKEN_MIN_TTL_MS);
    expect(buildCaptureTokenExpiry(7 * 60, now)).toBe(now + 7 * 60_000);
    expect(buildCaptureTokenExpiry(90 * 60, now)).toBe(now + CAPTURE_TOKEN_MAX_TTL_MS);
  });

  it("accepts exact origins and rejects wildcard origins", () => {
    expect(normalizeAllowedOrigin("https://example.com/path")).toBe("https://example.com");
    expect(normalizeAllowedOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop")).toBe(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
    );
    expect(() => normalizeAllowedOrigin("*")).toThrow("Wildcard origins are not allowed");
  });

  it("enforces scope, expiry, revocation, origin, and fixed project grants", () => {
    const now = 1_800_000_000_000;
    const grant = {
      scopes: ["capture:create"] as const,
      projectId: "project_1",
      allowedOrigin: "https://example.com",
      expiresAt: now + 60_000,
    };

    expect(
      validateCaptureTokenGrant(grant, {
        requiredScope: "capture:create",
        projectId: "project_1",
        origin: "https://example.com",
        now,
      })
    ).toEqual({ ok: true });
    expect(
      validateCaptureTokenGrant(grant, {
        requiredScope: "projects:list",
        origin: "https://example.com",
        now,
      })
    ).toEqual({ ok: false, status: 403, error: "insufficient_scope" });
    expect(
      validateCaptureTokenGrant(grant, {
        requiredScope: "capture:create",
        projectId: "project_2",
        origin: "https://example.com",
        now,
      })
    ).toEqual({ ok: false, status: 403, error: "project_scope_mismatch" });
    expect(
      validateCaptureTokenGrant(grant, {
        requiredScope: "capture:create",
        projectId: "project_1",
        origin: "https://evil.example",
        now,
      })
    ).toEqual({ ok: false, status: 403, error: "origin_mismatch" });
    expect(
      validateCaptureTokenGrant({ ...grant, expiresAt: now - 1 }, {
        requiredScope: "capture:create",
        origin: "https://example.com",
        now,
      })
    ).toEqual({ ok: false, status: 401, error: "token_expired" });
    expect(
      validateCaptureTokenGrant({ ...grant, revokedAt: now }, {
        requiredScope: "capture:create",
        origin: "https://example.com",
        now,
      })
    ).toEqual({ ok: false, status: 401, error: "token_revoked" });
  });
});
