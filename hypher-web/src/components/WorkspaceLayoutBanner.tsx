"use client";

import type { ProjectContentMode } from "@/lib/workspaceLayout";

type Props = {
  reason: string;
  mode: ProjectContentMode | "inbox" | "agent-inbox" | "dashboard";
  projectId: string | null;
  pinned: boolean;
  onDismiss: () => void;
  onPin: () => void;
};

export function WorkspaceLayoutBanner({
  reason,
  mode,
  projectId,
  pinned,
  onDismiss,
  onPin,
}: Props) {
  const pinLabel =
    projectId && (mode === "pulse" || mode === "canvas" || mode === "list")
      ? `Pin ${mode} for this project`
      : null;

  return (
    <div className="workspace-layout-banner" role="status">
      <p className="workspace-layout-banner__text">{reason}</p>
      <div className="workspace-layout-banner__actions">
        {pinLabel ? (
          <button
            type="button"
            className="workspace-layout-banner__btn workspace-layout-banner__btn--primary"
            onClick={onPin}
            disabled={pinned}
          >
            {pinned ? "Pinned" : pinLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="workspace-layout-banner__btn"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
