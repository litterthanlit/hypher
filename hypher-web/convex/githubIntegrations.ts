"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";
import { planGithubRepoBind } from "./lib/githubBind";

const connectRepoResult = v.union(
  v.object({
    ok: v.literal(true),
    repo: v.string(),
    synced: v.boolean(),
  }),
  v.object({
    ok: v.literal(false),
    error: v.string(),
  })
);

export const connectRepoToProject = action({
  args: { projectId: v.id("objects"), repoInput: v.string() },
  returns: connectRepoResult,
  handler: async (
    ctx,
    { projectId, repoInput }
  ): Promise<
    | { ok: true; repo: string; synced: boolean }
    | { ok: false; error: string }
  > => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "github-connect-repo", {
      requests: 20,
      window: "1h",
    });
    if (!allowed) throw new Error("Rate limited");

    let token: string | null = null;
    try {
      token = await ctx.runAction(internal.githubPat.decryptTokenForUser, {
        userId,
      });
    } catch {
      token = null;
    }

    const plan = planGithubRepoBind(repoInput, Boolean(token));
    if (!plan.ok) {
      return { ok: false, error: plan.error };
    }

    if (!plan.validateAndSync || !token) {
      await ctx.runMutation(internal.objects.patchGithubFields, {
        projectId,
        userId,
        githubRepo: plan.repo,
      });
      return { ok: true, repo: plan.repo, synced: false };
    }

    const validated = await ctx.runAction(internal.github.validateRepoInternal, {
      repo: plan.repo,
      token,
    });
    if (!validated.valid) {
      return {
        ok: false,
        error: validated.error ?? "Repository not found or token lacks access.",
      };
    }

    await ctx.runMutation(internal.objects.patchGithubFields, {
      projectId,
      userId,
      githubRepo: plan.repo,
      githubLastSync: Date.now(),
    });

    const sync = await ctx.runAction(internal.github.syncRepoInternal, {
      repo: plan.repo,
      token,
      projectId: projectId as string,
      projectName: validated.name,
      userId,
    });

    if (sync.latestCommitDate) {
      await ctx.runMutation(internal.githubInternal.touchSync, {
        projectId: projectId as Id<"objects">,
        timestamp: sync.latestCommitDate,
        blockers: sync.blockers,
      });
    }

    return { ok: true, repo: validated.name, synced: true };
  },
});
