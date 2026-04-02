"use client";

import { useState } from "react";
import type { AnyObject, Connection, Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, RefreshIcon } from "./Icons";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { InboxSidebar } from "./InboxSidebar";

type RightTab = "inbox" | "suggestions";

interface Props {
  suggestions: Connection[];
  resolveObject: (id: string) => AnyObject | undefined;
  selectedId: string | null;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  isProcessing: boolean;
  pendingCount: number;
  inboxItems?: AnyObject[];
  projects?: Project[];
  onAssignToProject?: (objectId: string, projectId: string) => void;
  onSelectObject?: (id: string) => void;
}

export function SuggestionsPanel({
  suggestions, resolveObject, selectedId,
  onConfirm, onDismiss, onRefresh, isProcessing, pendingCount,
  inboxItems = [], projects = [], onAssignToProject, onSelectObject,
}: Props) {
  const [tab, setTab] = useState<RightTab>(inboxItems.length > 0 ? "inbox" : "suggestions");

  return (
    <aside className="suggestions-panel">
      {/* Tab bar */}
      <div className="right-tabs">
        <button
          className={`right-tab ${tab === "inbox" ? "active" : ""}`}
          onClick={() => setTab("inbox")}
        >
          Inbox
          {inboxItems.length > 0 && <span className="right-tab-count">{inboxItems.length}</span>}
        </button>
        <button
          className={`right-tab ${tab === "suggestions" ? "active" : ""}`}
          onClick={() => setTab("suggestions")}
        >
          Suggestions
          {pendingCount > 0 && <span className="right-tab-count accent">{pendingCount}</span>}
        </button>
        {tab === "suggestions" && (
          <button className="btn-icon right-tab-action" onClick={onRefresh} disabled={isProcessing} title="Refresh">
            <RefreshIcon />
          </button>
        )}
      </div>

      {/* Inbox tab */}
      {tab === "inbox" && (
        <div className="right-panel-content">
          <InboxSidebar
            items={inboxItems}
            projects={projects}
            onAssign={onAssignToProject ?? (() => {})}
            onSelect={onSelectObject ?? (() => {})}
            selectedId={selectedId}
          />
        </div>
      )}

      {/* Suggestions tab */}
      {tab === "suggestions" && (
        <div className="right-panel-content">
          {!selectedId ? (
            <div className="panel-empty">Select an object to see suggested connections.</div>
          ) : suggestions.length === 0 ? (
            <div className="panel-empty">No suggestions yet. Add more objects to discover connections.</div>
          ) : (
            <ul className="suggestion-list">
              {suggestions.map((conn) => {
                const otherId = conn.sourceId === selectedId ? conn.targetId : conn.sourceId;
                const other = resolveObject(otherId);
                return (
                  <li key={conn.id} className="suggestion-card">
                    <div className="suggestion-header">
                      <KindIcon kind={other?.kind ?? "note"} className="kind-icon" />
                      <span className="suggestion-name">{other ? getDisplayName(other) : "Unknown"}</span>
                      <ConfidenceBadge confidence={conn.confidence} />
                    </div>
                    {conn.reason && <p className="suggestion-reason">{conn.reason}</p>}
                    <div className="suggestion-actions">
                      <button className="btn-dismiss" onClick={() => onDismiss(conn.id)}>Dismiss</button>
                      <button className="btn-confirm" onClick={() => onConfirm(conn.id)}>Confirm</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
