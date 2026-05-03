# Agent Handoff

Use `tools/hypher-handoff.mjs` to send a structured agent update into Hypher.

```bash
HYPHER_API_KEY=hyp_... node tools/hypher-handoff.mjs \
  --source openclaw \
  --project Hypher \
  --repo litterthanlit/hypher \
  --kind handoff \
  --title "Agent Events v0 shipped" \
  --body "Added agent event ingestion, inbox, project matching, and Project Pulse updates." \
  --action "Draft OpenClaw handoff skill" \
  --action "Add first-class next actions"
```

Dry-run without sending:

```bash
node tools/hypher-handoff.mjs --dry-run \
  --source codex \
  --project Hypher \
  --repo litterthanlit/hypher \
  --title "Smoke payload" \
  --body "Testing payload shape." \
  --action "Verify matched Project Pulse entry"
```

Environment variables:

- `HYPHER_API_KEY`: Hypher API key.
- `HYPHER_ENDPOINT`: Optional endpoint override. Defaults to `https://hypher.app/api/agent/events`.

Do not send secrets, env values, tokens, private keys, or full logs.
