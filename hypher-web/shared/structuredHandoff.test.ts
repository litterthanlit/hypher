import { describe, expect, it } from "vitest";
import {
  commitStructuredHandoff,
  compareRepoSnapshot,
  parseHandoffProposal,
  planHandoffDelivery,
  readHandoffCommand,
  renderHandoffPacket,
  validateDecisionTransition,
  type HandoffProposalV1,
  type StructuredHandoffHead,
} from "./structuredHandoff";

const repo = { repository: "litterthanlit/hypher", branch: "main", commit: "aaa111", dirty: true };

function proposal(overrides: Partial<HandoffProposalV1> = {}): HandoffProposalV1 {
  return {
    schemaVersion: 1,
    goal: "Finish explicit handoff resume",
    constraints: ["Do not transfer code", "Pulse stays three panels"],
    decisions: [{ decision: "Store the handoff in Convex", reason: "The pilot reuses the cloud app" }],
    completed: ["Proposal schema"],
    unverified: ["Live Codex to Claude switch"],
    blockers: [],
    nextAction: "Have Claude Code resume on the same tree",
    sources: [{ ref: "docs/PRODUCT.md", label: "product" }],
    repo,
    ...overrides,
  };
}

type Ledger = {
  projectId: string;
  head: StructuredHandoffHead | null;
  keys: Record<string, number>;
  history: StructuredHandoffHead[];
  receipts: Array<{ result: string; revision: number; destination: string }>;
};

function emptyLedger(projectId = "project-hypher"): Ledger {
  return { projectId, head: null, keys: {}, history: [], receipts: [] };
}

function save(ledger: Ledger, key: string, base: number, next: HandoffProposalV1, savedAt = 10) {
  const result = commitStructuredHandoff({
    projectId: ledger.projectId,
    headRevision: ledger.head?.revision ?? 0,
    existingKeyRevision: ledger.keys[key] ?? null,
    expectedBaseRevision: base,
    idempotencyKey: key,
    proposal: next,
    source: "codex",
    savedAt,
  });
  if (result.ok) {
    ledger.head = result.head;
    ledger.keys[key] = result.head.revision;
    ledger.history.push(result.head);
  }
  return result;
}

function deliver(
  ledger: Ledger,
  destinationProjectId: string,
  result: "prepared" | "failed",
  currentRepo = repo,
  destination = "claude-code"
) {
  const planned = planHandoffDelivery({
    handoffProjectId: ledger.projectId,
    head: ledger.head,
    destinationProjectId,
    destination,
    currentRepo,
    result,
    reason: result === "failed" ? "destination could not load the note" : undefined,
    createdAt: 20,
  });
  if (planned.receipt) {
    ledger.receipts.push({
      result: planned.receipt.result,
      revision: planned.receipt.revision,
      destination: planned.receipt.destination,
    });
  }
  return planned;
}

describe("structured handoff writes", () => {
  it("rejects a duplicate idempotency key without moving the head", () => {
    const ledger = emptyLedger();
    expect(save(ledger, "codex-1", 0, proposal()).ok).toBe(true);
    const head = ledger.head;
    const duplicate = save(ledger, "codex-1", 1, proposal({ goal: "A different goal" }));

    expect(duplicate).toMatchObject({
      ok: false,
      status: 409,
      code: "duplicate",
      revision: 1,
      headRevision: 1,
    });
    expect(ledger.head).toBe(head);
    expect(ledger.head?.proposal.goal).toBe("Finish explicit handoff resume");
    expect(ledger.history).toHaveLength(1);
  });

  it("rejects a stale base revision and leaves the current handoff in place", () => {
    const ledger = emptyLedger();
    save(ledger, "codex-1", 0, proposal());
    const stale = save(
      ledger,
      "codex-2",
      0,
      proposal({ nextAction: "Overwrite the newer note" })
    );

    expect(stale).toMatchObject({
      ok: false,
      status: 409,
      code: "stale-revision",
      headRevision: 1,
    });
    expect(ledger.head?.revision).toBe(1);
    expect(ledger.head?.proposal.nextAction).toBe("Have Claude Code resume on the same tree");
  });

  it("keeps a changed decision on the new revision and leaves the previous snapshot intact", () => {
    const ledger = emptyLedger();
    const first = proposal();
    save(ledger, "codex-1", 0, first);
    const changed = proposal({
      decisions: [{
        decision: "Skip local SQLite for this proof",
        reason: "The round trip uses the existing Convex app",
      }],
      unverified: ["Return trip back to Codex"],
      nextAction: "Resume in Codex with the changed decision",
    });
    const second = save(ledger, "claude-2", 1, changed, 30);

    expect(second.ok).toBe(true);
    expect(ledger.head?.revision).toBe(2);
    expect(ledger.head?.proposal.decisions[0]?.decision).toBe("Skip local SQLite for this proof");
    expect(ledger.history[0]?.proposal.decisions[0]?.decision).toBe("Store the handoff in Convex");
    expect(first.decisions[0]?.decision).toBe("Store the handoff in Convex");
  });
});

describe("structured handoff delivery", () => {
  it("rejects a delivery aimed at a different project and writes no receipt", () => {
    const ledger = emptyLedger();
    save(ledger, "codex-1", 0, proposal());
    const result = deliver(ledger, "other-project", "prepared");

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: "wrong-project",
    });
    expect(result.receipt).toBeUndefined();
    expect(ledger.receipts).toEqual([]);
    expect(ledger.head?.revision).toBe(1);
  });

  it("records a failed delivery and preserves the last valid handoff", () => {
    const ledger = emptyLedger();
    save(ledger, "codex-1", 0, proposal());
    const before = ledger.head?.proposal;
    const result = deliver(ledger, ledger.projectId, "failed");

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "failed-delivery",
      preservedRevision: 1,
      transfersCode: false,
      checksOut: false,
    });
    expect(ledger.receipts).toEqual([
      { result: "failed", revision: 1, destination: "claude-code" },
    ]);
    expect(ledger.head?.proposal).toBe(before);
    expect(ledger.head?.revision).toBe(1);
  });

  it("simulates Codex save, Claude resume, changed decision, and Codex resume", () => {
    const ledger = emptyLedger();
    const saved = save(ledger, "codex-save", 0, proposal());
    expect(saved.ok).toBe(true);

    const claudeResume = deliver(
      ledger,
      ledger.projectId,
      "prepared",
      { repository: "litterthanlit/hypher", branch: "main", commit: "aaa111", dirty: false },
      "claude-code"
    );
    expect(claudeResume.ok).toBe(true);
    if (!claudeResume.ok) return;
    expect(claudeResume.transfersCode).toBe(false);
    expect(claudeResume.checksOut).toBe(false);
    expect(claudeResume.repoSnapshot).toEqual(repo);
    expect(claudeResume.repoMatch).toBe(false);
    expect(claudeResume.warning).toMatch(/dirty is false/);
    expect(claudeResume.warning).not.toMatch(/checkout|git pull|sync files/i);
    expect(claudeResume.proposal.decisions[0]?.decision).toBe("Store the handoff in Convex");

    const changed = proposal({
      decisions: [{
        decision: "Resume stays explicit",
        reason: "Automatic checkpoints are not proven on these CLIs",
      }],
      completed: ["Proposal schema", "Claude loaded revision 1"],
      nextAction: "Return the changed decision to Codex",
      repo: { repository: "litterthanlit/hypher", branch: "main", commit: "bbb222", dirty: false },
    });
    expect(save(ledger, "claude-save", 1, changed, 40).ok).toBe(true);

    const codexResume = deliver(
      ledger,
      ledger.projectId,
      "prepared",
      { repository: "litterthanlit/hypher", branch: "main", commit: "bbb222", dirty: false },
      "codex"
    );
    expect(codexResume.ok).toBe(true);
    if (!codexResume.ok) return;
    expect(codexResume.revision).toBe(2);
    expect(codexResume.repoMatch).toBe(true);
    expect(codexResume.warning).toMatch(/did not verify file contents/);
    expect(codexResume.proposal.decisions[0]?.decision).toBe("Resume stays explicit");
    expect(codexResume.proposal.sources[0]?.ref).toBe("docs/PRODUCT.md");
    expect(ledger.receipts.map((item) => item.destination)).toEqual(["claude-code", "codex"]);
  });
});

describe("handoff proposal validation", () => {
  it("labels unverified agent claims and refuses invented source links", () => {
    const reported = proposal({
      decisions: [{ decision: "Ship now", reason: "Agent says approval happened" }],
      sources: [{ ref: "made-up-source" }],
    });
    expect(renderHandoffPacket(reported)).toContain("Agent-reported: Ship now");
    expect(renderHandoffPacket(reported)).toContain("Agent-reported: made-up-source");
    expect(parseHandoffProposal(proposal({
      decisions: [{ decision: "Ship now", reason: "Approved", sourceRefs: ["missing"] }],
    })).ok).toBe(false);
  });

  it("requires sourced approval to supersede an approved decision", () => {
    const previous = proposal({ decisions: [{ decision: "Keep guest checkout", reason: "User chose it", status: "approved", sourceRefs: ["capture-1"] }] });
    const unsourced = proposal({ decisions: [{ decision: "Require accounts", reason: "Agent suggestion" }] });
    expect(validateDecisionTransition(previous, unsourced, new Set())).toMatch(/cannot disappear/);
    const changed = proposal({ decisions: [{ decision: "Require accounts", reason: "User changed it", status: "approved", sourceRefs: ["capture-2"], supersedes: "Keep guest checkout" }] });
    expect(validateDecisionTransition(previous, changed, new Set(["capture-2"]))).toBeNull();
    expect(validateDecisionTransition(previous, changed, new Set())).toMatch(/requires a linked/);
  });

  it("keeps an earlier agent-reported decision visible until sourced supersession", () => {
    const previous = proposal({ decisions: [{ decision: "Use a queue", reason: "Agent report" }] });
    const replacement = proposal({ decisions: [{ decision: "Use direct calls", reason: "Agent report" }] });
    expect(validateDecisionTransition(previous, replacement, new Set())).toMatch(/cannot disappear/);
    expect(validateDecisionTransition(previous, proposal({ decisions: [...previous.decisions, ...replacement.decisions] }), new Set())).toBeNull();
  });

  it("rejects duplicate decisions and downgrading an approved decision", () => {
    expect(parseHandoffProposal(proposal({ decisions: [
      { decision: "Keep guest checkout", reason: "First" },
      { decision: "keep guest checkout", reason: "Second" },
    ] }))).toMatchObject({ ok: false, error: "decisions.decision must be unique" });
    const previous = proposal({ decisions: [{ decision: "Keep guest checkout", reason: "User choice", status: "approved", sourceRefs: ["capture-1"] }] });
    expect(validateDecisionTransition(previous, proposal({ decisions: [{ decision: "Keep guest checkout", reason: "Agent report" }] }), new Set()))
      .toMatch(/cannot be downgraded/);
  });

  it("does not call two dirty trees equal without a content fingerprint", () => {
    const result = compareRepoSnapshot(repo, { ...repo });
    expect(result.match).toBe(false);
    expect(result.warning).toMatch(/dirty file contents/);
    expect(compareRepoSnapshot({ ...repo, dirtyFingerprint: "x" }, { ...repo, dirtyFingerprint: "y" }).match).toBe(false);
  });

  it("rejects an unknown schema version and a proposal that tries to carry files", () => {
    expect(parseHandoffProposal({ ...proposal(), schemaVersion: 2 }).ok).toBe(false);
    expect(parseHandoffProposal({ ...proposal(), files: ["src/app.ts"] })).toMatchObject({
      ok: false,
      error: "proposal.files is not allowed",
    });
  });

  it("warns on a working-tree mismatch without telling the agent to sync code", () => {
    const warning = compareRepoSnapshot(repo, { repository: "litterthanlit/hypher", branch: "feature", commit: "ccc333", dirty: false });
    expect(warning.match).toBe(false);
    expect(warning.warning).toMatch(/does not establish/);
    expect(warning.warning).not.toMatch(/checkout/);
  });

  it("reads a save command and refuses a combined save plus resume", () => {
    const parsed = readHandoffCommand({
      proposal: proposal(),
      expectedBaseRevision: 0,
      idempotencyKey: "codex-1",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.command || parsed.command.type !== "save") {
      throw new Error("expected a save command");
    }
    expect(parsed.command.proposal.goal).toBe("Finish explicit handoff resume");
    expect(readHandoffCommand({ kind: "handoff", title: "x", body: "y" })).toEqual({
      ok: true,
      command: null,
    });
    expect(readHandoffCommand({
      proposal: proposal(),
      expectedBaseRevision: 0,
      idempotencyKey: "codex-1",
      resume: { destination: "claude-code", currentRepo: repo },
    }).ok).toBe(false);
  });

  it("parses a separate HTTP acknowledgment and rejects mixed commands", () => {
    expect(readHandoffCommand({ projectId: "p1", acknowledge: { receiptId: "r1", revision: 2, destination: "claude-code" } }))
      .toMatchObject({ ok: true, command: { type: "acknowledge", receiptId: "r1", revision: 2 } });
    expect(readHandoffCommand({ projectId: "p1", acknowledge: { receiptId: "r1", revision: 0, destination: "claude-code" } }).ok).toBe(false);
    expect(readHandoffCommand({ projectId: "p1", acknowledge: { receiptId: "r1", revision: 2, destination: "claude-code" },
      resume: { destination: "codex", currentRepo: repo } }).ok).toBe(false);
  });
});
