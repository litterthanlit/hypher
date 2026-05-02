"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { ActivityEntry, AnyObject, Project, ProjectMemory, ProjectMemoryStatus } from "@/types";
import { getDisplayName } from "@/types";
import { buildProjectPulseModel } from "@/lib/projectPulse";
import {
  canGenerateProjectMemory,
  computeProjectMemorySourceUpdatedAt,
  getProjectMemoryStatus,
} from "@/lib/projectMemory";
import { HealthRing } from "./HealthRing";

interface Props {
  project: Project;
  allObjects: AnyObject[];
  activity: ActivityEntry[];
  healthScore?: number | null;
  onOpenCanvas: () => void;
  onOpenList: () => void;
  onCapture: () => void;
  onSelectItem: (id: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function memoryStatusLabel(status: ProjectMemoryStatus): string {
  switch (status) {
    case "fresh": return "Fresh";
    case "stale": return "Stale";
    case "empty": return "Empty";
    case "generating": return "Generating";
    case "error": return "Needs retry";
  }
}

function itemKindLabel(item: AnyObject): string {
  if (item.kind === "note") return "capture";
  if (item.kind === "artifact") return item.type;
  return "project";
}

export function ProjectPulse({
  project,
  allObjects,
  activity,
  healthScore,
  onOpenCanvas,
  onOpenList,
  onCapture,
  onSelectItem,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const memories = useQuery((api as any).projectMemories.listForDashboard) as ProjectMemory[] | undefined;
  const updateNextActionStatus = useMutation((api as any).projectMemories.updateNextActionStatus);

  const model = useMemo(
    () => buildProjectPulseModel({ project, allObjects, activity, memories }),
    [project, allObjects, activity, memories]
  );

  const sourceUpdatedAt = computeProjectMemorySourceUpdatedAt({
    project,
    items: model.latestCaptures,
    activities: model.recentActivity,
  });
  const memoryStatus = getProjectMemoryStatus({
    memory: model.memory,
    sourceUpdatedAt,
    generating,
  });
  const canGenerate = canGenerateProjectMemory(project);

  const handleGenerateMemory = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/project-memory/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "generation-failed");
      toast.success("Project memory updated");
    } catch (err) {
      console.error("[ProjectPulse] generate memory", err);
      toast.error("Could not generate memory");
    } finally {
      setGenerating(false);
    }
  };

  const handleNextActionStatus = async (status: "accepted" | "dismissed") => {
    if (!model.primaryNextAction) return;
    try {
      await updateNextActionStatus({
        projectId: project.id,
        actionId: model.primaryNextAction.id,
        status,
        updatedAt: Date.now(),
      });
      toast.success(status === "accepted" ? "Next action accepted" : "Next action dismissed");
    } catch (err) {
      console.error("[ProjectPulse] update next action", err);
      toast.error("Could not update next action");
    }
  };

  return (
    <section className="project-pulse">
      <header className="project-pulse-hero">
        <div>
          <p className="project-pulse-kicker">Project Pulse</p>
          <h1>{project.name}</h1>
          <p className="project-pulse-summary">
            {model.memory?.currentDirection || project.description || "Capture a few fragments to build memory around this project."}
          </p>
        </div>
        <div className="project-pulse-actions">
          {healthScore != null ? (
            <div className="project-pulse-health">
              <HealthRing score={healthScore} size={36} strokeWidth={3} />
              <span>{healthScore}% health</span>
            </div>
          ) : null}
          <button type="button" className="project-pulse-btn project-pulse-btn--primary" onClick={onCapture}>
            Capture
          </button>
          <button type="button" className="project-pulse-btn" onClick={onOpenCanvas}>
            Canvas
          </button>
          <button type="button" className="project-pulse-btn" onClick={onOpenList}>
            List
          </button>
        </div>
      </header>

      <div className="project-pulse-grid">
        <section className="project-pulse-panel project-pulse-panel--memory">
          <div className="project-pulse-panel-head">
            <h2>Where It Stands</h2>
            <span className={`project-pulse-status project-pulse-status--${memoryStatus}`}>
              {memoryStatusLabel(memoryStatus)}
            </span>
          </div>
          {model.memory?.summary ? (
            <p className="project-pulse-memory-text">{model.memory.summary}</p>
          ) : (
            <p className="project-pulse-muted">No project memory yet.</p>
          )}
          <div className="project-pulse-memory-footer">
            <span>{model.memory?.generatedAt ? `Updated ${timeAgo(model.memory.generatedAt)}` : "Ready after first useful captures"}</span>
            {canGenerate ? (
              <button type="button" className="project-pulse-inline-btn" disabled={generating} onClick={() => void handleGenerateMemory()}>
                {generating ? "Generating..." : model.memory ? "Refresh memory" : "Generate memory"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="project-pulse-panel project-pulse-panel--next">
          <div className="project-pulse-panel-head">
            <h2>Next Move</h2>
          </div>
          {model.primaryNextAction ? (
            <>
              <p className="project-pulse-next-title">{model.primaryNextAction.title}</p>
              <p className="project-pulse-next-body">{model.primaryNextAction.rationale}</p>
              <div className="project-pulse-row-actions">
                {model.primaryNextAction.status === "suggested" ? (
                  <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" onClick={() => void handleNextActionStatus("accepted")}>
                    Accept
                  </button>
                ) : (
                  <span className="project-pulse-accepted">Accepted</span>
                )}
                <button type="button" className="project-pulse-inline-btn" onClick={() => void handleNextActionStatus("dismissed")}>
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <p className="project-pulse-muted">Generate memory to get a concrete next move.</p>
          )}
        </section>

        <section className="project-pulse-panel">
          <div className="project-pulse-panel-head">
            <h2>Latest Captures</h2>
            <span>{model.latestCaptures.length}</span>
          </div>
          {model.latestCaptures.length > 0 ? (
            <div className="project-pulse-list">
              {model.latestCaptures.map((item) => (
                <button key={item.id} type="button" className="project-pulse-list-row" onClick={() => onSelectItem(item.id)}>
                  <span>
                    <strong>{getDisplayName(item)}</strong>
                    <small>{itemKindLabel(item)}</small>
                  </span>
                  <em>{timeAgo(item.modifiedAt)}</em>
                </button>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">No captures assigned yet.</p>
          )}
        </section>

        <section className="project-pulse-panel">
          <div className="project-pulse-panel-head">
            <h2>Open Questions</h2>
          </div>
          {model.memory?.openQuestions?.length ? (
            <ul className="project-pulse-questions">
              {model.memory.openQuestions.slice(0, 4).map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : (
            <p className="project-pulse-muted">No open questions yet.</p>
          )}
        </section>

        <section className="project-pulse-panel">
          <div className="project-pulse-panel-head">
            <h2>Recent Changes</h2>
          </div>
          {model.memory?.recentChanges?.length ? (
            <ul className="project-pulse-questions">
              {model.memory.recentChanges.slice(0, 4).map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : model.recentActivity.length ? (
            <div className="project-pulse-list">
              {model.recentActivity.map((entry) => (
                <div key={entry.id} className="project-pulse-list-row project-pulse-list-row--static">
                  <span>
                    <strong>{entry.objectName}</strong>
                    <small>{entry.activityType ?? entry.action}</small>
                  </span>
                  <em>{timeAgo(entry.timestamp)}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">No recent changes yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}
