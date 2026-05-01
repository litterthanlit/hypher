import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./lib/auth";
import { SAMPLE_PREVIEW_PROJECT_NAME } from "./lib/samplePreviewConstants";
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

/** Rich canvas sample for UI preview; safe to run multiple times (idempotent by project name). */
export const createSamplePreviewProject = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const mine = await ctx.db
      .query("objects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existing = mine.find(
      (o) => o.kind === "project" && (o as { name?: string }).name === SAMPLE_PREVIEW_PROJECT_NAME,
    );
    if (existing) {
      return { projectId: existing._id as string, created: false as const };
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("objects", {
      userId,
      kind: "project",
      createdAt: now,
      modifiedAt: now,
      name: SAMPLE_PREVIEW_PROJECT_NAME,
      description:
        "Env-var punch list in progress. Onboarding spec queued. Voice-capture decision pending.",
      status: "active",
      priority: 3,
    });

    type NoteSeed = { content: string; x: number; y: number; tags?: string[]; maturity?: string; t?: number };
    const notes: NoteSeed[] = [
      {
        content: "Linear Design System — tokens, spacing, and component states for the beta shell.",
        x: -180,
        y: -120,
        tags: ["launch", "ui"],
        maturity: "developing",
        t: 0,
      },
      {
        content: "What's actually blocking beta? List env vars, Clerk webhooks, and digest API key checks.",
        x: 120,
        y: -140,
        tags: ["launch", "tech"],
        t: 1,
      },
      {
        content: "Ambient Ask: use canvas center context; ship with suggested follow-up chips.",
        x: -40,
        y: 80,
        tags: ["tech", "ui"],
        t: 2,
      },
      {
        content: "Onboarding: welcome overlay + tour steps; skip path for returning users.",
        x: 200,
        y: 60,
        tags: ["launch"],
        t: 3,
      },
      {
        content: "Digest copy: static demo vs live Claude — gate on ANTHROPIC_API_KEY.",
        x: -220,
        y: 160,
        tags: ["tech"],
        t: 4,
      },
    ];

    const noteIds: Id<"objects">[] = [];
    for (const n of notes) {
      const id = await ctx.db.insert("objects", {
        userId,
        kind: "note",
        createdAt: now + (n.t ?? 0) * 50,
        modifiedAt: now + 86400000 - (n.t ?? 0) * 3600000,
        content: n.content,
        maturity: n.maturity ?? "fleeting",
        projectId,
        canvasPosition: { x: n.x, y: n.y },
        tags: n.tags,
      });
      noteIds.push(id);
    }

    const docUrl = "https://www.notion.so/hypher/onboarding-spec";
    const artifactSeeds: {
      name: string;
      type: "code" | "document";
      x: number;
      y: number;
      fileReference?: string;
      t: number;
    }[] = [
      { name: "feat: ambient ask dock + context chips", type: "code", x: -60, y: 280, t: 0 },
      { name: "PR #25 — Ambient Ask (merged)", type: "code", x: 160, y: 260, t: 1 },
      {
        name: "05-onboarding-flow-spec.md",
        type: "document",
        x: -200,
        y: 300,
        fileReference: "docs/launch/05-onboarding-flow-spec.md",
        t: 2,
      },
      {
        name: "Beta checklist (Notion)",
        type: "document",
        x: 40,
        y: 320,
        fileReference: docUrl,
        t: 3,
      },
    ];

    const artifactIds: Id<"objects">[] = [];
    for (const a of artifactSeeds) {
      const id = await ctx.db.insert("objects", {
        userId,
        kind: "artifact",
        createdAt: now + 200 + a.t,
        modifiedAt: now + 200 + a.t,
        name: a.name,
        type: a.type,
        projectId,
        canvasPosition: { x: a.x, y: a.y },
        ...(a.fileReference ? { fileReference: a.fileReference } : {}),
      });
      artifactIds.push(id);
    }

    const links: [Id<"objects">, Id<"objects">, string][] = [
      [noteIds[0]!, noteIds[1]!, "Planning → blockers"],
      [noteIds[1]!, noteIds[2]!, "Blockers → ambient"],
      [noteIds[2]!, artifactIds[0]!, "Feature link"],
      [noteIds[0]!, artifactIds[2]!, "Design → spec"],
      [artifactIds[3]!, noteIds[3]!, "Notion → onboarding"],
    ];
    for (const [sourceId, targetId, reason] of links) {
      const sDoc = await ctx.db.get(sourceId);
      const tDoc = await ctx.db.get(targetId);
      if (!sDoc || !tDoc) continue;
      await ctx.db.insert("connections", {
        userId,
        sourceId: sourceId as string,
        targetId: targetId as string,
        sourceKind: sDoc.kind,
        targetKind: tDoc.kind,
        type: "manual",
        confidence: 1,
        reason,
        createdAt: now,
      });
    }

    await ctx.db.insert("activity", {
      userId,
      action: "created",
      objectId: projectId as string,
      objectKind: "project",
      objectName: SAMPLE_PREVIEW_PROJECT_NAME,
      timestamp: now,
      projectId: projectId as string,
      activityType: "demo_seed",
      summary: "Sample canvas project for UI preview.",
    });

    return { projectId: projectId as string, created: true as const };
  },
});
