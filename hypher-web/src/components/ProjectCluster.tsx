"use client";

import type { AnyObject, Project, Connection } from "@/types";
import { getDisplayName } from "@/types";
import { FolderIcon, NoteIcon, ArtifactIcon } from "./Icons";

interface Props {
  project: Project;
  members: AnyObject[];
  connectionCount: number;
  isSelected: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const STATUS_COLORS: Record<string, string> = {
  seed: "var(--text-quaternary)",
  growing: "var(--accent)",
  active: "var(--blue)",
  shipped: "#a78bfa",
  dormant: "var(--amber)",
  archived: "var(--text-quaternary)",
};

export function ProjectCluster({ project, members, connectionCount, isSelected, onDragOver, onDrop }: Props) {
  const notes = members.filter((m) => m.kind === "note").slice(0, 2);
  const artifacts = members.filter((m) => m.kind === "artifact").slice(0, 2);
  const previewItems = [...notes, ...artifacts].slice(0, 4);
  const statusColor = STATUS_COLORS[project.status] ?? "var(--text-quaternary)";

  return (
    <div
      className={`project-cluster ${isSelected ? "selected" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-target"); onDragOver?.(e); }}
      onDragLeave={(e) => { e.currentTarget.classList.remove("drop-target"); }}
      onDrop={(e) => { e.currentTarget.classList.remove("drop-target"); onDrop?.(e); }}
    >
      {/* Header */}
      <div className="cluster-header">
        <FolderIcon className="kind-icon" />
        <span className="cluster-name">{project.name}</span>
        <span className="cluster-status" style={{ color: statusColor }}>{project.status}</span>
      </div>

      {/* 2x2 preview grid */}
      <div className="cluster-grid">
        {previewItems.map((item) => (
          <div key={item.id} className="cluster-cell">
            {item.kind === "note" && (
              <>
                <NoteIcon className="cluster-cell-icon" />
                <span className="cluster-cell-text">{getDisplayName(item)}</span>
              </>
            )}
            {item.kind === "artifact" && (
              <>
                <ArtifactIcon className="cluster-cell-icon" />
                <span className="cluster-cell-text">{getDisplayName(item)}</span>
              </>
            )}
          </div>
        ))}
        {/* Fill empty cells */}
        {Array.from({ length: Math.max(0, 4 - previewItems.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="cluster-cell empty" />
        ))}
      </div>

      {/* Footer */}
      <div className="cluster-footer">
        <span className="cluster-member-count">{members.length} item{members.length !== 1 ? "s" : ""}</span>
        {connectionCount > 0 && (
          <span className="cluster-conn-count">{connectionCount} link{connectionCount !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}
