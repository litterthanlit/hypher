# Hypher Handoff

Use this skill when OpenClaw finishes project work, hits a blocker, produces a useful artifact, or has concrete next actions for the human to review in Hypher.

## When To Send

Send a handoff after:

- a build task finishes
- tests pass or fail
- a PR or diff is ready
- a blocker needs human review
- a decision was made
- a follow-up action is obvious

## Payload

Send one JSON event to Hypher:

```json
{
  "source": "openclaw",
  "project": "Hypher",
  "kind": "handoff",
  "title": "Short work summary",
  "body": "What changed, what passed, what failed, and what needs attention.",
  "suggestedActions": [
    "One concrete next step",
    "Another concrete next step"
  ],
  "repo": "litterthanlit/hypher",
  "branch": "optional",
  "commitSha": "optional"
}
```

## Command

Prefer the local handoff client when available:

```bash
HYPHER_API_KEY="$HYPHER_API_KEY" node tools/hypher-handoff.mjs \
  --source openclaw \
  --project "Hypher" \
  --repo "litterthanlit/hypher" \
  --kind handoff \
  --title "Short work summary" \
  --body "What changed, what passed, what failed, and what needs attention." \
  --action "One concrete next step"
```

## Safety

Never send secrets, env values, tokens, private keys, credentials, or full logs unless the human explicitly asks for that exact content.
