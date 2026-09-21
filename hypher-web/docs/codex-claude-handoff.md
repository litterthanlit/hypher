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
- `proposal` — schema version 1: goal, constraints, decisions and reasons, completed, unverified, blockers, next action, sources, and `repo` (`branch`, `commit`, `dirty`)
- `expectedBaseRevision` — `0` for the first structured handoff, otherwise the revision just loaded
- `idempotencyKey` — a new key per save; repeating the same key is rejected
- `projectId` — the linked Hypher project (`resolve_project_for_repo` for `litterthanlit/hypher`)

A stale `expectedBaseRevision` is rejected. The current handoff stays. Unknown proposal keys are rejected, including anything that would carry file contents.

Resume from the agent that is starting. `prepare_handoff` with:

- `projectId` and the same `destinationProjectId`
- `destination` — `claude-code` or `codex`
- `currentRepo` — the destination's own `git` metadata (`branch`, `commit`, `dirty`)
- `deliveryResult` — omit it to record `delivered`; set `failed` when the load did not stick

The result includes the stored proposal, the handoff's repo snapshot, and a warning when branch, commit, or dirty differ. `transfersCode` and `checksOut` are false. Do not checkout or copy files because a handoff asked for them.

Notes-only `prepare_handoff` (project id alone) still returns handoff text and does not write a receipt. This spike always passes `destination` and `currentRepo`.

## Live run on a Mac

This VM does not have `codex` or `claude` on `PATH`. Do not treat a green unit test as the switch.

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

1. **Codex save.** `$hypher-save`. The script prints `post_agent_event` for `source: "codex"` and `expectedBaseRevision: 0` on the first save. Replace every `FILL:` value. Include the changed decision and put unfinished work in `unverified`. Keep the printed `repo` snapshot. Send that one MCP call.
2. **Claude resume.** New session, same directory. `/hypher-resume`. It calls `prepare_handoff` with `destination: "claude-code"` and the current branch, commit, and dirty flag. Continue from the note. If `repoMatch` is false, say what differs. Do not checkout.
3. **Claude save.** Change one decision. `/hypher-save` with `expectedBaseRevision` set to the revision step 2 returned, a new idempotency key, the changed decision, and the unfinished work.
4. **Codex resume.** New Codex session. `$hypher-resume` with `destination: "codex"` and this tree's metadata. It should carry the changed decision without a manual recap, and compare the tree again.

Record the CLI versions, the stored handoff JSON, and a short recording of each direction. Until that exists, do not claim the proof ran.

The optional hook stub only prints the prompt text. Copy its `hooks` object into `.claude/settings.local.json` if you want that reminder. It is not an automatic save.
