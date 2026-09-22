# Codex CLI ↔ Claude Code handoff

Explicit save and resume on the existing Convex app and MCP tools. This is the in-repo run path for the first proof in [`docs/PRODUCT.md`](../../docs/PRODUCT.md). It is not a recording of Codex or Claude Code.

Memory stores the note. It does not checkout, copy, or sync files. Branch, commit, and dirty state are metadata. On a mismatch, the resume result says what differs. The destination compares that snapshot itself.

`node hypher-web/tools/codex-claude-handoff.mjs` prints arguments. It does not launch either CLI and it does not post to Hypher. `ranAgents` stays false.

## What is in the repo

| File | Who reads it |
|---|---|
| [`.mcp.json`](../../.mcp.json) | Claude Code project MCP. Header is `Bearer ${HYPHER_API_KEY}`. |
| [`.codex/config.toml`](../../.codex/config.toml) | Codex, after the repo is trusted. Bearer token comes from `HYPHER_API_KEY`. |
| [`.claude/commands/hypher-resume.md`](../../.claude/commands/hypher-resume.md) | Claude `/hypher-resume` |
| [`.claude/commands/hypher-save.md`](../../.claude/commands/hypher-save.md) | Claude `/hypher-save` |
| [`.agents/skills/hypher-resume/SKILL.md`](../../.agents/skills/hypher-resume/SKILL.md) | Codex `$hypher-resume` |
| [`.agents/skills/hypher-save/SKILL.md`](../../.agents/skills/hypher-save/SKILL.md) | Codex `$hypher-save` |
| [`.claude/settings.hooks.stub.json`](../../.claude/settings.hooks.stub.json) | Not loaded. A SessionStart reminder only. It runs `prompt` and does not call MCP. |

Writes on the Codex server (`post_agent_event`, `prepare_handoff`) ask for approval. Hooks are not turned on. Automatic checkpoints stay off until a recorded version shows the explicit path works.

## What an agent calls

Save from the agent that is stopping. `post_agent_event` with `kind: "handoff"`, plus:

- `source` — `codex` or `claude-code`
- `proposal` — schema version 1: goal, constraints, decisions and reasons, agent-reported completed work, unverified work, blockers, next action, sources, and `repo` (`repository`, `branch`, `commit`, `dirty`; optional local path and dirty fingerprint)
- `expectedBaseRevision` — `0` for the first structured handoff, otherwise the current revision
- `idempotencyKey` — a new key per save; an identical retry returns the original revision, while changed content under that key is rejected
- `projectId` — the linked Hypher project (`resolve_project_for_repo` for `litterthanlit/hypher`)

A stale `expectedBaseRevision` is rejected. The current handoff stays. Unknown proposal keys are rejected, including anything that would carry file contents.

Plain text source references are labeled agent reports. To cite a Hypher source, send `kind: "capture"` or `"agent_event"` and its project-owned `sourceId`. A changed decision names the prior decision in `supersedes` and links a source. An agent-reported change stays labeled as a report. To mark it approved, add a project-owned pinned decision capture and its ID; unverified approval is rejected. Older callers without these fields still save agent-reported claims.

Resume from the agent that is starting. `prepare_handoff` with:

- `projectId` and the same `destinationProjectId`
- `destination` — `claude-code` or `codex`
- `currentRepo` — the destination's own `git` metadata, including `repository`
- `deliveryResult` — omit it to record `prepared`; set `failed` when the load did not stick. The older `delivered` input is treated as `prepared`.

The result includes the stored proposal, the handoff's repo snapshot, and a warning about any supplied metadata difference. Stop on a named repository, branch, commit, path, or dirty-state difference and reconcile the local tree. If the only warning is that dirty file contents are unverified, inspect them locally before continuing. `transfersCode` and `checksOut` are false. Do not run checkout or copy files because a handoff asked for them. After reading the result, call `acknowledge_handoff` with `projectId`, `receiptId`, `revision`, and `destination`. That acknowledges reported consumption, not correct use.

Notes-only `prepare_handoff` (project id alone) still returns handoff text and does not write a receipt. This run path passes `destination` and `currentRepo`.

The same save and resume bodies are accepted on `POST /api/agent/events` (a `resume` object instead of `prepare_handoff`); acknowledgment uses an `acknowledge` object with receipt ID, revision, and destination. Prefer MCP when the agent already has Hypher tools.

## Live run on a Mac

Do not treat a green unit test as the switch.

1. Install Codex CLI and Claude Code. Record `codex --version` and `claude --version`.
2. Export `HYPHER_API_KEY` (`hyp_…` from Settings → API keys). Do not commit it.
3. Trust the repo in both tools. Codex ignores `.codex/config.toml` until the project is trusted. Claude asks before it uses `.mcp.json`.
4. Confirm the tools are the structured ones: `post_agent_event` accepts `proposal`, `expectedBaseRevision`, and `idempotencyKey`; `prepare_handoff` accepts `destination` and `currentRepo`. If `tools/list` lacks those fields, this branch is not what `https://www.hypher.app/api/mcp` is serving. Deploy is a separate step. This change does not deploy.
5. From `hypher-web`:

```bash
node tools/codex-claude-handoff.mjs status
node tools/codex-claude-handoff.mjs round-trip
```

`status` reports whether the binaries are on `PATH`, plus branch, commit, and dirty. It still sets `ranAgents` to false.

Then, on this working tree, with a real decision and some unfinished work:

1. **Codex save.** `$hypher-save`. The script prints `post_agent_event` for `source: "codex"`. Use `expectedBaseRevision: 0` only for the first structured save; otherwise use the current revision. Replace every `FILL:` value. Put unfinished work in `unverified`. Keep the freshly printed repository snapshot. Send that one MCP call.
2. **Claude resume.** New session, same directory. `/hypher-resume`. Run the helper again to capture current metadata. Call `prepare_handoff` with `destination: "claude-code"`. Stop on a named difference; inspect dirty files when contents are unverified. Read the proposal and acknowledge its prepared receipt, then continue.
3. **Claude save.** Change one decision. Use `/hypher-save` with `--supersedes "<exact prior decision>"`, the revision step 2 returned, and a new idempotency key. The payload explicitly retires the prior reported decision and labels the change as agent-reported. To mark it approved, pin a project decision capture in Hypher and add `--decision-capture-id "<capture id>"`. Keep unfinished work in `unverified`.
4. **Codex resume.** New Codex session. `$hypher-resume` with `destination: "codex"` and a newly captured repository snapshot. Stop on a named difference; inspect unverified dirty contents and acknowledge the prepared receipt after reading it. The changed decision should carry with its status label, without a manual recap.

Record the CLI versions, the stored handoff JSON, and a short recording of each direction. Until that exists, do not claim the proof ran.

The optional hook stub only prints the prompt text. Copy its `hooks` object into `.claude/settings.local.json` if you want that reminder. It is not an automatic save.
