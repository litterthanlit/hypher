"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";

type ValidateConnectResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

const MAX_GITHUB_REPO_INPUT = 200;
const MAX_GITHUB_TOKEN_INPUT = 2048;

export function cleanGithubRepoInput(repo: string): string | null {
  const cleaned = repo.trim();
  if (!cleaned || cleaned.length > MAX_GITHUB_REPO_INPUT) return null;
  return cleaned;
}

export function cleanGithubTokenInput(token: string | undefined): string | null | undefined {
  if (token === undefined) return undefined;
  const cleaned = token.trim();
  if (!cleaned) return undefined;
  if (cleaned.length > MAX_GITHUB_TOKEN_INPUT) return null;
  return cleaned;
}

async function requireGithubActionAllowed(userId: string, bucket: string) {
  const allowed = await ratelimitConvex(userId, bucket, {
    requests: 20,
    window: "1h",
  });
  if (!allowed) throw new Error("Rate limited");
}

export const validateAndConnectRepo = action({
  args: {
    projectId: v.id("objects"),
    repo: v.string(),
    pastedToken: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, repo, pastedToken }): Promise<ValidateConnectResult> => {
    const userId = await requireActionBetaAccess(ctx);
    await requireGithubActionAllowed(userId, "github-validate-connect");

    const cleanedRepo = cleanGithubRepoInput(repo);
    if (!cleanedRepo) {
      return { ok: false as const, error: "Enter a valid repo (owner/name) or GitHub URL." };
    }

    let token = cleanGithubTokenInput(pastedToken);
    if (token === null) {
      return { ok: false as const, error: "Token is too long." };
    }
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
      repo: cleanedRepo,
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
      githubRepo: cleanedRepo,
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
    await requireGithubActionAllowed(userId, "github-generate-docs");

    const project = await ctx.runQuery(internal.objects.getProjectForUser, {
      projectId,
      userId,
    });
    if (!project?.githubRepo) {
      throw new Error("Connect a GitHub repository first.");
    }

    let token = cleanGithubTokenInput(pastedToken);
    if (token === null) {
      throw new Error("Token is too long.");
    }
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

    const cleanedRepo = cleanGithubRepoInput(project.githubRepo);
    if (!cleanedRepo) throw new Error("Connected GitHub repository is invalid.");

    return await ctx.runAction((internal as any).github.generateDocs, {
      repo: cleanedRepo,
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
    await requireGithubActionAllowed(userId, "github-sync-project");

    const project = await ctx.runQuery(internal.objects.getProjectForUser, {
      projectId,
      userId,
    });
    if (!project?.githubRepo) {
      throw new Error("Connect a GitHub repository first.");
    }

    let token = cleanGithubTokenInput(pastedToken);
    if (token === null) {
      throw new Error("Token is too long.");
    }
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

    const cleanedRepo = cleanGithubRepoInput(project.githubRepo);
    if (!cleanedRepo) throw new Error("Connected GitHub repository is invalid.");

    const result = await ctx.runAction((internal as any).github.syncRepo, {
      repo: cleanedRepo,
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
