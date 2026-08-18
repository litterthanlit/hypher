---
name: hypher-handoff
description: Write this Cursor session back to Hypher Agent Inbox / Project Pulse
---

Run the Hypher `end-session` skill.

Summarize the session, then call `post_agent_event` with kind `handoff`, including repo, branch, and commit SHA when available. Confirm the write landed in Project Pulse / Agent Inbox.
