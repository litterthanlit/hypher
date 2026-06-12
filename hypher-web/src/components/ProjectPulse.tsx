"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
  AcceptedCrystallizedSuggestion,
  AcceptedCrystallizedSuggestionStatus,
  ActivityEntry,
  AgentEvent,
  AnyObject,
  Handoff,
  Project,
  ProjectAction,
  ProjectMemory,
  ProjectMemoryStatus,
  TargetTool,
} from "@/types";
import { getDisplayName } from "@/types";
import { buildAgentEventNoteContent } from "@/lib/agentEvents";
import { findDuplicateAction, selectProjectActionQueue } from "@/lib/actions";
import {
  acceptedCrystallizedSuggestionStatus,
  buildAcceptedCrystallizedMemoryPatch,
  buildCrystallizedMemoryStatusPatch,
  suggestCrystallizedUpdates,
  type CrystallizedSuggestion,
} from "@/lib/crystallizeRecentActivity";
import { buildHandoffResultUpdate } from "@/lib/handoffResults";
import { compileProjectContextWithMeta } from "@/lib/projectContext";
import {
  BUILDER_BRIEF_COPY_ERROR_TOAST,
  BUILDER_BRIEF_COPY_LABEL,
  BUILDER_BRIEF_COPY_SUCCESS_TOAST,
  buildProjectContextInput,
  buildProjectPulseModel,
} from "@/lib/projectPulse";
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
  projects: Project[];
  onOpenCanvas: () => void;
  onOpenList: () => void;
  onCapture: () => void;
  onSelectItem: (id: string) => void;
  onMoveCapture: (objectId: string, projectId: string) => Promise<void>;
  onArchiveCapture: (objectId: string) => Promise<void>;
  onUpdateCapture: (objectId: string, patch: Partial<AnyObject>) => Promise<void>;
  onCreateProjectFromCapture: (objectId: string, projectName: string) => Promise<void>;
  onMergeProject: (targetProjectId: string) => Promise<void>;
  emphasizeAgentSection?: boolean;
}

const TARGET_TOOLS: TargetTool[] = ["ChatGPT", "Claude", "Cursor", "Windsurf", "Linear", "GitHub", "GitHub Copilot", "MCP tool", "Manual"];
const CRYSTALLIZED_KIND_LABELS: Record<CrystallizedSuggestion["kind"], string> = {
  decision: "Decision",
  constraint: "Constraint",
  do_not_do: "Do Not Do",
  current_task: "Current Task",
  open_action: "Open Action",
  acceptance_criterion: "Acceptance Criterion",
  agent_warning: "Agent Warning",
  handoff_note: "Handoff Note",
};
const CRYSTALLIZED_MEMORY_KIND_ORDER: CrystallizedSuggestion["kind"][] = [
  "decision",
  "constraint",
  "do_not_do",
  "acceptance_criterion",
  "agent_warning",
  "handoff_note",
  "current_task",
  "open_action",
];
const CRYSTALLIZED_MEMORY_STATUS_LABELS: Record<AcceptedCrystallizedSuggestionStatus, string> = {
  active: "Active",
  stale: "Stale",
  excluded: "Excluded",
};

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

function captureSummary(item: AnyObject): string {
  if (item.kind === "note") {
    const text = item.content.trim();
    return text.length > 90 ? `${text.slice(0, 87)}...` : text;
  }
  if (item.kind === "artifact") return `${item.name} (${item.type})`;
  return item.name;
}

function crystallizedSourceLabel(suggestion: Pick<CrystallizedSuggestion, "sourceType">): string {
  switch (suggestion.sourceType) {
    case "capture": return "capture";
    case "returned_agent_output": return "agent result";
    case "user_note": return "user note";
    case "handoff": return "handoff";
  }
}

function crystallizedMemoryUpdatedLabel(item: AcceptedCrystallizedSuggestion): string {
  const timestamp = item.updatedAt ?? item.createdAt;
  return timestamp ? timeAgo(timestamp) : "saved";
}

function canApplyCrystallizedSuggestion(suggestion: CrystallizedSuggestion): boolean {
  return Boolean(suggestion.text.trim());
}

function crystallizedApplyLabel(suggestion: CrystallizedSuggestion): string {
  switch (suggestion.kind) {
    case "decision": return suggestion.sourceType === "capture" && suggestion.sourceId ? "Pin decision" : "Accept";
    case "constraint": return "Add constraint";
    case "do_not_do": return "Add to Do Not Do";
    case "current_task":
    case "open_action":
      return "Create action";
    case "acceptance_criterion": return "Add criterion";
    case "agent_warning": return "Add warning";
    case "handoff_note": return "Add note";
  }
}

export function ProjectPulse({
  project,
  allObjects,
  activity,
  healthScore,
  projects,
  onOpenCanvas,
  onOpenList,
  onCapture,
  onSelectItem,
  onMoveCapture,
  onArchiveCapture,
  onUpdateCapture,
  onCreateProjectFromCapture,
  onMergeProject,
  emphasizeAgentSection = false,
}: Props) {
  const agentPanelRef = useRef<HTMLElement | null>(null);
  const [generating, setGenerating] = useState(false);
  const [packetBusy, setPacketBusy] = useState(false);
  const [targetTool, setTargetTool] = useState<TargetTool | "Auto">("Auto");
  const [latestPacket, setLatestPacket] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [handoffDrafts, setHandoffDrafts] = useState<Record<string, { returnedAgentOutput: string; userNotes: string }>>({});
  const [showCrystallizedSuggestions, setShowCrystallizedSuggestions] = useState(false);
  const [dismissedCrystallizedSuggestionIds, setDismissedCrystallizedSuggestionIds] = useState<string[]>([]);
  const memory = useQuery(
    (api as any).projectMemories.getForProject,
    { projectId: project.id as Id<"objects"> }
  ) as ProjectMemory | null | undefined;
  const agentEvents = useQuery(
    (api as any).agentEvents.listForProject,
    { projectId: project.id as Id<"objects">, limit: 5 }
  ) as AgentEvent[] | undefined;
  const handoffs = useQuery(
    (api as any).handoffs.listForProject,
    { projectId: project.id as Id<"objects">, limit: 6 }
  ) as Handoff[] | undefined;
  const projectActions = useQuery(
    (api as any).actions.listForProject,
    { projectId: project.id as Id<"objects"> }
  ) as ProjectAction[] | undefined;
  useEffect(() => {
    if (!emphasizeAgentSection) return;
    agentPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [emphasizeAgentSection, project.id]);

  const updateNextActionStatus = useMutation((api as any).projectMemories.updateNextActionStatus);
  const dismissAgentEvent = useMutation((api as any).agentEvents.dismiss);
  const markAgentEventReviewed = useMutation((api as any).agentEvents.markReviewed);
  const saveAgentEventAsNote = useMutation((api as any).agentEvents.saveAsNote);
  const createActionFromAgentSuggestion = useMutation((api as any).actions.createFromAgentSuggestion);
  const createActionFromMemoryAction = useMutation((api as any).actions.createFromMemoryAction);
  const createAction = useMutation((api as any).actions.create);
  const updateActionStatus = useMutation((api as any).actions.updateStatus);
  const updateManualMemory = useMutation((api as any).projectMemories.updateManual);
  const createHandoff = useMutation((api as any).handoffs.create);
  const updateHandoffStatus = useMutation((api as any).handoffs.updateStatus);
  const updateHandoffNotes = useMutation((api as any).handoffs.updateNotes);

  const model = useMemo(
    () => buildProjectPulseModel({ project, allObjects, activity, memories: memory ? [memory] : [] }),
    [project, allObjects, activity, memory]
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
  const crystallizedSuggestions = useMemo(
    () => suggestCrystallizedUpdates({
      captures: model.latestCaptures,
      handoffs: handoffs ?? [],
      existingMemory: model.memory,
      existingActions: actionQueue,
      limits: { maxSuggestions: 8, maxSourceLength: 220 },
    }),
    [actionQueue, handoffs, model.latestCaptures, model.memory]
  );
  const visibleCrystallizedSuggestions = useMemo(
    () => crystallizedSuggestions.filter((suggestion) => !dismissedCrystallizedSuggestionIds.includes(suggestion.id)),
    [crystallizedSuggestions, dismissedCrystallizedSuggestionIds]
  );
  const crystallizedMemoryGroups = useMemo(() => {
    const accepted = model.memory?.acceptedCrystallizedSuggestions ?? [];
    return CRYSTALLIZED_MEMORY_KIND_ORDER
      .map((kind) => ({
        kind,
        items: accepted.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.items.length > 0);
  }, [model.memory?.acceptedCrystallizedSuggestions]);
  const crystallizedMemoryTotal = model.memory?.acceptedCrystallizedSuggestions?.length ?? 0;
  const activeCrystallizedMemoryTotal = model.memory?.acceptedCrystallizedSuggestions
    ?.filter((item) => acceptedCrystallizedSuggestionStatus(item) === "active").length ?? 0;
  const otherProjects = useMemo(
    () => projects.filter((candidate) => candidate.id !== project.id),
    [project.id, projects]
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

  const dismissCrystallizedSuggestion = (suggestionId: string) => {
    setDismissedCrystallizedSuggestionIds((ids) => ids.includes(suggestionId) ? ids : [...ids, suggestionId]);
  };

  const handleCopyCrystallizedSuggestion = async (suggestion: CrystallizedSuggestion) => {
    try {
      await navigator.clipboard.writeText(`${CRYSTALLIZED_KIND_LABELS[suggestion.kind]}: ${suggestion.text}`);
      toast.success("Suggestion copied");
    } catch (err) {
      console.error("[ProjectPulse] copy crystallized suggestion", err);
      toast.error("Could not copy suggestion");
    }
  };

  const handleApplyCrystallizedSuggestion = async (suggestion: CrystallizedSuggestion) => {
    try {
      if (suggestion.kind === "open_action" || suggestion.kind === "current_task") {
        const duplicate = findDuplicateAction(actionQueue, suggestion.text);
        if (duplicate) {
          dismissCrystallizedSuggestion(suggestion.id);
          toast.success("Action already exists");
          return;
        }

        const now = Date.now();
        await createAction({
          projectId: project.id as Id<"objects">,
          title: suggestion.text,
          status: "suggested",
          sourceType: "manual",
          sourceId: suggestion.sourceId ?? suggestion.id,
          rationale: `Crystallized from ${crystallizedSourceLabel(suggestion)}${suggestion.sourceId ? ` ${suggestion.sourceId}` : ""}; suggestion ${suggestion.id}.`,
          createdAt: now,
        });
        dismissCrystallizedSuggestion(suggestion.id);
        toast.success("Saved as action");
        return;
      }

      if (suggestion.kind === "decision" && suggestion.sourceType === "capture" && suggestion.sourceId) {
        await onUpdateCapture(suggestion.sourceId, { pinnedAsDecision: true, captureType: "decision" });
        dismissCrystallizedSuggestion(suggestion.id);
        toast.success("Pinned as decision");
        return;
      }

      if (!model.memory) {
        toast.error("Generate memory before saving this suggestion");
        return;
      }

      const now = Date.now();
      const patch = buildAcceptedCrystallizedMemoryPatch({
        memory: model.memory,
        suggestion,
        acceptedAt: now,
      });
      if (!Object.keys(patch).length) {
        dismissCrystallizedSuggestion(suggestion.id);
        toast.success("Already saved");
        return;
      }

      await updateManualMemory({
        projectId: project.id as Id<"objects">,
        updatedAt: now,
        ...patch,
      });
      dismissCrystallizedSuggestion(suggestion.id);
      toast.success("Saved to memory");
    } catch (err) {
      console.error("[ProjectPulse] apply crystallized suggestion", err);
      toast.error("Could not apply suggestion");
    }
  };

  const handleCrystallizedMemoryStatus = async (
    item: AcceptedCrystallizedSuggestion,
    status: AcceptedCrystallizedSuggestionStatus
  ) => {
    if (!model.memory) return;
    try {
      const now = Date.now();
      const patch = buildCrystallizedMemoryStatusPatch({
        memory: model.memory,
        target: item,
        status,
        updatedAt: now,
      });
      if (!Object.keys(patch).length) return;
      await updateManualMemory({
        projectId: project.id as Id<"objects">,
        updatedAt: now,
        ...patch,
      });
      toast.success(status === "active" ? "Memory restored" : status === "stale" ? "Memory marked stale" : "Memory excluded");
    } catch (err) {
      console.error("[ProjectPulse] update crystallized memory", err);
      toast.error("Could not update memory");
    }
  };

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
        targetTool: targetTool === "Auto" ? undefined : targetTool,
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

  const handleCopyHandoff = async (handoff: Handoff) => {
    try {
      await navigator.clipboard.writeText(handoff.packetContent);
      toast.success("Builder Brief copied");
    } catch (err) {
      console.error("[ProjectPulse] copy handoff", err);
      toast.error(BUILDER_BRIEF_COPY_ERROR_TOAST);
    }
  };

  const handleHandoffStatus = async (handoff: Handoff, status: Handoff["status"]) => {
    try {
      await updateHandoffStatus({ handoffId: handoff.id as Id<"handoffs">, status });
      toast.success("Builder Brief updated");
    } catch (err) {
      console.error("[ProjectPulse] update handoff", err);
      toast.error("Could not update Builder Brief");
    }
  };

  const handoffDraft = (handoff: Handoff) => handoffDrafts[handoff.id] ?? {
    returnedAgentOutput: handoff.returnedAgentOutput ?? "",
    userNotes: handoff.userNotes ?? "",
  };

  const handleHandoffDraft = (
    handoff: Handoff,
    patch: Partial<{ returnedAgentOutput: string; userNotes: string }>
  ) => {
    setHandoffDrafts((drafts) => ({
      ...drafts,
      [handoff.id]: { ...handoffDraft(handoff), ...patch },
    }));
  };

  const handleSaveHandoffResult = async (handoff: Handoff) => {
    const result = buildHandoffResultUpdate(handoff, handoffDraft(handoff));
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    try {
      await updateHandoffNotes({
        handoffId: result.args.handoffId as Id<"handoffs">,
        returnedAgentOutput: result.args.returnedAgentOutput,
        userNotes: result.args.userNotes,
      });
      setHandoffDrafts((drafts) => ({
        ...drafts,
        [handoff.id]: {
          returnedAgentOutput: result.args.returnedAgentOutput ?? "",
          userNotes: result.args.userNotes ?? "",
        },
      }));
      toast.success("Agent result saved");
    } catch (err) {
      console.error("[ProjectPulse] save handoff result", err);
      toast.error("Could not save agent result");
    }
  };

  const handleCapturePatch = async (item: AnyObject, patch: Partial<AnyObject>, message: string) => {
    try {
      await onUpdateCapture(item.id, patch);
      toast.success(message);
    } catch (err) {
      console.error("[ProjectPulse] update capture", err);
      toast.error("Could not update capture");
    }
  };

  const handleConvertCaptureToTask = async (item: AnyObject) => {
    try {
      const now = Date.now();
      await createAction({
        projectId: project.id as Id<"objects">,
        title: captureSummary(item),
        status: "suggested",
        sourceType: "manual",
        sourceId: item.id,
        rationale: "Converted from a project capture.",
        createdAt: now,
      });
      await onUpdateCapture(item.id, { convertedToTask: true, captureType: "task" });
      toast.success("Capture converted to task");
    } catch (err) {
      console.error("[ProjectPulse] convert capture", err);
      toast.error("Could not convert capture");
    }
  };

  const handleSplitCapture = async (item: AnyObject) => {
    const projectName = window.prompt("New project name");
    if (!projectName?.trim()) return;
    try {
      await onCreateProjectFromCapture(item.id, projectName.trim());
      toast.success("Capture moved to new project");
    } catch (err) {
      console.error("[ProjectPulse] split capture", err);
      toast.error("Could not split capture");
    }
  };

  const handleMergeProject = async () => {
    if (!mergeTarget) return;
    const target = projects.find((candidate) => candidate.id === mergeTarget);
    if (!target) return;
    const ok = window.confirm(`Move this project's captures into "${target.name}" and archive this project?`);
    if (!ok) return;
    try {
      await onMergeProject(mergeTarget);
      toast.success(`Merged into ${target.name}`);
    } catch (err) {
      console.error("[ProjectPulse] merge project", err);
      toast.error("Could not merge project");
    }
  };

  return (
    <section
      className={`project-pulse${emphasizeAgentSection ? " project-pulse--emphasize-agent" : ""}`}
    >
      <header className="project-pulse-hero">
        <div>
          <p className="project-pulse-kicker">Project Pulse</p>
          <h1>{project.name}</h1>
          <p className="project-pulse-summary">
            Stay single-threaded. {model.memory?.currentDirection || project.description || "Capture a few fragments to build memory around this project."}
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
          <button type="button" className="project-pulse-btn" disabled={packetBusy} onClick={() => void handleGenerateHandoff()}>
            {packetBusy ? "Preparing..." : BUILDER_BRIEF_COPY_LABEL}
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
            <h2>Project Memory</h2>
            <span className={`project-pulse-status project-pulse-status--${memoryStatus}`}>
              {memoryStatusLabel(memoryStatus)}
            </span>
          </div>
          {model.memory?.summary ? (
            <div className="project-memory-stack">
              <p className="project-pulse-memory-text">{model.memory.summary}</p>
              <dl className="project-memory-fields">
                <div>
                  <dt>Current goal</dt>
                  <dd>{model.memory.currentGoal || project.description || "Not set yet."}</dd>
                </div>
                <div>
                  <dt>Current direction</dt>
                  <dd>{model.memory.currentDirection || "Not set yet."}</dd>
                </div>
              </dl>
            </div>
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
          {otherProjects.length > 0 ? (
            <div className="project-merge-control">
              <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">Merge into...</option>
                {otherProjects.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
              <button type="button" className="project-pulse-inline-btn" disabled={!mergeTarget} onClick={() => void handleMergeProject()}>
                Merge
              </button>
            </div>
          ) : null}
        </section>

        <section className="project-pulse-panel project-pulse-panel--next">
          <div className="project-pulse-panel-head">
            <h2>Next Move</h2>
          </div>
          {model.primaryNextAction ? (
            <>
              <p className="project-pulse-next-title">{model.primaryNextAction.title}</p>
              <p className="project-pulse-next-body">{model.primaryNextAction.rationale}</p>
              <div className="next-action-meta">
                <span>Tool: {model.primaryNextAction.suggestedTargetTool ?? "Auto"}</span>
                <span>Confidence: {typeof model.primaryNextAction.confidence === "number" ? `${Math.round(model.primaryNextAction.confidence * 100)}%` : "medium"}</span>
              </div>
              {model.primaryNextAction.requiredContext?.length ? (
                <p className="project-pulse-next-context">
                  Context: {model.primaryNextAction.requiredContext.join(", ")}
                </p>
              ) : null}
              <label className="handoff-tool-select">
                <span>Target tool</span>
                <select value={targetTool} onChange={(e) => setTargetTool(e.target.value as TargetTool | "Auto")}>
                  <option value="Auto">Auto</option>
                  {TARGET_TOOLS.map((tool) => (
                    <option key={tool} value={tool}>{tool}</option>
                  ))}
                </select>
              </label>
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
                <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" disabled={packetBusy} onClick={() => void handleGenerateHandoff()}>
                  Brief
                </button>
              </div>
            </>
          ) : (
            <p className="project-pulse-muted">Generate memory to get a concrete next move.</p>
          )}
        </section>

        <section className="project-pulse-panel project-pulse-panel--crystallize">
          <div className="project-pulse-panel-head">
            <h2>Crystallize Recent Activity</h2>
            <span>{visibleCrystallizedSuggestions.length}</span>
          </div>
          <div className="crystallize-review-head">
            <p className="project-pulse-muted">Preview only until applied.</p>
            <button
              type="button"
              className="project-pulse-inline-btn project-pulse-inline-btn--primary"
              onClick={() => setShowCrystallizedSuggestions((value) => !value)}
            >
              {showCrystallizedSuggestions ? "Hide suggestions" : "Crystallize recent activity"}
            </button>
          </div>
          {showCrystallizedSuggestions ? (
            visibleCrystallizedSuggestions.length ? (
              <div className="crystallized-suggestion-list">
                {visibleCrystallizedSuggestions.map((suggestion) => (
                  <article key={suggestion.id} className="crystallized-suggestion-row">
                    <div className="crystallized-suggestion-meta">
                      <span>{CRYSTALLIZED_KIND_LABELS[suggestion.kind]}</span>
                      <span>{crystallizedSourceLabel(suggestion)}</span>
                      {suggestion.confidence ? <span>{suggestion.confidence}</span> : null}
                    </div>
                    <p>{suggestion.text}</p>
                    <div className="project-pulse-row-actions">
                      {canApplyCrystallizedSuggestion(suggestion) ? (
                        <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" onClick={() => void handleApplyCrystallizedSuggestion(suggestion)}>
                          {crystallizedApplyLabel(suggestion)}
                        </button>
                      ) : null}
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCopyCrystallizedSuggestion(suggestion)}>
                        Copy
                      </button>
                      <button type="button" className="project-pulse-inline-btn" onClick={() => dismissCrystallizedSuggestion(suggestion.id)}>
                        Dismiss
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="project-pulse-muted crystallize-empty">No new suggestions.</p>
            )
          ) : null}
        </section>

        <section className="project-pulse-panel project-pulse-panel--crystallized-memory">
          <div className="project-pulse-panel-head">
            <h2>Crystallized Memory</h2>
            <span>{activeCrystallizedMemoryTotal}/{crystallizedMemoryTotal} active</span>
          </div>
          {crystallizedMemoryGroups.length ? (
            <div className="crystallized-memory-groups">
              {crystallizedMemoryGroups.map((group) => (
                <div key={group.kind} className="crystallized-memory-group">
                  <h3>{CRYSTALLIZED_KIND_LABELS[group.kind]}</h3>
                  <div className="crystallized-memory-list">
                    {group.items.map((item) => {
                      const status = acceptedCrystallizedSuggestionStatus(item);
                      return (
                        <article
                          key={`${item.suggestionId ?? item.sourceId ?? item.createdAt}-${item.kind}-${item.text}`}
                          className={`crystallized-memory-row is-${status}`}
                        >
                          <div className="crystallized-suggestion-meta">
                            <span>{CRYSTALLIZED_MEMORY_STATUS_LABELS[status]}</span>
                            <span>{crystallizedSourceLabel(item)}</span>
                            <span>{crystallizedMemoryUpdatedLabel(item)}</span>
                          </div>
                          <p>{item.text}</p>
                          <div className="project-pulse-row-actions">
                            {status !== "active" ? (
                              <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" onClick={() => void handleCrystallizedMemoryStatus(item, "active")}>
                                Restore
                              </button>
                            ) : null}
                            {status !== "stale" ? (
                              <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCrystallizedMemoryStatus(item, "stale")}>
                                Stale
                              </button>
                            ) : null}
                            {status !== "excluded" ? (
                              <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCrystallizedMemoryStatus(item, "excluded")}>
                                Exclude
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">No accepted crystallized memory yet.</p>
          )}
        </section>

        <section className="project-pulse-panel project-pulse-panel--handoffs">
          <div className="project-pulse-panel-head">
            <h2>Builder Brief History</h2>
            <span>{handoffs?.length ?? 0}</span>
          </div>
          {latestPacket ? (
            <details className="handoff-preview">
              <summary>Latest Builder Brief</summary>
              <textarea readOnly value={latestPacket} />
            </details>
          ) : null}
          {handoffs?.length ? (
            <div className="handoff-history-list">
              {handoffs.map((handoff) => (
                <article key={handoff.id} className={`handoff-history-row is-${handoff.status}`}>
                  <div className="agent-event-meta">
                    <span>{handoff.targetTool}</span>
                    <span>{handoff.status}</span>
                    <span>{timeAgo(handoff.generatedAt)}</span>
                  </div>
                  <h3>{handoff.requestedTask}</h3>
                  <p>{handoff.sourceCaptures.length} source captures included</p>
                  {handoff.returnedAgentOutput ? (
                    <p className="handoff-result-status">Agent result attached</p>
                  ) : null}
                  <div className="project-pulse-row-actions">
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCopyHandoff(handoff)}>
                      Copy
                    </button>
                    {handoff.status !== "used" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleHandoffStatus(handoff, "used")}>
                        Used
                      </button>
                    ) : null}
                    {handoff.status !== "completed" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleHandoffStatus(handoff, "completed")}>
                        Complete
                      </button>
                    ) : null}
                    {handoff.status !== "discarded" ? (
                      <button type="button" className="project-pulse-inline-btn" onClick={() => void handleHandoffStatus(handoff, "discarded")}>
                        Discard
                      </button>
                    ) : null}
                  </div>
                  <details className="handoff-result-editor">
                    <summary>{handoff.returnedAgentOutput ? "Edit agent result" : "Add agent result"}</summary>
                    <label>
                      <span>Returned agent output</span>
                      <textarea
                        value={handoffDraft(handoff).returnedAgentOutput}
                        placeholder="What did the builder agent do?"
                        onChange={(event) => handleHandoffDraft(handoff, { returnedAgentOutput: event.target.value })}
                      />
                    </label>
                    <label>
                      <span>User notes</span>
                      <textarea
                        value={handoffDraft(handoff).userNotes}
                        placeholder="Anything Hypher should remember for the next Builder Brief?"
                        onChange={(event) => handleHandoffDraft(handoff, { userNotes: event.target.value })}
                      />
                    </label>
                    <button type="button" className="project-pulse-inline-btn project-pulse-inline-btn--primary" onClick={() => void handleSaveHandoffResult(handoff)}>
                      Save agent result
                    </button>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p className="project-pulse-muted">No Builder Briefs copied yet.</p>
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
            <div className="project-pulse-list project-capture-list">
              {model.latestCaptures.map((item) => (
                <article key={item.id} className="project-capture-row">
                  <button type="button" className="project-pulse-list-row" onClick={() => onSelectItem(item.id)}>
                    <span>
                      <strong>{getDisplayName(item)}</strong>
                      <small>
                        {item.captureType?.replace("_", " ") ?? itemKindLabel(item)}
                        {item.pinnedAsDecision ? " / decision" : ""}
                        {item.stale ? " / stale" : ""}
                        {item.excludeFromPackets ? " / excluded" : ""}
                      </small>
                    </span>
                    <em>{timeAgo(item.modifiedAt)}</em>
                  </button>
                  <div className="capture-correction-actions">
                    <select
                      aria-label="Move capture"
                      value={item.projectId ?? ""}
                      onChange={(e) => {
                        if (e.target.value && e.target.value !== item.projectId) {
                          void onMoveCapture(item.id, e.target.value);
                        }
                      }}
                    >
                      {projects.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                      ))}
                    </select>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCapturePatch(item, { pinnedAsDecision: !item.pinnedAsDecision, captureType: "decision" }, item.pinnedAsDecision ? "Decision unpinned" : "Pinned as decision")}>
                      {item.pinnedAsDecision ? "Unpin" : "Decision"}
                    </button>
                    <button type="button" className="project-pulse-inline-btn" disabled={item.convertedToTask} onClick={() => void handleConvertCaptureToTask(item)}>
                      {item.convertedToTask ? "Task" : "Task"}
                    </button>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCapturePatch(item, { stale: !item.stale }, item.stale ? "Marked current" : "Marked stale")}>
                      {item.stale ? "Current" : "Stale"}
                    </button>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleCapturePatch(item, { excludeFromPackets: !item.excludeFromPackets }, item.excludeFromPackets ? "Included in packets" : "Excluded from packets")}>
                      {item.excludeFromPackets ? "Include" : "Exclude"}
                    </button>
                    <button type="button" className="project-pulse-inline-btn" onClick={() => void handleSplitCapture(item)}>
                      Split
                    </button>
                    <button
                      type="button"
                      className="project-pulse-inline-btn danger-text"
                      onClick={() => void onArchiveCapture(item.id).then(() => toast.success("Capture marked irrelevant")).catch(() => toast.error("Could not archive capture"))}
                    >
                      Irrelevant
                    </button>
                  </div>
                </article>
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
            <h2>Decisions & Constraints</h2>
          </div>
          {model.memory?.importantDecisions?.length || model.memory?.constraints?.length || model.latestCaptures.some((item) => item.pinnedAsDecision) ? (
            <div className="project-memory-mini">
              <div>
                <span>Decisions</span>
                <ul className="project-pulse-questions">
                  {[...(model.memory?.importantDecisions ?? []), ...model.latestCaptures.filter((item) => item.pinnedAsDecision).map(captureSummary)].slice(0, 4).map((decision) => (
                    <li key={decision}>{decision}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>Constraints</span>
                <ul className="project-pulse-questions">
                  {(model.memory?.constraints ?? []).slice(0, 4).map((constraint) => (
                    <li key={constraint}>{constraint}</li>
                  ))}
                  {!(model.memory?.constraints?.length) ? <li>No constraints recorded yet.</li> : null}
                </ul>
              </div>
            </div>
          ) : (
            <p className="project-pulse-muted">Pin captures as decisions or refresh memory to fill this in.</p>
          )}
        </section>

        <section
          ref={agentPanelRef}
          className="project-pulse-panel project-pulse-panel--agent"
        >
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
              No agent updates yet. When OpenClaw, Hermes, or another agent works on this project, its handoff notes will appear here for review.
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
