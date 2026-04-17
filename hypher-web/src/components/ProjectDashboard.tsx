"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { api } from "../../convex/_generated/api";
import type { Project, ProjectStatus, AnyObject } from "@/types";
import { computeHealthScore, type HealthResult } from "@/lib/health";
import { HealthRing } from "./HealthRing";

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  onSelectProject: (id: string) => void;
}

type SortKey = "priority" | "lastActivity" | "name" | "itemCount" | "health";
type StatusFilter = "all" | ProjectStatus;
type PriorityFilter = "all" | "1" | "2" | "3+";

const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; label: string }> = {
  active: { bg: "var(--accent-subtle)", text: "var(--accent)", label: "Active" },
  paused: { bg: "rgba(212, 136, 43, 0.1)", text: "var(--amber)", label: "Paused" },
  shipped: { bg: "rgba(59, 130, 246, 0.1)", text: "var(--blue)", label: "Shipped" },
  archived: { bg: "var(--bg-tertiary)", text: "var(--text-tertiary)", label: "Archived" },
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "shipped", label: "Shipped" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "lastActivity", label: "Last activity" },
  { value: "name", label: "Name" },
  { value: "itemCount", label: "Item count" },
  { value: "health", label: "Health (needs attention first)" },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectDashboard({ projects, allObjects, onSelectProject }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [blockersOnly, setBlockersOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("priority");

  // Fetch health inputs from Convex (reactive)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthInputsList = useQuery((api as any).projects.healthInputs);

  // Build a map of projectId → HealthResult directly in render
  // (no useMemo — O(n) where n = project count; negligible for ~5–12 projects)
  const healthMap: Record<string, HealthResult> = {};
  if (healthInputsList) {
    const now = Date.now();
    for (const input of healthInputsList) {
      healthMap[input.projectId] = computeHealthScore(input, now);
    }
  }

  // Count items per project
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const obj of allObjects) {
      if (obj.projectId) {
        counts[obj.projectId] = (counts[obj.projectId] ?? 0) + 1;
      }
    }
    return counts;
  }, [allObjects]);

  // Filter
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (blockersOnly && !p.blockers) return false;
      if (priorityFilter !== "all") {
        const pri = p.priority ?? 3;
        if (priorityFilter === "1" && pri !== 1) return false;
        if (priorityFilter === "2" && pri !== 2) return false;
        if (priorityFilter === "3+" && pri < 3) return false;
      }
      return true;
    });
  }, [projects, statusFilter, priorityFilter, blockersOnly]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "priority":
          return (a.priority ?? 3) - (b.priority ?? 3);
        case "lastActivity":
          return (b.lastActivity ?? b.modifiedAt) - (a.lastActivity ?? a.modifiedAt);
        case "name":
          return a.name.localeCompare(b.name);
        case "itemCount":
          return (itemCounts[b.id] ?? 0) - (itemCounts[a.id] ?? 0);
        case "health": {
          const isInactive = (p: Project) => p.status === "archived" || p.status === "shipped";
          const aInactive = isInactive(a);
          const bInactive = isInactive(b);
          // Inactive projects sink to the bottom
          if (aInactive && !bInactive) return 1;
          if (!aInactive && bInactive) return -1;
          // Sort ascending (lowest health first — needs attention)
          const aScore = healthMap[a.id]?.score ?? 101;
          const bScore = healthMap[b.id]?.score ?? 101;
          return aScore - bScore;
        }
        default:
          return 0;
      }
    });
  // healthMap is rebuilt each render; listing healthInputsList as dep triggers
  // re-sort when Convex data updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, itemCounts, healthInputsList]);

  if (projects.length === 0) {
    return (
      <div className="dashboard">
        <div className="dashboard-empty">
          <p className="dashboard-empty-title">No projects yet</p>
          <p className="dashboard-empty-sub">Capture something to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Projects</h2>
      </div>

      {/* Filters row */}
      <div className="dashboard-filters">
        <div className="dashboard-filter-group">
          <div className="dashboard-pill-group">
            {STATUS_FILTERS.map((sf) => (
              <button
                key={sf.value}
                className={`dashboard-pill ${statusFilter === sf.value ? "active" : ""}`}
                onClick={() => setStatusFilter(sf.value)}
              >
                {sf.label}
              </button>
            ))}
          </div>

          <select
            className="dashboard-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          >
            <option value="all">All priorities</option>
            <option value="1">P1 only</option>
            <option value="2">P2 only</option>
            <option value="3+">P3+</option>
          </select>

          <label className="dashboard-toggle">
            <input
              type="checkbox"
              checked={blockersOnly}
              onChange={(e) => setBlockersOnly(e.target.checked)}
            />
            <span>Has blockers</span>
          </label>
        </div>

        <select
          className="dashboard-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>Sort: {opt.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="dashboard-empty">
          <p className="dashboard-empty-title">No projects match these filters</p>
          <p className="dashboard-empty-sub">
            <button className="dashboard-clear-btn" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setBlockersOnly(false); }}>
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div className="dashboard-grid">
          {sorted.map((project) => {
            const count = itemCounts[project.id] ?? 0;
            const activity = project.lastActivity ?? project.modifiedAt;
            const statusStyle = STATUS_COLORS[project.status] ?? STATUS_COLORS.active;
            const pri = project.priority ?? 3;
            const isInactive = project.status === "archived" || project.status === "shipped";
            const healthResult = healthMap[project.id];

            return (
              <motion.button
                key={project.id}
                className="dashboard-card"
                onClick={() => onSelectProject(project.id)}
                whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <div className="dashboard-card-top">
                  <span className="dashboard-card-name">{project.name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {project.blockers && (
                      <span className="dashboard-card-blocker" title={project.blockers}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={14} height={14}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                        </svg>
                      </span>
                    )}
                    {!isInactive && healthResult && (
                      <HealthRing
                        score={healthResult.score}
                        size={32}
                        breakdown={healthResult.breakdown}
                      />
                    )}
                  </span>
                </div>

                <div className="dashboard-card-meta">
                  <span
                    className="dashboard-badge"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}
                  >
                    {statusStyle.label}
                  </span>
                  <span className={`dashboard-priority ${pri === 1 ? "p1" : ""}`}>
                    P{pri}
                  </span>
                </div>

                <div className="dashboard-card-bottom">
                  <span className="dashboard-card-count">
                    {count} item{count !== 1 ? "s" : ""}
                  </span>
                  <span className="dashboard-card-activity">{timeAgo(activity)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
