import { query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

/**
 * Returns the minimal input shape needed to compute health scores for every
 * active project owned by the current user. Reactive — any write to objects
 * for this user re-emits the query.
 */
export const healthInputs = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const all = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = all.filter((o) => o.kind === "project");
    const itemsByProject = new Map<string, { kind: "note" | "artifact"; modifiedAt: number; maturity?: string }[]>();

    for (const o of all) {
      if ((o.kind === "note" || o.kind === "artifact") && o.projectId) {
        const arr = itemsByProject.get(o.projectId) ?? [];
        arr.push({ kind: o.kind, modifiedAt: o.modifiedAt, maturity: o.maturity });
        itemsByProject.set(o.projectId, arr);
      }
    }

    return projects.map((p) => ({
      projectId: p._id as string,
      lastActivity: p.lastActivity,
      blockers: p.blockers,
      githubRepo: p.githubRepo,
      githubLastSync: p.githubLastSync,
      items: itemsByProject.get(p._id as string) ?? [],
    }));
  },
});
