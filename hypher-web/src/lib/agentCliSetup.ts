// Setup for the explicit Codex CLI ↔ Claude Code handoff, shown in
// Settings → Integrations. Mirrors the repo kit described in
// docs/codex-claude-handoff.md. The snippets must match the checked-in
// .mcp.json and .codex/config.toml (agentCliSetup.test.ts checks this).
// This is a pilot path: the live switch is not recorded, so never label
// either door as supported here.

export type AgentCliDoor = {
  id: "claude-code" | "codex";
  name: string;
  status: string;
  configPath: string;
  configLanguage: "json" | "toml";
  config: string;
  save: string;
  resume: string;
  steps: string[];
};

export const HYPHER_MCP_URL = "https://www.hypher.app/api/mcp";

export const CLAUDE_CODE_MCP_JSON = `{
  "mcpServers": {
    "hypher": {
      "type": "http",
      "url": "${HYPHER_MCP_URL}",
      "headers": {
        "Authorization": "Bearer \${HYPHER_API_KEY}"
      }
    }
  }
}`;

export const CODEX_CONFIG_TOML = `[mcp_servers.hypher]
url = "${HYPHER_MCP_URL}"
bearer_token_env_var = "HYPHER_API_KEY"
startup_timeout_sec = 20

[mcp_servers.hypher.tools.post_agent_event]
approval_mode = "prompt"

[mcp_servers.hypher.tools.prepare_handoff]
approval_mode = "prompt"`;

export const AGENT_CLI_DOORS: AgentCliDoor[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    status: "Pilot · not yet recorded",
    configPath: ".mcp.json",
    configLanguage: "json",
    config: CLAUDE_CODE_MCP_JSON,
    save: "/hypher-save",
    resume: "/hypher-resume",
    steps: [
      "Add .mcp.json at the repository root.",
      "Export HYPHER_API_KEY in your shell. Never commit it.",
      "Approve the hypher server when Claude Code asks.",
    ],
  },
  {
    id: "codex",
    name: "Codex CLI",
    status: "Pilot · not yet recorded",
    configPath: ".codex/config.toml",
    configLanguage: "toml",
    config: CODEX_CONFIG_TOML,
    save: "$hypher-save",
    resume: "$hypher-resume",
    steps: [
      "Add .codex/config.toml to the repository.",
      "Export HYPHER_API_KEY in your shell. Never commit it.",
      "Trust the project in Codex. It ignores project config until you do.",
    ],
  },
];
