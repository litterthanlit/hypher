"use client";

import { useState, useEffect, useRef } from "react";
import type { Project } from "@/types";

interface Props {
  text: string;
  projects: Project[];
  aiSuggestions?: { projectId: string; projectName: string; confidence: number }[];
  onAssign: (projectId: string) => void;
  onInbox: () => void;
  onNewProject: (name: string) => void;
  onDismiss: () => void;
}

export function ProjectAssignPopup({
  text,
  projects,
  aiSuggestions = [],
  onAssign,
  onInbox,
  onNewProject,
  onDismiss,
}: Props) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creatingProject) inputRef.current?.focus();
  }, [creatingProject]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onInbox();
        return;
      }
      if (creatingProject) return;

      // Number keys to select
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1) {
        const allOptions = buildOptions();
        const idx = num - 1;
        if (idx < allOptions.length) {
          allOptions[idx]!.action();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [creatingProject, projects, aiSuggestions]);

  const buildOptions = () => {
    const options: { label: string; sub?: string; action: () => void; accent?: boolean }[] = [];

    // AI-suggested projects first
    for (const s of aiSuggestions) {
      const project = projects.find((p) => p.id === s.projectId);
      if (project) {
        options.push({
          label: project.name,
          sub: `${Math.round(s.confidence * 100)}%`,
          action: () => onAssign(project.id),
          accent: true,
        });
      }
    }

    // Remaining projects sorted by recency
    const suggestedIds = new Set(aiSuggestions.map((s) => s.projectId));
    const remaining = projects
      .filter((p) => !suggestedIds.has(p.id))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);

    for (const p of remaining) {
      options.push({
        label: p.name,
        action: () => onAssign(p.id),
      });
    }

    return options;
  };

  const options = buildOptions();

  const handleNewProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onNewProject(newName.trim());
      setNewName("");
      setCreatingProject(false);
    }
  };

  return (
    <div className="assign-popup" ref={containerRef}>
      <div className="assign-label">Add to</div>
      <div className="assign-options">
        {options.map((opt, i) => (
          <button
            key={i}
            className={`assign-pill ${opt.accent ? "ai-suggested" : ""}`}
            onClick={opt.action}
          >
            {opt.accent && <span className="assign-sparkle">*</span>}
            <span>{opt.label}</span>
            {opt.sub && <span className="assign-confidence">{opt.sub}</span>}
            <kbd className="assign-kbd">{i + 1}</kbd>
          </button>
        ))}

        <button className="assign-pill inbox" onClick={onInbox}>
          Inbox
        </button>

        {!creatingProject ? (
          <button className="assign-pill new" onClick={() => setCreatingProject(true)}>
            + New Project
          </button>
        ) : (
          <form className="assign-new-form" onSubmit={handleNewProjectSubmit}>
            <input
              ref={inputRef}
              className="assign-new-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setCreatingProject(false); } }}
              placeholder="Project name..."
            />
          </form>
        )}
      </div>
      <div className="assign-hint">Press number to select, Esc for inbox</div>
    </div>
  );
}
