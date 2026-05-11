"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ActivityEntry, AgentEvent, AnyObject, Project, ProjectAction, ProjectMemory, ProjectMemoryStatus } from "@/types";
import { getDisplayName } from "@/types";
import { buildAgentEventNoteContent } from "@/lib/agentEvents";
import { selectProjectActionQueue } from "@/lib/actions";
import { compileProjectContext } from "@/lib/projectContext";
import { buildProjectContextInput, buildProjectPulseModel } from "@/lib/projectPulse";
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
  const agentEvents = useQuery(
    (api as any).agentEvents.listForProject,
    { projectId: project.id as Id<"objects">, limit: 5 }
  ) as AgentEvent[] | undefined;
  const projectActions = useQuery(
    (api as any).actions.listForProject,
    { projectId: project.id as Id<"objects"> }
  ) as ProjectAction[] | undefined;
  const updateNextActionStatus = useMutation((api as any).projectMemories.updateNextActionStatus);
  const dismissAgentEvent = useMutation((api as any).agentEvents.dismiss);
  const markAgentEventReviewed = useMutation((api as any).agentEvents.markReviewed);
  const saveAgentEventAsNote = useMutation((api as any).agentEvents.saveAsNote);
  const createActionFromAgentSuggestion = useMutation((api as any).actions.createFromAgentSuggestion);
  const createActionFromMemoryAction = useMutation((api as any).actions.createFromMemoryAction);
  const updateActionStatus = useMutation((api as any).actions.updateStatus);

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
  const actionQueue = useMemo(
    () => selectProjectActionQueue(projectActions ?? []),
    [projectActions]
  );

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

  const handleSaveMemoryAction = async () => {
    if (!model.primaryNextAction) return;
    try {
      await createActionFromMemoryAction({
        projectId: project.id as Id<"objects">,
        memoryActionId: model.primaryNextAction.id,
        title: model.primaryNextAction.title,
        rationale: model.primaryNextAction.rationale,
        status: model.primaryNextAction.status,
        createdAt: Date.now(),
      });
      toast.success("Saved as project action");
    } catch (err) {
      console.error("[ProjectPulse] save memory action", err);
      toast.error("Could not save action");
    }
  };

  const handleProjectActionStatus = async (action: ProjectAction, status: "accepted" | "completed" | "dismissed") => {
    try {
      await updateActionStatus({
        actionId: action.id as Id<"actions">,
        status,
        updatedAt: Date.now(),
      });
      toast.success(status === "completed" ? "Action completed" : "Action updated");
    } catch (err) {
      console.error("[ProjectPulse] update action", err);
      toast.error("Could not update action");
    }
  };

  const handleSaveAgentEvent = async (event: AgentEvent) => {
    try {
      await saveAgentEventAsNote({
        eventId: event.id as Id<"agentEvents">,
        projectId: project.id as Id<"objects">,
        content: buildAgentEventNoteContent(event),
        createdAt: Date.now(),
      });
      toast.success("Agent update saved as note");
    } catch (err) {
      console.error("[ProjectPulse] save agent event", err);
      toast.error("Could not save agent update");
    }
  };

  const handleAgentStatus = async (event: AgentEvent, status: "reviewed" | "dismissed") => {
    try {
      const args = { eventId: event.id as Id<"agentEvents">, reviewedAt: Date.now() };
      if (status === "dismissed") await dismissAgentEvent(args);
      else await markAgentEventReviewed(args);
      toast.success(status === "dismissed" ? "Agent update dismissed" : "Agent update reviewed");
    } catch (err) {
      console.error("[ProjectPulse] update agent event", err);
      toast.error("Could not update agent event");
    }
  };

  const handleCreateAgentAction = async (event: AgentEvent, title: string) => {
    try {
      await createActionFromAgentSuggestion({
        eventId: event.id as Id<"agentEvents">,
        projectId: project.id as Id<"objects">,
        title,
        createdAt: Date.now(),
      });
      toast.success("Saved as project action");
    } catch (err) {
      console.error("[ProjectPulse] create agent action", err);
      toast.error("Could not save action");
    }
  };

  const handleCopyAgentContext = async () => {
    try {
      const packet = compileProjectContext({
        ...buildProjectContextInput({
          project,
          model,
          actionQueue,
          agentEvents: agentEvents ?? [],
        }),
      });
      await navigator.clipboard.writeText(packet);
      toast.success("Agent context copied");
    } catch (err) {
      console.error("[ProjectPulse] copy agent context", err);
      toast.error("Could not copy agent context");
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
          <button type="button" className="project-pulse-btn" onClick={() => void handleCopyAgentContext()}>
            Copy agent context
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
                <button type="button" className="project-pulse-inline-btn" onClick={() => void handleSaveMemoryAction()}>
                  Save as action
                </button>
              </div>
            </>
          ) : (
            <p className="project-pulse-muted">Generate memory to get a concrete next move.</p>
          )}
        </section>

        <section className="project-pulse-panel project-pulse-panel--actions">
          <div className="project-pulse-panel-head">
            <h2>Actions</h2>
            <span>{actionQueue.length}</span>
          </div>
          {actionQueue.length ? (
            <div className="project-action-list">
              {actionQueue.slice(0, 5).map((action) => (
                <article key={action.id} className={`project-action-row is-${action.status}`}>
                  <span>{action.status}</span>
                  <strong>{action.title}</strong>
                  {action.rationale ? <p>{action.rationale}</p> : null}
                  <div className="project-pulse-row-actions">
                    {action.status === "suggested" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleProjectActionStatus(action, "accepted")}>
                        Accept
                      </button>
                    ) : null}
                    {action.status !== "completed" && action.status !== "dismissed" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleProjectActionStatus(action, "completed")}>
                        Complete
                      </button>
                    ) : null}
                    {action.status !== "dismissed" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleProjectActionStatus(action, "dismissed")}>
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">Save a memory suggestion or agent suggestion to start the action queue.</p>
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

        <section className="project-pulse-panel project-pulse-panel--agent">
          <div className="project-pulse-panel-head">
            <h2>Agent Updates</h2>
            <span>{agentEvents?.length ?? 0}</span>
          </div>
          {agentEvents?.length ? (
            <div className="agent-updates-list">
              {agentEvents.map((event) => (
                <article key={event.id} className="agent-update-row">
                  <div className="agent-event-meta">
                    <span>{event.source}</span>
                    <span>{event.kind.replace("_", " ")}</span>
                    <span>{timeAgo(event.createdAt)}</span>
                  </div>
                  <h3>{event.title}</h3>
                  <p>{event.body}</p>
                  {event.suggestedActions?.length ? (
                    <ul>
                      {event.suggestedActions.slice(0, 3).map((action) => (
                        <li key={action}>
                          <span>{action}</span>
                          <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCreateAgentAction(event, action)}>
                            Save action
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="project-pulse-row-actions">
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleSaveAgentEvent(event)}>
                      Save as note
                    </button>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleAgentStatus(event, "reviewed")}>
                      Review
                    </button>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleAgentStatus(event, "dismissed")}>
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">
              No agent updates yet. When OpenClaw, Hermes, or another agent works on this project, its handoffs will appear here for review.
            </p>
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
