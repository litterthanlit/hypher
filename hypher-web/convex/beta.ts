import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { requireUserId } from "./lib/auth";
import { ratelimitConvex } from "./lib/rateLimit";

type FeedbackCategory = "bug" | "friction" | "idea" | "praise";
type FeedbackStatus = "new" | "reviewed" | "closed";
type BetaRequestStatus = "pending" | "approved" | "rejected" | "archived";

const PREFIX_LEN = 10;
const BCRYPT_COST = 10;
const MAX_FEEDBACK_LENGTH = 2000;
const REQUEST_LIMITS = {
  name: 80,
  email: 160,
  role: 120,
  work: 500,
  pain: 500,
  link: 220,
  howFound: 240,
  adminNotes: 1000,
  idealUserType: 80,
};

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

const betaRequestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("archived")
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

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function trimLimit(input: string | undefined, limit: number): string {
  return (input ?? "").trim().slice(0, limit);
}

function normalizeRequestInput(args: {
  name: string;
  email: string;
  role: string;
  work: string;
  pain: string;
  link?: string;
  howFound: string;
  website?: string;
}):
  | {
      ok: true;
      request: {
        name: string;
        email: string;
        emailNorm: string;
        role: string;
        work: string;
        pain: string;
        link?: string;
        howFound: string;
      };
    }
  | { ok: false; error: string } {
  if (args.website?.trim()) return { ok: false, error: "bot-field" };

  const name = trimLimit(args.name, REQUEST_LIMITS.name);
  const email = trimLimit(args.email, REQUEST_LIMITS.email);
  const emailNorm = normalizeEmail(email);
  const role = trimLimit(args.role, REQUEST_LIMITS.role);
  const work = trimLimit(args.work, REQUEST_LIMITS.work);
  const pain = trimLimit(args.pain, REQUEST_LIMITS.pain);
  const link = trimLimit(args.link, REQUEST_LIMITS.link);
  const howFound = trimLimit(args.howFound, REQUEST_LIMITS.howFound);

  if (!name) return { ok: false, error: "name-required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return { ok: false, error: "email-invalid" };
  if (!role) return { ok: false, error: "role-required" };
  if (!work) return { ok: false, error: "work-required" };
  if (!pain) return { ok: false, error: "pain-required" };
  if (!howFound) return { ok: false, error: "how-found-required" };

  return {
    ok: true,
    request: {
      name,
      email,
      emailNorm,
      role,
      work,
      pain,
      ...(link ? { link } : {}),
      howFound,
    },
  };
}

async function insertInvite(ctx: MutationCtx, args: {
  adminId: string;
  label: string;
  maxRedemptions: number;
  expiresAt?: number;
}) {
  const trimmed = args.label.trim();
  if (!trimmed) throw new Error("Label required");
  if (!Number.isFinite(args.maxRedemptions) || args.maxRedemptions < 1 || args.maxRedemptions > 500) {
    throw new Error("Max redemptions must be between 1 and 500");
  }

  const code = generateInviteCode();
  const parts = splitInviteCode(code);
  if (!parts) throw new Error("Could not generate invite code");
  const inviteId = await ctx.db.insert("betaInvites", {
    prefix: parts.prefix,
    remainderBcrypt: bcrypt.hashSync(parts.remainder, BCRYPT_COST),
    label: trimmed,
    maxRedemptions: Math.floor(args.maxRedemptions),
    redemptionCount: 0,
    createdBy: args.adminId,
    createdAt: Date.now(),
    ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
  });

  return {
    inviteId,
    code,
    prefix: parts.prefix,
  };
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
    const enabled = gateEnabled();
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        gateEnabled: enabled,
        isAdmin: false,
        isAuthenticated: false,
        hasAccess: !enabled,
      };
    }
    const userId = identity.subject;
    const admin = isAdmin(userId);
    const access = await getAccessRow(ctx, userId);
    return {
      gateEnabled: enabled,
      isAdmin: admin,
      isAuthenticated: true,
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
    return await insertInvite(ctx, { adminId, label, maxRedemptions, expiresAt });
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

export const submitRequest = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
    work: v.string(),
    pain: v.string(),
    link: v.optional(v.string()),
    howFound: v.string(),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeRequestInput(args);
    if (!normalized.ok) return { ok: false as const, error: normalized.error };

    const allowed = await ratelimitConvex(
      normalized.request.emailNorm,
      "beta-request",
      { requests: 3, window: "1h" }
    );
    if (!allowed) return { ok: false as const, error: "rate-limited" as const };

    const existing = await ctx.db
      .query("betaRequests")
      .withIndex("by_email", (q) => q.eq("emailNorm", normalized.request.emailNorm))
      .collect();
    const active = existing.find((row) => row.status !== "archived");
    if (active) {
      return {
        ok: true as const,
        duplicate: true as const,
        requestId: active._id,
        status: active.status,
      };
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("betaRequests", {
      ...normalized.request,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true as const, duplicate: false as const, requestId, status: "pending" as const };
  },
});

export const listRequests = query({
  args: { status: v.optional(betaRequestStatus) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = status
      ? await ctx.db
          .query("betaRequests")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .collect()
      : await ctx.db
          .query("betaRequests")
          .withIndex("by_createdAt")
          .order("desc")
          .collect();

    return rows.map((row) => ({
      id: row._id,
      name: row.name,
      email: row.email,
      role: row.role,
      work: row.work,
      pain: row.pain,
      link: row.link,
      howFound: row.howFound,
      status: row.status,
      adminNotes: row.adminNotes,
      idealUserType: row.idealUserType,
      inviteId: row.inviteId,
      invitePrefix: row.invitePrefix,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      archivedAt: row.archivedAt,
    }));
  },
});

export const updateRequestReview = mutation({
  args: {
    requestId: v.id("betaRequests"),
    adminNotes: v.optional(v.string()),
    idealUserType: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, adminNotes, idealUserType }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(requestId);
    if (!existing) throw new Error("Request not found");
    await ctx.db.patch(requestId, {
      adminNotes: trimLimit(adminNotes, REQUEST_LIMITS.adminNotes) || undefined,
      idealUserType: trimLimit(idealUserType, REQUEST_LIMITS.idealUserType) || undefined,
      updatedAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const updateRequestStatus = mutation({
  args: {
    requestId: v.id("betaRequests"),
    status: betaRequestStatus,
  },
  handler: async (ctx, { requestId, status }) => {
    const adminId = await requireAdmin(ctx);
    const existing = await ctx.db.get(requestId);
    if (!existing) throw new Error("Request not found");
    if (status === "approved") throw new Error("Use approveRequest to approve requests");

    const now = Date.now();
    await ctx.db.patch(requestId, {
      status: status as BetaRequestStatus,
      updatedAt: now,
      reviewedAt: status === "pending" ? undefined : now,
      reviewedBy: status === "pending" ? undefined : adminId,
      archivedAt: status === "archived" ? now : undefined,
    });
    return { ok: true as const, status: status as BetaRequestStatus };
  },
});

export const approveRequest = mutation({
  args: { requestId: v.id("betaRequests") },
  handler: async (ctx, { requestId }) => {
    const adminId = await requireAdmin(ctx);
    const existing = await ctx.db.get(requestId);
    if (!existing) throw new Error("Request not found");
    if (existing.status === "approved" && existing.inviteId) {
      throw new Error("Request already approved");
    }
    if (existing.status === "archived") {
      throw new Error("Archived requests cannot be approved");
    }

    const invite = await insertInvite(ctx, {
      adminId,
      label: `Beta request: ${existing.name}`,
      maxRedemptions: 1,
      expiresAt: Date.now() + 30 * 86_400_000,
    });
    const now = Date.now();
    await ctx.db.patch(requestId, {
      status: "approved",
      inviteId: invite.inviteId,
      invitePrefix: invite.prefix,
      reviewedAt: now,
      reviewedBy: adminId,
      updatedAt: now,
      archivedAt: undefined,
    });
    return {
      ok: true as const,
      requestId,
      inviteId: invite.inviteId,
      code: invite.code,
      prefix: invite.prefix,
    };
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
