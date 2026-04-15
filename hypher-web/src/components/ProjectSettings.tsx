"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Project, ProjectStatus, ProjectPriority } from "@/types";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "shipped", label: "Shipped" },
  { value: "archived", label: "Archived" },
];

const PRIORITY_OPTIONS: { value: ProjectPriority; label: string }[] = [
  { value: 1, label: "1 — Highest" },
  { value: 2, label: "2 — High" },
  { value: 3, label: "3 — Medium" },
  { value: 4, label: "4 — Low" },
  { value: 5, label: "5 — Lowest" },
];

type GitHubStep = "idle" | "input" | "validating" | "connected" | "generating" | "syncing" | "error";

export function ProjectSettings({ project, onUpdate, onClose }: Props) {
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<ProjectPriority>(project.priority ?? 3);
  const [blockers, setBlockers] = useState(project.blockers ?? "");
  const [tags, setTags] = useState(project.tags?.join(", ") ?? "");

  // GitHub state
  const [ghStep, setGhStep] = useState<GitHubStep>(project.githubRepo ? "connected" : "idle");
  const [ghRepo, setGhRepo] = useState(project.githubRepo ?? "");
  const [ghToken, setGhToken] = useState("");
  const [ghError, setGhError] = useState("");
  const [ghDocs, setGhDocs] = useState<{ claude: string; roadmap: string; handoff: string } | null>(null);
  const [ghSync, setGhSync] = useState<{ openPRCount: number; openIssueCount: number; blockers: string[] } | null>(null);

  const validateRepo = useAction(api.github.validateRepo);
  const generateDocs = useAction(api.github.generateDocs);
  const syncRepo = useAction(api.github.syncRepo);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValues = useRef({ status, priority, blockers, tags });

  // Keep ref in sync
  useEffect(() => {
    latestValues.current = { status, priority, blockers, tags };
  }, [status, priority, blockers, tags]);

  const flush = useCallback(() => {
    const v = latestValues.current;
    const parsedTags = v.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    onUpdate({
      ...project,
      status: v.status,
      priority: v.priority,
      blockers: v.blockers || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      modifiedAt: Date.now(),
    });
  }, [project, onUpdate]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 500);
  }, [flush]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        flush();
      }
    };
  }, [flush]);

  // GitHub: connect repo
  const handleConnectGitHub = useCallback(async () => {
    if (!ghRepo.trim() || !ghToken.trim()) {
      setGhError("Enter both a repo (owner/name) and a personal access token.");
      return;
    }
    setGhStep("validating");
    setGhError("");
    try {
      const result = await validateRepo({ repo: ghRepo.trim(), token: ghToken.trim() });
      if (!result.valid) {
        setGhError(result.error || "Repository not found. Check the name and token permissions.");
        setGhStep("input");
        return;
      }
      // Save repo to project
      onUpdate({
        ...project,
        githubRepo: ghRepo.trim(),
        modifiedAt: Date.now(),
      });
      setGhStep("connected");
    } catch (e) {
      setGhError(e instanceof Error ? e.message : "Connection failed");
      setGhStep("input");
    }
  }, [ghRepo, ghToken, project, onUpdate, validateRepo]);

  // GitHub: generate docs
  const handleGenerateDocs = useCallback(async () => {
    if (!ghToken.trim()) {
      setGhError("Enter your GitHub token to generate docs.");
      setGhStep("input");
      return;
    }
    setGhStep("generating");
    setGhError("");
    try {
      const docs = await generateDocs({ repo: project.githubRepo!, token: ghToken.trim() });
      setGhDocs(docs);
      setGhStep("connected");
    } catch (e) {
      setGhError(e instanceof Error ? e.message : "Doc generation failed");
      setGhStep("connected");
    }
  }, [ghToken, project.githubRepo, generateDocs]);

  // GitHub: sync now
  const handleSyncNow = useCallback(async () => {
    if (!ghToken.trim()) {
      setGhError("Enter your GitHub token to sync.");
      setGhStep("input");
      return;
    }
    setGhStep("syncing");
    setGhError("");
    try {
      const result = await syncRepo({
        repo: project.githubRepo!,
        token: ghToken.trim(),
        projectId: project.id,
        projectName: project.name,
      });
      setGhSync(result);
      // Update lastActivity and blockers
      const updates: Partial<Project> = { modifiedAt: Date.now(), githubLastSync: Date.now() };
      if (result.latestCommitDate) updates.lastActivity = result.latestCommitDate;
      if (result.blockers.length > 0) {
        const manualBlockers = (project.blockers ?? "").replace(/\[GitHub\][\s\S]*$/, "").trim();
        const ghSection = `[GitHub] ${result.blockers.join("; ")}`;
        updates.blockers = manualBlockers ? `${manualBlockers}\n${ghSection}` : ghSection;
      }
      onUpdate({ ...project, ...updates } as Project);
      setGhStep("connected");
    } catch (e) {
      setGhError(e instanceof Error ? e.message : "Sync failed");
      setGhStep("connected");
    }
  }, [ghToken, project, onUpdate, syncRepo]);

  // GitHub: disconnect
  const handleDisconnectGitHub = useCallback(() => {
    onUpdate({
      ...project,
      githubRepo: undefined,
      githubLastSync: undefined,
      modifiedAt: Date.now(),
    });
    setGhStep("idle");
    setGhRepo("");
    setGhSync(null);
    setGhDocs(null);
  }, [project, onUpdate]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal project-settings" onClick={(e) => e.stopPropagation()}>
        <div className="project-settings-header">
          <h3>Project Settings</h3>
          <button className="project-settings-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="project-settings-name">{project.name}</div>

        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ProjectStatus);
              scheduleSave();
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Priority
          <select
            value={priority}
            onChange={(e) => {
              setPriority(Number(e.target.value) as ProjectPriority);
              scheduleSave();
            }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Blockers
          <textarea
            value={blockers}
            onChange={(e) => {
              setBlockers(e.target.value);
              scheduleSave();
            }}
            placeholder="What's blocking this project?"
            rows={3}
          />
        </label>

        <label>
          Tags
          <input
            type="text"
            value={tags}
            onChange={(e) => {
              setTags(e.target.value);
              scheduleSave();
            }}
            placeholder="design, frontend, v2 (comma-separated)"
          />
        </label>

        {/* ── GitHub Integration ── */}
        <div className="settings-divider" />
        <div className="settings-section-label">GitHub</div>

        {ghStep === "idle" && (
          <button className="settings-github-btn" onClick={() => setGhStep("input")}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width={16} height={16}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Connect GitHub Repo
          </button>
        )}

        {ghStep === "input" && (
          <div className="settings-github-form">
            <input
              type="text"
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
              placeholder="owner/repo"
              className="settings-github-input"
            />
            <input
              type="password"
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
              placeholder="GitHub personal access token"
              className="settings-github-input"
            />
            <p className="settings-github-hint">
              Create a token at github.com/settings/tokens with <code>repo</code> scope.
            </p>
            <div className="settings-github-actions">
              <button className="settings-github-connect" onClick={handleConnectGitHub}>Connect</button>
              <button className="settings-github-cancel" onClick={() => { setGhStep("idle"); setGhError(""); }}>Cancel</button>
            </div>
          </div>
        )}

        {ghStep === "validating" && (
          <div className="settings-github-status">Validating repository...</div>
        )}

        {ghStep === "generating" && (
          <div className="settings-github-status">Generating docs with Claude... this may take a moment.</div>
        )}

        {ghStep === "syncing" && (
          <div className="settings-github-status">Syncing GitHub activity...</div>
        )}

        {ghStep === "connected" && (
          <div className="settings-github-connected">
            <div className="settings-github-repo-info">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width={14} height={14}>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              <span>{project.githubRepo}</span>
              {project.githubLastSync && (
                <span className="settings-github-sync-time">
                  synced {new Date(project.githubLastSync).toLocaleString()}
                </span>
              )}
            </div>

            {!ghToken && (
              <div className="settings-github-token-prompt">
                <input
                  type="password"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  placeholder="Enter token for actions"
                  className="settings-github-input"
                />
              </div>
            )}

            <div className="settings-github-actions">
              <button className="settings-github-action" onClick={handleGenerateDocs} disabled={!ghToken}>
                Generate Docs
              </button>
              <button className="settings-github-action" onClick={handleSyncNow} disabled={!ghToken}>
                Sync Now
              </button>
              <button className="settings-github-disconnect" onClick={handleDisconnectGitHub}>
                Disconnect
              </button>
            </div>

            {ghSync && (
              <div className="settings-github-sync-result">
                <p>{ghSync.openPRCount} open PRs, {ghSync.openIssueCount} open issues</p>
                {ghSync.blockers.length > 0 && (
                  <div className="settings-github-blockers">
                    <p className="settings-github-blockers-label">Blockers detected:</p>
                    <ul>
                      {ghSync.blockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {ghDocs && (
              <div className="settings-github-docs">
                <p className="settings-github-docs-label">Generated documentation:</p>
                <details>
                  <summary>CLAUDE.md</summary>
                  <pre>{ghDocs.claude}</pre>
                </details>
                <details>
                  <summary>ROADMAP.md</summary>
                  <pre>{ghDocs.roadmap}</pre>
                </details>
                <details>
                  <summary>HANDOFF.md</summary>
                  <pre>{ghDocs.handoff}</pre>
                </details>
              </div>
            )}
          </div>
        )}

        {ghError && <div className="settings-github-error">{ghError}</div>}
      </div>
    </div>
  );
}
