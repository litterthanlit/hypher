---
name: hypher-save
description: Save an explicit Hypher structured handoff when a Codex session stops, including a changed decision, unfinished work, and repo metadata. Use when asked to hand off or switch to Claude Code. Does not transfer code.
---

# Save a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs save --source codex --base-revision <n>`. Use `0` only when no structured handoff exists yet. On a return save, use the revision `$hypher-resume` loaded. For a changed decision, add `--supersedes "<exact prior decision>"`; to mark it approved, also add `--decision-capture-id "<project-owned pinned capture id>"`.
2. Replace every value that starts with `FILL:`. Keep every prior decision in this full snapshot unless it is explicitly superseded. Without a pinned capture, label the change agent-reported. Put unfinished work in `unverified`. Keep the printed repository, branch, commit, dirty state, and worktree path. Do not add file contents, diffs, or patches.
3. Call Hypher MCP `post_agent_event` once with the printed arguments. `source` is `codex`. Use a new `idempotencyKey`.
4. Stop. Do not launch Claude Code from this session.

An identical retry with the same idempotency key returns the original revision. Changed content under that key or a stale `expectedBaseRevision` is rejected. Do not checkout.

The script's `ranAgents` value stays false. This skill does not start another CLI.
