"use node";

import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import crypto from "crypto";

function encryptionKey(): Buffer {
  const s = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!s || s.length < 8) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY not configured (min 8 chars)");
  }
  return crypto.createHash("sha256").update(s, "utf8").digest();
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
/** Returns stored PAT for the current user (for client-side GitHub actions). */
export const getTokenForCurrentUser = action({
  args: {},
  handler: async (ctx): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.runAction(internal.githubPat.decryptTokenForUser, {
      userId: identity.subject,
    });
  },
});

export const savePersonalAccessToken = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    await ghFetchUser(token.trim());
    const ciphertext = encryptToken(token.trim());
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
