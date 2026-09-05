"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import crypto from "crypto";
import { requireActionBetaAccess } from "./lib/actionAuth";
import { ratelimitConvex } from "./lib/rateLimit";
import { cleanGithubTokenInput } from "./githubProjectActions";

export const GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED =
  "GitHub token encryption is not configured on this server (GITHUB_TOKEN_ENCRYPTION_KEY). Binding a repo does not need a token.";

export function githubTokenEncryptionKeyError(
  key: string | undefined | null
): string | null {
  if (!key || key.length < 8) {
    return GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED;
  }
  return null;
}

function encryptionKey(): Buffer {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  const error = githubTokenEncryptionKeyError(key);
  if (error || !key) {
    throw new Error(error ?? GITHUB_TOKEN_ENCRYPTION_UNCONFIGURED);
  }
  return crypto.createHash("sha256").update(key, "utf8").digest();
}

function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptTokenBlob(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 28) throw new Error("Invalid token blob");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function ghFetchUser(token: string): Promise<{ login: string }> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Save PAT after validating with GET /user. Stores AES-256-GCM ciphertext only. */
export const savePersonalAccessToken = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const userId = await requireActionBetaAccess(ctx);
    const allowed = await ratelimitConvex(userId, "github-save-pat", {
      requests: 10,
      window: "1h",
    });
    if (!allowed) throw new Error("Rate limited");

    const cleanedToken = cleanGithubTokenInput(token);
    if (!cleanedToken) throw new Error("Invalid token");

    const encryptionError = githubTokenEncryptionKeyError(
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY
    );
    if (encryptionError) throw new Error(encryptionError);

    await ghFetchUser(cleanedToken);
    const ciphertext = encryptToken(cleanedToken);
    await ctx.runMutation(internal.githubTokens.upsertEncryptedToken, {
      userId,
      ciphertext,
    });
    return { ok: true as const };
  },
});

export const decryptTokenForUser = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<string | null> => {
    const row = await ctx.runQuery(internal.githubTokens.getEncryptedTokenRow, {
      userId,
    });
    if (!row?.accessToken) return null;
    try {
      return decryptTokenBlob(row.accessToken);
    } catch {
      return null;
    }
  },
});
