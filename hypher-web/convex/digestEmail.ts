"use node";

import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Resend } from "resend";
import { requireUserId } from "./lib/auth";
import { fetchClerkEmail } from "./lib/clerk";

// typegen pending convex dev
const _internal = internal as any;

// ─── helpers ────────────────────────────────────────────────────────────────

function subjectLineForToday(): string {
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Your Hypher digest, ${day} ${period}`;
}

function top3MentionedProjects(
  text: string,
  projects: Array<{ name: string; _id?: string; id?: string }>
): Array<{ name: string; id: string }> {
  return projects
    .filter((p) => text.includes(p.name))
    .slice(0, 3)
    .map((p) => ({ name: p.name, id: (p._id ?? p.id ?? "") as string }));
}

function renderText({
  text,
  replyToken,
}: {
  text: string;
  replyToken: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypher.app";
  return [
    "Good morning.",
    "",
    text.trim(),
    "",
    "—",
    "Reply to add a thought to your inbox.",
    `Open Hypher: ${appUrl}/app`,
    "",
    `Unsubscribe: ${appUrl}/digest/unsubscribe?token=${replyToken}`,
  ].join("\n");
}

function renderHtml({
  text,
  projects,
  replyToken,
}: {
  text: string;
  projects: Array<{ name: string; id: string }>;
  replyToken: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypher.app";
  const unsubUrl = `${appUrl}/digest/unsubscribe?token=${replyToken}`;

  const projectLinksHtml =
    projects.length > 0
      ? `
      <div style="margin:24px 0 0;">
        <p style="font-size:13px;color:#6b7280;margin:0 0 10px;">Jump to project</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${projects
            .map(
              (p) =>
                `<a href="${appUrl}/app?project=${p.id}" style="display:inline-block;padding:6px 14px;background:#18181b;color:#fff;border-radius:6px;font-size:13px;text-decoration:none;">${escapeHtml(p.name)}</a>`
            )
            .join("")}
        </div>
      </div>`
      : "";

  const digestParagraphs = text
    .trim()
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 10px;line-height:1.6;">${escapeHtml(line)}</p>`
        : `<p style="margin:0 0 10px;">&nbsp;</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Hypher digest</title>
<style>
@media (prefers-color-scheme: dark) {
  .email-body { background-color: #0f0f0f !important; color: #e5e7eb !important; }
  .email-card { background-color: #18181b !important; border-color: #27272a !important; }
  .footer-text { color: #71717a !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;" class="email-body">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;" class="email-card">
        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:20px;font-weight:600;color:#18181b;">Good morning.</p>
            <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Your Hypher daily digest</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:20px 32px;">
            <div style="font-size:15px;color:#27272a;">
              ${digestParagraphs}
            </div>
            ${projectLinksHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #f4f4f5;">
            <p style="margin:0 0 8px;font-size:13px;color:#52525b;" class="footer-text">
              <strong>Add a thought — just reply</strong> and it lands in your Hypher inbox.
            </p>
            <p style="margin:0;font-size:12px;color:#a1a1aa;" class="footer-text">
              <a href="${unsubUrl}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
              &nbsp;·&nbsp;
              <a href="${appUrl}/app" style="color:#a1a1aa;text-decoration:underline;">Open Hypher</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── queries ────────────────────────────────────────────────────────────────

export const getProfile = internalQuery({
  args: { userId: v.string() },
  handler: async (_ctx, { userId }) => {
    const email = await fetchClerkEmail(userId);
    return { email };
  },
});

export const projectInputs = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const allObjects = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = allObjects.filter(
      (o) => o.kind === "project" && o.status !== "archived"
    );
    if (projects.length === 0) return [];

    const itemCounts: Record<string, number> = {};
    for (const obj of allObjects) {
      if (obj.projectId) {
        itemCounts[obj.projectId as string] =
          (itemCounts[obj.projectId as string] ?? 0) + 1;
      }
    }

    return projects.map((p) => ({
      _id: p._id,
      name: p.name ?? "Untitled",
      status: p.status,
      priority: p.priority,
      blockers: p.blockers,
      lastActivity: p.lastActivity,
      itemCount: itemCounts[p._id] ?? 0,
      githubRepo: p.githubRepo,
      githubSummary: p.githubRepo
        ? `Connected to ${p.githubRepo}${p.githubLastSync ? `, last synced ${new Date(p.githubLastSync).toLocaleDateString()}` : ""}`
        : undefined,
    }));
  },
});

export const listEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("digestPrefs")
      .filter((q) => q.eq(q.field("enabled"), true))
      .collect();
  },
});

export const lookupToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("digestReplyTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

export const getInboxProjectId = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Resolve the user's inbox project: the first non-archived project created
    // for this user. If Spec #01's demo project exists, it will be the oldest.
    const project = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("kind"), "project"),
          q.neq(q.field("status"), "archived")
        )
      )
      .first();
    return project ? (project._id as string) : null;
  },
});

// ─── mutations ──────────────────────────────────────────────────────────────

export const recordSend = internalMutation({
  args: {
    userId: v.string(),
    sentAt: v.number(),
    replyToken: v.string(),
  },
  handler: async (ctx, { userId, sentAt, replyToken }) => {
    // Upsert lastSentAt on digestPrefs
    const existing = await ctx.db
      .query("digestPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSentAt: sentAt });
    } else {
      // Create a default row if none exists (e.g. user skipped settings UI)
      const tz = "UTC";
      await ctx.db.insert("digestPrefs", {
        userId,
        enabled: true,
        localHour: 8,
        timezone: tz,
        lastSentAt: sentAt,
      });
    }

    // Insert the reply token
    await ctx.db.insert("digestReplyTokens", {
      token: replyToken,
      userId,
      createdAt: sentAt,
    });
  },
});

/**
 * Public mutation: called by the unsubscribe route handler.
 * Security: token is the only auth factor — unguessable 128-bit UUID.
 * Worst case if leaked: attacker unsubscribes the user (annoying, not damaging).
 */
export const disableViaToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenRow = await ctx.db
      .query("digestReplyTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!tokenRow) return false;

    const prefs = await ctx.db
      .query("digestPrefs")
      .withIndex("by_user", (q) => q.eq("userId", tokenRow.userId))
      .first();
    if (prefs) {
      await ctx.db.patch(prefs._id, { enabled: false });
    }
    return true;
  },
});

/**
 * Public mutation: bootstrap digestPrefs row on first sign-in.
 * Idempotent — no-op if a row already exists for the authenticated user.
 * Called from useStore.ts useEffect after Clerk confirms signed-in.
 */
export const ensureDefaultPrefs = mutation({
  args: { timezone: v.string() },
  handler: async (ctx, { timezone }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("digestPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!existing) {
      await ctx.db.insert("digestPrefs", {
        userId,
        enabled: true,
        localHour: 8,
        timezone,
      });
    }
  },
});

export const pruneOldTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 14 * 86_400_000;
    const old = await ctx.db
      .query("digestReplyTokens")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .collect();
    for (const row of old) {
      await ctx.db.delete(row._id);
    }
  },
});

/** Public mutation: upserts digestPrefs for the authenticated user. */
export const savePrefs = mutation({
  args: {
    enabled: v.boolean(),
    localHour: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, { enabled, localHour, timezone }) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("digestPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, localHour, timezone });
    } else {
      await ctx.db.insert("digestPrefs", {
        userId,
        enabled,
        localHour,
        timezone,
      });
    }
  },
});

/** Public query: read current prefs for the authenticated user. */
export const getPrefs = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("digestPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

// ─── actions ────────────────────────────────────────────────────────────────

export const sendForUser = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[hypher/digestEmail] RESEND_API_KEY missing — skipping digest");
      return;
    }

    const profile = await ctx.runQuery(_internal.digestEmail.getProfile, { userId });
    if (!profile?.email) {
      console.warn(`[hypher/digestEmail] No email for userId ${userId} — skipping`);
      return;
    }

    const projects = await ctx.runQuery(_internal.digestEmail.projectInputs, { userId });
    if (projects.length === 0) {
      return; // no projects — spec says skip silently
    }

    const text: string = await ctx.runAction(_internal.ai.generateDigest, {
      projects: projects.map((p: {
        name: string;
        status?: string;
        priority?: number;
        blockers?: string;
        lastActivity?: number;
        itemCount: number;
        githubRepo?: string;
        githubSummary?: string;
      }) => ({
        name: p.name,
        status: p.status,
        priority: p.priority,
        blockers: p.blockers,
        lastActivity: p.lastActivity,
        itemCount: p.itemCount,
        githubRepo: p.githubRepo,
        githubSummary: p.githubSummary,
      })),
    });

    if (!text || text.startsWith("Daily digest unavailable")) return;

    const replyToken = crypto.randomUUID();
    const sentAt = Date.now();

    await ctx.runMutation(_internal.digestEmail.recordSend, {
      userId,
      sentAt,
      replyToken,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypher.app";
    const replyAddress = `reply+${replyToken}@inbound.hypher.app`;

    const mentionedProjects = top3MentionedProjects(text, projects);

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "Hypher Digest <digest@hypher.app>",
      to: profile.email,
      replyTo: replyAddress,
      subject: subjectLineForToday(),
      html: renderHtml({ text, projects: mentionedProjects, replyToken }),
      text: renderText({ text, replyToken }),
      headers: {
        "List-Unsubscribe": `<${appUrl}/digest/unsubscribe?token=${replyToken}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  },
});
