import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { v } from "convex/values";
import { hasBetaAccess, requireBetaAccess } from "./lib/auth";
import type { Id } from "./_generated/dataModel";
import bcrypt from "bcryptjs";

/**
 * 30-day sunset for legacy salt-less hashes (manual enforcement).
 *
 * TODO: After sunset, remove legacy validation branches in `validate` and drop the
 * `by_legacy_full` schema index (only used for that fallback).
 */
export const LEGACY_HASH_SUNSET_MS = 30 * 24 * 60 * 60 * 1000;

const BCRYPT_COST = 10;
const PREFIX_LEN = 8;

/** Legacy fingerprint of the full plaintext key (pre-bcrypt migration). */
function legacyHashFullKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hk_${Math.abs(hash).toString(36)}`;
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const entropy = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `hyp_${entropy}`;
}

function splitKey(plain: string): { prefix: string; remainder: string } | null {
  if (plain.length <= PREFIX_LEN) return null;
  return {
    prefix: plain.slice(0, PREFIX_LEN),
    remainder: plain.slice(PREFIX_LEN),
  };
}

/** Constant-time compare for equal-length ASCII strings (Convex V8 — no Node `crypto`). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isLegacyKeyValidationAllowed(
  row: { createdAt: number; revokedAt?: number },
  now = Date.now()
): boolean {
  if (row.revokedAt !== undefined) return false;
  return now - row.createdAt <= LEGACY_HASH_SUNSET_MS;
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await requireBetaAccess(ctx);
    const plainKey = generateApiKey();
    const parts = splitKey(plainKey);
    if (!parts) throw new Error("Invalid generated key");

    const remainderBcrypt = bcrypt.hashSync(parts.remainder, BCRYPT_COST);

    await ctx.db.insert("apiKeys", {
      userId,
      name,
      prefix: parts.prefix,
      remainderBcrypt,
      createdAt: Date.now(),
    });

    return plainKey;
  },
});

export const list = query({
  args: { includeRevoked: v.optional(v.boolean()) },
  handler: async (ctx, { includeRevoked }) => {
    const userId = await requireBetaAccess(ctx);
    const keys = await ctx.db.query("apiKeys").collect();
    return keys
      .filter((k) => k.userId === userId)
      .filter((k) => includeRevoked || k.revokedAt === undefined)
      .map((k) => ({
        id: k._id,
        name: k.name,
        prefix: k.prefix ?? "—",
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
        revokedAt: k.revokedAt,
        needsRotation: k.needsRotation ?? false,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const revoke = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, { keyId }) => {
    const userId = await requireBetaAccess(ctx);
    const row = await ctx.db.get(keyId);
    if (!row || row.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(keyId, { revokedAt: Date.now() });
  },
});

export type ValidateResult = {
  userId: string;
  keyId: Id<"apiKeys">;
  rateLimitKey: string;
};

export const validate = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<ValidateResult | null> => {
    const parts = splitKey(key);
    if (parts) {
      const candidates = await ctx.db
        .query("apiKeys")
        .withIndex("by_prefix", (q) => q.eq("prefix", parts.prefix))
        .collect();

      for (const row of candidates) {
        if (row.revokedAt !== undefined) continue;
        if (!row.remainderBcrypt) continue;
        if (bcrypt.compareSync(parts.remainder, row.remainderBcrypt)) {
          if (!row.prefix) continue;
          if (!(await hasBetaAccess(ctx, row.userId))) return null;
          return {
            userId: row.userId,
            keyId: row._id,
            rateLimitKey: row.prefix,
          };
        }
      }
    }

    const legacyFp = legacyHashFullKey(key);

    const byLegacyIndex = await ctx.db
      .query("apiKeys")
      .withIndex("by_legacy_full", (q) => q.eq("legacyFullKeyHash", legacyFp))
      .first();
    if (
      byLegacyIndex &&
      byLegacyIndex.revokedAt === undefined &&
      byLegacyIndex.legacyFullKeyHash !== undefined &&
      isLegacyKeyValidationAllowed(byLegacyIndex) &&
      timingSafeEqualStr(legacyFp, byLegacyIndex.legacyFullKeyHash)
    ) {
      if (!(await hasBetaAccess(ctx, byLegacyIndex.userId))) return null;
      return {
        userId: byLegacyIndex.userId,
        keyId: byLegacyIndex._id,
        rateLimitKey:
          byLegacyIndex.prefix ?? legacyFp.slice(0, PREFIX_LEN),
      };
    }

    const byOldKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", legacyFp))
      .first();
    if (
      byOldKey &&
      byOldKey.revokedAt === undefined &&
      byOldKey.key !== undefined &&
      isLegacyKeyValidationAllowed(byOldKey) &&
      timingSafeEqualStr(legacyFp, byOldKey.key)
    ) {
      if (!(await hasBetaAccess(ctx, byOldKey.userId))) return null;
      return {
        userId: byOldKey.userId,
        keyId: byOldKey._id,
        rateLimitKey: byOldKey.prefix ?? legacyFp.slice(0, PREFIX_LEN),
      };
    }

    return null;
  },
});

export const touch = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, { keyId }) => {
    const row = await ctx.db.get(keyId);
    if (row && row.revokedAt === undefined) {
      await ctx.db.patch(keyId, { lastUsed: Date.now() });
    }
  },
});

/**
 * One-shot migration: cannot rehash without plaintext — mark rotation + legacy hash path.
 * Idempotent: rows already having `legacyFullKeyHash` or `remainderBcrypt` are skipped.
 */
export const migrateApiKeyHashes = internalMutation({
  handler: async (ctx) => {
    const rows = await ctx.db.query("apiKeys").collect();
    let updated = 0;
    for (const row of rows) {
      if (row.remainderBcrypt || row.legacyFullKeyHash) continue;
      const oldFingerprint = row.key;
      if (!oldFingerprint) continue;
      await ctx.db.patch(row._id, {
        legacyFullKeyHash: oldFingerprint,
        needsRotation: true,
        key: undefined,
      });
      updated++;
    }
    return {
      updated,
      /** Fingerprint format for legacy full-key hash (still accepted until sunset). */
      legacyHash: legacyHashFullKey("hyp_sample"),
    };
  },
});
