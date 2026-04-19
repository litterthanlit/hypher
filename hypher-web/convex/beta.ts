import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { requireUserId } from "./lib/auth";

type FeedbackCategory = "bug" | "friction" | "idea" | "praise";
type FeedbackStatus = "new" | "reviewed" | "closed";

const PREFIX_LEN = 10;
const BCRYPT_COST = 10;
const MAX_FEEDBACK_LENGTH = 2000;

const feedbackCategory = v.union(
  v.literal("bug"),
  v.literal("friction"),
  v.literal("idea"),
  v.literal("praise")
);

const feedbackStatus = v.union(
  v.literal("new"),
  v.literal("reviewed"),
  v.literal("closed")
);

function gateEnabled(): boolean {
  return process.env.BETA_INVITE_GATE_ENABLED === "true";
}

function isAdmin(userId: string): boolean {
  const raw = process.env.BETA_ADMIN_USER_IDS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

async function requireAdmin(ctx: Parameters<typeof requireUserId>[0]): Promise<string> {
  const userId = await requireUserId(ctx);
  if (!isAdmin(userId)) throw new Error("Unauthorized");
  return userId;
}

function normalizeInviteCode(input: string): string {
  return input.replace(/\s+/g, "").trim().toUpperCase();
}

function splitInviteCode(input: string): { prefix: string; remainder: string } | null {
  const normalized = normalizeInviteCode(input);
  if (!/^HYP-[A-Z0-9-]{12,}$/.test(normalized)) return null;
  const compact = normalized.replace(/-/g, "");
  if (compact.length <= PREFIX_LEN) return null;
  return {
    prefix: compact.slice(0, PREFIX_LEN),
    remainder: compact.slice(PREFIX_LEN),
  };
}

function randomPart(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function generateInviteCode(): string {
  return `HYP-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}-${randomPart(4)}`;
}

function validateInvite(invite: {
  revokedAt?: number;
  expiresAt?: number;
  maxRedemptions: number;
  redemptionCount: number;
}, now: number): "ok" | "revoked" | "expired" | "exhausted" {
  if (invite.revokedAt !== undefined) return "revoked";
  if (invite.expiresAt !== undefined && invite.expiresAt <= now) return "expired";
  if (invite.redemptionCount >= invite.maxRedemptions) return "exhausted";
  return "ok";
}

async function getAccessRow(ctx: Parameters<typeof requireUserId>[0], userId: string) {
  return await ctx.db
    .query("betaAccess")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export const getGateState = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const admin = isAdmin(userId);
    const access = await getAccessRow(ctx, userId);
    const enabled = gateEnabled();
    return {
      gateEnabled: enabled,
      isAdmin: admin,
      hasAccess: !enabled || admin || access !== null,
      ...(access ? { accessGrantedAt: access.grantedAt } : {}),
    };
  },
});

export const redeemInviteCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireUserId(ctx);
    const existingAccess = await getAccessRow(ctx, userId);
    if (existingAccess) {
      return { ok: true as const, alreadyHadAccess: true as const };
    }

    const parts = splitInviteCode(code);
    if (!parts) return { ok: false as const, error: "invalid-code" as const };

    const candidates = await ctx.db
      .query("betaInvites")
      .withIndex("by_prefix", (q) => q.eq("prefix", parts.prefix))
      .collect();

    const now = Date.now();
    for (const invite of candidates) {
      if (!bcrypt.compareSync(parts.remainder, invite.remainderBcrypt)) continue;
      const valid = validateInvite(invite, now);
      if (valid !== "ok") return { ok: false as const, error: valid };

      await ctx.db.insert("betaAccess", {
        userId,
        inviteId: invite._id,
        grantedAt: now,
      });
      await ctx.db.patch(invite._id, {
        redemptionCount: invite.redemptionCount + 1,
      });
      return { ok: true as const, alreadyHadAccess: false as const };
    }

    return { ok: false as const, error: "invalid-code" as const };
  },
});

export const listInvites = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invites = await ctx.db
      .query("betaInvites")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return invites.map((invite) => ({
      id: invite._id,
      prefix: invite.prefix,
      label: invite.label,
      maxRedemptions: invite.maxRedemptions,
      redemptionCount: invite.redemptionCount,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
      revokedAt: invite.revokedAt,
      expiresAt: invite.expiresAt,
    }));
  },
});

export const createInvite = mutation({
  args: {
    label: v.string(),
    maxRedemptions: v.number(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { label, maxRedemptions, expiresAt }) => {
    const adminId = await requireAdmin(ctx);
    const trimmed = label.trim();
    if (!trimmed) throw new Error("Label required");
    if (!Number.isFinite(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 500) {
      throw new Error("Max redemptions must be between 1 and 500");
    }

    const code = generateInviteCode();
    const parts = splitInviteCode(code);
    if (!parts) throw new Error("Could not generate invite code");
    const inviteId = await ctx.db.insert("betaInvites", {
      prefix: parts.prefix,
      remainderBcrypt: bcrypt.hashSync(parts.remainder, BCRYPT_COST),
      label: trimmed,
      maxRedemptions: Math.floor(maxRedemptions),
      redemptionCount: 0,
      createdBy: adminId,
      createdAt: Date.now(),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    });

    return {
      inviteId,
      code,
      prefix: parts.prefix,
    };
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("betaInvites") },
  handler: async (ctx, { inviteId }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(inviteId);
    if (!row) throw new Error("Invite not found");
    await ctx.db.patch(inviteId, { revokedAt: Date.now() });
    return { ok: true as const };
  },
});

export const submitFeedback = mutation({
  args: {
    category: feedbackCategory,
    message: v.string(),
    pagePath: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const admin = isAdmin(userId);
    const access = await getAccessRow(ctx, userId);
    if (gateEnabled() && !admin && !access) throw new Error("Invite required");

    const message = args.message.trim();
    if (!message) throw new Error("Feedback message required");
    if (message.length > MAX_FEEDBACK_LENGTH) {
      throw new Error("Feedback is too long");
    }

    const now = Date.now();
    return await ctx.db.insert("betaFeedback", {
      userId,
      category: args.category as FeedbackCategory,
      message,
      pagePath: args.pagePath?.slice(0, 300),
      userAgent: args.userAgent?.slice(0, 300),
      status: "new",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listFeedback = query({
  args: { status: v.optional(feedbackStatus) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? await ctx.db
          .query("betaFeedback")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .collect()
      : await ctx.db
          .query("betaFeedback")
          .withIndex("by_createdAt")
          .order("desc")
          .collect();

    return rows.map((row) => ({
      id: row._id,
      userId: row.userId,
      category: row.category,
      message: row.message,
      pagePath: row.pagePath,
      userAgent: row.userAgent,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const updateFeedbackStatus = mutation({
  args: {
    feedbackId: v.id("betaFeedback"),
    status: feedbackStatus,
  },
  handler: async (ctx, { feedbackId, status }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(feedbackId);
    if (!existing) throw new Error("Feedback not found");
    await ctx.db.patch(feedbackId, {
      status: status as FeedbackStatus,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
