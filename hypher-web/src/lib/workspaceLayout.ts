import type { WorkspaceContentMode } from "./activation";

export const INBOX_BACKLOG_THRESHOLD = 5;
export const MANUAL_OVERRIDE_TTL_MS = 24 * 60 * 60 * 1000;
export const LOW_HEALTH_THRESHOLD = 60;

export type WorkspacePreset = "orient" | "think" | "triage";
export type ProjectContentMode = "pulse" | "canvas" | "list";

export interface WorkspaceSignals {
  inboxCount: number;
  agentInboxCount: number;
  activationIncomplete: boolean;
  projectHealthScore: number | null;
  memoryStale: boolean;
  hasSelectedProject: boolean;
}

export interface ProjectWorkspacePrefs {
  pinnedMode: ProjectContentMode | null;
  lastManualMode: ProjectContentMode | null;
  lastManualAt: number | null;
}

export interface WorkspaceLayoutInput {
  signals: WorkspaceSignals;
  globalDefaultMode: ProjectContentMode;
  projectPrefs: ProjectWorkspacePrefs | null;
  now: number;
}

export interface WorkspaceLayoutResult {
  preset: WorkspacePreset;
  contentMode: WorkspaceContentMode;
  reason: string | null;
  autoSwitched: boolean;
  emphasizeAgentSection: boolean;
}

export function modeToPreset(mode: ProjectContentMode): WorkspacePreset {
  switch (mode) {
    case "canvas":
      return "think";
    case "list":
      return "triage";
    default:
      return "orient";
  }
}

function hasHighSeveritySignal(signals: WorkspaceSignals): boolean {
  return (
    signals.inboxCount >= INBOX_BACKLOG_THRESHOLD ||
    signals.agentInboxCount > 0
  );
}

function projectResult(
  mode: ProjectContentMode,
  options: {
    reason?: string | null;
    autoSwitched?: boolean;
    emphasizeAgentSection?: boolean;
  } = {}
): WorkspaceLayoutResult {
  return {
    preset: modeToPreset(mode),
    contentMode: mode,
    reason: options.reason ?? null,
    autoSwitched: options.autoSwitched ?? false,
    emphasizeAgentSection: options.emphasizeAgentSection ?? false,
  };
}

function workspaceResult(
  contentMode: WorkspaceContentMode,
  preset: WorkspacePreset,
  options: {
    reason?: string | null;
    autoSwitched?: boolean;
    emphasizeAgentSection?: boolean;
  } = {}
): WorkspaceLayoutResult {
  return {
    preset,
    contentMode,
    reason: options.reason ?? null,
    autoSwitched: options.autoSwitched ?? false,
    emphasizeAgentSection: options.emphasizeAgentSection ?? false,
  };
}

/** Pure layout router — no side effects. */
export function resolveWorkspaceLayout(input: WorkspaceLayoutInput): WorkspaceLayoutResult {
  const { signals, globalDefaultMode, projectPrefs, now } = input;
  const highSeverity = hasHighSeveritySignal(signals);

  if (projectPrefs?.pinnedMode) {
    return projectResult(projectPrefs.pinnedMode);
  }

  if (signals.hasSelectedProject) {
    if (signals.activationIncomplete) {
      return projectResult("pulse");
    }

    if (
      projectPrefs?.lastManualMode &&
      projectPrefs.lastManualAt != null &&
      !highSeverity
    ) {
      const age = now - projectPrefs.lastManualAt;
      if (age < MANUAL_OVERRIDE_TTL_MS) {
        return projectResult(projectPrefs.lastManualMode);
      }
    }

    if (signals.agentInboxCount > 0) {
      return projectResult("pulse", {
        reason: `${signals.agentInboxCount} agent update${signals.agentInboxCount === 1 ? "" : "s"} need review`,
        autoSwitched: true,
        emphasizeAgentSection: true,
      });
    }

    if (signals.inboxCount >= INBOX_BACKLOG_THRESHOLD) {
      return projectResult("list", {
        reason: `${signals.inboxCount} unsorted captures — triage from list or inbox`,
        autoSwitched: true,
      });
    }

    if (
      signals.projectHealthScore != null &&
      signals.projectHealthScore < LOW_HEALTH_THRESHOLD
    ) {
      return projectResult("pulse", {
        reason: "Project health is low — review pulse first",
        autoSwitched: true,
      });
    }

    if (signals.memoryStale) {
      return projectResult("pulse", {
        reason: "Project memory may be stale — review pulse",
        autoSwitched: true,
      });
    }

    return projectResult(globalDefaultMode);
  }

  if (signals.activationIncomplete) {
    return workspaceResult("dashboard", "orient");
  }

  if (signals.agentInboxCount > 0) {
    return workspaceResult("agent-inbox", "orient", {
      reason: `${signals.agentInboxCount} agent update${signals.agentInboxCount === 1 ? "" : "s"} need review`,
      autoSwitched: true,
      emphasizeAgentSection: true,
    });
  }

  if (signals.inboxCount >= INBOX_BACKLOG_THRESHOLD) {
    return workspaceResult("inbox", "triage", {
      reason: `${signals.inboxCount} unsorted captures in inbox`,
      autoSwitched: true,
    });
  }

  return workspaceResult("dashboard", "orient");
}

export function isProjectContentMode(mode: WorkspaceContentMode): mode is ProjectContentMode {
  return mode === "pulse" || mode === "canvas" || mode === "list";
}
