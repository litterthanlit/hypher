"use client";

import { useState } from "react";
import type { AnyObject, Connection, ProjectStatus, NoteMaturity, ArtifactType } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, SparklesIcon } from "./Icons";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  object: AnyObject | null;
  connections: Connection[];
  allObjects: AnyObject[];
  resolveObject: (id: string) => AnyObject | undefined;
  onUpdate: (obj: AnyObject) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onManualConnect: (sourceId: string, targetId: string) => void;
  onRemoveConnection: (connId: string) => void;
  onAssignToProject?: (objectId: string, projectId: string) => void;
  onUnassignFromProject?: (objectId: string) => void;
}

export function DetailView({
  object, connections, allObjects, resolveObject,
  onUpdate, onDelete, onSelect, onManualConnect, onRemoveConnection,
  onAssignToProject, onUnassignFromProject,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectSearch, setConnectSearch] = useState("");

  if (!object) {
    return (
      <div className="detail empty-state">
        <SparklesIcon className="empty-state-icon" />
        <h2>Select an object</h2>
        <p>Choose a project, note, or artifact from the sidebar to view details and connections.</p>
      </div>
    );
  }

  const startEdit = (field: string, value: string) => {
    setEditing(field);
    setEditValue(value);
  };

  const saveEdit = (field: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditing(null); return; }

    const updated = { ...object, modifiedAt: Date.now() };
    if (field === "name" && (updated.kind === "project" || updated.kind === "artifact")) {
      (updated as any).name = trimmed;
    } else if (field === "description" && updated.kind === "project") {
      (updated as any).description = trimmed;
    } else if (field === "content" && updated.kind === "note") {
      (updated as any).content = trimmed;
    }
    onUpdate(updated);
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit(field);
    }
    if (e.key === "Escape") setEditing(null);
  };

  const handleStatusChange = (value: string) => {
    const updated = { ...object, modifiedAt: Date.now() };
    if (updated.kind === "project") (updated as any).status = value as ProjectStatus;
    if (updated.kind === "note") (updated as any).maturity = value as NoteMaturity;
    if (updated.kind === "artifact") (updated as any).type = value as ArtifactType;
    onUpdate(updated);
  };

  const connectedIds = new Set(connections.flatMap((c) => [c.sourceId, c.targetId]));
  const connectableObjects = allObjects.filter(
    (o) => o.id !== object.id && !connectedIds.has(o.id)
  );
  const filteredConnectable = connectSearch
    ? connectableObjects.filter((o) => getDisplayName(o).toLowerCase().includes(connectSearch.toLowerCase()))
    : connectableObjects;

  const title = object.kind === "project" ? object.name : object.kind === "artifact" ? object.name : "Note";
  const statusOptions = object.kind === "project"
    ? ["active", "paused", "shipped", "archived"]
    : object.kind === "note"
    ? ["fleeting", "developing", "structured", "reference"]
    : ["image", "video", "code", "document", "font", "audio", "other"];
  const statusValue = object.kind === "project" ? object.status : object.kind === "note" ? object.maturity : object.type;

  return (
    <div className="detail">
      <div className="detail-content">
        {/* Header */}
        <div className="detail-header">
          <KindIcon kind={object.kind} className="kind-icon" />
          <div className="detail-header-text">
            {editing === "name" ? (
              <input
                className="detail-edit-input title"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "name")}
                onBlur={() => saveEdit("name")}
                autoFocus
              />
            ) : (
              <h2
                className="detail-title-editable"
                onClick={() => (object.kind === "project" || object.kind === "artifact") && startEdit("name", title)}
              >
                {title}
              </h2>
            )}
            <select
              className="detail-status-select"
              value={statusValue}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Project assignment for non-project objects */}
        {object.kind !== "project" && onAssignToProject && (
          <div className="detail-project-assign">
            {object.projectId ? (
              <div className="detail-project-current">
                <span className="detail-project-label">In:</span>
                <span className="detail-project-name">
                  {allObjects.find((o) => o.id === object.projectId && o.kind === "project")
                    ? getDisplayName(allObjects.find((o) => o.id === object.projectId)!)
                    : "Unknown project"}
                </span>
                {onUnassignFromProject && (
                  <button className="btn-ghost" onClick={() => onUnassignFromProject(object.id)}>Remove</button>
                )}
              </div>
            ) : (
              <div className="detail-project-picker">
                <span className="detail-project-label">Assign to:</span>
                {allObjects.filter((o) => o.kind === "project").slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    className="assign-pill"
                    onClick={() => onAssignToProject(object.id, p.id)}
                  >
                    {getDisplayName(p)}
                  </button>
                ))}
                {allObjects.filter((o) => o.kind === "project").length === 0 && (
                  <span className="detail-project-none">No projects yet</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content / Description */}
        {object.kind === "project" && (
          editing === "description" ? (
            <textarea
              className="detail-edit-textarea"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "description")}
              onBlur={() => saveEdit("description")}
              rows={4}
              autoFocus
            />
          ) : (
            <p
              className="detail-desc editable"
              onClick={() => startEdit("description", object.description)}
            >
              {object.description || "Add a description..."}
            </p>
          )
        )}
        {object.kind === "note" && (
          editing === "content" ? (
            <textarea
              className="detail-edit-textarea large"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "content")}
              onBlur={() => saveEdit("content")}
              rows={8}
              autoFocus
            />
          ) : (
            <p
              className="detail-desc editable"
              onClick={() => startEdit("content", object.content)}
            >
              {object.content}
            </p>
          )
        )}
        {object.kind === "artifact" && object.fileReference && (
          <p className="detail-desc mono">{object.fileReference}</p>
        )}

        {/* Meta */}
        <div className="meta">
          <span>{new Date(object.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          {object.embedding && (
            <>
              <span className="meta-dot" />
              <span className="embedding-status">
                <span className="embedding-dot" />
                Embedded
              </span>
            </>
          )}
          <span className="meta-dot" />
          <span className="meta-modified">
            Modified {new Date(object.modifiedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        {/* Connections */}
        <div className="connections-section">
          <div className="connections-header">
            <h3>Connections</h3>
            <button className="btn-ghost" onClick={() => setShowConnect(!showConnect)}>
              + Link
            </button>
          </div>

          {showConnect && (
            <div className="connect-picker">
              <input
                className="connect-search"
                placeholder="Search objects to link..."
                value={connectSearch}
                onChange={(e) => setConnectSearch(e.target.value)}
                autoFocus
              />
              <ul className="connect-list">
                {filteredConnectable.slice(0, 6).map((o) => (
                  <li
                    key={o.id}
                    className="connect-item"
                    onClick={() => {
                      onManualConnect(object.id, o.id);
                      setShowConnect(false);
                      setConnectSearch("");
                    }}
                  >
                    <KindIcon kind={o.kind} className="kind-icon" />
                    <span>{getDisplayName(o)}</span>
                  </li>
                ))}
                {filteredConnectable.length === 0 && (
                  <li className="connect-empty">No objects to link</li>
                )}
              </ul>
            </div>
          )}

          {connections.length === 0 && !showConnect ? (
            <p className="empty-hint">No confirmed connections</p>
          ) : (
            <ul className="connection-list">
              {connections.map((conn) => {
                const otherId = conn.sourceId === object.id ? conn.targetId : conn.sourceId;
                const other = resolveObject(otherId);
                return (
                  <li key={conn.id} className="connection-row">
                    <KindIcon kind={other?.kind ?? "note"} className="kind-icon" />
                    <span
                      className="conn-name clickable"
                      onClick={() => other && onSelect(other.id)}
                    >
                      {other ? getDisplayName(other) : "Unknown"}
                    </span>
                    <ConfidenceBadge confidence={conn.confidence} />
                    <button
                      className="conn-remove"
                      onClick={() => onRemoveConnection(conn.id)}
                      title="Remove connection"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Delete */}
        <div className="detail-danger">
          {showDelete ? (
            <div className="delete-confirm">
              <span>Delete this {object.kind}?</span>
              <button className="btn-ghost" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => onDelete(object.id)}>Delete</button>
            </div>
          ) : (
            <button className="btn-ghost danger-text" onClick={() => setShowDelete(true)}>
              Delete {object.kind}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
