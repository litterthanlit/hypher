import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hasBetaAccess, requireBetaAccess } from "./lib/auth";
import {
  getRegisteredOAuthClient,
  isRedirectUriRegistered,
  registeredOAuthClients,
} from "../shared/oauthClients";
import { oauthResourcesEquivalent } from "../shared/oauthResources";

const CODE_TTL_MS = 10 * 60 * 1000;
const CONSENT_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function isRegisteredRedirect(clientId: string, redirectUri: string): boolean {
  const client = getRegisteredOAuthClient(clientId, registeredOAuthClients());
  return client ? isRedirectUriRegistered(client, redirectUri) : false;
}

function getClientName(clientId: string): string {
  return getRegisteredOAuthClient(clientId, registeredOAuthClients())?.name ?? clientId;
}

function requireOAuthServerSecret(serverSecret: string) {
  const expected = process.env.HYPHER_OAUTH_CONSENT_SECRET;
  if (!expected || serverSecret !== expected) {
    throw new Error("Unauthorized OAuth server");
  }
}

type PendingOAuthConsentForCodeIssue = {
  userId: string;
  clientId: string;
  redirectUri: string;
  csrfTokenHash: string;
  expiresAt: number;
  codeIssuedAt?: number;
};

export function validatePendingOAuthConsentForCodeIssue(args: {
  consent: PendingOAuthConsentForCodeIssue | null;
  userId: string;
  csrfTokenHash: string;
  now: number;
  serverSecret?: string;
  expectedServerSecret?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!args.expectedServerSecret || args.serverSecret !== args.expectedServerSecret) {
    return { ok: false, reason: "server_secret" };
  }
  if (!args.consent) return { ok: false, reason: "not_found" };
  if (args.consent.userId !== args.userId) return { ok: false, reason: "user" };
  if (args.consent.expiresAt <= args.now) return { ok: false, reason: "expired" };
  if (args.consent.codeIssuedAt !== undefined) return { ok: false, reason: "used" };
  if (args.consent.csrfTokenHash !== args.csrfTokenHash) return { ok: false, reason: "csrf" };
  if (!isRegisteredRedirect(args.consent.clientId, args.consent.redirectUri)) {
    return { ok: false, reason: "client" };
  }
  return { ok: true };
}

export const createPendingConsent = mutation({
  args: {
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    scope: v.string(),
    state: v.optional(v.string()),
    csrfTokenHash: v.string(),
    now: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    requireOAuthServerSecret(args.serverSecret);
    if (!isRegisteredRedirect(args.clientId, args.redirectUri)) {
      throw new Error("Unauthorized OAuth client");
    }

    const consentId = await ctx.db.insert("oauthConsentTransactions", {
      userId,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      codeChallenge: args.codeChallenge,
      resource: args.resource,
      scope: args.scope,
      state: args.state,
      csrfTokenHash: args.csrfTokenHash,
      createdAt: args.now,
      expiresAt: args.now + CONSENT_TTL_MS,
    });

    return { consentId };
  },
});

export const getPendingConsent = query({
  args: {
    consentId: v.id("oauthConsentTransactions"),
    csrfTokenHash: v.string(),
    now: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    requireOAuthServerSecret(args.serverSecret);
    const consent = await ctx.db.get(args.consentId);
    const validation = validatePendingOAuthConsentForCodeIssue({
      consent,
      userId,
      csrfTokenHash: args.csrfTokenHash,
      now: args.now,
      serverSecret: args.serverSecret,
      expectedServerSecret: process.env.HYPHER_OAUTH_CONSENT_SECRET,
    });
    if (!validation.ok || !consent) return null;

    return {
      clientId: consent.clientId,
      clientName: getClientName(consent.clientId),
      resource: consent.resource,
      scope: consent.scope,
      expiresAt: consent.expiresAt,
    };
  },
});

export const createAuthorizationCode = mutation({
  args: {
    codeHash: v.string(),
    consentId: v.id("oauthConsentTransactions"),
    csrfTokenHash: v.string(),
    now: v.number(),
    serverSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireBetaAccess(ctx);
    requireOAuthServerSecret(args.serverSecret);
    const consent = await ctx.db.get(args.consentId);
    const validation = validatePendingOAuthConsentForCodeIssue({
      consent,
      userId,
      csrfTokenHash: args.csrfTokenHash,
      now: args.now,
      serverSecret: args.serverSecret,
      expectedServerSecret: process.env.HYPHER_OAUTH_CONSENT_SECRET,
    });
    if (!validation.ok || !consent) {
      return null;
    }

    await ctx.db.patch(args.consentId, {
      approvedAt: args.now,
      codeIssuedAt: args.now,
    });
    await ctx.db.insert("oauthAuthorizationCodes", {
      codeHash: args.codeHash,
      userId,
      clientId: consent.clientId,
      redirectUri: consent.redirectUri,
      codeChallenge: consent.codeChallenge,
      resource: consent.resource,
      scope: consent.scope,
      consentedAt: args.now,
      createdAt: args.now,
      expiresAt: args.now + CODE_TTL_MS,
    });

    return {
      redirectUri: consent.redirectUri,
      state: consent.state,
    };
  },
});

export const exchangeAuthorizationCode = mutation({
  args: {
    codeHash: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    accessTokenHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const code = await ctx.db
      .query("oauthAuthorizationCodes")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (!code || code.consumedAt !== undefined || code.expiresAt <= args.now) {
      return null;
    }
    if (
      code.clientId !== args.clientId ||
      code.redirectUri !== args.redirectUri ||
      code.codeChallenge !== args.codeChallenge ||
      !oauthResourcesEquivalent(code.resource, args.resource)
    ) {
      return null;
    }
    if (!isRegisteredRedirect(args.clientId, args.redirectUri)) return null;
    if (!(await hasBetaAccess(ctx, code.userId))) return null;

    await ctx.db.patch(code._id, { consumedAt: args.now });
    await ctx.db.insert("oauthAccessTokens", {
      tokenHash: args.accessTokenHash,
      userId: code.userId,
      clientId: code.clientId,
      resource: code.resource,
      scope: code.scope,
      createdAt: args.now,
      expiresAt: args.now + TOKEN_TTL_MS,
    });

    return {
      userId: code.userId,
      scope: code.scope,
      expiresIn: Math.floor(TOKEN_TTL_MS / 1000),
    };
  },
});

async function lookupAccessToken(
  ctx: { db: any },
  args: { tokenHash: string; resource: string; scope: string; now: number },
  touch: boolean
) {
  const token = await ctx.db
    .query("oauthAccessTokens")
    .withIndex("by_tokenHash", (q: any) => q.eq("tokenHash", args.tokenHash))
    .unique();

  if (!token || token.revokedAt !== undefined || token.expiresAt <= args.now) {
    return null;
  }
  if (
    !oauthResourcesEquivalent(token.resource, args.resource) ||
    !token.scope.split(/\s+/).includes(args.scope)
  ) {
    return null;
  }
  if (!(await hasBetaAccess(ctx as any, token.userId))) {
    return null;
  }
  if (touch) {
    await ctx.db.patch(token._id, { lastUsedAt: args.now });
  }
  return {
    userId: token.userId,
    clientId: token.clientId,
    scope: token.scope,
    expiresAt: token.expiresAt,
  };
}

export const validateAccessToken = mutation({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    return await lookupAccessToken(ctx, args, true);
  },
});

export const userIdForAccessToken = internalQuery({
  args: {
    tokenHash: v.string(),
    resource: v.string(),
    scope: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const token = await lookupAccessToken(ctx, args, false);
    return token ? { userId: token.userId } : null;
  },
});

export const listConnections = query({
  handler: async (ctx) => {
    const userId = await requireBetaAccess(ctx);
    const rows = await ctx.db.query("oauthAccessTokens").collect();

    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row._id,
        clientId: row.clientId,
        scope: row.scope,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        lastUsedAt: row.lastUsedAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const revokeConnection = mutation({
  args: { tokenId: v.id("oauthAccessTokens") },
  handler: async (ctx, { tokenId }) => {
    const userId = await requireBetaAccess(ctx);
    const row = await ctx.db.get(tokenId);
    if (!row || row.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(tokenId, { revokedAt: Date.now() });
    return { ok: true as const };
  },
});
