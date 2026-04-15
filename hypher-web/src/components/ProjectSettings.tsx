"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

export function ProjectSettings({ project, onUpdate, onClose }: Props) {
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [priority, setPriority] = useState<ProjectPriority>(project.priority ?? 3);
  const [blockers, setBlockers] = useState(project.blockers ?? "");
  const [tags, setTags] = useState(project.tags?.join(", ") ?? "");

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
      </div>
    </div>
  );
}
