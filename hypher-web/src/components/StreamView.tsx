"use client";

import type { ActivityEntry, AnyObject } from "@/types";
import { KindIcon } from "./Icons";

interface Props {
  activity: ActivityEntry[];
  objects: AnyObject[];
  onSelect: (id: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  connected: "Connected",
  suggested: "AI suggested",
  dismissed: "Dismissed",
};

const ACTION_COLORS: Record<string, string> = {
  created: "var(--accent)",
  updated: "var(--blue)",
  deleted: "var(--red)",
  connected: "var(--accent)",
  suggested: "var(--amber)",
  dismissed: "var(--text-quaternary)",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDate(entries: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = "Yesterday";
    } else {
      key = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return groups;
}

export function StreamView({ activity, objects, onSelect }: Props) {
  const grouped = groupByDate(activity);
  const objectExists = (id: string) => objects.some((o) => o.id === id);

  // Summary stats
  const today = activity.filter((a) => Date.now() - a.timestamp < 86400000);
  const todayCreated = today.filter((a) => a.action === "created").length;
  const todayConnected = today.filter((a) => a.action === "connected").length;
  const todaySuggested = today.filter((a) => a.action === "suggested").length;

  if (activity.length === 0) {
    return (
      <div className="stream-view stream-empty">
        <div className="stream-empty-content">
          <span className="stream-empty-icon">~</span>
          <p className="stream-empty-title">No activity yet</p>
          <p className="stream-empty-sub">Create objects and confirm connections to see your stream.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stream-view">
      <div className="stream-content">
        {/* Daily summary */}
        {today.length > 0 && (
          <div className="stream-summary">
            <span className="stream-summary-label">Today</span>
            <div className="stream-summary-stats">
              {todayCreated > 0 && <span className="stream-stat"><span className="stream-stat-num">{todayCreated}</span> created</span>}
              {todayConnected > 0 && <span className="stream-stat"><span className="stream-stat-num">{todayConnected}</span> connected</span>}
              {todaySuggested > 0 && <span className="stream-stat"><span className="stream-stat-num">{todaySuggested}</span> suggested</span>}
            </div>
          </div>
        )}

        {/* Activity entries grouped by date */}
        {Array.from(grouped.entries()).map(([dateLabel, entries]) => (
          <div key={dateLabel} className="stream-group">
            <div className="stream-date">{dateLabel}</div>
            <div className="stream-entries">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`stream-entry ${objectExists(entry.objectId) ? "clickable" : ""}`}
                  onClick={() => objectExists(entry.objectId) && onSelect(entry.objectId)}
                >
                  <div className="stream-entry-dot" style={{ background: ACTION_COLORS[entry.action] }} />
                  <div className="stream-entry-content">
                    <div className="stream-entry-header">
                      <KindIcon kind={entry.objectKind} className="kind-icon" />
                      <span className="stream-entry-action" style={{ color: ACTION_COLORS[entry.action] }}>
                        {ACTION_LABELS[entry.action]}
                      </span>
                      <span className="stream-entry-name">{entry.objectName}</span>
                      {entry.targetName && (
                        <>
                          <span className="stream-entry-arrow">→</span>
                          {entry.targetKind && <KindIcon kind={entry.targetKind} className="kind-icon" />}
                          <span className="stream-entry-name">{entry.targetName}</span>
                        </>
                      )}
                    </div>
                    <span className="stream-entry-time">{timeAgo(entry.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
