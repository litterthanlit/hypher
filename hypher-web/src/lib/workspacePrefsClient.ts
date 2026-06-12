import type { ProjectContentMode } from "./workspaceLayout";

export const VIEW_MODE_STORAGE_PREFIX = "hypher-view-mode-";
export const WORKSPACE_PREFS_MIGRATED_KEY = "hypher-workspace-prefs-migrated";

export function readLocalViewMode(projectId: string): ProjectContentMode | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(`${VIEW_MODE_STORAGE_PREFIX}${projectId}`);
  if (saved === "pulse" || saved === "canvas" || saved === "list") return saved;
  return null;
}

export function writeLocalViewMode(projectId: string, mode: ProjectContentMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${VIEW_MODE_STORAGE_PREFIX}${projectId}`, mode);
}

export function collectLocalViewModes(): Array<{ projectId: string; mode: ProjectContentMode }> {
  if (typeof window === "undefined") return [];
  const entries: Array<{ projectId: string; mode: ProjectContentMode }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(VIEW_MODE_STORAGE_PREFIX)) continue;
    const mode = localStorage.getItem(key);
    if (mode !== "pulse" && mode !== "canvas" && mode !== "list") continue;
    entries.push({
      projectId: key.slice(VIEW_MODE_STORAGE_PREFIX.length),
      mode,
    });
  }
  return entries;
}

export function hasMigratedWorkspacePrefs(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(WORKSPACE_PREFS_MIGRATED_KEY) === "true";
}

export function markWorkspacePrefsMigrated(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACE_PREFS_MIGRATED_KEY, "true");
}
