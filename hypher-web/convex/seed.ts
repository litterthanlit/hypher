import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

const DEMO_PROJECT = "Try Hypher";

const DEMO_DIGEST = `Welcome to Hypher — this is a sample daily digest.

**Today**
- Skim the canvas: notes and links are yours to rearrange.
- Open Search (⌘K) to jump across everything you've captured.

**Focus**
- Finish wiring your first real project when you're ready.
- This digest is static demo text; live digests use your Convex + Anthropic setup.

Enjoy the beta.`;

async function performSeed(
  ctx: MutationCtx,
  userId: string
): Promise<{ alreadySeeded: boolean }> {
  const meta = await ctx.db
    .query("userMeta")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (meta?.demoSeeded) {
    return { alreadySeeded: true };
  }

  const now = Date.now();
  const projectId = await ctx.db.insert("objects", {
    userId,
    kind: "project",
    createdAt: now,
    modifiedAt: now,
    name: DEMO_PROJECT,
    description: "A guided tour — replace with your own projects anytime.",
    status: "active",
    priority: 3,
  });

  const noteContents = [
    "Capture ideas without filing them first.",
    "Link notes to see patterns across projects.",
    "Ship in small slices — momentum beats perfect plans.",
    "Revisit the inbox when you need a clean slate.",
    "Use the canvas to think spatially.",
    "Tag sparingly; search catches the rest.",
    "Connect GitHub when code context matters.",
    "Let the digest surface what went quiet.",
    "Keyboard shortcuts speed up flow (see toolbar hints).",
    "Delete this demo when you're done exploring.",
  ];

  const noteIds: Id<"objects">[] = [];
  let i = 0;
  for (const content of noteContents) {
    const id = await ctx.db.insert("objects", {
      userId,
      kind: "note",
      createdAt: now + i,
      modifiedAt: now + i,
      content,
      maturity: "fleeting",
      projectId,
      canvasPosition: { x: 80 + (i % 4) * 160, y: 80 + Math.floor(i / 4) * 120 },
      tags: i === 0 ? ["demo", "welcome"] : undefined,
    });
    noteIds.push(id);
    i++;
  }

  const commitMsgs = [
    "abc12de feat: add canvas grid snap",
    "def34fa fix: digest copy when API key missing",
  ];
  for (let j = 0; j < commitMsgs.length; j++) {
    const id = await ctx.db.insert("objects", {
      userId,
      kind: "artifact",
      createdAt: now + 100 + j,
      modifiedAt: now + 100 + j,
      name: commitMsgs[j]!,
      type: "code",
      projectId,
      canvasPosition: { x: 120 + j * 200, y: 420 },
    });
  }

  const pairs: [number, number][] = [[0, 1], [1, 2], [3, 4]];
  for (const [a, b] of pairs) {
    await ctx.db.insert("connections", {
      userId,
      sourceId: noteIds[a]!,
      targetId: noteIds[b]!,
      sourceKind: "note",
      targetKind: "note",
      type: "manual",
      confidence: 1,
      reason: "Demo connection",
      createdAt: now,
    });
  }

  await ctx.db.insert("activity", {
    userId,
    action: "created",
    objectId: projectId,
    objectKind: "project",
    objectName: DEMO_PROJECT,
    timestamp: now,
    projectId,
    activityType: "demo_seed",
    summary: "Welcome! We added a demo project to your workspace.",
  });

  if (meta) {
    await ctx.db.patch(meta._id, {
      demoSeeded: true,
      demoDigestText: DEMO_DIGEST,
    });
  } else {
    await ctx.db.insert("userMeta", {
      userId,
      legacyClaimed: false,
      demoSeeded: true,
      demoDigestText: DEMO_DIGEST,
    });
  }

  return { alreadySeeded: false };
}

/** Idempotent: seeds demo data once per user (auth). */
export const ensureDemoForUser = mutation({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await performSeed(ctx, userId);
  },
});

/**
 * Called only from the Next.js Clerk webhook after Svix verification.
 * Secured with SEED_WEBHOOK_SECRET (same pattern as Stripe → Convex shared secret).
 */
export const seedDemoAfterClerkSignup = mutation({
  args: { userId: v.string(), secret: v.string() },
  handler: async (ctx, { userId, secret }) => {
    const expected = process.env.SEED_WEBHOOK_SECRET;
    if (!expected || secret !== expected) {
      throw new Error("Unauthorized");
    }
    return await performSeed(ctx, userId);
  },
});

export const getDemoDigest = query({
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const meta = await ctx.db
      .query("userMeta")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return meta?.demoDigestText ?? null;
  },
});
