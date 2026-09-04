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

| When | What to do |
| --- | --- |
| Start | `/hypher-brief` — resolve `owner/repo`, load Builder Brief once |
| During | Stay in Cursor. Use `get_current_state` / `get_next_move` if stuck |
| End | `/hypher-handoff` — one `handoff` event to Agent Inbox / Project Pulse |

If the repo is not linked, Hypher will not invent status. Connect `owner/repo` on the Integrations page, then run `/hypher-brief` again.

## Auth

Preferred: OAuth. The plugin uses public client `hypher-cursor` and the same Hypher MCP scope as ChatGPT (`hypher.projects.read`). That token can read briefs and write session events.

Fallback: a Hypher API key from Settings → API keys, added as a Bearer header on the Hypher MCP server in Cursor. Do not configure two credentials unless OAuth is blocked.

## Troubleshooting

- **Tools do not appear.** Confirm the plugin is enabled and MCP logs show `https://www.hypher.app/api/mcp`.
- **OAuth fails on redirect_uri.** Hypher allowlists `http://localhost:8787/callback`, `cursor://anysphere.cursor-mcp/oauth/callback`, and `https://www.cursor.com/agents/mcp/oauth/callback`.
- **`resolve_project_for_repo` is unmatched.** Link the GitHub repo on [Integrations](https://hypher.app/app/settings/integrations).
- **Handoff did not show up.** Check Agent Inbox, then Project Pulse for the matched project. Unmatched events stay in Inbox for review.
- **Brief did not improve next time.** Make sure `/hypher-handoff` ran, then start the next session with `/hypher-brief` instead of pasting context.

## Marketplace

This package lives at `extensions/cursor` in the [hypher repo](https://github.com/litterthanlit/hypher). Submit from [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish) after local dogfood.
