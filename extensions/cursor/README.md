# Hypher Cursor plugin

Product: [`docs/PRODUCT.md`](../../docs/PRODUCT.md).

Make Hypher native in Cursor: connect your account, start a session with the Builder Brief already loaded, and write a handoff back to Project Pulse when you stop.

Hypher is the project memory / control plane. Cursor is the execution environment. This plugin is the bridge.

## Install (local dogfood)

1. Copy or symlink this folder to Cursor's local plugin directory:

   ```bash
   mkdir -p ~/.cursor/plugins/local
   ln -s "$PWD" ~/.cursor/plugins/local/hypher
   ```

   Run that from `extensions/cursor` in this repo.

2. Reload Cursor. Confirm **Hypher** appears under Customize → Plugins.
3. Enable the plugin. Cursor should connect to `https://www.hypher.app/api/mcp` and open Hypher OAuth.
4. Sign in with your existing Hypher / Clerk account and authorize Cursor.

Until marketplace review lands, this local path is the supported install.

## Connect from Hypher

In Hypher, open [Settings → Integrations](https://hypher.app/app/settings/integrations) and click **Add to Cursor**. That deeplink registers the same remote MCP server.

## Session loop

When the plugin is enabled and this repo is linked, start and end are automatic:

| When | What happens |
| --- | --- |
| Start | `sessionStart` hook — resolve `owner/repo`, load the Builder Brief once |
| During | Stay in Cursor. Use `get_current_state` / `get_next_move` if stuck |
| End | `sessionEnd` hook — one `handoff` to Agent Inbox / Project Pulse |

`/hypher-brief` and `/hypher-handoff` stay as manual overrides (reload the brief, or write back before the window closes).

Hooks live at `hooks/hooks.json` and run `scripts/session-start.mjs` / `scripts/session-end.mjs` via `${CURSOR_PLUGIN_ROOT}`. Default is once in, one handoff out.

### Cloud / background agents (no hooks)

Cursor cloud agents, background agents, and other MCP clients do **not** fire `sessionStart` / `sessionEnd` hooks. There the loop is driven by the always-applied rule (`rules/use-hypher-context.mdc`) plus the `start-session` / `end-session` skills: the agent loads the Builder Brief through MCP at the first action and posts one `handoff` before it finishes. Same context loop, same "once in, one out" — no hooks and no copy-paste from the app required.

For these environments, connect with a Hypher **API key** (see Auth) so the agent can both read the brief and post the handoff with a single credential and no browser OAuth step.

If the repo is not linked, Hypher will not invent status. Connect `owner/repo` on the Integrations page, then start a new chat or run `/hypher-brief`.

## Auth

Preferred: OAuth. The plugin uses public client `hypher-cursor` and the same Hypher MCP scope as ChatGPT (`hypher.projects.read`). That token can read briefs and write session events.

Headless / cloud: a Hypher API key from Settings → API keys, sent as a Bearer credential on the Hypher MCP server. The MCP endpoint accepts `hyp_…` API keys for both reading briefs (`get_project_context`, `resolve_project_for_repo`, `get_current_state`, `get_next_move`, `prepare_handoff`) and writing events (`post_agent_event`) — the same access as the OAuth token, without the browser step. In the Cursor IDE, prefer OAuth; do not configure two credentials unless OAuth is blocked.

The `sessionEnd` hook process cannot see Cursor's stored MCP OAuth token. Automatic writeback from the hook itself needs `HYPHER_API_KEY` or `HYPHER_ACCESS_TOKEN` in the environment; otherwise the agent still posts one `handoff` through MCP (`post_agent_event`), and `/hypher-handoff` remains the override.

## Troubleshooting

- **Tools do not appear.** Confirm the plugin is enabled and MCP logs show `https://www.hypher.app/api/mcp`.
- **OAuth fails on redirect_uri.** Hypher allowlists `http://localhost:8787/callback`, `cursor://anysphere.cursor-mcp/oauth/callback`, and `https://www.cursor.com/agents/mcp/oauth/callback`.
- **`resolve_project_for_repo` is unmatched.** Link the GitHub repo on [Integrations](https://hypher.app/app/settings/integrations).
- **Handoff did not show up.** Check Agent Inbox, then Project Pulse for the matched project. Unmatched events stay in Inbox for review. The `sessionEnd` hook can post only when a Hypher API key or OAuth access token is in the hook environment (`HYPHER_API_KEY` / `HYPHER_ACCESS_TOKEN`). Cursor's MCP OAuth token is not exposed to shell hooks — without a token, the agent still writes one `handoff` via `post_agent_event` (rule + `/hypher-handoff`). `sessionEnd` may also fire late on window close.
- **Brief did not load at session start.** Confirm the plugin is enabled and check the Hooks output channel. Then run `/hypher-brief`. Hooks do not run on Cursor cloud agents (`sessionStart` / `sessionEnd` are IDE session boundaries).
- **Brief did not improve next time.** Make sure one `handoff` landed, then start the next session so `sessionStart` can load the updated brief. Do not paste context by hand.

## Marketplace

This package lives at `extensions/cursor` in the [hypher repo](https://github.com/litterthanlit/hypher). Submit from [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) after local dogfood.
