import { describe, expect, it } from "vitest";
import { acknowledgeForUser, commitForUser, deliverForUser } from "./structuredHandoffs";
import type { HandoffProposalV1 } from "../shared/structuredHandoff";

type TestHandler = (ctx: any, args: any) => Promise<any>;
const commit = (commitForUser as unknown as { _handler: TestHandler })._handler;
const deliver = (deliverForUser as unknown as { _handler: TestHandler })._handler;
const acknowledge = (acknowledgeForUser as unknown as { _handler: TestHandler })._handler;

function fakeDb() {
  const rows = new Map<string, Record<string, any>>();
  const counts: Record<string, number> = {};
  rows.set("p1", { _id: "p1", userId: "u1", kind: "project", name: "Hypher", githubRepo: "litterthanlit/hypher" });
  return {
    rows,
    get: async (id: string) => rows.get(id) ?? null,
    insert: async (table: string, data: Record<string, unknown>) => {
      counts[table] = (counts[table] ?? 0) + 1;
      const id = `${table}-${counts[table]}`;
      rows.set(id, { _id: id, ...data });
      return id;
    },
    patch: async (id: string, data: Record<string, unknown>) => {
      rows.set(id, { ...rows.get(id), ...data });
    },
    query: (table: string) => {
      const filters: Record<string, unknown> = {};
      let index = "";
      let direction = "asc";
      const query = {
        withIndex(name: string, build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) {
          index = name;
          const builder = { eq(field: string, value: unknown) { filters[field] = value; return builder; } };
          build(builder);
          return query;
        },
        order(value: string) { direction = value; return query; },
        async first() {
          const found = [...rows.values()].filter((row) => row._id.startsWith(`${table}-`)
            && Object.entries(filters).every(([key, value]) => row[key] === value));
          if (index.includes("revision")) found.sort((a, b) => (a.revision ?? -1) - (b.revision ?? -1));
          if (direction === "desc") found.reverse();
          return found[0] ?? null;
        },
      };
      return query;
    },
  };
}

const repo = { repository: "litterthanlit/hypher", branch: "main", commit: "abc123", dirty: false };
function proposal(overrides: Partial<HandoffProposalV1> = {}): HandoffProposalV1 {
  return {
    schemaVersion: 1,
    goal: "Continue the checkout work",
    constraints: [],
    decisions: [{ decision: "Keep guest checkout", reason: "User said so" }],
    completed: [],
    unverified: ["Tests not run"],
    blockers: [],
    nextAction: "Finish checkout",
    sources: [{ ref: "agent session", kind: "agent_report" }],
    repo,
    ...overrides,
  };
}

function saveArgs(next = proposal()) {
  return { userId: "u1", projectId: "p1", expectedBaseRevision: 0, idempotencyKey: "session-1",
    proposal: next, source: "codex", title: "Checkout handoff", body: "Agent reported checkout state",
    repo: "litterthanlit/hypher", now: 100 };
}

describe("Convex structured handoff mutation handlers", () => {
  it("returns the original result for an identical retry and rejects key reuse with different content", async () => {
    const db = fakeDb();
    const first = await commit({ db } as any, saveArgs() as any);
    expect(first).toMatchObject({ ok: true, code: "saved", revision: 1 });
    const retry = await commit({ db } as any, saveArgs() as any);
    expect(retry).toMatchObject({ ok: true, code: "already-saved", revision: 1, eventId: first.eventId });
    expect([...db.rows.values()].filter((row) => row._id.startsWith("handoffs-"))).toHaveLength(1);
    expect([...db.rows.values()].filter((row) => row._id.startsWith("agentEvents-"))).toHaveLength(1);
    const changed = await commit({ db } as any, saveArgs(proposal({ goal: "Different" })) as any);
    expect(changed).toMatchObject({ ok: false, code: "duplicate" });
  });

  it("rejects wrong repositories and foreign or unapproved source claims", async () => {
    const db = fakeDb();
    expect(await commit({ db } as any, saveArgs(proposal({ repo: { ...repo, repository: "someone/else" } })) as any))
      .toMatchObject({ ok: false, code: "wrong-project" });
    db.rows.set("other-note", { _id: "other-note", userId: "u1", kind: "note", projectId: "p2",
      pinnedAsDecision: true, captureType: "decision" });
    const linked = proposal({
      sources: [{ ref: "source-1", kind: "capture", sourceId: "other-note" }],
      decisions: [{ decision: "Ship", reason: "Approved", status: "approved", sourceRefs: ["source-1"] }],
    });
    expect(await commit({ db } as any, saveArgs(linked) as any))
      .toMatchObject({ ok: false, code: "invalid", error: expect.stringContaining("unavailable") });
    db.rows.set("other-note", { ...db.rows.get("other-note"), projectId: "p1", pinnedAsDecision: false });
    expect(await commit({ db } as any, saveArgs(linked) as any))
      .toMatchObject({ ok: false, code: "invalid", error: expect.stringContaining("Approved decision requires") });
  });

  it("records preparation and only acknowledges the matching revision and destination", async () => {
    const db = fakeDb();
    await commit({ db } as any, saveArgs() as any);
    const prepared = await deliver({ db } as any, { userId: "u1", projectId: "p1",
      destinationProjectId: "p1", destination: "claude-code", currentRepo: repo, result: "prepared", now: 101 } as any);
    expect(prepared).toMatchObject({ ok: true, code: "prepared", revision: 1 });
    expect(db.rows.get(prepared.receiptId!)).toMatchObject({ result: "prepared" });
    expect(await acknowledge({ db } as any, { userId: "u1", projectId: "p1",
      receiptId: prepared.receiptId, revision: 2, destination: "claude-code", now: 102 } as any))
      .toMatchObject({ ok: false });
    expect(await acknowledge({ db } as any, { userId: "u1", projectId: "p1",
      receiptId: prepared.receiptId, revision: 1, destination: "claude-code", now: 102 } as any))
      .toMatchObject({ ok: true, code: "acknowledged" });
    expect(db.rows.get(prepared.receiptId!)).toMatchObject({ result: "acknowledged", acknowledgedAt: 102 });
  });

  it("carries an explicitly superseded reported decision to the return agent", async () => {
    const db = fakeDb();
    expect(await commit({ db } as any, saveArgs() as any)).toMatchObject({ ok: true, revision: 1 });
    const changed = proposal({
      decisions: [{ decision: "Require accounts", reason: "Claude changed the plan", status: "reported",
        sourceRefs: ["claude-session"], supersedes: "Keep guest checkout" }],
      sources: [{ ref: "claude-session", kind: "agent_report" }],
      unverified: ["Account flow remains unimplemented"],
    });
    expect(await commit({ db } as any, { ...saveArgs(changed), expectedBaseRevision: 1,
      idempotencyKey: "session-2", source: "claude-code", now: 102 } as any))
      .toMatchObject({ ok: true, revision: 2 });
    const resumed = await deliver({ db } as any, { userId: "u1", projectId: "p1",
      destinationProjectId: "p1", destination: "codex", currentRepo: repo, result: "prepared", now: 103 } as any);
    expect(resumed).toMatchObject({ ok: true, revision: 2,
      proposal: { decisions: [{ decision: "Require accounts", status: "reported", supersedes: "Keep guest checkout" }],
        unverified: ["Account flow remains unimplemented"] } });
  });
});
