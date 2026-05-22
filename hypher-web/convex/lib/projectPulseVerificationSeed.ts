export const PROJECT_PULSE_VERIFICATION_PROJECT_NAME = "Hypher Project Pulse Loop Demo";

export const PROJECT_PULSE_VERIFICATION_INACTIVE_STALE_TEXT =
  "Old assumption: stale accepted memory should still appear in Builder Briefs.";

export const PROJECT_PULSE_VERIFICATION_INACTIVE_EXCLUDED_TEXT =
  "Temporary experiment: add a classifier before beta.";

export const PROJECT_PULSE_VERIFICATION_CAPTURES = [
  {
    key: "defer-oauth",
    text: "Don't build OAuth yet. Stabilize the Builder Brief loop first.",
    captureType: "decision",
  },
  {
    key: "context-control",
    text: "Decision: Hypher is the context control layer for AI builders.",
    captureType: "decision",
  },
  {
    key: "visual-check",
    text: "Need to verify Project Pulse visually with authenticated local data.",
    captureType: "task",
  },
  {
    key: "stale-criteria",
    text: "Acceptance criteria: stale memory must not appear in future Builder Briefs.",
    captureType: "thought",
  },
  {
    key: "agent-warning",
    text: "Agent warning: risk of the builder rebuilding the compiler.",
    captureType: "agent_output",
  },
] as const;

export const PROJECT_PULSE_VERIFICATION_MEMORY = {
  summary:
    "Hypher keeps builder agents on track by turning messy activity into durable agent-ready context.",
  currentGoal: "Verify the complete Project Pulse memory loop for beta demo.",
  currentDirection:
    "Harden the existing Builder Brief and crystallized memory loop without rebuilding the compiler.",
  recentChanges: [
    "Implemented Crystallized Memory Ledger.",
    "Added active/stale/excluded lifecycle.",
    "Updated Builder Brief filtering.",
    "Tests passed.",
  ],
  importantDecisions: [
    "Hypher is the context control layer for AI builders.",
  ],
  constraints: [
    "Do not build OAuth yet. Stabilize the Builder Brief loop first.",
    PROJECT_PULSE_VERIFICATION_INACTIVE_STALE_TEXT,
    PROJECT_PULSE_VERIFICATION_INACTIVE_EXCLUDED_TEXT,
  ],
  openQuestions: [
    "Can authenticated Project Pulse be visually verified with local demo data?",
  ],
  activeTasks: [
    "Verify the Project Pulse memory loop locally.",
  ],
  blockers: [
    "Authenticated visual verification needs a signed-in local Clerk session.",
  ],
  staleAssumptions: [],
  acceptanceCriteria: [
    "Stale memory must not appear in future Builder Briefs.",
  ],
  agentWarnings: [
    "Do not let the builder rebuild the compiler.",
  ],
  handoffNotes: [
    "Returned agent output should feed future Builder Briefs as bounded context.",
  ],
};

export const PROJECT_PULSE_VERIFICATION_ACCEPTED_MEMORY = [
  {
    key: "accepted-context-control",
    kind: "decision",
    text: "Hypher is the context control layer for AI builders.",
    sourceType: "capture",
    sourceKey: "context-control",
    status: "active",
  },
  {
    key: "accepted-defer-oauth",
    kind: "constraint",
    text: "Do not build OAuth yet. Stabilize the Builder Brief loop first.",
    sourceType: "capture",
    sourceKey: "defer-oauth",
    status: "active",
  },
  {
    key: "accepted-stale-criteria",
    kind: "acceptance_criterion",
    text: "Stale memory must not appear in future Builder Briefs.",
    sourceType: "capture",
    sourceKey: "stale-criteria",
    status: "active",
  },
  {
    key: "accepted-agent-warning",
    kind: "agent_warning",
    text: "Do not let the builder rebuild the compiler.",
    sourceType: "capture",
    sourceKey: "agent-warning",
    status: "active",
  },
  {
    key: "accepted-handoff-note",
    kind: "handoff_note",
    text: "Returned agent output should feed future Builder Briefs as bounded context.",
    sourceType: "returned_agent_output",
    sourceKey: "handoff-result",
    status: "active",
  },
  {
    key: "accepted-stale-memory",
    kind: "constraint",
    text: PROJECT_PULSE_VERIFICATION_INACTIVE_STALE_TEXT,
    sourceType: "capture",
    sourceKey: "visual-check",
    status: "stale",
  },
  {
    key: "accepted-excluded-memory",
    kind: "constraint",
    text: PROJECT_PULSE_VERIFICATION_INACTIVE_EXCLUDED_TEXT,
    sourceType: "capture",
    sourceKey: "visual-check",
    status: "excluded",
  },
] as const;

export const PROJECT_PULSE_VERIFICATION_HANDOFF = {
  key: "handoff-result",
  targetTool: "Cursor",
  requestedTask: "Implement the Crystallized Memory Ledger.",
  packetContent: "# Builder Brief: Hypher Project Pulse Loop Demo\n\nVerify the memory loop.",
  returnedAgentOutput:
    "Implemented Crystallized Memory Ledger. Added active/stale/excluded lifecycle. Updated Builder Brief filtering. Tests passed.",
  userNotes:
    "Authenticated Project Pulse UI still needs local visual verification with representative data.",
} as const;
