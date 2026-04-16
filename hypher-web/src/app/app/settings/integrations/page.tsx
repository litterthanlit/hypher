"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery, useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function IntegrationsPage() {
  const status = useQuery(api.githubTokens.getStatus);
  const savePat = useAction(api.githubPat.savePersonalAccessToken);
  const connectRepo = useAction(api.githubIntegrations.connectRepoToProject);

  const projects = useQuery(api.objects.list);
  const projectList =
    projects?.filter((o) => o.kind === "project") ?? [];

  const [patInput, setPatInput] = useState("");
  const [savingPat, setSavingPat] = useState(false);
  const [repoByProject, setRepoByProject] = useState<Record<string, string>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleSavePat = useCallback(async () => {
    if (!patInput.trim()) {
      toast.error("Paste a personal access token first.");
      return;
    }
    setSavingPat(true);
    try {
      await savePat({ token: patInput.trim() });
      setPatInput("");
      toast.success("GitHub token saved and verified.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save token.");
    } finally {
      setSavingPat(false);
    }
  }, [patInput, savePat]);

  const handleConnectRepo = useCallback(
    async (projectId: string) => {
      const input = repoByProject[projectId]?.trim() ?? "";
      if (!input) {
        toast.error("Enter a repository URL or owner/name.");
        return;
      }
      setConnectingId(projectId);
      try {
        const result = await connectRepo({
          projectId: projectId as Id<"objects">,
          repoInput: input,
        });
        if (result.ok) {
          toast.success(`Connected ${result.repo} and synced.`);
        } else {
          toast.error(result.error);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed.");
      } finally {
        setConnectingId(null);
      }
    },
    [connectRepo, repoByProject]
  );

  return (
    <div className="settings-api-keys-page">
      <div className="modal api-keys-panel api-keys-panel--page integrations-page">
        <div className="project-settings-header">
          <h3>Integrations</h3>
          <Link href="/app" className="api-keys-back-link">
            ← Back to app
          </Link>
        </div>

        <p className="api-keys-desc">
          Connect GitHub with a personal access token (classic or fine-grained with repo read). The token is encrypted at rest.{" "}
          <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="integrations-docs-link">
            Create a token
          </a>
        </p>

        <section className="integrations-section">
          <h4 className="integrations-section-title">GitHub</h4>
          <p className="integrations-status">
            Status:{" "}
            <strong>{status === undefined ? "…" : status.connected ? "Connected" : "Not connected"}</strong>
          </p>
          <div className="integrations-pat-form">
            <input
              type="password"
              autoComplete="off"
              value={patInput}
              onChange={(e) => setPatInput(e.target.value)}
              placeholder="ghp_… or github_pat_…"
              className="settings-github-input"
            />
            <button
              type="button"
              className="settings-github-connect"
              onClick={() => void handleSavePat()}
              disabled={savingPat}
            >
              {savingPat ? "Saving…" : "Save token"}
            </button>
          </div>
        </section>

        <section className="integrations-section">
          <h4 className="integrations-section-title">Connect repository per project</h4>
          <p className="api-keys-desc">
            After saving a token, link each project to a repo. We validate access and run an initial sync.
          </p>
          <div className="integrations-project-list">
            {projectList.length === 0 && (
              <p className="api-keys-empty">No projects yet — create one in the app first.</p>
            )}
            {projectList.map((p) => (
              <div key={p._id} className="integrations-project-row">
                <div className="integrations-project-name">
                  <span>{p.name}</span>
                  {p.githubRepo && (
                    <code className="integrations-repo-badge">{p.githubRepo}</code>
                  )}
                </div>
                <div className="integrations-repo-form">
                  <input
                    type="text"
                    value={repoByProject[p._id] ?? ""}
                    onChange={(e) =>
                      setRepoByProject((prev) => ({
                        ...prev,
                        [p._id]: e.target.value,
                      }))
                    }
                    placeholder="https://github.com/owner/repo or owner/repo"
                    className="settings-github-input"
                  />
                  <button
                    type="button"
                    className="settings-github-connect"
                    disabled={connectingId === p._id || !status?.connected}
                    onClick={() => void handleConnectRepo(p._id)}
                  >
                    {connectingId === p._id ? "Syncing…" : "Connect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
