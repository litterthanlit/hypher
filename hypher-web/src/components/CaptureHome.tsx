"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { UserButton } from "@clerk/nextjs";
import type { CaptureResult, Project, ProjectSuggestion, AnyObject } from "@/types";
import { ProjectAssignPopup } from "./ProjectAssignPopup";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  onCapture: (text: string, projectId?: string | null) => Promise<CaptureResult>;
  onAssignCaptured: (noteId: string, projectId: string) => Promise<void>;
  onKeepInInbox: (noteId: string) => Promise<void>;
  onCreateProjectAndCapture: (projectName: string, noteId: string) => Promise<void>;
  onNavigateToWorkspace: () => void;
  onCreateProject?: () => void;
  onProjectClick: (projectId: string) => void;
  onClipboardCapture?: () => void;
  onSearchClick?: () => void;
  onAddFiles?: (files: File[]) => void | Promise<void>;
}

type CaptureStep = "idle" | "assigning";

function formatRelative(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function CaptureHome({
  projects,
  allObjects,
  onCapture,
  onAssignCaptured,
  onKeepInInbox,
  onCreateProjectAndCapture,
  onNavigateToWorkspace,
  onCreateProject,
  onProjectClick,
  onClipboardCapture,
  onSearchClick,
  onAddFiles,
}: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<CaptureStep>("idle");
  const [aiSuggestions, setAiSuggestions] = useState<ProjectSuggestion[]>([]);
  const [capturedText, setCapturedText] = useState("");
  const [capturedNoteId, setCapturedNoteId] = useState<string | null>(null);
  const [isDragNear, setIsDragNear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt),
    [projects]
  );

  const activeCount = projects.filter((p) => p.status === "active").length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) setIsDragNear(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setIsDragNear(false);
    };
    const onDrop = () => setIsDragNear(false);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    if (step === "idle") inputRef.current?.focus();
  }, [step]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setCapturedText(trimmed);
    const result = await onCapture(trimmed, null);
    setCapturedNoteId(result.noteId);
    setAiSuggestions(result.suggestions);
    setStep("assigning");
    setText("");
  }, [onCapture, text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const resetAssignState = () => {
    setStep("idle");
    setCapturedText("");
    setCapturedNoteId(null);
    setAiSuggestions([]);
  };

  const handleAssign = async (projectId: string) => {
    if (!capturedNoteId) return;
    await onAssignCaptured(capturedNoteId, projectId);
    resetAssignState();
  };

  const handleInbox = async () => {
    if (capturedNoteId) await onKeepInInbox(capturedNoteId);
    resetAssignState();
  };

  const handleDismiss = () => {
    resetAssignState();
  };

  const handleNewProject = async (name: string) => {
    if (!capturedNoteId) return;
    await onCreateProjectAndCapture(name, capturedNoteId);
    resetAssignState();
  };

  const primary = sortedProjects[0];
  const secondary = sortedProjects.slice(1, 4);

  const itemCount = (pid: string) =>
    allObjects.filter((o) => o.projectId === pid && o.kind !== "project").length;

  return (
    <div className="capture-home capture-home-mock">
      <input
        ref={fileRef}
        type="file"
        hidden
        multiple
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length && onAddFiles) {
            void onAddFiles(Array.from(list));
          }
          e.target.value = "";
        }}
      />

      <header className="capture-chrome-mock">
        <div className="capture-chrome-mock__inner">
          <div className="capture-chrome-mock__left">
            <button
              type="button"
              className="capture-icon-btn"
              aria-label={projects.length > 0 ? "Open workspace" : "Focus capture"}
              title={projects.length > 0 ? "Workspace" : "Capture first"}
              onClick={projects.length > 0 ? onNavigateToWorkspace : () => inputRef.current?.focus()}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="2" y1="8" x2="14" y2="8" />
                <line x1="2" y1="12" x2="14" y2="12" />
              </svg>
            </button>
            <span className="capture-chrome-brand">
              <img className="hypher-signal-mark" src="/hypher-logo.svg" alt="" aria-hidden />
              <span className="capture-wordmark-mock">hypher</span>
            </span>
          </div>
          <div className="capture-chrome-mock__right">
            {onSearchClick ? (
              <button type="button" className="capture-icon-btn" aria-label="Search" title="Search (⌘K)" onClick={onSearchClick}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5" />
                  <line x1="11" y1="11" x2="14" y2="14" />
                </svg>
              </button>
            ) : null}
            <span className="capture-user-wrap" title="Signed in">
              <UserButton />
            </span>
          </div>
        </div>
      </header>

      <main className="capture-home-mock__main">
        <section className="home-hero-mock">
          <div className="home-hero-glass">
          <div className={`home-input-shell-mock ${isDragNear ? "is-drag" : ""}`}>
            <input
              ref={inputRef}
              className="home-input-mock"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="dump a thought, bug, decision, or agent output..."
              disabled={step === "assigning"}
            />
            <button
              type="button"
              className="home-input-submit-mock"
              aria-label="Capture"
              title="Capture"
              disabled={step === "assigning"}
              onClick={() => void handleSubmit()}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </button>
          </div>

          {step === "idle" && (
            <div className="home-quick-row-mock">
              {onClipboardCapture ? (
                <button type="button" className="home-quick-mock" onClick={onClipboardCapture}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="3" y="2" width="10" height="12" rx="1" />
                    <path d="M6 5h4M6 8h4M6 11h2" />
                  </svg>
                  paste from clipboard
                </button>
              ) : null}
              {onAddFiles ? (
                <button type="button" className="home-quick-mock" onClick={() => fileRef.current?.click()}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
                  </svg>
                  upload file
                </button>
              ) : null}
            </div>
          )}
          </div>

          {step === "idle" && (
            <div className="home-kbd-hints-mock">
              <span className="home-kbd-hint-group-mock">
                <span className="home-kbd-hint-keys-mock">
                  <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">↵</kbd>
                </span>
                <span className="home-kbd-hint-label-mock">capture</span>
              </span>
              <span className="home-kbd-hint-group-mock">
                <span className="home-kbd-hint-keys-mock">
                  <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">⇧</kbd>
                  <kbd className="hint-kbd hint-kbd--mock">V</kbd>
                </span>
                <span className="home-kbd-hint-label-mock">paste</span>
              </span>
              {onSearchClick ? (
                <span className="home-kbd-hint-group-mock">
                  <span className="home-kbd-hint-keys-mock">
                    <kbd className="hint-kbd hint-kbd--mock">⌘</kbd>
                    <kbd className="hint-kbd hint-kbd--mock">K</kbd>
                  </span>
                  <span className="home-kbd-hint-label-mock">search</span>
                </span>
              ) : null}
            </div>
          )}

          {step === "assigning" && (
            <ProjectAssignPopup
              text={capturedText}
              projects={projects}
              aiSuggestions={aiSuggestions}
              onAssign={handleAssign}
              onInbox={handleInbox}
              onNewProject={handleNewProject}
              onDismiss={handleDismiss}
            />
          )}
        </section>

        <section className="home-projects-section-mock">
          <div className="home-projects-head-mock">
            <h2 className="home-projects-title-mock">projects</h2>
            <span className="home-projects-meta-mock">{activeCount} active</span>
          </div>

          {projects.length === 0 && step === "idle" ? (
            <div className="capture-clusters-empty">
              <p className="capture-clusters-empty-title">Nothing here yet</p>
              <p className="capture-clusters-empty-sub">
                Dump a thought above. Hypher will help sort it into a project.
              </p>
              {onCreateProject ? (
                <div className="capture-empty-actions">
                  <button type="button" className="capture-clusters-empty-btn capture-clusters-empty-btn--secondary" onClick={onCreateProject}>
                    Create project manually
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="home-projects-grid-mock">
              {primary ? (
                <article
                  key={primary.id}
                  className="home-project-card-mock home-project-card-mock--primary"
                  onClick={() => onProjectClick(primary.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onProjectClick(primary.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="home-project-card-head-mock">
                    <h3 className="home-project-name-mock">{primary.name}</h3>
                  </div>
                  <div className="home-project-foot-mock">
                    <span>{itemCount(primary.id)} items</span>
                    <span>edited {formatRelative(primary.modifiedAt)}</span>
                  </div>
                </article>
              ) : null}

              {secondary.map((p) => (
                <article
                  key={p.id}
                  className="home-project-card-mock"
                  role="button"
                  tabIndex={0}
                  onClick={() => onProjectClick(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onProjectClick(p.id);
                    }
                  }}
                >
                  <div className="home-project-card-head-mock">
                    <h3 className="home-project-name-mock">{p.name}</h3>
                  </div>
                  <div className="home-project-foot-mock">
                    <span>{itemCount(p.id)} items</span>
                    <span>{formatRelative(p.modifiedAt)}</span>
                  </div>
                </article>
              ))}

              <button type="button" className="home-project-new-mock" onClick={onNavigateToWorkspace}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <path d="M8 3v10M3 8h10" />
                </svg>
                <span>new project</span>
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
