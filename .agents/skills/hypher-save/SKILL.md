---
name: hypher-save
description: Save an explicit Hypher structured handoff when a Codex session stops, including a changed decision, unfinished work, and repo metadata. Use when asked to hand off or switch to Claude Code. Does not transfer code.
---

# Save a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs save --source codex --base-revision <n>`. Use `0` only when no structured handoff exists yet. On a return save, use the revision `$hypher-resume` loaded.
2. Replace every value that starts with `FILL:`. Include one changed decision (decision and reason) and put unfinished work in `unverified`. Keep `proposal.repo` as the printed branch, commit, and dirty flag. Do not add file contents, diffs, or patches. Hypher rejects unknown proposal keys.
3. Call Hypher MCP `post_agent_event` once with the printed arguments. `source` is `codex`. Use a new `idempotencyKey`.
4. Stop. Do not launch Claude Code from this session.

A repeated idempotency key or a stale `expectedBaseRevision` is a rejection. The current handoff stays. Do not checkout.

The script's `ranAgents` value stays false. This skill does not start another CLI.
