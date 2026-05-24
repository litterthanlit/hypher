import { describe, expect, it } from "vitest";
import { isGlobalLegacyMigrationLock, isLegacyScopedUserId } from "./legacy";

describe("HYP-SEC-004 legacy migration helpers", () => {
  it("uses a global migration lock and only treats null/default owners as legacy", () => {
    expect(isGlobalLegacyMigrationLock("__legacy_migration_global__")).toBe(true);
    expect(isLegacyScopedUserId(undefined)).toBe(true);
    expect(isLegacyScopedUserId(null)).toBe(true);
    expect(isLegacyScopedUserId("default")).toBe(true);
    expect(isLegacyScopedUserId("user_123")).toBe(false);
  });
});
