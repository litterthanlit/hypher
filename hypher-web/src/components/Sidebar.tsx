"use client";

import { useState } from "react";
import type { Project, Note, Artifact, AnyObject } from "@/types";
import { CreateForm } from "./CreateForm";
import { FolderIcon, NoteIcon, ArtifactIcon, PlusIcon } from "./Icons";

interface Props {
  projects: Project[];
  notes: Note[];
  artifacts: Artifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (obj: AnyObject) => void;
  pendingCount: number;
  onOpenSearch?: () => void;
}

export function Sidebar({ projects, notes, artifacts, selectedId, onSelect, onAdd, pendingCount, onOpenSearch }: Props) {
  const [showForm, setShowForm] = useState<"project" | "note" | "artifact" | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">hypher</span>
        <button className="btn-icon" onClick={() => setShowForm("project")} title="Create">
          <PlusIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="section">
          <h2 className="section-title">Projects <span className="count">{projects.length}</span></h2>
          <ul>
            {projects.map((p) => (
              <li key={p.id} className={`sidebar-item ${selectedId === p.id ? "selected" : ""}`} onClick={() => onSelect(p.id)}>
                <FolderIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{p.name}</span>
                  <span className="item-sub">{p.status}</span>
                </div>
              </li>
            ))}
            {projects.length === 0 && <li className="empty-hint">No projects</li>}
          </ul>
        </div>

        <div className="section">
          <h2 className="section-title">Notes <span className="count">{notes.length}</span></h2>
          <ul>
            {notes.map((n) => (
              <li key={n.id} className={`sidebar-item ${selectedId === n.id ? "selected" : ""}`} onClick={() => onSelect(n.id)}>
                <NoteIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{n.content.trim().slice(0, 40) || "Untitled"}</span>
                  <span className="item-sub">{n.maturity}</span>
                </div>
              </li>
            ))}
            {notes.length === 0 && <li className="empty-hint">No notes</li>}
          </ul>
        </div>

        <div className="section">
          <h2 className="section-title">Artifacts <span className="count">{artifacts.length}</span></h2>
          <ul>
            {artifacts.map((a) => (
              <li key={a.id} className={`sidebar-item ${selectedId === a.id ? "selected" : ""}`} onClick={() => onSelect(a.id)}>
                <ArtifactIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{a.name}</span>
                  <span className="item-sub">{a.type}</span>
                </div>
              </li>
            ))}
            {artifacts.length === 0 && <li className="empty-hint">No artifacts</li>}
          </ul>
        </div>
      </nav>

      <div className="sidebar-actions">
        <button className="btn-secondary" onClick={() => setShowForm("project")}>Project</button>
        <button className="btn-secondary" onClick={() => setShowForm("note")}>Note</button>
        <button className="btn-secondary" onClick={() => setShowForm("artifact")}>Artifact</button>
      </div>

      {showForm && (
        <CreateForm
          kind={showForm}
          onSubmit={(obj) => { onAdd(obj); setShowForm(null); }}
          onCancel={() => setShowForm(null)}
        />
      )}
    </aside>
  );
}
