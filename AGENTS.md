# Agents

Read [docs/PRODUCT.md](docs/PRODUCT.md) first. It is the only product source of truth. If a Hypher note (the Builder Brief) disagrees with it, this file and `docs/PRODUCT.md` win.

Working promise: **Switch agents without starting over.** Hypher is project memory under coding agents: dump / capture → one note → writeback. A warmer next session and a switch to another agent are the same loop. Cursor already has the code. Memory does not transfer code or uncommitted files.

Build order: [docs/PLAN.md](docs/PLAN.md). Doc lock and revisioned save/resume are in the tree. The open slice is the Codex CLI ↔ Claude Code explicit handoff on one local working tree: project MCP config, then a live Mac recording. Do not claim that recording. Do not implement canvas, pricing changes, local SQLite Core, a broad plugin matrix, or a replacement coding harness. Do not rebuild Phase 1a or Phase 1b. Do not rebuild the canvas, daily digest, health rings, ambient ask, Notion import, or extra Pulse panels.

If Hypher MCP tools are connected, resolve this git remote with `resolve_project_for_repo`, then load `get_project_context` once at session start. Do not reload the full note every turn. Use the note for the last handoff, the current next move, and constraints that are not already in `docs/PRODUCT.md`. If that note is still a skeleton or heuristic dump echo, call `get_synthesis_input` once, compile identity JSON on your model from the returned prompt, then `write_project_memory` once. Skip when `needsSynthesis` is false. Hypher stores the note; it does not host the model and does not use MCP sampling. At session end, post one `handoff` with `post_agent_event`. If the repo is unmatched, point at Settings → Integrations. Do not invent status. Do not auto-mint a project.

When preparing a cross-agent handoff, structure it: current goal, constraints, decisions and reasons, reported completed work versus unverified work, blockers, next action, source references, and repository / branch / commit identity with dirty state as metadata. Save that proposal with `post_agent_event` (`proposal`, `expectedBaseRevision`, `idempotencyKey`). Use project-owned capture IDs for sourced decisions; otherwise label them agent reports. An approved decision needs a pinned decision capture, and a change names the decision it supersedes. Resume with `prepare_handoff` (`destination`, `currentRepo`), read the returned revision, then call `acknowledge_handoff` with its receipt. The destination must inspect the working tree. Do not claim code or uncommitted files were synced. An identical retry returns the original revision; a stale revision or changed body under the same key is rejected.

Codex CLI and Claude Code adapters are not proven. Do not claim they already work. Do not claim a benchmark result. The live switch is a Mac recording; unit tests are not that recording.

How, not what:

- Grok CEO bot: `docs/bots/hypher-ceo.md`
- Cursor plugin: `extensions/cursor/README.md`
- Handoff CLI: `hypher-web/docs/agent-handoff.md`
- Codex ↔ Claude explicit handoff: `hypher-web/docs/codex-claude-handoff.md`
- UI styling: `hypher-web/STYLING.md`
- Planning detail: `docs/planning/`
