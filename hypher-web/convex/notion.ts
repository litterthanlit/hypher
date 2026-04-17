import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUserId } from "./lib/auth";

const NOTION_SEARCH_URL = "https://api.notion.com/v1/search";
const NOTION_API_VERSION = "2022-06-28";
export const NOTION_IMPORT_CAP = 50;

// ─── Public queries ───────────────────────────────────────────────────────────

export const getTokenStatus = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("notionTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      connected: !!row?.accessToken,
      workspaceName: row?.workspaceName,
    };
  },
});

export const getImportProgress = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return meta?.notionImportProgress ?? null;
  },
});

// ─── Public mutations ─────────────────────────────────────────────────────────

/**
 * Persist a Notion OAuth token for the signed-in user. Called from
 * /api/notion/callback via fetchMutation with the user's Convex token.
 */
export const storeToken = mutation({
  args: {
    accessToken: v.string(),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    botId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("notionTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        workspaceId: args.workspaceId,
        workspaceName: args.workspaceName,
        botId: args.botId,
      });
      return existing._id;
    }
    return await ctx.db.insert("notionTokens", {
      userId,
      accessToken: args.accessToken,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      botId: args.botId,
      createdAt: Date.now(),
    });
  },
});

export const clearToken = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db
      .query("notionTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

// ─── Internal helpers used by the import action ───────────────────────────────

export const getTokenForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("notionTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

export const setImportProgress = internalMutation({
  args: {
    userId: v.string(),
    imported: v.number(),
    total: v.number(),
    startedAt: v.number(),
  },
  handler: async (ctx, { userId, imported, total, startedAt }) => {
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const progress = { imported, total, startedAt };
    if (meta) {
      await ctx.db.patch(meta._id, { notionImportProgress: progress });
    } else {
      await ctx.db.insert("userMeta", {
        userId,
        legacyClaimed: false,
        notionImportProgress: progress,
      });
    }
  },
});

export const clearImportProgress = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (meta?.notionImportProgress !== undefined) {
      await ctx.db.patch(meta._id, { notionImportProgress: undefined });
    }
  },
});

export const insertImportedObject = internalMutation({
  args: {
    userId: v.string(),
    kind: v.union(v.literal("project"), v.literal("note")),
    name: v.optional(v.string()),
    content: v.optional(v.string()),
    projectId: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
    maturity: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("objects", {
      userId: args.userId,
      kind: args.kind,
      name: args.name,
      content: args.content,
      projectId: args.projectId ?? null,
      status: args.status,
      maturity: args.maturity,
      createdAt: args.createdAt,
      modifiedAt: now,
    });
  },
});

// ─── Shared classification (mirrored from src/lib/notion-import.ts) ───────────
//
// Convex functions cannot import from outside convex/, so this duplicates the
// classifyPage logic intentionally. Keep in sync with src/lib/notion-import.ts.

const PROJECT_PAGES = [
  "Hypher",
  "Marque",
  "Litt.designs",
  "Ergon",
  "COLOSSAL PROJECTS",
];

function classifyPage(title: string): { isProject: boolean; parentProject?: string } {
  const lower = title.toLowerCase();
  for (const p of PROJECT_PAGES) {
    if (lower.includes(p.toLowerCase())) return { isProject: true };
  }
  if (lower.includes("studio os") || /^v\d/.test(title)) {
    return { isProject: false, parentProject: "Studio OS" };
  }
  if (lower.includes("content") || lower.includes("week")) {
    return { isProject: false, parentProject: "Content" };
  }
  return { isProject: false };
}

// ─── Public action: importFromNotion ──────────────────────────────────────────

type NotionSearchPage = {
  id: string;
  object: "page";
  properties?: Record<string, { type: string; title?: Array<{ plain_text?: string }> }>;
  url?: string;
};

function extractTitle(page: NotionSearchPage): string {
  const props = page.properties ?? {};
  for (const value of Object.values(props)) {
    if (value?.type === "title" && Array.isArray(value.title)) {
      const text = value.title.map((t) => t?.plain_text ?? "").join("").trim();
      if (text) return text;
    }
  }
  return "Untitled";
}

export const importFromNotion = action({
  handler: async (ctx): Promise<{ imported: number; capped: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;

    const tokenRow: { accessToken: string } | null = await ctx.runQuery(
      internal.notion.getTokenForUser,
      { userId }
    );
    if (!tokenRow?.accessToken) {
      throw new Error("Notion not connected");
    }

    // Fetch up to 50 pages in a single search call. Bare object (no query) returns
    // everything the integration has access to, most-recently-edited first.
    const res = await fetch(NOTION_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRow.accessToken}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        page_size: NOTION_IMPORT_CAP,
        sort: { direction: "descending", timestamp: "last_edited_time" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Notion search failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { results?: NotionSearchPage[]; has_more?: boolean };
    const pages = (data.results ?? []).filter((r) => r.object === "page");
    const total = pages.length;
    const startedAt = Date.now();

    await ctx.runMutation(internal.notion.setImportProgress, {
      userId,
      imported: 0,
      total,
      startedAt,
    });

    // First pass: projects. Second pass: everything else, remapped to their parent
    // project where classifyPage resolves one by name.
    const projectNameToId = new Map<string, string>();
    let imported = 0;

    for (const page of pages) {
      const title = extractTitle(page);
      const classification = classifyPage(title);
      if (!classification.isProject) continue;
      const id = await ctx.runMutation(internal.notion.insertImportedObject, {
        userId,
        kind: "project",
        name: title,
        status: "active",
        createdAt: startedAt,
      });
      projectNameToId.set(title, String(id));
      imported += 1;
      await ctx.runMutation(internal.notion.setImportProgress, {
        userId,
        imported,
        total,
        startedAt,
      });
    }

    for (const page of pages) {
      const title = extractTitle(page);
      const classification = classifyPage(title);
      if (classification.isProject) continue;
      let projectId: string | null = null;
      if (classification.parentProject) {
        const parentId = projectNameToId.get(classification.parentProject);
        if (parentId) projectId = parentId;
      }
      await ctx.runMutation(internal.notion.insertImportedObject, {
        userId,
        kind: "note",
        content: title,
        projectId,
        maturity: "fleeting",
        createdAt: startedAt,
      });
      imported += 1;
      if (imported % 5 === 0 || imported === total) {
        await ctx.runMutation(internal.notion.setImportProgress, {
          userId,
          imported,
          total,
          startedAt,
        });
      }
    }

    await ctx.runMutation(internal.notion.clearImportProgress, { userId });

    return { imported, capped: !!data.has_more };
  },
});
