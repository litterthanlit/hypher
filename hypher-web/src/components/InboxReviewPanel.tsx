"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { AnyObject, Project, ProjectSuggestion } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";

interface Props {
  items: AnyObject[];
  reviewItems: AnyObject[];
  projects: Project[];
  selectedId: string | null;
  getSuggestions: (objectId: string) => ProjectSuggestion[];
  onSelect: (id: string) => void;
  onAssign: (objectId: string, projectId: string) => Promise<void>;
  onKeepInInbox: (objectId: string) => Promise<void>;
  onCreateProject: (objectId: string, projectName: string) => Promise<void>;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function ReviewCard({
  item,
  projects,
  selected,
  suggestions,
  onSelect,
  onAssign,
  onKeepInInbox,
  onCreateProject,
}: {
  item: AnyObject;
  projects: Project[];
  selected: boolean;
  suggestions: ProjectSuggestion[];
  onSelect: () => void;
  onAssign: (projectId: string) => Promise<void>;
  onKeepInInbox: () => Promise<void>;
  onCreateProject: (projectName: string) => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");

  const suggestedIds = new Set(suggestions.map((s) => s.projectId));
  const fallbackProjects = projects
    .filter((project) => !suggestedIds.has(project.id))
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, Math.max(0, 3 - suggestions.length));

  const submitNewProject = async (e: FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    await onCreateProject(name);
    setProjectName("");
    setCreating(false);
  };

  return (
    <article className={`inbox-review-card ${selected ? "selected" : ""}`}>
      <button type="button" className="inbox-review-main" onClick={onSelect}>
        <span className="inbox-review-header">
          <KindIcon kind={item.kind} className="kind-icon" />
          <span className="inbox-review-name">{getDisplayName(item)}</span>
          <span className="inbox-review-time">{timeAgo(item.createdAt)}</span>
        </span>
        {item.kind === "note" && (
          <span className="inbox-review-preview">{item.content}</span>
        )}
      </button>

      <div className="inbox-review-actions" aria-label={`Review ${getDisplayName(item)}`}>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.projectId}
            type="button"
            className="assign-pill ai-suggested"
            title={suggestion.reason}
            onClick={() => void onAssign(suggestion.projectId)}
          >
            <span className="assign-sparkle">*</span>
            <span>{suggestion.projectName}</span>
            <span className="assign-confidence">{Math.round(suggestion.confidence * 100)}%</span>
            <span className="assign-reason">{suggestion.reason}</span>
          </button>
        ))}

        {fallbackProjects.map((project) => (
          <button
            key={project.id}
            type="button"
            className="assign-pill"
            onClick={() => void onAssign(project.id)}
          >
            {project.name}
          </button>
        ))}

        <button type="button" className="assign-pill inbox" onClick={() => void onKeepInInbox()}>
          Keep in inbox
        </button>

        {!creating ? (
          <button type="button" className="assign-pill new" onClick={() => setCreating(true)}>
            + New Project
          </button>
        ) : (
          <form className="assign-new-form" onSubmit={submitNewProject}>
            <input
              className="assign-new-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setProjectName("");
                  setCreating(false);
                }
              }}
              placeholder="Project name..."
              autoFocus
            />
          </form>
        )}
      </div>
    </article>
  );
}

export function InboxReviewPanel({
  items,
  reviewItems,
  projects,
  selectedId,
  getSuggestions,
  onSelect,
  onAssign,
  onKeepInInbox,
  onCreateProject,
}: Props) {
  const historyItems = useMemo(
    () =>
      items
        .filter((item) => item.reviewedAt)
        .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  if (items.length === 0) {
    return (
      <div className="inbox-review-panel">
        <div className="inbox-review-empty">
          <p className="inbox-review-empty-title">Inbox empty</p>
          <p className="inbox-review-empty-sub">Captured ideas without a project will wait here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-review-panel">
      <header className="inbox-review-titlebar">
        <div>
          <h2>Inbox Review</h2>
          <p>Sort loose captures into projects, or keep them here for later.</p>
        </div>
        <span className="inbox-review-count">{reviewItems.length} to review</span>
      </header>

      {reviewItems.length > 0 ? (
        <section className="inbox-review-section" aria-label="Items to review">
          {reviewItems.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              projects={projects}
              selected={selectedId === item.id}
              suggestions={getSuggestions(item.id)}
              onSelect={() => onSelect(item.id)}
              onAssign={(projectId) => onAssign(item.id, projectId)}
              onKeepInInbox={() => onKeepInInbox(item.id)}
              onCreateProject={(projectName) => onCreateProject(item.id, projectName)}
            />
          ))}
        </section>
      ) : (
        <div className="inbox-review-done">
          <p>All caught up.</p>
          <p>Reviewed captures stay below as inbox history.</p>
        </div>
      )}

      {historyItems.length > 0 && (
        <section className="inbox-history-section" aria-label="Inbox history">
          <h3>Inbox history</h3>
          <ul className="inbox-history-list">
            {historyItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`inbox-history-item ${selectedId === item.id ? "selected" : ""}`}
                  onClick={() => onSelect(item.id)}
                >
                  <KindIcon kind={item.kind} className="kind-icon" />
                  <span>{getDisplayName(item)}</span>
                  <span className="inbox-review-time">{timeAgo(item.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
