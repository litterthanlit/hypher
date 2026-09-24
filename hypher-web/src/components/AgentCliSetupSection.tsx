"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AGENT_CLI_DOORS } from "@/lib/agentCliSetup";

const HANDOFF_DOCS_URL =
  "https://github.com/litterthanlit/hypher/blob/main/hypher-web/docs/codex-claude-handoff.md";

export function AgentCliSetupSection() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1600);
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  }, []);

  return (
    <section className="integrations-section" aria-labelledby="agent-cli-heading">
      <h4 id="agent-cli-heading" className="integrations-section-title">
        Claude Code and Codex CLI
      </h4>
      <p className="api-keys-desc">
        Explicit save and resume between the two CLIs on the same working tree. The agent that stops saves a
        structured handoff; the agent that starts resumes it and checks branch, commit, and dirty state itself.
        Memory never moves code.
      </p>
      <p className="api-keys-desc">
        Create a key in{" "}
        <Link href="/app/settings/api-keys" className="integrations-docs-link">
          Settings → API keys
        </Link>{" "}
        and export it as <code>HYPHER_API_KEY</code>. Then bind the repository below.
      </p>

      <div className="integrations-cli-grid">
        {AGENT_CLI_DOORS.map((door) => (
          <article key={door.id} className="integrations-cli-card" aria-labelledby={`cli-${door.id}`}>
            <header className="integrations-cli-head">
              <h5 id={`cli-${door.id}`}>{door.name}</h5>
              <span className="integrations-cli-status">{door.status}</span>
            </header>
            <ol className="integrations-cli-steps">
              {door.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="integrations-snippet">
              <div className="integrations-snippet-bar">
                <code>{door.configPath}</code>
                <button
                  type="button"
                  className="integrations-snippet-copy"
                  onClick={() => void copy(door.id, door.config)}
                  aria-label={`Copy ${door.configPath} for ${door.name}`}
                >
                  {copied === door.id ? "Copied" : "Copy"}
                </button>
              </div>
              <pre tabIndex={0} aria-label={`${door.configPath} contents`}>
                <code>{door.config}</code>
              </pre>
            </div>
            <dl className="integrations-cli-commands">
              <div>
                <dt>When you stop</dt>
                <dd>
                  <code>{door.save}</code>
                </dd>
              </div>
              <div>
                <dt>When you start</dt>
                <dd>
                  <code>{door.resume}</code>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="api-keys-desc integrations-cli-note">
        Automatic checkpoints are off for both CLIs until the switch is recorded on named versions. The save
        and resume commands ship in the repo kit.{" "}
        <a href={HANDOFF_DOCS_URL} target="_blank" rel="noreferrer" className="integrations-docs-link">
          Handoff run path
        </a>
      </p>
    </section>
  );
}
