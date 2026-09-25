import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const touchSync = internalMutation({
  args: {
    projectId: v.id("objects"),
    timestamp: v.number(),
    blockers: v.array(v.string()),
  },
  handler: async (ctx, { projectId, timestamp, blockers }) => {
    const patch: Record<string, unknown> = {
      githubLastSync: Date.now(),
      modifiedAt: Date.now(),
    };
    if (timestamp) {
      patch.lastActivity = timestamp;
    }
    // Prepend GitHub blockers to existing blockers field
    if (blockers.length > 0) {
      const existing = await ctx.db.get(projectId);
      const manualBlockers = existing?.blockers ?? "";
      const ghSection = `[GitHub] ${blockers.join("; ")}`;
      // Replace previous GitHub blockers if present, append otherwise
      const cleaned = manualBlockers.replace(/\[GitHub\][\s\S]*$/, "").trim();
      patch.blockers = cleaned ? `${cleaned}\n${ghSection}` : ghSection;
    }
    await ctx.db.patch(projectId, patch);
  },
});
