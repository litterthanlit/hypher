"use client";

import type { AnyObject, Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";

interface Props {
  items: AnyObject[];
  projects: Project[];
  onAssign: (objectId: string, projectId: string) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function InboxSidebar({ items, projects, onAssign, onSelect, selectedId }: Props) {
  if (items.length === 0) {
    return (
      <div className="inbox-panel-empty">
        <p>Inbox empty</p>
        <p className="inbox-panel-sub">Captured items without a project appear here.</p>
      </div>
    );
  }

  return (
    <ul className="inbox-list">
      {items.map((item) => (
        <li
          key={item.id}
          className={`inbox-card ${selectedId === item.id ? "selected" : ""}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", item.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={() => onSelect(item.id)}
        >
          <div className="inbox-card-header">
            <KindIcon kind={item.kind} className="kind-icon" />
            <span className="inbox-card-name">{getDisplayName(item)}</span>
            <span className="inbox-card-time">{timeAgo(item.createdAt)}</span>
          </div>

          {projects.length > 0 && (
            <div className="inbox-card-actions">
              {projects.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className="inbox-move-btn"
                  onClick={(e) => { e.stopPropagation(); onAssign(item.id, p.id); }}
                  title={`Move to ${p.name}`}
                >
                  {p.name.slice(0, 12)}
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
