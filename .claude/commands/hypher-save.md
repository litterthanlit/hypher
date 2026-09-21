---
description: Save a structured Hypher handoff for the next agent
---

# Save a Hypher handoff

Memory stores the note. It does not checkout, copy, or sync files.

1. From the repository root, run `node hypher-web/tools/codex-claude-handoff.mjs save --source claude-code --base-revision <n>`. Use the revision `prepare_handoff` returned. Use `0` only when no structured handoff exists yet.
2. Replace every value that starts with `FILL:`. Include the decision that changed (decision and reason) and put unfinished work in `unverified`. Keep `proposal.repo` as the printed branch, commit, and dirty flag. Do not add file contents, diffs, or patches.
3. Call `post_agent_event` once with those arguments. `kind` is `handoff`. `source` is `claude-code`. Use the new `idempotencyKey` the script printed. Do not reuse a key from an earlier save.
4. Stop. Do not launch Codex from this session.

A repeated idempotency key or a stale `expectedBaseRevision` is a rejection. The current handoff stays. Do not checkout.
