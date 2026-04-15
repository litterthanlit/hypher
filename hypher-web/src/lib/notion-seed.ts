// Notion import seed data — extracted from Notion workspace
// Run this once to populate Hypher with your Notion content

import type { AnyObject, Project, Note } from "@/types";

interface NotionItem {
  title: string;
  content: string;
  stage?: string;
  timestamp: string;
  isProject: boolean;
  parentProject?: string;
}

const notionData: NotionItem[] = [
  // ─── Projects ───
  {
    title: "Hypher",
    content: "Like notion meets freeform meets obsidian meets openclaw. Mac native, iOS integration, syncs across devices. Build an agent/app that keeps track of all projects, organizes files, documentation, app updates, notes, moodboards.",
    stage: "active",
    timestamp: "2026-04-02T16:21:00.000Z",
    isProject: true,
  },
  {
    title: "Marque",
    content: "Vector creation tool — add ability to create vectors like Vecteezy. Visual asset creation product. Animate logos with animation magic. Add perspective.",
    stage: "active",
    timestamp: "2026-04-02T18:54:00.000Z",
    isProject: true,
  },
  {
    title: "Litt.designs",
    content: "Build landing page prototype.",
    stage: "active",
    timestamp: "2026-04-01T19:09:00.000Z",
    isProject: true,
  },
  {
    title: "Ergon",
    content: "Project page created in Notes OS.",
    stage: "active",
    timestamp: "2026-04-02T07:29:00.000Z",
    isProject: true,
  },
  {
    title: "Studio OS",
    content: "Design tool / canvas platform. Multi-page site planning, section library, insert system, AI integration.",
    stage: "active",
    timestamp: "2026-03-22T10:15:00.000Z",
    isProject: true,
  },
  {
    title: "Colossal Projects",
    content: "Loading page black canvas with red acrylic contrasts.",
    stage: "paused",
    timestamp: "2026-01-02T00:09:00.000Z",
    isProject: true,
  },
  {
    title: "Content",
    content: "7-month content sprint April to October 2026. Design roasts, redesigns, Framer tips, studio journey.",
    stage: "active",
    timestamp: "2026-03-26T04:57:00.000Z",
    isProject: true,
  },

  // ─── Notes (with parent projects) ───
  {
    title: "User interface is a blank page always",
    content: "USER INTERFACE IS A BLANK PAGE ALWAYS. Once you write your entry/idea image — a pop up below shows — add to X, Y, Z project etc. CANVAS is on home page top right corner.",
    timestamp: "2026-04-02T16:21:00.000Z",
    isProject: false,
    parentProject: "Hypher",
  },
  {
    title: "Add entry history, setup Convex",
    content: "Add entry history — check every single one added. Setup convex for backend. Add that app for comparing. Have claude fill out affiliate program.",
    timestamp: "2026-04-02T16:21:00.000Z",
    isProject: false,
    parentProject: "Hypher",
  },
  {
    title: "Marque MVP scope",
    content: "Define core feature set and MVP scope. Research competitor landscape (Vecteezy, Canva vectors). Create initial wireframes. Build prototype.",
    timestamp: "2026-04-02T18:54:00.000Z",
    isProject: false,
    parentProject: "Marque",
  },
  {
    title: "Page with cool interactions",
    content: "Page with cool interactions — reference for design inspiration.",
    timestamp: "2026-03-24T19:47:00.000Z",
    isProject: false,
  },
  {
    title: "Competitor analysis & strategic ideas",
    content: "Before/after comparison is the strongest visual on the page. Competitor analysis for studio positioning.",
    timestamp: "2026-03-06T20:16:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "V5 features plan",
    content: "Copy as React + Tailwind for individual sections or full page. Dev/Handoff integration. Multi-page sites.",
    timestamp: "2026-03-22T10:15:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "V4 plan — single page focus",
    content: "V4 prioritizes single-page excellence, reusable sections/components, and reference-native design. Multi-page support deferred to V5+.",
    timestamp: "2026-03-20T09:08:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "V3 unified canvas plan",
    content: "Artboards, multi-page sites on same canvas, collaboration. Replace stage split with one unified canvas page component.",
    timestamp: "2026-03-18T11:26:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "Competitor canvas research",
    content: "What Studio OS should copy: inline AI on current selection, fast layer/page/asset search.",
    timestamp: "2026-03-20T08:37:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "Studio OS iteration plan",
    content: "Users upload fresh images every time. It needs to pull directly from the individual project. Iteration on core canvas features.",
    timestamp: "2026-03-08T11:41:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "Harness V1 roadmap",
    content: "Studio OS Harness V1 roadmap. Single-page focus for V1.",
    timestamp: "2026-03-22T10:15:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
  {
    title: "Week 1 content drafts — March 31 to April 4",
    content: "Your SaaS landing page isn't a movie theater. It's a handshake. First roast/redesign post — pick a well-known SaaS landing page, redesign with warmth + motion.",
    timestamp: "2026-03-26T04:58:00.000Z",
    isProject: false,
    parentProject: "Content",
  },
  {
    title: "7-month content sprint plan",
    content: "April to October 2026 content strategy. Design roasts, Framer tips, studio journey documentation. Building in public.",
    timestamp: "2026-03-26T04:57:00.000Z",
    isProject: false,
    parentProject: "Content",
  },
  {
    title: "Roast/Redesign: Pick a cold SaaS landing page",
    content: "Roast/Redesign: Pick a cold SaaS landing page, redesign with warmth. Before/after comparison format.",
    timestamp: "2026-03-26T04:58:00.000Z",
    isProject: false,
    parentProject: "Content",
  },
  {
    title: "Design is the new code",
    content: "Linear, Notion, Stripe, and Arc didn't win on features — they won on design as strategic advantage. Design is the moat.",
    timestamp: "2026-03-24T14:06:00.000Z",
    isProject: false,
  },
  {
    title: "I asked AI to code Figma from scratch — Andrew Gao",
    content: "Figma clone from a blank repo. 13 million tokens later, it created 'Vigma' — a working design tool. Reference for AI-generated tools.",
    timestamp: "2026-03-24T06:21:00.000Z",
    isProject: false,
    parentProject: "Studio OS",
  },
];

export function generateSeedData(): AnyObject[] {
  const objects: AnyObject[] = [];
  const projectIdMap = new Map<string, string>();

  // First pass: create projects
  for (const item of notionData.filter((d) => d.isProject)) {
    const id = crypto.randomUUID();
    projectIdMap.set(item.title, id);
    objects.push({
      id,
      kind: "project",
      name: item.title,
      description: item.content,
      status: (item.stage as any) ?? "active",
      createdAt: new Date(item.timestamp).getTime(),
      modifiedAt: new Date(item.timestamp).getTime(),
    } as Project);
  }

  // Second pass: create notes
  for (const item of notionData.filter((d) => !d.isProject)) {
    const projectId = item.parentProject ? projectIdMap.get(item.parentProject) : undefined;
    objects.push({
      id: crypto.randomUUID(),
      kind: "note",
      content: item.content,
      maturity: "developing",
      createdAt: new Date(item.timestamp).getTime(),
      modifiedAt: new Date(item.timestamp).getTime(),
      projectId: projectId ?? null,
    } as Note);
  }

  return objects;
}
