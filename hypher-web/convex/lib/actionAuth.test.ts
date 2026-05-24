import { describe, expect, it } from "vitest";
import { requireActionBetaAccess } from "./actionAuth";

function mockActionCtx(args: { userId?: string; betaAccess?: boolean }) {
  return {
    auth: {
      getUserIdentity: async () =>
        args.userId ? { subject: args.userId } : null,
    },
    runQuery: async () => args.betaAccess === true,
  } as any;
}

describe("HYP-SEC-001 action auth", () => {
  it("rejects unauthenticated public Convex action callers", async () => {
    await expect(requireActionBetaAccess(mockActionCtx({}))).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("rejects signed-in non-beta public Convex action callers", async () => {
    await expect(
      requireActionBetaAccess(mockActionCtx({ userId: "user_non_beta" }))
    ).rejects.toThrow("Beta access required");
  });

  it("allows beta users", async () => {
    await expect(
      requireActionBetaAccess(mockActionCtx({ userId: "user_beta", betaAccess: true }))
    ).resolves.toBe("user_beta");
  });
});
