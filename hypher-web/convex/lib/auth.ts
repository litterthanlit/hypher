import type { GenericQueryCtx, GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export async function requireUserId(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }
  return identity.subject;
}

export function isBetaGateEnabled(): boolean {
  return process.env.BETA_INVITE_GATE_ENABLED === "true";
}

export function isAdminUserId(userId: string): boolean {
  const raw = process.env.BETA_ADMIN_USER_IDS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

export async function hasBetaAccess(ctx: Ctx, userId: string): Promise<boolean> {
  if (!isBetaGateEnabled()) return true;
  if (isAdminUserId(userId)) return true;
  const access = await ctx.db
    .query("betaAccess")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return access !== null;
}

export async function requireBetaAccess(ctx: Ctx): Promise<string> {
  const userId = await requireUserId(ctx);
  if (!(await hasBetaAccess(ctx, userId))) {
    throw new Error("Beta access required");
  }
  return userId;
}

export async function requireAdmin(ctx: Ctx): Promise<string> {
  const userId = await requireUserId(ctx);
  if (!isAdminUserId(userId)) {
    throw new Error("Admin access required");
  }
  return userId;
}
