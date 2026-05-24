"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireActionBetaAccess } from "./lib/actionAuth";

type ValidateConnectResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export const validateAndConnectRepo = action({
  args: {
    projectId: v.id("objects"),
    repo: v.string(),
    pastedToken: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, repo, pastedToken }): Promise<ValidateConnectResult> => {
    const userId = await requireActionBetaAccess(ctx);

    let token = pastedToken?.trim();
    if (!token) {
      token =
        (await ctx.runAction(internal.githubPat.decryptTokenForUser, {
          userId,
        })) ?? undefined;
    }
    if (!token) {
      return {
        ok: false as const,
        error: "Add a token under Settings → Integrations or paste it below.",
      };
    }

    const validated: { valid: true; name: string; description?: string } | { valid: false; error: string } =
      await ctx.runAction(internal.github.validateRepoInternal, {
      repo: repo.trim(),
      token,
    });
    if (!validated.valid) {
      return {
        ok: false as const,
        error: validated.error ?? "Repository not found or token lacks access.",
      };
    }

    await ctx.runMutation(internal.objects.patchGithubFields, {
      projectId,
      userId,
      githubRepo: repo.trim(),
      githubLastSync: Date.now(),
    });

    return { ok: true as const, name: validated.name };
  },
});

export const generateProjectDocs = action({
  args: {
    projectId: v.id("objects"),
    pastedToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { projectId, pastedToken }
  ): Promise<{ claude: string; roadmap: string; handoff: string }> => {
    const userId = await requireActionBetaAccess(ctx);

    const project = await ctx.runQuery(internal.objects.getProjectForUser, {
      projectId,
      userId,
    });
    if (!project?.githubRepo) {
      throw new Error("Connect a GitHub repository first.");
    }

    let token = pastedToken?.trim();
    if (!token) {
      token =
        (await ctx.runAction(internal.githubPat.decryptTokenForUser, {
          userId,
        })) ?? undefined;
    }
    if (!token) {
      throw new Error(
        "Add a token under Settings → Integrations or paste an override below."
      );
    }

    return await ctx.runAction((internal as any).github.generateDocs, {
      repo: project.githubRepo,
      token,
    });
  },
});

type SyncRepoResult = {
  blockers: string[];
  openPRCount: number;
  openIssueCount: number;
  recentPRs: { number: number; title: string; state: string; draft: boolean; updatedAt: string }[];
  latestCommitDate?: number;
  commitMessages: string[];
};

export const syncProjectRepo = action({
  args: {
    projectId: v.id("objects"),
    pastedToken: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, pastedToken }): Promise<SyncRepoResult> => {
    const userId = await requireActionBetaAccess(ctx);

    const project = await ctx.runQuery(internal.objects.getProjectForUser, {
      projectId,
      userId,
    });
    if (!project?.githubRepo) {
      throw new Error("Connect a GitHub repository first.");
    }

    let token = pastedToken?.trim();
    if (!token) {
      token =
        (await ctx.runAction(internal.githubPat.decryptTokenForUser, {
          userId,
        })) ?? undefined;
    }
    if (!token) {
      throw new Error(
        "Add a token under Settings → Integrations or paste an override below."
      );
    }

    const result = await ctx.runAction((internal as any).github.syncRepo, {
      repo: project.githubRepo,
      token,
      projectId: projectId as string,
      projectName: project.name,
    });

    await ctx.runMutation(internal.objects.applyGithubSyncToProject, {
      projectId,
      userId,
      githubLastSync: Date.now(),
      lastActivity: result.latestCommitDate,
      syncBlockers: result.blockers,
    });

    return result;
  },
});
