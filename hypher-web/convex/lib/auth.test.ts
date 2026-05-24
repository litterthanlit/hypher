import { afterEach, describe, expect, it } from "vitest";
import {
  requireAdmin,
  requireBetaAccess,
  requireUserId,
} from "./auth";

const originalGate = process.env.BETA_INVITE_GATE_ENABLED;
const originalAdmins = process.env.BETA_ADMIN_USER_IDS;

function mockCtx(args: { userId?: string; betaAccess?: boolean }) {
  return {
    auth: {
      getUserIdentity: async () =>
        args.userId ? { subject: args.userId } : null,
    },
    db: {
      query: (table: string) => {
        if (table !== "betaAccess") throw new Error(`unexpected table ${table}`);
        return {
          withIndex: () => ({
            first: async () =>
              args.betaAccess && args.userId
                ? { userId: args.userId, grantedAt: 123 }
                : null,
          }),
        };
      },
    },
  } as any;
}

afterEach(() => {
  process.env.BETA_INVITE_GATE_ENABLED = originalGate;
  process.env.BETA_ADMIN_USER_IDS = originalAdmins;
});

describe("HYP-SEC-002 Convex auth helpers", () => {
  it("rejects unauthenticated callers", async () => {
    await expect(requireUserId(mockCtx({}))).rejects.toThrow("Unauthorized");
    await expect(requireBetaAccess(mockCtx({}))).rejects.toThrow("Unauthorized");
  });

  it("rejects signed-in non-beta users when the beta gate is enabled", async () => {
    process.env.BETA_INVITE_GATE_ENABLED = "true";
    process.env.BETA_ADMIN_USER_IDS = "";

    await expect(
      requireBetaAccess(mockCtx({ userId: "user_non_beta" }))
    ).rejects.toThrow("Beta access required");
  });

  it("allows beta users and admins through the beta gate", async () => {
    process.env.BETA_INVITE_GATE_ENABLED = "true";
    process.env.BETA_ADMIN_USER_IDS = "user_admin";

    await expect(
      requireBetaAccess(mockCtx({ userId: "user_beta", betaAccess: true }))
    ).resolves.toBe("user_beta");
    await expect(
      requireBetaAccess(mockCtx({ userId: "user_admin" }))
    ).resolves.toBe("user_admin");
  });

  it("requires admin membership for admin-only paths", async () => {
    process.env.BETA_ADMIN_USER_IDS = "user_admin";

    await expect(requireAdmin(mockCtx({ userId: "user_beta" }))).rejects.toThrow(
      "Admin access required"
    );
    await expect(requireAdmin(mockCtx({ userId: "user_admin" }))).resolves.toBe(
      "user_admin"
    );
  });
});
