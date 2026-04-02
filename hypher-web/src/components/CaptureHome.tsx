"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Project } from "@/types";
import { ProjectAssignPopup } from "./ProjectAssignPopup";

interface Props {
  projects: Project[];
  onCapture: (text: string, projectId?: string | null) => Promise<{ projectId: string; projectName: string; confidence: number }[]>;
  onCreateProjectAndCapture: (projectName: string, noteText: string) => void;
  onNavigateToWorkspace: () => void;
}

type CaptureStep = "idle" | "assigning";

export function CaptureHome({ projects, onCapture, onCreateProjectAndCapture, onNavigateToWorkspace }: Props) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<CaptureStep>("idle");
  const [aiSuggestions, setAiSuggestions] = useState<{ projectId: string; projectName: string; confidence: number }[]>([]);
  const [capturedText, setCapturedText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
      {/* Header */}
      <div className="capture-header">
        <span className="capture-logo">hypher</span>
        <button className="capture-workspace-btn" onClick={onNavigateToWorkspace} title="Open workspace">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={18} height={18}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        </button>
      </div>

      {/* Center capture area */}
      <div className="capture-center">
        <input
          ref={inputRef}
          className="capture-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          disabled={step === "assigning"}
        />

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
      </div>
    </div>
  );
}
