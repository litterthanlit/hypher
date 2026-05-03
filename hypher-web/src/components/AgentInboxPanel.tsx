"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { AgentEvent, Project } from "@/types";
import { buildAgentEventNoteContent } from "@/lib/agentEvents";

interface Props {
  events: AgentEvent[];
  projects: Project[];
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function sourceLabel(source: string): string {
  return source
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AgentInboxPanel({ events, projects }: Props) {
  const [selectedProjectByEvent, setSelectedProjectByEvent] = useState<Record<string, string>>({});
  const dismissEvent = useMutation((api as any).agentEvents.dismiss);
  const markReviewed = useMutation((api as any).agentEvents.markReviewed);
  const moveToProject = useMutation((api as any).agentEvents.moveToProject);
  const saveAsNote = useMutation((api as any).agentEvents.saveAsNote);

  const defaultProjectId = projects[0]?.id ?? "";
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => b.createdAt - a.createdAt),
    [events]
  );

  const projectForEvent = (event: AgentEvent) => selectedProjectByEvent[event.id] || defaultProjectId;

  const handleDismiss = async (event: AgentEvent) => {
    await dismissEvent({ eventId: event.id as Id<"agentEvents">, reviewedAt: Date.now() });
    toast.success("Agent update dismissed");
  };

  const handleReview = async (event: AgentEvent) => {
    await markReviewed({ eventId: event.id as Id<"agentEvents">, reviewedAt: Date.now() });
    toast.success("Agent update reviewed");
  };

  const handleMove = async (event: AgentEvent) => {
    const projectId = projectForEvent(event);
    if (!projectId) return;
    await moveToProject({
      eventId: event.id as Id<"agentEvents">,
      projectId: projectId as Id<"objects">,
    });
    toast.success("Moved to project");
  };

  const handleSaveAsNote = async (event: AgentEvent) => {
    const projectId = projectForEvent(event);
    if (!projectId) return;
    await saveAsNote({
      eventId: event.id as Id<"agentEvents">,
      projectId: projectId as Id<"objects">,
      content: buildAgentEventNoteContent(event),
      createdAt: Date.now(),
    });
    toast.success("Saved as note");
  };

  if (sortedEvents.length === 0) {
    return (
      <section className="agent-inbox-panel">
        <div className="agent-inbox-empty">
          <p className="agent-inbox-empty-title">Agent Inbox is clear.</p>
          <p>New handoffs, build logs, and suggestions wait here when Hypher is not sure where they belong.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="agent-inbox-panel">
      <header className="agent-inbox-head">
        <div>
          <p className="project-pulse-kicker">Agent Inbox</p>
          <h1>Review agent updates</h1>
          <p>Move unmatched handoffs into the right project, save useful context, or dismiss noise.</p>
        </div>
        <span>{sortedEvents.length} new</span>
      </header>

      <div className="agent-event-list">
        {sortedEvents.map((event) => (
          <article key={event.id} className="agent-event-card">
            <div className="agent-event-meta">
              <span>{sourceLabel(event.source)}</span>
              <span>{event.kind.replace("_", " ")}</span>
              <span>{timeAgo(event.createdAt)}</span>
            </div>
            <h2>{event.title}</h2>
            <p>{event.body}</p>
            {event.suggestedActions?.length ? (
              <div className="agent-event-actions-list">
                <span>Suggested actions</span>
                <ul>
                  {event.suggestedActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="agent-event-controls">
              <select
                value={projectForEvent(event)}
                onChange={(e) =>
                  setSelectedProjectByEvent((current) => ({ ...current, [event.id]: e.target.value }))
                }
              >
                {projects.length === 0 ? <option value="">No projects</option> : null}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => void handleMove(event)} disabled={!projectForEvent(event)}>
                Move to project
              </button>
              <button type="button" onClick={() => void handleSaveAsNote(event)} disabled={!projectForEvent(event)}>
                Save as note
              </button>
              <button type="button" onClick={() => void handleReview(event)}>
                Mark reviewed
              </button>
              <button type="button" onClick={() => void handleDismiss(event)}>
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
