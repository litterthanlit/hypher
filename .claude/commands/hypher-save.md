---
description: Save a structured Hypher handoff for the next agent
---

# Save a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs save --source claude-code --base-revision <n>`. Use the revision `prepare_handoff` returned. Use `0` only when no structured handoff exists yet. For a changed decision, add `--supersedes "<exact prior decision>"`; to mark it approved, also add `--decision-capture-id "<project-owned pinned capture id>"`.
2. Replace every value that starts with `FILL:`. Keep every prior decision in this full snapshot unless it is explicitly superseded. Without a pinned capture, label the change agent-reported. Put unfinished work in `unverified`. Keep the printed repository metadata. Do not add file contents, diffs, or patches.
3. Call `post_agent_event` once with those arguments. `kind` is `handoff`. `source` is `claude-code`. Use the new `idempotencyKey` the script printed. Do not reuse a key from an earlier save.
4. Stop. Do not launch Codex from this session.

An identical retry with the same idempotency key returns the original revision. Changed content under that key or a stale `expectedBaseRevision` is rejected. Do not checkout.
