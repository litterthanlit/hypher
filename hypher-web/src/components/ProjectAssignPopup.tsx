"use client";

import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { Project, ProjectSuggestion } from "@/types";

interface Props {
  text: string;
  projects: Project[];
  aiSuggestions?: ProjectSuggestion[];
  onAssign: (projectId: string) => void | Promise<void>;
  onInbox: () => void | Promise<void>;
  onNewProject: (name: string) => void | Promise<void>;
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
        onDismiss();
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
  }, [creatingProject, projects, aiSuggestions, onAssign, onDismiss]);

  const buildOptions = () => {
    const options: { key: string; label: string; sub?: string; reason?: string; action: () => void; accent?: boolean }[] = [];

    // AI-suggested projects first
    for (const s of aiSuggestions) {
      const project = projects.find((p) => p.id === s.projectId);
      if (project) {
        options.push({
          key: project.id,
          label: project.name,
          sub: `${Math.round(s.confidence * 100)}%`,
          reason: s.reason,
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
        key: p.id,
        label: p.name,
        action: () => onAssign(p.id),
      });
    }

    return options;
  };

  const options = buildOptions();

  const handleNewProjectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      void onNewProject(newName.trim());
      setNewName("");
      setCreatingProject(false);
    }
  };

  return (
    <div className="assign-popup" ref={containerRef}>
      <div className="assign-label">Put it on</div>
      <p className="assign-captured-preview">{text}</p>
      <div className="assign-options">
        {options.map((opt, i) => (
          <button
            key={opt.key}
            className={`assign-pill ${opt.accent ? "ai-suggested" : ""}`}
            title={opt.reason}
            onClick={opt.action}
          >
            {opt.accent && <span className="assign-sparkle">*</span>}
            <span>{opt.label}</span>
            {opt.sub && <span className="assign-confidence">{opt.sub}</span>}
            {opt.reason && <span className="assign-reason">{opt.reason}</span>}
            <kbd className="assign-kbd">{i + 1}</kbd>
          </button>
        ))}

        <button className="assign-pill inbox" onClick={onInbox}>
          Keep in inbox
        </button>

        <button className="assign-pill later" onClick={onDismiss}>
          Decide later
        </button>

        {!creatingProject ? (
          <button className="assign-pill new" onClick={() => setCreatingProject(true)}>
            + New project
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
      <div className="assign-hint">Press number to select, Esc to decide later</div>
    </div>
  );
}
