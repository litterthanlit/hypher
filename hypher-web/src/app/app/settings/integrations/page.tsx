"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useQuery, useAction, useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  buildCursorMcpInstallDeeplink,
  cursorConnectionStatus,
} from "@/lib/cursorPlugin";
import { getSettingsAccessState } from "@/lib/settingsAccess";

export default function IntegrationsPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gateState = useQuery((api as any).beta.getGateState, isAuthenticated ? {} : "skip") as
    | { hasAccess: boolean; isAdmin: boolean }
    | undefined;
  const accessState = getSettingsAccessState({
    isLoading: isLoading || (isAuthenticated && gateState === undefined),
    isAuthenticated,
    hasBetaAccess: gateState?.hasAccess,
    isAdmin: gateState?.isAdmin,
  });
  const canQuery = accessState === "settings";

  const status = useQuery(api.githubTokens.getStatus, canQuery ? {} : "skip");
  const savePat = useAction(api.githubPat.savePersonalAccessToken);
  const connectRepo = useAction(api.githubIntegrations.connectRepoToProject);
  const oauthConnections = useQuery(api.oauth.listConnections, canQuery ? {} : "skip");

  const cursorStatus = useMemo(
    () => cursorConnectionStatus(oauthConnections ?? [], Date.now()),
    [oauthConnections]
  );
  const cursorDeeplink = buildCursorMcpInstallDeeplink();

  const projects = useQuery(api.objects.list, canQuery ? {} : "skip");
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

        {!canQuery ? (
          <div className="api-keys-auth-required">
            <p>{accessState === "loading" ? "Checking sign-in..." : accessState === "beta_required" ? "Beta access is required to manage integrations." : "Sign in to manage integrations."}</p>
            {accessState === "sign_in_required" ? (
              <Link href="/sign-in?redirect_url=/app/settings/integrations" className="settings-github-connect">
                Sign in
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <section className="integrations-section">
              <h4 className="integrations-section-title">Cursor</h4>
              <p className="integrations-status">
                Status:{" "}
                <strong>
                  {oauthConnections === undefined ? "…" : cursorStatus.connected ? "Connected" : "Not connected"}
                </strong>
              </p>
              <p className="api-keys-desc">
                Install the Hypher plugin in Cursor, then authorize with your Hypher account. Opening a bound repo
                loads the Builder Brief; `/hypher-handoff` writes back to Agent Inbox.
              </p>
              <div className="integrations-pat-form">
                <a href={cursorDeeplink} className="settings-github-connect">
                  Add to Cursor
                </a>
                <a
                  href="https://github.com/litterthanlit/hypher/tree/main/extensions/cursor"
                  target="_blank"
                  rel="noreferrer"
                  className="integrations-docs-link"
                >
                  Local install docs
                </a>
              </div>
            </section>

            <section className="integrations-section">
              <h4 className="integrations-section-title">Bind repositories</h4>
              <p className="api-keys-desc">
                A project is a name and a repo. Save a GitHub token (classic or fine-grained with repo read — encrypted
                at rest), then bind each project to its repository.{" "}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="integrations-docs-link">
                  Create a token
                </a>
              </p>
              <p className="integrations-status">
                GitHub token:{" "}
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
                        {connectingId === p._id ? "Syncing…" : "Bind"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
