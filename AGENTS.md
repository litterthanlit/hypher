# Agents

Read [docs/PRODUCT.md](docs/PRODUCT.md) first. It is the only product source of truth. If a Hypher note (the Builder Brief) disagrees with it, this file and `docs/PRODUCT.md` win.

Working promise: **Switch agents without starting over.** Hypher is project memory under coding agents: dump / capture → one note → writeback. A warmer next session and a switch to another agent are the same loop. Cursor already has the code. Memory does not transfer code or uncommitted files.

Build order: [docs/PLAN.md](docs/PLAN.md). This milestone is the doc lock, then a Codex CLI ↔ Claude Code explicit handoff/resume spike on one local working tree, then the smallest revisioned round trip on existing Convex and MCP storage. Do not implement canvas, pricing changes, local SQLite Core, a broad plugin matrix, or a replacement coding harness. Do not rebuild Phase 1a or Phase 1b. Do not rebuild the canvas, daily digest, health rings, ambient ask, Notion import, or extra Pulse panels.

If Hypher MCP tools are connected, resolve this git remote with `resolve_project_for_repo`, then load `get_project_context` once at session start. Do not reload the full note every turn. Use the note for the last handoff, the current next move, and constraints that are not already in `docs/PRODUCT.md`. If that note is still a skeleton or heuristic dump echo, call `get_synthesis_input` once, compile identity JSON on your model from the returned prompt, then `write_project_memory` once. Skip when `needsSynthesis` is false. Hypher stores the note; it does not host the model and does not use MCP sampling. At session end, post one `handoff` with `post_agent_event`. If the repo is unmatched, point at Settings → Integrations. Do not invent status. Do not auto-mint a project.

When preparing a cross-agent handoff, structure it: current goal, constraints, decisions and reasons, completed work versus unverified work, blockers, next action, source references, and repository / branch / commit identity with dirty state as metadata. The destination must verify the working tree. Do not claim code or uncommitted files were synced.

Codex CLI and Claude Code adapters are the next integration spike. Do not claim they already work. Do not claim a benchmark result.

How, not what:

- Grok CEO bot: `docs/bots/hypher-ceo.md`
- Cursor plugin: `extensions/cursor/README.md`
- Handoff CLI: `hypher-web/docs/agent-handoff.md`
- UI styling: `hypher-web/STYLING.md`
- Planning detail: `docs/planning/`
