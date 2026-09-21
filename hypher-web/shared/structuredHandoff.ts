/**
 * Versioned handoff proposal for an explicit agent switch.
 * Hypher validates and stores the note. It does not transfer files.
 */

export const HANDOFF_PROPOSAL_SCHEMA_VERSION = 1 as const;

const MAX_ITEMS = 8;
const MAX_SHORT = 280;
const MAX_GOAL = 600;
const MAX_KEY = 200;
const MAX_BRANCH = 200;
const MAX_COMMIT = 80;
const MAX_DESTINATION = 80;
const MAX_REASON = 500;

const PROPOSAL_KEYS = new Set([
  "schemaVersion",
  "goal",
  "constraints",
  "decisions",
  "completed",
  "unverified",
  "blockers",
  "nextAction",
  "sources",
  "repo",
]);

export type RepoSnapshot = {
  branch: string;
  commit: string;
  dirty: boolean;
};

export type HandoffDecision = {
  decision: string;
  reason: string;
};

export type HandoffSource = {
  ref: string;
  label?: string;
};

export type HandoffProposalV1 = {
  schemaVersion: typeof HANDOFF_PROPOSAL_SCHEMA_VERSION;
  goal: string;
  constraints: string[];
  decisions: HandoffDecision[];
  completed: string[];
  unverified: string[];
  blockers: string[];
  nextAction: string;
  sources: HandoffSource[];
  repo: RepoSnapshot;
};

export type StructuredHandoffHead = {
  projectId: string;
  revision: number;
  idempotencyKey: string;
  proposal: HandoffProposalV1;
  source: string;
  savedAt: number;
};

export type HandoffDeliveryReceipt = {
  projectId: string;
  revision: number;
  destination: string;
  result: "delivered" | "failed";
  reason?: string;
  repoWarning?: string;
  createdAt: number;
};

type Fail = {
  ok: false;
  status: 400 | 409;
  code: "invalid" | "duplicate" | "stale-revision" | "wrong-project" | "failed-delivery" | "no-handoff";
  error: string;
};

export const HANDOFF_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "goal",
    "constraints",
    "decisions",
    "completed",
    "unverified",
    "blockers",
    "nextAction",
    "sources",
    "repo",
  ],
  properties: {
    schemaVersion: { type: "integer", const: 1 },
    goal: { type: "string" },
    constraints: { type: "array", items: { type: "string" } },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["decision", "reason"],
        properties: {
          decision: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    completed: { type: "array", items: { type: "string" } },
    unverified: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    nextAction: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref"],
        properties: {
          ref: { type: "string" },
          label: { type: "string" },
        },
      },
    },
    repo: {
      type: "object",
      additionalProperties: false,
      required: ["branch", "commit", "dirty"],
      properties: {
        branch: { type: "string" },
        commit: { type: "string" },
        dirty: { type: "boolean" },
      },
      description: "Working-tree metadata. This snapshot does not include file contents.",
    },
  },
} as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKey(value: Record<string, unknown>, allowed: Set<string>): string | null {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

function shortText(
  value: unknown,
  field: string,
  max: number
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: `${field} must be a string` };
  const cleaned = value.trim();
  if (!cleaned) return { ok: false, error: `${field} is required` };
  if (cleaned.length > max) return { ok: false, error: `${field} is too long` };
  return { ok: true, value: cleaned };
}

function stringList(
  value: unknown,
  field: string,
  min: number
): { ok: true; value: string[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) return { ok: false, error: `${field} must be an array` };
  if (value.length > MAX_ITEMS) return { ok: false, error: `${field} has too many items` };
  if (value.length < min) return { ok: false, error: `${field} is required` };
  const items: string[] = [];
  for (const item of value) {
    const parsed = shortText(item, field, MAX_SHORT);
    if (!parsed.ok) return parsed;
    items.push(parsed.value);
  }
  return { ok: true, value: items };
}

export function parseRepoSnapshot(
  value: unknown
): { ok: true; value: RepoSnapshot } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: "repo must be an object" };
  const extra = unknownKey(value, new Set(["branch", "commit", "dirty"]));
  if (extra) return { ok: false, error: `repo.${extra} is not allowed` };
  const branch = shortText(value.branch, "repo.branch", MAX_BRANCH);
  if (!branch.ok) return branch;
  const commit = shortText(value.commit, "repo.commit", MAX_COMMIT);
  if (!commit.ok) return commit;
  if (typeof value.dirty !== "boolean") return { ok: false, error: "repo.dirty must be a boolean" };
  return { ok: true, value: { branch: branch.value, commit: commit.value, dirty: value.dirty } };
}

export function parseHandoffProposal(
  value: unknown
): { ok: true; value: HandoffProposalV1 } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: false, error: "proposal must be an object" };
  const extra = unknownKey(value, PROPOSAL_KEYS);
  if (extra) return { ok: false, error: `proposal.${extra} is not allowed` };
  if (value.schemaVersion !== HANDOFF_PROPOSAL_SCHEMA_VERSION) {
    return { ok: false, error: "proposal.schemaVersion must be 1" };
  }
  const goal = shortText(value.goal, "goal", MAX_GOAL);
  if (!goal.ok) return goal;
  const constraints = stringList(value.constraints, "constraints", 0);
  if (!constraints.ok) return constraints;
  const completed = stringList(value.completed, "completed", 0);
  if (!completed.ok) return completed;
  const unverified = stringList(value.unverified, "unverified", 0);
  if (!unverified.ok) return unverified;
  const blockers = stringList(value.blockers, "blockers", 0);
  if (!blockers.ok) return blockers;
  const nextAction = shortText(value.nextAction, "nextAction", MAX_SHORT);
  if (!nextAction.ok) return nextAction;
  if (!Array.isArray(value.decisions)) return { ok: false, error: "decisions must be an array" };
  if (value.decisions.length === 0) return { ok: false, error: "decisions is required" };
  if (value.decisions.length > MAX_ITEMS) return { ok: false, error: "decisions has too many items" };
  const decisions: HandoffDecision[] = [];
  for (const item of value.decisions) {
    if (!isObject(item)) return { ok: false, error: "decisions must be objects" };
    const decisionExtra = unknownKey(item, new Set(["decision", "reason"]));
    if (decisionExtra) return { ok: false, error: `decisions.${decisionExtra} is not allowed` };
    const decision = shortText(item.decision, "decisions.decision", MAX_SHORT);
    if (!decision.ok) return decision;
    const reason = shortText(item.reason, "decisions.reason", MAX_SHORT);
    if (!reason.ok) return reason;
    decisions.push({ decision: decision.value, reason: reason.value });
  }
  if (!Array.isArray(value.sources)) return { ok: false, error: "sources must be an array" };
  if (value.sources.length === 0) return { ok: false, error: "sources is required" };
  if (value.sources.length > MAX_ITEMS) return { ok: false, error: "sources has too many items" };
  const sources: HandoffSource[] = [];
  for (const item of value.sources) {
    if (!isObject(item)) return { ok: false, error: "sources must be objects" };
    const sourceExtra = unknownKey(item, new Set(["ref", "label"]));
    if (sourceExtra) return { ok: false, error: `sources.${sourceExtra} is not allowed` };
    const ref = shortText(item.ref, "sources.ref", MAX_SHORT);
    if (!ref.ok) return ref;
    const source: HandoffSource = { ref: ref.value };
    if (item.label !== undefined) {
      const label = shortText(item.label, "sources.label", MAX_SHORT);
      if (!label.ok) return label;
      source.label = label.value;
    }
    sources.push(source);
  }
  const repo = parseRepoSnapshot(value.repo);
  if (!repo.ok) return repo;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      goal: goal.value,
      constraints: constraints.value,
      decisions,
      completed: completed.value,
      unverified: unverified.value,
      blockers: blockers.value,
      nextAction: nextAction.value,
      sources,
      repo: repo.value,
    },
  };
}

export function renderHandoffPacket(proposal: HandoffProposalV1): string {
  const lines = [
    `Goal: ${proposal.goal}`,
    proposal.constraints.length ? `Constraints: ${proposal.constraints.join("; ")}` : "Constraints: none",
    "Decisions:",
    ...proposal.decisions.map((item) => `- ${item.decision} — ${item.reason}`),
    proposal.completed.length ? `Completed: ${proposal.completed.join("; ")}` : "Completed: none",
    proposal.unverified.length ? `Unverified: ${proposal.unverified.join("; ")}` : "Unverified: none",
    proposal.blockers.length ? `Blockers: ${proposal.blockers.join("; ")}` : "Blockers: none",
    `Next action: ${proposal.nextAction}`,
    "Sources:",
    ...proposal.sources.map((item) => `- ${item.label ? `${item.label}: ` : ""}${item.ref}`),
    `Repo: branch ${proposal.repo.branch}, commit ${proposal.repo.commit}, dirty ${proposal.repo.dirty}`,
    "Memory does not transfer code or uncommitted files.",
  ];
  return lines.join("\n");
}

export function compareRepoSnapshot(
  saved: RepoSnapshot,
  current: RepoSnapshot
): { match: boolean; warning?: string } {
  const parts: string[] = [];
  if (saved.branch !== current.branch) {
    parts.push(`branch is ${current.branch}; handoff recorded ${saved.branch}`);
  }
  if (saved.commit !== current.commit) {
    parts.push(`commit is ${current.commit}; handoff recorded ${saved.commit}`);
  }
  if (saved.dirty !== current.dirty) {
    parts.push(`dirty is ${String(current.dirty)}; handoff recorded ${String(saved.dirty)}`);
  }
  if (parts.length === 0) return { match: true };
  return {
    match: false,
    warning: `Working tree does not match the handoff snapshot (${parts.join("; ")}). Memory did not transfer code or uncommitted files. Compare the tree yourself before continuing.`,
  };
}

function integerRevision(value: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) {
    return { ok: false, error: "expectedBaseRevision must be a non-negative integer" };
  }
  return { ok: true, value };
}

export function commitStructuredHandoff(input: {
  projectId: string;
  headRevision: number;
  existingKeyRevision: number | null;
  expectedBaseRevision: number;
  idempotencyKey: string;
  proposal: HandoffProposalV1;
  source: string;
  savedAt: number;
}):
  | { ok: true; head: StructuredHandoffHead }
  | (Fail & { headRevision: number; revision?: number }) {
  const key = input.idempotencyKey.trim();
  if (!key || key.length > MAX_KEY) {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      error: "idempotencyKey is required",
      headRevision: input.headRevision,
    };
  }
  if (input.existingKeyRevision !== null) {
    return {
      ok: false,
      status: 409,
      code: "duplicate",
      error: `Duplicate handoff write. Idempotency key already stored at revision ${input.existingKeyRevision}.`,
      headRevision: input.headRevision,
      revision: input.existingKeyRevision,
    };
  }
  if (input.expectedBaseRevision !== input.headRevision) {
    return {
      ok: false,
      status: 409,
      code: "stale-revision",
      error: `Stale handoff revision. Expected base ${input.expectedBaseRevision}, current revision is ${input.headRevision}.`,
      headRevision: input.headRevision,
    };
  }
  const revision = input.headRevision + 1;
  return {
    ok: true,
    head: {
      projectId: input.projectId,
      revision,
      idempotencyKey: key,
      proposal: input.proposal,
      source: input.source,
      savedAt: input.savedAt,
    },
  };
}

export function planHandoffDelivery(input: {
  handoffProjectId: string;
  head: StructuredHandoffHead | null;
  destinationProjectId: string;
  destination: string;
  currentRepo: RepoSnapshot;
  result: "delivered" | "failed";
  reason?: string;
  createdAt: number;
}):
  | {
      ok: true;
      status: 200;
      code: "delivered";
      revision: number;
      proposal: HandoffProposalV1;
      repoSnapshot: RepoSnapshot;
      repoMatch: boolean;
      warning?: string;
      transfersCode: false;
      checksOut: false;
      receipt: HandoffDeliveryReceipt;
    }
  | (Fail & {
      headRevision?: number;
      preservedRevision?: number;
      proposal?: HandoffProposalV1;
      repoSnapshot?: RepoSnapshot;
      repoMatch?: boolean;
      warning?: string;
      transfersCode?: false;
      checksOut?: false;
      receipt?: HandoffDeliveryReceipt;
    }) {
  if (input.destinationProjectId !== input.handoffProjectId) {
    return {
      ok: false,
      status: 400,
      code: "wrong-project",
      error: "Destination project does not match the handoff project.",
    };
  }
  const destination = input.destination.trim();
  if (!destination || destination.length > MAX_DESTINATION) {
    return { ok: false, status: 400, code: "invalid", error: "destination is required" };
  }
  if (!input.head) {
    return {
      ok: false,
      status: 400,
      code: "no-handoff",
      error: "No structured handoff is stored for this project.",
    };
  }
  const comparison = compareRepoSnapshot(input.head.proposal.repo, input.currentRepo);
  const reason = input.reason?.trim();
  if (reason && reason.length > MAX_REASON) {
    return { ok: false, status: 400, code: "invalid", error: "reason is too long" };
  }
  const receipt: HandoffDeliveryReceipt = {
    projectId: input.handoffProjectId,
    revision: input.head.revision,
    destination,
    result: input.result,
    reason: reason || undefined,
    repoWarning: comparison.warning,
    createdAt: input.createdAt,
  };
  if (input.result === "failed") {
    return {
      ok: false,
      status: 409,
      code: "failed-delivery",
      error: reason || "Handoff delivery failed. The last valid handoff was preserved.",
      preservedRevision: input.head.revision,
      proposal: input.head.proposal,
      repoSnapshot: input.head.proposal.repo,
      repoMatch: comparison.match,
      warning: comparison.warning,
      transfersCode: false,
      checksOut: false,
      receipt,
    };
  }
  return {
    ok: true,
    status: 200,
    code: "delivered",
    revision: input.head.revision,
    proposal: input.head.proposal,
    repoSnapshot: input.head.proposal.repo,
    repoMatch: comparison.match,
    warning: comparison.warning,
    transfersCode: false,
    checksOut: false,
    receipt,
  };
}

export type StructuredHandoffCommand =
  | {
      type: "save";
      projectId?: string;
      expectedBaseRevision: number;
      idempotencyKey: string;
      proposal: HandoffProposalV1;
      eventDefaults: { title: string; body: string; kind: "handoff" };
    }
  | {
      type: "resume";
      projectId?: string;
      destination: string;
      destinationProjectId?: string;
      currentRepo: RepoSnapshot;
      result: "delivered" | "failed";
      reason?: string;
    };

export function readHandoffCommand(
  value: unknown
): { ok: true; command: StructuredHandoffCommand | null } | { ok: false; error: string } {
  if (!isObject(value)) return { ok: true, command: null };
  const hasSave = "proposal" in value || "expectedBaseRevision" in value || "idempotencyKey" in value;
  const hasResume = "resume" in value && value.resume !== undefined;
  if (hasSave && hasResume) {
    return { ok: false, error: "Send a handoff save or a resume, not both." };
  }
  if (!hasSave && !hasResume) return { ok: true, command: null };
  const projectId = typeof value.projectId === "string" && value.projectId.trim()
    ? value.projectId.trim()
    : undefined;
  if (hasResume) {
    if (!isObject(value.resume)) return { ok: false, error: "resume must be an object" };
    const extra = unknownKey(
      value.resume,
      new Set(["destination", "destinationProjectId", "currentRepo", "result", "reason"])
    );
    if (extra) return { ok: false, error: `resume.${extra} is not allowed` };
    const destination = shortText(value.resume.destination, "destination", MAX_DESTINATION);
    if (!destination.ok) return destination;
    const currentRepo = parseRepoSnapshot(value.resume.currentRepo);
    if (!currentRepo.ok) return currentRepo;
    let result: "delivered" | "failed" = "delivered";
    if (value.resume.result !== undefined) {
      if (value.resume.result !== "delivered" && value.resume.result !== "failed") {
        return { ok: false, error: "resume.result must be delivered or failed" };
      }
      result = value.resume.result;
    }
    let reason: string | undefined;
    if (value.resume.reason !== undefined) {
      const parsedReason = shortText(value.resume.reason, "reason", MAX_REASON);
      if (!parsedReason.ok) return parsedReason;
      reason = parsedReason.value;
    }
    let destinationProjectId: string | undefined;
    if (value.resume.destinationProjectId !== undefined) {
      if (typeof value.resume.destinationProjectId !== "string" || !value.resume.destinationProjectId.trim()) {
        return { ok: false, error: "destinationProjectId must be a string" };
      }
      destinationProjectId = value.resume.destinationProjectId.trim();
    }
    return {
      ok: true,
      command: {
        type: "resume",
        projectId,
        destination: destination.value,
        destinationProjectId,
        currentRepo: currentRepo.value,
        result,
        reason,
      },
    };
  }
  if (!("proposal" in value) || !("expectedBaseRevision" in value) || !("idempotencyKey" in value)) {
    return {
      ok: false,
      error: "Structured handoff save requires proposal, expectedBaseRevision, and idempotencyKey.",
    };
  }
  const proposal = parseHandoffProposal(value.proposal);
  if (!proposal.ok) return proposal;
  const expectedBaseRevision = integerRevision(value.expectedBaseRevision);
  if (!expectedBaseRevision.ok) return expectedBaseRevision;
  const idempotencyKey = shortText(value.idempotencyKey, "idempotencyKey", MAX_KEY);
  if (!idempotencyKey.ok) return idempotencyKey;
  if (value.kind !== undefined && value.kind !== "handoff") {
    return { ok: false, error: "Structured handoff save requires kind handoff." };
  }
  return {
    ok: true,
    command: {
      type: "save",
      projectId,
      expectedBaseRevision: expectedBaseRevision.value,
      idempotencyKey: idempotencyKey.value,
      proposal: proposal.value,
      eventDefaults: {
        kind: "handoff",
        title: `Handoff: ${proposal.value.goal}`.slice(0, 200),
        body: renderHandoffPacket(proposal.value).slice(0, 9_000),
      },
    },
  };
}

export function parseResumeCall(args: {
  projectId: string;
  destination: unknown;
  destinationProjectId?: unknown;
  currentRepo: unknown;
  deliveryResult?: unknown;
  reason?: unknown;
}):
  | {
      ok: true;
      value: {
        projectId: string;
        destinationProjectId: string;
        destination: string;
        currentRepo: RepoSnapshot;
        result: "delivered" | "failed";
        reason?: string;
      };
    }
  | { ok: false; error: string } {
  const destination = shortText(args.destination, "destination", MAX_DESTINATION);
  if (!destination.ok) return destination;
  const currentRepo = parseRepoSnapshot(args.currentRepo);
  if (!currentRepo.ok) return currentRepo;
  let result: "delivered" | "failed" = "delivered";
  if (args.deliveryResult !== undefined) {
    if (args.deliveryResult !== "delivered" && args.deliveryResult !== "failed") {
      return { ok: false, error: "deliveryResult must be delivered or failed" };
    }
    result = args.deliveryResult;
  }
  let reason: string | undefined;
  if (args.reason !== undefined) {
    const parsed = shortText(args.reason, "reason", MAX_REASON);
    if (!parsed.ok) return parsed;
    reason = parsed.value;
  }
  let destinationProjectId = args.projectId;
  if (args.destinationProjectId !== undefined) {
    if (typeof args.destinationProjectId !== "string" || !args.destinationProjectId.trim()) {
      return { ok: false, error: "destinationProjectId must be a string" };
    }
    destinationProjectId = args.destinationProjectId.trim();
  }
  return {
    ok: true,
    value: {
      projectId: args.projectId,
      destinationProjectId,
      destination: destination.value,
      currentRepo: currentRepo.value,
      result,
      reason,
    },
  };
}
