/**
 * Client-side seed for the canvas sample project when `seed:createSamplePreviewProject`
 * is not yet deployed (same data as convex/seed.ts — keep in sync when editing).
 */
import { SAMPLE_PREVIEW_PROJECT_NAME } from "../../convex/lib/samplePreviewConstants";

type PutObject = (args: Record<string, unknown>) => Promise<string>;
type PutConnection = (args: Record<string, unknown>) => Promise<string>;
type PutActivity = (args: Record<string, unknown>) => Promise<string>;

export async function createSamplePreviewProjectClient(opts: {
  projects: { id: string; name?: string }[];
  putObject: PutObject;
  putConnection: PutConnection;
  putActivity: PutActivity;
}): Promise<{ projectId: string; created: boolean }> {
  const { projects, putObject, putConnection, putActivity } = opts;
  const existing = projects.find((p) => p.name === SAMPLE_PREVIEW_PROJECT_NAME);
  if (existing) {
    return { projectId: existing.id, created: false };
  }

  const now = Date.now();
  const projectId = await putObject({
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

  const noteIds: string[] = [];
  for (const n of notes) {
    const id = await putObject({
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

  const artifactIds: string[] = [];
  for (const a of artifactSeeds) {
    const id = await putObject({
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

  const links: [string, string, string, string, string][] = [
    [noteIds[0]!, noteIds[1]!, "note", "note", "Planning → blockers"],
    [noteIds[1]!, noteIds[2]!, "note", "note", "Blockers → ambient"],
    [noteIds[2]!, artifactIds[0]!, "note", "artifact", "Feature link"],
    [noteIds[0]!, artifactIds[2]!, "note", "artifact", "Design → spec"],
    [artifactIds[3]!, noteIds[3]!, "artifact", "note", "Notion → onboarding"],
  ];
  for (const [sourceId, targetId, sourceKind, targetKind, reason] of links) {
    await putConnection({
      sourceId,
      targetId,
      sourceKind,
      targetKind,
      type: "manual",
      confidence: 1,
      reason,
      createdAt: now,
    });
  }

  await putActivity({
    action: "created",
    objectId: projectId,
    objectKind: "project",
    objectName: SAMPLE_PREVIEW_PROJECT_NAME,
    timestamp: now,
    projectId,
    activityType: "demo_seed",
    summary: "Sample canvas project for UI preview.",
  });

  return { projectId, created: true };
}

export function isMissingSamplePreviewMutationError(message: string): boolean {
  return (
    message.includes("Could not find public function") &&
    message.includes("createSamplePreviewProject")
  );
}
