import { describe, expect, it } from "vitest";
import {
  LEGACY_HASH_SUNSET_MS,
  apiKeyProbeRateLimitKey,
  generateApiKey,
  isLegacyKeyValidationAllowed,
} from "./apiKeys";

describe("HYP-SEC-005 API key generation and validation", () => {
  it("generates new keys with at least 256 bits of CSPRNG entropy", () => {
    const first = generateApiKey();
    const second = generateApiKey();

    expect(first).toMatch(/^hyp_[a-f0-9]{64}$/);
    expect(second).toMatch(/^hyp_[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("rejects revoked and sunsetted legacy keys", () => {
    const now = 1_800_000_000_000;

    expect(
      isLegacyKeyValidationAllowed({ createdAt: now - 1_000 }, now)
    ).toBe(true);
    expect(
      isLegacyKeyValidationAllowed(
        { createdAt: now - LEGACY_HASH_SUNSET_MS - 1 },
        now
      )
    ).toBe(false);
    expect(
      isLegacyKeyValidationAllowed({ createdAt: now - 1_000, revokedAt: now }, now)
    ).toBe(false);
  });

  it("builds bounded generic rate-limit keys for API-key probes", () => {
    expect(apiKeyProbeRateLimitKey("hyp_1234567890abcdef")).toBe("prefix:hyp_123456");
    expect(apiKeyProbeRateLimitKey("x")).toBe("malformed");
    expect(apiKeyProbeRateLimitKey("")).toBe("missing");
  });
});
