import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listGitHubProjects = internalQuery({
  handler: async (ctx) => {
    const all = await ctx.db
      .query("objects")
      .withIndex("by_kind", (q) => q.eq("kind", "project"))
      .collect();
    return all.filter((o) => o.githubRepo);
  },
});

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

export const logGitHubActivity = internalMutation({
  args: {
    projectId: v.string(),
    projectName: v.string(),
    summary: v.string(),
  },
  handler: async (ctx, { projectId, projectName, summary }) => {
    await ctx.db.insert("activity", {
      action: "updated",
      objectId: projectId,
      objectKind: "project",
      objectName: projectName,
      timestamp: Date.now(),
      projectId,
      activityType: "github",
      summary,
    });
  },
});
