"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";
import { cleanGithubRepoInput } from "./githubProjectActions";

function parseRepoFromInput(input: string): string | null {
  if (input.length > 500) return null;
  const t = input.trim();
  if (!t) return null;
  try {
    if (t.includes("github.com")) {
      const u = new URL(t.startsWith("http") ? t : `https://${t}`);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      return null;
    }
  } catch {
    /* fall through */
  }
  const slash = t.replace(/^\/+/, "");
  if (/^[\w.-]+\/[\w.-]+$/.test(slash)) return slash;
  return null;
}

export const connectRepoToProject = action({
  args: { projectId: v.id("objects"), repoInput: v.string() },
  handler: async (
    ctx,
    { projectId, repoInput }
  ): Promise<
    | { ok: true; repo: string }
    | { ok: false; error: string }
  > => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "github-connect-repo", {
      requests: 20,
      window: "1h",
    });
    if (!allowed) throw new Error("Rate limited");

    const repo = parseRepoFromInput(repoInput);
    if (!repo) {
      return { ok: false, error: "Enter a valid repo (owner/name) or GitHub URL." };
    }
    const cleanedRepo = cleanGithubRepoInput(repo);
    if (!cleanedRepo) {
      return { ok: false, error: "Enter a valid repo (owner/name) or GitHub URL." };
    }

    const token = await ctx.runAction(internal.githubPat.decryptTokenForUser, {
      userId,
    });
    if (!token) {
      return {
        ok: false,
        error: "Save a GitHub personal access token in Settings → Integrations first.",
      };
    }

    const validated = await ctx.runAction(internal.github.validateRepoInternal, {
      repo: cleanedRepo,
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
      githubRepo: cleanedRepo,
      githubLastSync: Date.now(),
    });

    const sync = await ctx.runAction(internal.github.syncRepoInternal, {
      repo: cleanedRepo,
      token,
      projectId: projectId as string,
      projectName: validated.name,
    });

    if (sync.latestCommitDate) {
      await ctx.runMutation(internal.githubInternal.touchSync, {
        projectId: projectId as Id<"objects">,
        timestamp: sync.latestCommitDate,
        blockers: sync.blockers,
      });
    }

    return { ok: true, repo: validated.name };
  },
});
