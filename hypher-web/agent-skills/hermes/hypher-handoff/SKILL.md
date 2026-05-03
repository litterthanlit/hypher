# Hypher Handoff

Use this skill when Hermes finishes work, creates a build log, finds a blocker, or has useful project context that should appear in Hypher.

## When To Send

Send a handoff after:

- a build task finishes
- tests pass or fail
- a deployment or integration check changes state
- a blocker needs human review
- an artifact or output is ready
- a follow-up action is obvious

## Payload

Send one JSON event to Hypher:

```json
{
  "source": "hermes",
  "project": "Hypher",
  "kind": "build_log",
  "title": "Short work summary",
  "body": "What changed, what passed, what failed, and what needs attention.",
  "suggestedActions": [
    "One concrete next step",
    "Another concrete next step"
  ],
  "repo": "litterthanlit/hypher",
  "branch": "optional",
  "commitSha": "optional",
  "artifactUrl": "optional"
}
```

## Command

Prefer the local handoff client when available:

```bash
HYPHER_API_KEY="$HYPHER_API_KEY" node tools/hypher-handoff.mjs \
  --source hermes \
  --project "Hypher" \
  --repo "litterthanlit/hypher" \
  --kind build_log \
  --title "Short work summary" \
  --body "What changed, what passed, what failed, and what needs attention." \
  --action "One concrete next step"
```

## Safety

Never send secrets, env values, tokens, private keys, credentials, or full logs unless the human explicitly asks for that exact content.
