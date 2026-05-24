import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { hasBetaAccess } from "./lib/auth";

export const hasBetaAccessForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await hasBetaAccess(ctx, userId);
  },
});
