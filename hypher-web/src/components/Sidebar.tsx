"use client";

import { useState } from "react";
import type { Project, AnyObject } from "@/types";
import { getDisplayName } from "@/types";
import { CreateForm } from "./CreateForm";
import { FolderIcon, KindIcon, PlusIcon } from "./Icons";

interface Props {
  projects: Project[];
  inboxItems: AnyObject[];
  recentItems: AnyObject[];
  selectedProjectId: string | null;
  selectedObjectId: string | null;
  onSelectProject: (id: string) => void;
  onSelectInboxItem: (id: string) => void;
  onSelectRecent: (id: string) => void;
  onAdd: (obj: AnyObject) => void;
  onGoHome: () => void;
  onDashboard: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function Sidebar({
  projects, inboxItems, recentItems, selectedProjectId, selectedObjectId,
  onSelectProject, onSelectInboxItem, onSelectRecent, onAdd, onGoHome, onDashboard,
}: Props) {
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
        <div className="section">
          <div className="section-title-row">
            <h2 className="section-title">
              Projects <span className="count">{projects.length}</span>
            </h2>
            <button className="dashboard-btn" onClick={onDashboard} title="Project Dashboard (⌘⇧P)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </button>
          </div>
          <ul>
            {projects.map((p) => (
              <li
                key={p.id}
                className={`sidebar-item ${selectedProjectId === p.id ? "selected" : ""}`}
                onClick={() => onSelectProject(p.id)}
              >
                <FolderIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{p.name}</span>
                  <span className="item-sub">{p.status}</span>
                </div>
              </li>
            ))}
            {projects.length === 0 && <li className="empty-hint">No projects yet</li>}
          </ul>
        </div>

        {recentItems.length > 0 && (
          <div className="section">
            <h2 className="section-title recent-title">
              Recent
            </h2>
            <ul>
              {recentItems.map((item) => (
                <li
                  key={item.id}
                  className={`sidebar-item recent-item ${selectedObjectId === item.id ? "selected" : ""}`}
                  onClick={() => onSelectRecent(item.id)}
                >
                  <KindIcon kind={item.kind} className="kind-icon" />
                  <div className="item-text">
                    <span className="item-name">{getDisplayName(item)}</span>
                  </div>
                  <span className="recent-time">{timeAgo(item.createdAt)}</span>
                  <span className="recent-check">{"\u2713"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {inboxItems.length > 0 && (
          <div className="section">
            <h2 className="section-title inbox-title">
              Inbox <span className="count inbox-count">{inboxItems.length}</span>
            </h2>
            <ul>
              {inboxItems.map((item) => (
                <li
                  key={item.id}
                  className={`sidebar-item ${selectedObjectId === item.id ? "selected" : ""}`}
                  onClick={() => onSelectInboxItem(item.id)}
                >
                  <KindIcon kind={item.kind} className="kind-icon" />
                  <div className="item-text">
                    <span className="item-name">{getDisplayName(item)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

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
