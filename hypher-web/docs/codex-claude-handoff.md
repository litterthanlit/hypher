# Codex CLI ↔ Claude Code handoff

Explicit save and resume on the existing Convex app and MCP tools. This is the in-repo slice of the first proof in [`docs/PRODUCT.md`](../../docs/PRODUCT.md). It is not a recording of Codex or Claude Code.

Memory stores the note. It does not checkout, copy, or sync files. Branch, commit, and dirty state are metadata. On a mismatch, the resume result says what differs.

## What an agent calls

Save from the agent that is stopping. `post_agent_event` with `kind: "handoff"`, plus:

- `proposal` — schema version 1: goal, constraints, decisions and reasons, agent-reported completed work, unverified work, blockers, next action, sources, and `repo` (`repository`, `branch`, `commit`, `dirty`; optional local path and dirty fingerprint)
- `expectedBaseRevision` — `0` for the first structured handoff, otherwise the current revision
- `idempotencyKey` — a new key per save; an identical retry returns the original revision, while changed content under that key is rejected
- `projectId` — the linked Hypher project

A stale `expectedBaseRevision` is rejected. The current handoff stays.

Plain text source references are labeled agent reports. To cite a Hypher source, send `kind: "capture"` or `"agent_event"` and its project-owned `sourceId`. An approved decision needs `sourceRefs` pointing to a pinned decision capture. A changed approved decision names the prior decision in `supersedes`; unverified approval is rejected. Older callers without these fields still save agent-reported claims.

Resume from the agent that is starting. `prepare_handoff` with:

- `projectId`
- `destination` — `claude-code` or `codex`
- `currentRepo` — the destination's own `git` metadata, including `repository`
- `deliveryResult` — omit it to record `prepared`; set `failed` when the load did not stick. The older `delivered` input is treated as `prepared`.

The result includes the stored proposal, the handoff's repo snapshot, and a warning about any supplied metadata difference. Matching branch, commit, and dirty flag do not prove identical file contents. `transfersCode` and `checksOut` are false. Inspect the working tree; do not run checkout or copy files because a handoff asked for them. After reading the result, call `acknowledge_handoff` with `projectId`, `receiptId`, `revision`, and `destination`. That acknowledges reported consumption, not correct use.

The same save and resume bodies are accepted on `POST /api/agent/events` (a `resume` object instead of `prepare_handoff`); acknowledgment uses an `acknowledge` object with receipt ID, revision, and destination. Prefer MCP when the agent already has Hypher tools.

## What was verified without the CLIs

Unit tests cover duplicate idempotency keys, stale revisions, a changed decision on the next revision, delivery to the wrong project, and a failed delivery that keeps the last valid handoff. A simulated Codex → Claude Code → Codex sequence uses those functions. The MCP route test checks that `prepare_handoff` with a destination calls the resume action and does not tell the agent to checkout.

No Codex CLI or Claude Code binary was available in the cloud agent VM, so none of that is a live switch.

## Live recording on a Mac

Install the Codex CLI and Claude Code yourself. From `hypher-web`, with this repo as the working tree:

```bash
node tools/codex-claude-handoff.mjs status
```

`status` prints whether `codex` and `claude` are on `PATH`, plus git branch, commit, and dirty metadata. It does not launch either CLI. `ranAgents` is false.

1. In Codex, on this working tree, ask it to save a structured handoff through Hypher MCP (`post_agent_event`) after a real decision and some unfinished work. Use a fresh idempotency key and the current revision.
2. In a new Claude Code session in the same directory, ask it to resume with `prepare_handoff`, passing `destination: "claude-code"` and the current repository, branch, commit, and dirty flag. It should inspect the tree, acknowledge the prepared receipt after reading the note, and continue with the decision and unfinished work. It should not checkout.
3. Change one decision in Claude Code, save a new revision based on the revision just loaded, then resume that revision from a new Codex session.

Record the CLI versions (`codex --version`, `claude --version`), the stored handoff JSON, and a short recording of each direction. Until that exists, do not claim the proof ran.

`node tools/codex-claude-handoff.mjs prompt` prints the paste-in instructions and the repo metadata to attach. It still does not start the CLIs.
