"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Project, AnyObject } from "@/types";
import { ProjectAssignPopup } from "./ProjectAssignPopup";
import { FloatingClusters } from "./FloatingClusters";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  onCapture: (text: string, projectId?: string | null) => Promise<{ projectId: string; projectName: string; confidence: number }[]>;
  onCreateProjectAndCapture: (projectName: string, noteText: string) => void;
  onNavigateToWorkspace: () => void;
  onProjectClick: (projectId: string) => void;
  onClipboardCapture?: () => void;
  onNotionImport?: () => void;
}

type CaptureStep = "idle" | "assigning";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Late night";
}

export function CaptureHome({ projects, allObjects, onCapture, onCreateProjectAndCapture, onNavigateToWorkspace, onProjectClick, onClipboardCapture, onNotionImport }: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<CaptureStep>("idle");
  const [aiSuggestions, setAiSuggestions] = useState<{ projectId: string; projectName: string; confidence: number }[]>([]);
  const [capturedText, setCapturedText] = useState("");
  const [greeting] = useState(getGreeting);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [textVisible, setTextVisible] = useState(true);
  const [isDragNear, setIsDragNear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blinkCount = useRef(0);

  const placeholders = [
    "what's on your mind...",
    "something you noticed...",
    "the idea you keep circling...",
    "before it fades...",
    "what clicked today...",
    "the thread worth pulling...",
    "say it simply...",
    "what's forming...",
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // One rhythm: 3200ms cycle.
  // At 0ms: cursor on, text visible
  // At 800ms: cursor off
  // At 1600ms: cursor on
  // At 2400ms: cursor off + text fades out
  // At 2800ms: text swaps (while both hidden)
  // At 3200ms: cursor on + text fades in (new cycle)
  useEffect(() => {
    if (text || step !== "idle") return;

    const CYCLE = 3200;
    const BLINK = 800;

    const run = () => {
      // Phase 0: cursor on, text in
      setCursorVisible(true);
      setTextVisible(true);

      // Phase 1 (800ms): cursor off
      const t1 = setTimeout(() => setCursorVisible(false), BLINK);

      // Phase 2 (1600ms): cursor on
      const t2 = setTimeout(() => setCursorVisible(true), BLINK * 2);

      // Phase 3 (2400ms): cursor off + text out
      const t3 = setTimeout(() => {
        setCursorVisible(false);
        setTextVisible(false);
      }, BLINK * 3);

      // Phase 3.5 (2800ms): swap text while both hidden
      const t4 = setTimeout(() => {
        setPlaceholderIndex((i) => (i + 1) % placeholders.length);
      }, BLINK * 3 + 400);

      return [t1, t2, t3, t4];
    };

    const timers = run();
    const interval = setInterval(() => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      timers.push(...run());
    }, CYCLE);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(interval);
    };
  }, [text, step, placeholders.length]);

  // Detect file drag near the window
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

  // Refocus after each capture cycle
  useEffect(() => {
    if (step === "idle") {
      inputRef.current?.focus();
    }
  }, [step]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setCapturedText(trimmed);

    if (projects.length === 0) {
      // No projects exist — go straight to inbox
      await onCapture(trimmed, null);
      setText("");
      setStep("idle");
      return;
    }

    // Create note without project, get AI suggestions
    const suggestions = await onCapture(trimmed, null);
    setAiSuggestions(suggestions);
    setText("");
    setStep("assigning");
  }, [text, projects, onCapture]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleAssign = async (projectId: string) => {
    // Find the note we just created (most recent fleeting note matching text)
    // The store already created it in onCapture — now just assign it
    // We need the parent to handle this since we don't have the note ID
    // For now, the parent will handle reassignment in onCapture flow
    setStep("idle");
    setCapturedText("");
    setAiSuggestions([]);
  };

  const handleInbox = () => {
    // Already in inbox from onCapture(text, null)
    setStep("idle");
    setCapturedText("");
    setAiSuggestions([]);
  };

  const handleNewProject = (name: string) => {
    onCreateProjectAndCapture(name, capturedText);
    setStep("idle");
    setCapturedText("");
    setAiSuggestions([]);
  };

  return (
    <div className="capture-home">
      <FloatingClusters
        projects={projects}
        allObjects={allObjects}
        inputText={text}
        onProjectClick={onProjectClick}
      />

      {/* Header */}
      <div className="capture-header">
        <span className="capture-logo">hypher</span>
        <div className="capture-header-actions">
        {onClipboardCapture && (
          <button className="capture-workspace-btn" onClick={onClipboardCapture} title="Paste from clipboard (Cmd+Shift+V)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
            </svg>
          </button>
        )}
        <button className="capture-workspace-btn" onClick={onNavigateToWorkspace} title="Open workspace">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        </button>
        </div>
      </div>

      {/* Center capture area */}
      <div className="capture-center">
        <div className={`capture-input-wrap ${isDragNear ? "drag-glow" : ""}`}>
          <input
            ref={inputRef}
            className={`capture-input ${text ? "has-text" : ""}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder=""
            disabled={step === "assigning"}
          />
          {!text && step === "idle" && (
            <span className={`capture-placeholder ${textVisible ? "visible" : ""}`} key={placeholderIndex}>
              {placeholders[placeholderIndex]}
            </span>
          )}
          {!text && step === "idle" && cursorVisible && <span className="capture-cursor" />}
          {!text && step === "idle" && (
            <div className={`capture-drop-hint ${isDragNear ? "visible" : ""}`} aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m17 8-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
            </div>
          )}
        </div>


        {step === "idle" && !text && (
          <div className="capture-hints">
            <span className="capture-hint">
              <kbd className="hint-kbd">⌘</kbd>
              <kbd className="hint-kbd">↵</kbd>
              <span>capture</span>
            </span>
            <span className="capture-hint-sep" />
            <span className="capture-hint">
              <kbd className="hint-kbd">⌘</kbd>
              <kbd className="hint-kbd">⇧</kbd>
              <kbd className="hint-kbd">V</kbd>
              <span>paste</span>
            </span>
            <span className="capture-hint-sep" />
            <span className="capture-hint">
              <kbd className="hint-kbd">⌘</kbd>
              <kbd className="hint-kbd">K</kbd>
              <span>search</span>
            </span>
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
            onDismiss={handleInbox}
          />
        )}

        {onNotionImport && step === "idle" && !text && (
          <button className="notion-import-btn" onClick={onNotionImport}>
            Import from Notion
          </button>
        )}

        {projects.length === 0 && step === "idle" && !text && (
          <div className="capture-clusters-empty">
            <p className="capture-clusters-empty-title">Project constellations appear here</p>
            <p className="capture-clusters-empty-sub">
              Create a project from the workspace sidebar to see floating clusters around this field. They’re not missing — there’s nothing to orbit yet.
            </p>
            <button type="button" className="capture-clusters-empty-btn" onClick={onNavigateToWorkspace}>
              Open workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
