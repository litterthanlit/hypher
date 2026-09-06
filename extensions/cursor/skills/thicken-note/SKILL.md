---
name: thicken-note
description: Use when the Hypher Builder Brief is still skeleton or heuristic (dump-echo / needsSynthesis), or when the user asks to thicken/improve project memory without a Generate button. Prefer after start-session loads a thin brief.
---

# Thicken the Hypher note on your model

Hypher stores the note. It does not host the brain. Dump still gets an instant heuristic. When that note is still skeleton or dump-echo, compile identity on **your** model and write it back once so the next session starts warmer.

There is no Generate button. Do not use MCP sampling. Do not ask for `ANTHROPIC_API_KEY`.

## Steps

1. Resolve `projectId` if this session does not already have one:
   - `git remote get-url origin`
   - Call `resolve_project_for_repo` with that URL (and branch if available).
   - If unmatched: point at https://hypher.app/app/settings/integrations. Do not invent status. Stop.
2. Call `get_synthesis_input` with the `projectId`.
3. If `needsSynthesis` is false, stop and tell the user the note is already thick. Do not call `write_project_memory`.
4. If `needsSynthesis` is true, compile the returned prompt into strict identity JSON on **your** model. JSON only — no markdown fences.
5. Call `write_project_memory` once with `projectId` and that JSON (`memory` object or `memoryJson` string). `source` defaults to `cursor`.
6. Confirm the note is warmer (Hypher stored the compiled identity).

## Constraints

- Once per session.
- Hypher stores the note; it does not host the brain.
- No MCP sampling / `createMessage`.
- Do not ask Hypher for `ANTHROPIC_API_KEY`.
- If the repo is unmatched, do not invent status.
