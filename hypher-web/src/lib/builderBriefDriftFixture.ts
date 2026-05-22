import type { AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileBuilderBrief } from "./projectContext";

export type BuilderBriefDriftDimensionKey =
  | "planAdherence"
  | "driftCount"
  | "humanCorrectionsNeeded"
  | "unrelatedChanges"
  | "missedConstraints"
  | "testCoverage"
  | "completionQuality"
  | "handoffQuality";

export interface BuilderBriefDriftDimension {
  key: BuilderBriefDriftDimensionKey;
  label: string;
  notes: string;
}

const project: Project = {
  id: "fixture-project",
  kind: "project",
  name: "Hypher",
  description: "Hypher is the context control layer for AI builders.",
  status: "active",
  createdAt: 1,
  modifiedAt: 10,
};

const memory: ProjectMemory = {
  id: "fixture-memory",
  projectId: project.id,
  summary: "Hypher keeps AI builders on track by turning messy project activity into Crystallized Context and Builder Briefs.",
  currentGoal: "Ship the first practical Builder Brief workflow inside Project Pulse.",
  currentDirection: "Adapt the existing context compiler and Project Pulse copy flow instead of creating duplicate systems.",
  recentChanges: [
    "The existing Agent Context Packet compiler was audited.",
    "Project Pulse already has a copy/save path for agent-ready context.",
  ],
  importantDecisions: [
    "Builder Brief is the agent-facing product primitive.",
    "Crystallized State should be preferred over raw captures.",
  ],
  constraints: [
    "The compiler must stay pure and deterministic.",
    "Do not build OAuth yet.",
    "Do not change unrelated Project Pulse UI.",
    "Do not skip tests.",
  ],
  openQuestions: [],
  staleAssumptions: ["Copying markdown is the product outcome."],
  nextActions: [
    {
      id: "fixture-next",
      title: "Implement Copy Builder Brief using the existing compiler path",
      rationale: "This proves Hypher can keep builder agents aligned without new delivery integrations.",
      status: "accepted",
      createdAt: 11,
      updatedAt: 11,
      suggestedTargetTool: "Cursor",
    },
  ],
  generatedAt: 12,
  sourceUpdatedAt: 12,
  model: "fixture",
};

const captures: AnyObject[] = [
  {
    id: "fixture-capture",
    kind: "note",
    content: "Do not add MCP yet. First make the Builder Brief workflow useful from Project Pulse.",
    maturity: "structured",
    projectId: project.id,
    captureType: "decision",
    pinnedAsDecision: true,
    createdAt: 9,
    modifiedAt: 9,
  },
];

const actions: ProjectAction[] = [
  {
    id: "fixture-action",
    userId: "fixture-user",
    projectId: project.id,
    title: "Add compiler tests for Builder Brief section ordering",
    status: "accepted",
    sourceType: "manual",
    createdAt: 13,
    updatedAt: 13,
  },
];

const agentEvents: AgentEvent[] = [
  {
    id: "fixture-event",
    userId: "fixture-user",
    projectId: project.id,
    source: "codex",
    kind: "handoff",
    title: "Audit completed",
    body: "Existing compiler, Project Pulse copy path, API route, and MCP tool were found and should be reused.",
    status: "new",
    createdAt: 14,
  },
];

export const builderBriefDriftFixture = {
  productClaim: "Hypher reduces agent drift by giving the builder agent the right context at the right time.",
  withoutHypher: {
    prompt: "Build the next Hypher workflow. Make sure the agent has enough context to continue.",
  },
  withHypher: {
    prompt: compileBuilderBrief({
      project,
      memory,
      captures,
      actions,
      agentEvents,
      generatedAt: 15,
    }),
  },
  dimensions: [
    {
      key: "planAdherence",
      label: "Plan adherence",
      notes: "Did the builder follow the approved sequence of work?",
    },
    {
      key: "driftCount",
      label: "Drift count",
      notes: "How many times did the builder leave the current task or product thesis?",
    },
    {
      key: "humanCorrectionsNeeded",
      label: "Human corrections needed",
      notes: "How often did a human need to redirect the builder?",
    },
    {
      key: "unrelatedChanges",
      label: "Unrelated changes",
      notes: "Did the builder modify unrelated files or product areas?",
    },
    {
      key: "missedConstraints",
      label: "Missed constraints",
      notes: "Did the builder violate constraints or Do Not Do items?",
    },
    {
      key: "testCoverage",
      label: "Test coverage",
      notes: "Did the builder add or update useful tests?",
    },
    {
      key: "completionQuality",
      label: "Completion quality",
      notes: "Was the requested task completed without avoidable gaps?",
    },
    {
      key: "handoffQuality",
      label: "Handoff quality",
      notes: "Did the builder leave clear next-session context?",
    },
  ] satisfies BuilderBriefDriftDimension[],
} as const;
