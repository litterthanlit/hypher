"use client";

import type { AnyObject, Connection } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, RefreshIcon } from "./Icons";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  suggestions: Connection[];
  resolveObject: (id: string) => AnyObject | undefined;
  selectedId: string | null;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  isProcessing: boolean;
  pendingCount: number;
}

export function SuggestionsPanel({
  suggestions, resolveObject, selectedId,
  onConfirm, onDismiss, onRefresh, isProcessing, pendingCount,
}: Props) {
  return (
    <aside className="suggestions-panel">
      <div className="panel-header">
        <h2>
          Suggestions
          {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
        </h2>
        <button className="btn-icon" onClick={onRefresh} disabled={isProcessing} title="Refresh">
          <RefreshIcon />
        </button>
      </div>

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
    </aside>
  );
}
