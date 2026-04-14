"use client";

import { useState } from "react";
import type { AnyObject, Connection, NoteMaturity, ArtifactType } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";
import { InlineEditor } from "./InlineEditor";

interface Props {
  items: AnyObject[];
  connections: Connection[];
  onUpdate: (obj: AnyObject) => void;
  onDelete: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ListView({ items, connections, onUpdate, onDelete, selectedId, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => b.modifiedAt - a.modifiedAt);

  const hasConnection = (id: string) =>
    connections.some(
      (c) => (c.type === "ai_confirmed" || c.type === "manual") && (c.sourceId === id || c.targetId === id)
    );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    onSelect(id);
  };

  if (items.length === 0) {
    return (
      <div className="list-empty">
        <p>No items in this project yet.</p>
        <p className="list-empty-sub">Capture a thought from the home screen and assign it here.</p>
      </div>
    );
  }

  return (
    <div className="list-view">
      {sorted.map((item) => {
        const isExpanded = expandedId === item.id;
        const linked = hasConnection(item.id);

        return (
          <div
            key={item.id}
            className={`list-item ${isExpanded ? "expanded" : ""} ${selectedId === item.id ? "selected" : ""}`}
            onClick={() => toggleExpand(item.id)}
          >
            <div className="list-item-header">
              <KindIcon kind={item.kind} className="kind-icon" />
              <span className="list-item-name">{getDisplayName(item)}</span>
              {linked && <span className="list-item-linked" title="Has connections" />}
              <span className="list-item-time">
                {new Date(item.modifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>

            {isExpanded && (
              <div className="list-item-expanded" onClick={(e) => e.stopPropagation()}>
                {item.kind === "note" && (
                  <>
                    <InlineEditor
                      value={item.content}
                      onSave={(v) => onUpdate({ ...item, content: v, modifiedAt: Date.now() })}
                      multiline
                      className="list-edit-textarea"
                      displayClassName="list-edit-display"
                    />
                    <select
                      className="list-status-select"
                      value={item.maturity}
                      onChange={(e) => onUpdate({ ...item, maturity: e.target.value as NoteMaturity, modifiedAt: Date.now() })}
                    >
                      {["fleeting", "developing", "structured", "reference"].map((m) => (
                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </>
                )}
                {item.kind === "artifact" && (
                  <>
                    <InlineEditor
                      value={item.name}
                      onSave={(v) => onUpdate({ ...item, name: v, modifiedAt: Date.now() })}
                      className="list-edit-input"
                      displayClassName="list-edit-display"
                    />
                    <select
                      className="list-status-select"
                      value={item.type}
                      onChange={(e) => onUpdate({ ...item, type: e.target.value as ArtifactType, modifiedAt: Date.now() })}
                    >
                      {["image", "video", "code", "document", "font", "audio", "other"].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </>
                )}
                <button className="btn-ghost danger-text" onClick={() => onDelete(item.id)}>Delete</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
