"use client";

import type { Connection } from "@/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  connection: Connection;
  position: { x: number; y: number };
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function ConnectionPopover({ connection, position, onConfirm, onDismiss, onClose }: Props) {
  return (
    <div
      className="conn-popover"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="conn-popover-header">
        <ConfidenceBadge confidence={connection.confidence} />
        <button className="conn-popover-close" onClick={onClose}>×</button>
      </div>
      {connection.reason && (
        <p className="conn-popover-reason">{connection.reason}</p>
      )}
      <div className="conn-popover-actions">
        <button className="btn-dismiss" onClick={() => { onDismiss(connection.id); onClose(); }}>
          Dismiss
        </button>
        <button className="btn-confirm" onClick={() => { onConfirm(connection.id); onClose(); }}>
          Confirm
        </button>
      </div>
    </div>
  );
}
