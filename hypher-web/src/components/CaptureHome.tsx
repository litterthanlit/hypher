"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { CaptureResult, Project, ProjectSuggestion, AnyObject } from "@/types";
import { HypherMark } from "./HypherMark";
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt),
    [projects]
  );

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
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
            <span className="capture-chrome-brand">
              <HypherMark />
              <span className="capture-wordmark-mock">hypher</span>
            </span>
          </div>
          <div className="capture-chrome-mock__right">
            {projects.length > 0 ? (
              <button
                type="button"
                className="capture-text-btn"
                onClick={onNavigateToWorkspace}
              >
                Projects
              </button>
            ) : null}
            {onSearchClick ? (
              <button type="button" className="capture-icon-btn" aria-label="Search" title="Search (⌘K)" onClick={onSearchClick}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
                  <circle cx="7" cy="7" r="5" />
                  <line x1="11" y1="11" x2="14" y2="14" />
                </svg>
              </button>
            ) : null}
            <Link href="/app/settings" className="capture-icon-btn" aria-label="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
            <span className="capture-user-wrap" title="Signed in">
              <UserButton />
            </span>
          </div>
        </div>
      </header>

      <main className="capture-home-mock__main">
        <section className="home-hero-mock">
          <h1 className="home-hero-title-mock">Give them the context they don&apos;t have.</h1>
          <p className="home-hero-subtitle-mock">A decision, a don&apos;t, a rant, a next move. Hypher turns it into the brief they read.</p>
          <div className="home-hero-glass">
          <div className={`home-input-shell-mock ${isDragNear ? "is-drag" : ""}`}>
            <textarea
              ref={inputRef}
              className="home-input-mock home-input-mock--area"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Don’t widen OAuth. Pulse stays three panels…"
              disabled={step === "assigning"}
            />
            <button
              type="button"
              className="home-input-submit-mock"
              aria-label="Save context"
              title="Save (⌘↵)"
              disabled={step === "assigning" || !text.trim()}
              onClick={() => void handleSubmit()}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          </div>

          {step === "idle" && (
            <div className="home-quick-row-mock">
              {onClipboardCapture ? (
                <button type="button" className="home-quick-mock" onClick={onClipboardCapture}>
                  Paste
                </button>
              ) : null}
              {onAddFiles ? (
                <button type="button" className="home-quick-mock" onClick={() => fileRef.current?.click()}>
                  File
                </button>
              ) : null}
              <span className="home-quick-hint">⌘↵ to save</span>
            </div>
          )}
          </div>

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
            <h2 className="home-projects-title-mock">Projects</h2>
            {onCreateProject ? (
              <button type="button" className="home-projects-add" onClick={onCreateProject}>
                New
              </button>
            ) : null}
          </div>

          {projects.length === 0 && step === "idle" ? (
            <div className="capture-clusters-empty">
              <p className="capture-clusters-empty-sub">
                Save something above, then put it on a project. The brief fills from there.
              </p>
            </div>
          ) : (
            <ul className="home-project-list">
              {sortedProjects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="home-project-row"
                    onClick={() => onProjectClick(p.id)}
                  >
                    <span className="home-project-name-mock">{p.name}</span>
                    <span className="home-project-foot-mock">
                      {itemCount(p.id) ? `${itemCount(p.id)}` : "—"}
                      <span aria-hidden>·</span>
                      {formatRelative(p.modifiedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
