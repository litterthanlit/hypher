"use client";

import { useState } from "react";
import type { Project, Note, Artifact, AnyObject } from "@/types";
import { getDisplayName } from "@/types";
import { CreateForm } from "./CreateForm";
import { FolderIcon, NoteIcon, ArtifactIcon, PlusIcon, KindIcon } from "./Icons";

interface Props {
  projects: Project[];
  notes: Note[];
  artifacts: Artifact[];
  inboxItems?: AnyObject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (obj: AnyObject) => void;
  pendingCount: number;
  onOpenSearch?: () => void;
  onGoHome?: () => void;
}

export function Sidebar({ projects, notes, artifacts, inboxItems = [], selectedId, onSelect, onAdd, pendingCount, onOpenSearch, onGoHome }: Props) {
  const [showForm, setShowForm] = useState<"project" | "note" | "artifact" | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="logo-btn" onClick={onGoHome} title="Capture (Cmd+N)">
          <span className="logo">hypher</span>
        </button>
        <button className="btn-icon" onClick={() => setShowForm("project")} title="Create">
          <PlusIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        {/* Inbox section */}
        {inboxItems.length > 0 && (
          <div className="section">
            <h2 className="section-title inbox-title">Inbox <span className="count inbox-count">{inboxItems.length}</span></h2>
            <ul>
              {inboxItems.slice(0, 8).map((item) => (
                <li key={item.id} className={`sidebar-item ${selectedId === item.id ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
                  <KindIcon kind={item.kind} className="kind-icon" />
                  <div className="item-text">
                    <span className="item-name">{getDisplayName(item)}</span>
                    <span className="item-sub unassigned">unassigned</span>
                  </div>
                </li>
              ))}
              {inboxItems.length > 8 && (
                <li className="empty-hint">+{inboxItems.length - 8} more</li>
              )}
            </ul>
          </div>
        )}

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
