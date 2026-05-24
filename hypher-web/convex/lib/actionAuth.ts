import { internal } from "../_generated/api";

const _internal = internal as any;

type ActionAuthCtx = {
  auth: {
    getUserIdentity: () => Promise<{ subject: string } | null>;
  };
  runQuery: (...args: any[]) => Promise<unknown>;
};

export async function requireActionBetaAccess(ctx: ActionAuthCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  const userId = identity.subject;
  const allowed = await ctx.runQuery(_internal.authz.hasBetaAccessForUser, {
    userId,
  });
  if (!allowed) throw new Error("Beta access required");
  return userId;
}
