"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project, AnyObject } from "@/types";
import { CreateForm } from "./CreateForm";
import { FolderIcon, PlusIcon } from "./Icons";

interface Props {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAdd: (obj: AnyObject) => void;
  onGoHome: () => void;
  onDashboard: () => void;
  agentInboxCount?: number;
  onAgentInbox?: () => void;
  showBetaAdmin?: boolean;
  /** Which primary destination is current (workspace only). */
  activeSection?: "projects" | "agent" | "project";
  /** Merged onto `<aside>` (e.g. `sidebar--drawer-open` on narrow screens). */
  className?: string;
  /** Called after a navigation action so mobile drawer can close. */
  onMobileSidebarClose?: () => void;
}

export function Sidebar({
  projects, selectedProjectId,
  onSelectProject, onAdd, onGoHome, onDashboard,
  agentInboxCount = 0,
  onAgentInbox,
  showBetaAdmin,
  activeSection,
  className,
  onMobileSidebarClose,
}: Props) {
  const [showForm, setShowForm] = useState<"project" | "note" | "artifact" | null>(null);
  const closeMobile = () => { onMobileSidebarClose?.(); };

  return (
    <aside className={["sidebar", className].filter(Boolean).join(" ")}>
      <div className="sidebar-header">
        <button className="logo-btn" onClick={() => { closeMobile(); onGoHome(); }} title="Capture (Cmd+N)">
          <span className="logo logo--with-mark">
            <img className="hypher-signal-mark hypher-signal-mark--sidebar" src="/hypher-logo.svg" alt="" aria-hidden />
            hypher
          </span>
        </button>
        <button className="btn-icon" onClick={() => setShowForm("project")} title="Create" aria-label="Create project">
          <PlusIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-primary" aria-label="Workspace">
          <button
            type="button"
            className="sidebar-primary-link"
            onClick={() => { closeMobile(); onGoHome(); }}
          >
            Home
          </button>
          <button
            type="button"
            className={`sidebar-primary-link${activeSection === "projects" ? " is-active" : ""}`}
            onClick={() => { closeMobile(); onDashboard(); }}
          >
            Projects
          </button>
          {agentInboxCount > 0 && onAgentInbox ? (
            <button
              type="button"
              className={`sidebar-primary-link${activeSection === "agent" ? " is-active" : ""}`}
              onClick={() => { closeMobile(); onAgentInbox(); }}
            >
              Agent
            </button>
          ) : null}
        </div>
        <div className="section">
          <div className="section-title-row">
            <h2 className="section-title">
              Projects <span className="count">{projects.length}</span>
            </h2>
          </div>
          <ul>
            {projects.map((p) => (
              <li
                key={p.id}
                className={`sidebar-item ${selectedProjectId === p.id ? "selected" : ""}`}
                onClick={() => { closeMobile(); onSelectProject(p.id); }}
              >
                <FolderIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{p.name}</span>
                  {p.githubRepo ? <span className="item-sub">{p.githubRepo}</span> : null}
                </div>
              </li>
            ))}
            {projects.length === 0 && <li className="empty-hint">No projects yet</li>}
          </ul>
        </div>

        {agentInboxCount > 0 && onAgentInbox ? (
          <div className="section">
            <button className="sidebar-digest-btn sidebar-agent-inbox-btn" onClick={() => { closeMobile(); onAgentInbox(); }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 4.5h10" />
                <path d="M4.5 2.5h7l1.5 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7l1.5-2Z" />
                <path d="M6 8h4" />
              </svg>
              Agent Inbox
              <span className="count inbox-count">{agentInboxCount}</span>
            </button>
          </div>
        ) : null}
        <div className="section">
          <Link href="/app/settings" className="sidebar-digest-btn sidebar-settings-link" onClick={closeMobile}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            Settings
          </Link>
          {showBetaAdmin ? (
            <Link href="/app/settings/beta" className="sidebar-digest-btn sidebar-settings-link" onClick={closeMobile}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a8.25 8.25 0 0 1 15 0" />
              </svg>
              Beta
            </Link>
          ) : null}
        </div>
      </nav>

      {showForm && (
        <CreateForm
          kind={showForm}
          onSubmit={(obj) => { closeMobile(); onAdd(obj); setShowForm(null); }}
          onCancel={() => setShowForm(null)}
        />
      )}
    </aside>
  );
}
