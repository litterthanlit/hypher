"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
  ActivityEntry,
  AgentEvent,
  AnyObject,
  Handoff,
  Project,
  ProjectAction,
  ProjectMemory,
} from "@/types";
import { getDisplayName } from "@/types";
import { selectProjectActionQueue } from "@/lib/actions";
import { compileProjectContextWithMeta } from "@/lib/projectContext";
import {
  BUILDER_BRIEF_COPY_ERROR_TOAST,
  BUILDER_BRIEF_COPY_LABEL,
  BUILDER_BRIEF_COPY_SUCCESS_TOAST,
  buildProjectContextInput,
  buildProjectPulseModel,
} from "@/lib/projectPulse";

interface Props {
  project: Project;
  allObjects: AnyObject[];
  activity: ActivityEntry[];
  onCapture: () => void;
  onUpdateCapture: (objectId: string, patch: Partial<AnyObject>) => Promise<void>;
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

function itemKindLabel(item: AnyObject): string {
  if (item.kind === "note") return "capture";
  if (item.kind === "artifact") return item.type;
  return "project";
}

export function ProjectPulse({
  project,
  allObjects,
  activity,
  onCapture,
  onUpdateCapture,
}: Props) {
  const [packetBusy, setPacketBusy] = useState(false);
  const [latestPacket, setLatestPacket] = useState("");
  const memory = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).projectMemories.getForProject,
    { projectId: project.id as Id<"objects"> }
  ) as ProjectMemory | null | undefined;
  const agentEvents = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).agentEvents.listForProject,
    { projectId: project.id as Id<"objects">, limit: 8 }
  ) as AgentEvent[] | undefined;
  const handoffs = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).handoffs.listForProject,
    { projectId: project.id as Id<"objects">, limit: 6 }
  ) as Handoff[] | undefined;
  const projectActions = useQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (api as any).actions.listForProject,
    { projectId: project.id as Id<"objects"> }
  ) as ProjectAction[] | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dismissAgentEvent = useMutation((api as any).agentEvents.dismiss);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acceptAgentEvent = useMutation((api as any).agentEvents.accept);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createHandoff = useMutation((api as any).handoffs.create);

  const model = useMemo(
    () => buildProjectPulseModel({ project, allObjects, activity, memories: memory ? [memory] : [] }),
    [project, allObjects, activity, memory]
  );

  const actionQueue = useMemo(
    () => selectProjectActionQueue(projectActions ?? []),
    [projectActions]
  );

  const lastBrief = latestPacket
    ? { packet: latestPacket, generatedAt: null as number | null }
    : handoffs?.[0]
      ? { packet: handoffs[0].packetContent, generatedAt: handoffs[0].generatedAt }
      : null;

  const handleGenerateHandoff = async () => {
    if (packetBusy) return;
    setPacketBusy(true);
    try {
      const compiled = compileProjectContextWithMeta({
        ...buildProjectContextInput({
          project,
          model,
          actionQueue,
          agentEvents: agentEvents ?? [],
        }),
        handoffs: handoffs ?? [],
        generatedAt: Date.now(),
      });
      const handoffId = await createHandoff({
        projectId: project.id as Id<"objects">,
        generatedAt: compiled.generatedAt,
        targetTool: compiled.targetTool,
        packetContent: compiled.packet,
        sourceCaptures: compiled.sourceCaptureIds,
        requestedTask: compiled.requestedTask,
        status: "pending",
      });
      for (const captureId of compiled.sourceCaptureIds) {
        await onUpdateCapture(captureId, { linkedHandoffId: String(handoffId) });
      }
      await navigator.clipboard.writeText(compiled.packet);
      setLatestPacket(compiled.packet);
      toast.success(BUILDER_BRIEF_COPY_SUCCESS_TOAST);
    } catch (err) {
      console.error("[ProjectPulse] generate handoff", err);
      toast.error(BUILDER_BRIEF_COPY_ERROR_TOAST);
    } finally {
      setPacketBusy(false);
    }
  };

  const handleAgentDismiss = async (event: AgentEvent) => {
    try {
      await dismissAgentEvent({ eventId: event.id as Id<"agentEvents">, reviewedAt: Date.now() });
      toast.success("Agent update dismissed");
    } catch (err) {
      console.error("[ProjectPulse] dismiss agent event", err);
      toast.error("Could not update agent event");
    }
  };

  const handleAcceptAgentEvent = async (event: AgentEvent) => {
    try {
      await acceptAgentEvent({
        eventId: event.id as Id<"agentEvents">,
        projectId: project.id as Id<"objects">,
        acceptedAt: Date.now(),
      });
      toast.success("Accepted into memory");
    } catch (err) {
      console.error("[ProjectPulse] accept agent event", err);
      toast.error("Could not accept agent update");
    }
  };

  return (
    <section className="project-pulse">
      <header className="project-pulse-hero">
        <div>
          <p className="project-pulse-kicker">Project Pulse</p>
          <h1>{project.name}</h1>
          {project.githubRepo ? (
            <p className="project-pulse-summary">{project.githubRepo}</p>
          ) : null}
        </div>
        <div className="project-pulse-actions">
          <button type="button" className="project-pulse-btn" onClick={onCapture}>
            Capture
          </button>
          <button type="button" className="project-pulse-btn project-pulse-btn--primary" disabled={packetBusy} onClick={() => void handleGenerateHandoff()}>
            {packetBusy ? "Preparing..." : BUILDER_BRIEF_COPY_LABEL}
          </button>
        </div>
      </header>

      <div className="project-pulse-grid">
        <section className="project-pulse-panel">
          <div className="project-pulse-panel-head">
            <h2>Latest Captures</h2>
            <span>{model.latestCaptures.length}</span>
          </div>
          {model.latestCaptures.length > 0 ? (
            <div className="project-pulse-list">
              {model.latestCaptures.map((item) => (
                <div key={item.id} className="project-pulse-list-row project-pulse-list-row--static">
                  <span>
                    <strong>{getDisplayName(item)}</strong>
                    <small>{item.captureType?.replace("_", " ") ?? itemKindLabel(item)}</small>
                  </span>
                  <em>{timeAgo(item.modifiedAt)}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">No captures assigned yet.</p>
          )}
        </section>

        <section className="project-pulse-panel project-pulse-panel--handoffs">
          <div className="project-pulse-panel-head">
            <h2>Builder Brief</h2>
          </div>
          <p className="project-pulse-muted">
            Compiles this project&apos;s context into a packet for your coding agent.
          </p>
          <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" disabled={packetBusy} onClick={() => void handleGenerateHandoff()}>
            {packetBusy ? "Preparing..." : BUILDER_BRIEF_COPY_LABEL}
          </button>
          {lastBrief ? (
            <details className="handoff-preview">
              <summary>
                Latest brief{lastBrief.generatedAt ? ` · ${timeAgo(lastBrief.generatedAt)}` : ""}
              </summary>
              <textarea readOnly value={lastBrief.packet} />
            </details>
          ) : null}
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
                  <div className="project-pulse-row-actions">
                    {event.status === "accepted" ? (
                      <span className="project-pulse-accepted">Accepted</span>
                    ) : (
                      <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" onClick={() => void handleAcceptAgentEvent(event)}>
                        Accept
                      </button>
                    )}
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleAgentDismiss(event)}>
                      Dismiss
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">
              No agent updates yet. When an agent works on this project, its writeback lands here.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
