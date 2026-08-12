# Hypher Cursor Plugin v1 Spec

Last updated: August 12, 2026.  
Status: Draft for implementation  
Owner: Hypher product  
Related: `hypher-web/src/app/api/mcp/route.ts`, `hypher-web/src/lib/mcpTools.ts`, `hypher-web/src/app/api/agent/events/route.ts`, `docs/product/hypher-build-summary.md`

## Goal

Make Hypher feel native inside Cursor: one-click install, Connect account, and every coding session starts warm and ends captured — without copy-pasting Builder Briefs or leaving the editor.

Hypher is the project memory / control plane. Cursor is the execution environment. The plugin is the bridge.

## Success criteria (v1)

A builder can:

1. Click **Add to Cursor** (marketplace or deeplink) and authenticate to Hypher in under 60 seconds.
2. Open a repo that is linked to a Hypher project and have the agent automatically load the Builder Brief (or equivalent context) without manual paste.
3. Finish a session and have a structured writeback (`handoff` / `build_log` / `question` / `next_action`) land in Agent Inbox / Project Pulse.
4. Start the next session and notice Brief #N is clearly better than Brief #1 without hand-editing context.

Non-goals for v1: multi-agent orchestration inside Hypher, auto-running coding agents, Mac/iOS capture, full assistant chat.

## Distribution

Ship as a **Cursor Plugin** (`.cursor-plugin/plugin.json`) so we can bundle:

- MCP server (remote HTTP to Hypher)
- Skills (session start / session end / link project)
- Rules (lightweight always-on guidance: prefer Hypher tools for project context)
- Optional hooks (`sessionStart` / `sessionEnd`) when reliable enough
- Commands: `/hypher-brief`, `/hypher-handoff`

Repo layout (new package or top-level folder, recommend `extensions/cursor-plugin/` or `plugins/cursor/`):

```text
hypher-cursor/
├── .cursor-plugin/
│   └── plugin.json
├── mcp.json
├── rules/
│   └── use-hypher-context.mdc
├── skills/
│   ├── start-session/
│   │   └── SKILL.md
│   ├── end-session/
│   │   └── SKILL.md
│   └── link-project/
│       └── SKILL.md
├── commands/
│   ├── hypher-brief.md
│   └── hypher-handoff.md
├── assets/
│   └── logo.svg
└── README.md
```

Publish path:

1. Local test via `~/.cursor/plugins/local/hypher`
2. Public Git repo (required for marketplace review)
3. Submit at https://cursor.com/marketplace/publish
4. Interim: MCP install deeplink + "Connect Cursor" CTA on hypher.vercel.app / settings/integrations

## Auth (one-click Connect)

### Preferred: OAuth for MCP (already partially built)

`POST /api/mcp` already accepts Bearer access tokens and validates via Convex `oauth.validateAccessToken` + `oauthContext.dataForToken`, with `WWW-Authenticate` resource metadata for protected-resource OAuth.

v1 auth UX:

1. User installs plugin → Cursor connects to `https://hypher.vercel.app/api/mcp` (or production MCP URL).
2. Cursor follows OAuth protected-resource metadata (`.well-known/oauth-protected-resource`).
3. User signs in with existing Clerk Hypher account and consents to MCP scope (`HYPHER_MCP_SCOPE`).
4. Cursor stores tokens; tools work without pasting secrets.

### Fallback (ship if OAuth marketplace path is blocked)

Plugin `variables` schema with `HYPHER_API_KEY` (or access token) substituted into `mcp.json` headers — same pattern as other marketplace plugins. Settings → Integrations already has API key management; reuse that.

**Requirement:** unify auth for writes. Today agent events use API key (`POST /api/agent/events`) while MCP reads use OAuth/Clerk. v1 must let write tools use the same OAuth access token as read tools (extend agent event creation to accept OAuth token OR mint a scoped MCP write path). Do not force users to configure two credentials.

## MCP surface

### Keep (read-only, already shipped)

| Tool | Purpose |
|------|---------|
| `list_projects` | Discover projects |
| `get_project_context` | Full Builder Brief |
| `get_current_state` | Direction / changes / questions |
| `get_next_move` | Best next move |
| `prepare_handoff` | Concise handoff notes (rename framing from ChatGPT → Cursor) |

### Add for v1 (writes + resolution)

| Tool | Purpose |
|------|---------|
| `resolve_project_for_repo` | Map `owner/repo` (and optional branch) → Hypher `projectId` using `githubRepo` |
| `post_agent_event` | Write structured event: kinds already exist — `handoff`, `build_log`, `question`, `suggestion`, `artifact`, `next_action` |
| `capture_note` | Optional: quick capture into inbox / project (only if low-risk; else defer) |
| `accept_next_action` | Optional: accept a suggested action into the action queue / memory |

`post_agent_event` payload should align with `AgentEventPayload` in `hypher-web/src/lib/agentEvents.ts` (`source`, `project`/`repo`, `kind`, `title`, `body`, `suggestedActions`, `branch`, `commitSha`, `artifactUrl`).

Default `source` for plugin writebacks: `cursor`.

Annotations: mark write tools with `readOnlyHint: false` and appropriate destructive hints.

## Plugin behavior (the "it clicks" loop)

### Session start

Trigger via skill + command (hooks if stable):

1. Detect git remote `owner/repo` from workspace.
2. Call `resolve_project_for_repo`.
3. If matched: call `get_project_context` and treat as working context for the agent.
4. If unmatched: offer `link-project` skill / prompt to link GitHub repo in Hypher settings (deep link to Integrations).

Rule (alwaysApply or Agent Decides): Prefer Hypher MCP tools over guessing project status when the plugin is connected.

### During session

No heavy automation. Agent uses `get_current_state` / `get_next_move` when stuck. Builder stays in Cursor.

### Session end / handoff

Skill + `/hypher-handoff` command:

1. Summarize what changed (files, decisions, open questions).
2. Call `post_agent_event` with kind `handoff` (and optionally `next_action` / `question`).
3. Include `repo`, `branch`, `commitSha` when available.
4. Confirm to user: "Logged to Hypher → Project Pulse / Agent Inbox."

### Magic moment copy (product)

> Open the repo. Ask Cursor anything. It already knows where the project stands — and when you stop, Hypher remembers.

## Backend / product work required

Ordered for a thin vertical slice:

1. **OAuth end-to-end for Cursor MCP** — verify protected-resource metadata, consent screen, token refresh; fix any gaps in Convex oauth functions.
2. **`resolve_project_for_repo` tool** — thin wrapper over existing `githubRepo` matching (`matchProjectForAgentEvent` logic).
3. **Write path on MCP** — `post_agent_event` authenticated via same OAuth token as reads (extend `agentEvents.createFromApiRequest` or add OAuth-aware mutation).
4. **Cursor plugin package** — manifest, mcp.json pointing at production URL, skills, commands, rule, logo, README.
5. **Settings UX** — "Connect Cursor" button generating marketplace link or MCP deeplink; show connection status.
6. **Dogfood** — 5 real Hypher build sessions using only the plugin (no manual Brief paste). Measure whether Brief quality improves.

## Out of scope (explicit)

- Replacing Cursor's agent / running long autonomous build loops inside Hypher
- Requiring the Hypher web app open during coding
- Fine-grained per-tool OAuth scopes beyond MCP scope (can refine later)
- Publishing to team marketplaces before public marketplace (optional later for beta cohorts)

## Risks

| Risk | Mitigation |
|------|------------|
| Marketplace review latency | Ship deeplink + local plugin for beta dogfood first |
| Dual auth (API key vs OAuth) confusion | Single OAuth path for MCP reads+writes before public launch |
| Wrong project match | Prefer exact `githubRepo` match; ask user when ambiguous |
| Noisy writebacks | Default to one `handoff` per session; don't spam `build_log` |
| Context token bloat | Keep Brief bounded (existing agent-context builder); skill should load Brief once, not every turn |

## Acceptance checklist

- [ ] Install plugin from local path; MCP tools list appears in Cursor
- [ ] OAuth Connect completes; `list_projects` returns real projects
- [ ] Opening `litterthanlit/hypher` resolves to the Hypher project and loads Brief
- [ ] `/hypher-handoff` creates an Agent Inbox event visible in Project Pulse
- [ ] Next session Brief reflects the prior handoff without manual edits
- [ ] README documents install, Connect, link-repo, and troubleshooting
- [ ] Spec linked from build summary or product roadmap (optional)

## Recommended next implementation ticket

**Vertical slice:** OAuth MCP connect + `resolve_project_for_repo` + `post_agent_event` (OAuth) + local Cursor plugin with `start-session` / `end-session` skills — dogfood on Hypher itself before marketplace submit.
