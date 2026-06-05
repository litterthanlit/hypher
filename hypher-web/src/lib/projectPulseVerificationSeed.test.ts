import { describe, expect, it } from "vitest";
import type { AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import {
  PROJECT_PULSE_VERIFICATION_ACCEPTED_MEMORY,
  PROJECT_PULSE_VERIFICATION_CAPTURES,
  PROJECT_PULSE_VERIFICATION_HANDOFF,
  PROJECT_PULSE_VERIFICATION_INACTIVE_EXCLUDED_TEXT,
  PROJECT_PULSE_VERIFICATION_INACTIVE_STALE_TEXT,
  PROJECT_PULSE_VERIFICATION_MEMORY,
  PROJECT_PULSE_VERIFICATION_PROJECT_NAME,
} from "../../convex/lib/projectPulseVerificationSeed";
import { suggestCrystallizedUpdates } from "./crystallizeRecentActivity";
import { compileBuilderBrief } from "./projectContext";

const now = 1_800_000_000_000;

function captureId(key: string): string {
  return `capture-${key}`;
}

const project: Project = {
  id: "project-demo",
  kind: "project",
  name: PROJECT_PULSE_VERIFICATION_PROJECT_NAME,
  description: "Demo project for verifying the Project Pulse loop.",
  status: "active",
  createdAt: now,
  modifiedAt: now,
};

const captures: AnyObject[] = [
  project,
  ...PROJECT_PULSE_VERIFICATION_CAPTURES.map((capture, index) => ({
    id: captureId(capture.key),
    kind: "note" as const,
    content: capture.text,
    maturity: "developing" as const,
    projectId: project.id,
    captureType: capture.captureType,
    captureStatus: "sorted" as const,
    createdAt: now + index + 1,
    modifiedAt: now + index + 1,
  })),
];

const acceptedMemory = PROJECT_PULSE_VERIFICATION_ACCEPTED_MEMORY.map((item, index) => ({
  kind: item.kind,
  text: item.text,
  sourceType: item.sourceType,
  sourceId: item.sourceKey === PROJECT_PULSE_VERIFICATION_HANDOFF.key
    ? "handoff-demo"
    : captureId(item.sourceKey),
  suggestionId: `seed-${item.key}`,
  status: item.status,
  createdAt: now + 100 + index,
  updatedAt: now + 100 + index,
}));

const memory: ProjectMemory = {
  id: "memory-demo",
  projectId: project.id,
  ...PROJECT_PULSE_VERIFICATION_MEMORY,
  acceptedCrystallizedSuggestions: acceptedMemory,
  nextActions: [
    {
      id: "next-demo",
      title: "Verify the Project Pulse memory loop locally.",
      rationale: "The beta demo needs the full Hypher loop visible before launch.",
      status: "accepted",
      suggestedTargetTool: "Manual",
      createdAt: now + 200,
      updatedAt: now + 200,
    },
  ],
  generatedAt: now + 200,
  sourceUpdatedAt: now + 200,
  model: "seed",
};

const actions: ProjectAction[] = [
  {
    id: "action-demo",
    userId: "user-demo",
    projectId: project.id,
    title: "Open the seeded Project Pulse and inspect Crystallized Memory.",
    status: "accepted",
    sourceType: "manual",
    createdAt: now + 250,
    updatedAt: now + 250,
  },
];

const handoffs: Handoff[] = [
  {
    id: "handoff-demo",
    userId: "user-demo",
    projectId: project.id,
    generatedAt: now + 300,
    targetTool: PROJECT_PULSE_VERIFICATION_HANDOFF.targetTool,
    packetContent: PROJECT_PULSE_VERIFICATION_HANDOFF.packetContent,
    sourceCaptures: PROJECT_PULSE_VERIFICATION_CAPTURES.map((capture) => captureId(capture.key)),
    requestedTask: PROJECT_PULSE_VERIFICATION_HANDOFF.requestedTask,
    status: "completed",
    returnedAgentOutput: PROJECT_PULSE_VERIFICATION_HANDOFF.returnedAgentOutput,
    userNotes: PROJECT_PULSE_VERIFICATION_HANDOFF.userNotes,
  },
];

describe("Project Pulse verification seed", () => {
  it("keeps the seeded full loop visible in future Builder Briefs", () => {
    const packet = compileBuilderBrief({
      project,
      memory,
      captures,
      actions,
      agentEvents: [],
      handoffs,
      generatedAt: now + 400,
    });

    expect(packet).toContain("Hypher is the context control layer for AI builders.");
    expect(packet).toContain("Do not build OAuth yet. Stabilize the Builder Brief loop first.");
    expect(packet).toContain("Stale memory must not appear in future Builder Briefs.");
    expect(packet).toContain("Do not let the builder rebuild the compiler.");
    expect(packet).toContain("Implemented Crystallized Memory Ledger.");
    expect(packet).not.toContain(PROJECT_PULSE_VERIFICATION_INACTIVE_STALE_TEXT);
    expect(packet).not.toContain(PROJECT_PULSE_VERIFICATION_INACTIVE_EXCLUDED_TEXT);
  });

  it("generates review suggestions from the seeded messy captures", () => {
    const suggestions = suggestCrystallizedUpdates({
      captures,
      handoffs,
      existingMemory: null,
      existingActions: [],
      limits: { maxSuggestions: 8 },
    });

    expect(suggestions.map((item) => item.kind)).toEqual(expect.arrayContaining([
      "do_not_do",
      "decision",
      "acceptance_criterion",
      "agent_warning",
      "handoff_note",
    ]));
  });
});
