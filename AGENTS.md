# Agents

Read [docs/PRODUCT.md](docs/PRODUCT.md) first. It is the only product source of truth. If a Hypher Builder Brief disagrees with it, this file and `docs/PRODUCT.md` win.

Build order: [docs/PLAN.md](docs/PLAN.md). Next coding slice is Phase 1c (every agent loads the brief once, including cloud agents). Packet quality is the next compiler change. Do not rebuild Phase 1a or Phase 1b. Do not rebuild the canvas, daily digest, health rings, ambient ask, Notion import, or extra Pulse panels.

Hypher is project memory under agents: dump → one brief → writeback. Cursor already has the code.

If Hypher MCP tools are connected, resolve this git remote with `resolve_project_for_repo`, then load `get_project_context` once at session start. Do not reload the full Builder Brief every turn. Use the brief for the last handoff, the current next move, and constraints that are not already in `docs/PRODUCT.md`. At session end, post one `handoff` with `post_agent_event`. If the repo is unmatched, point at Settings → Integrations. Do not invent status.

How, not what:

- Grok CEO bot: `docs/bots/hypher-ceo.md`
- Cursor plugin: `extensions/cursor/README.md`
- Handoff CLI: `hypher-web/docs/agent-handoff.md`
- UI styling: `hypher-web/STYLING.md`
