"use client";

import { useRef, useEffect } from "react";
import type { MenuPosition, MenuTarget } from "./useContextMenu";

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  /** When true: item is rendered greyed-out and clicks are suppressed. */
  disabled?: boolean;
}

interface MenuSeparator {
  type: "separator";
}

type MenuEntry = MenuItem | MenuSeparator;

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return "type" in entry && entry.type === "separator";
}

interface CardMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "card" };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface CanvasMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "canvas" };
  onAddNote: () => void;
  onSelectAll: () => void;
  onResetView: () => void;
  onClose: () => void;
  /** Called with canvas coordinates when the user picks "Ask about what's around me". */
  onAskAround: (canvasX: number, canvasY: number) => void;
  /** If true, the "Ask about what's around me" entry is disabled (no items in radius). */
  askAroundDisabled?: boolean;
}

export function CardContextMenu({ position, onEdit, onDuplicate, onDelete, onClose }: CardMenuProps) {
  const entries: MenuEntry[] = [
    { label: "Edit", shortcut: "Enter", onClick: onEdit },
    { label: "Duplicate", shortcut: "⌘D", onClick: onDuplicate },
    { type: "separator" },
    { label: "Delete", shortcut: "⌫", onClick: onDelete, danger: true },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}

export function CanvasContextMenu({
  position,
  target,
  onAddNote,
  onSelectAll,
  onResetView,
  onClose,
  onAskAround,
  askAroundDisabled,
}: CanvasMenuProps) {
  const entries: MenuEntry[] = [
    {
      label: "Ask about what's around me",
      onClick: () => onAskAround(target.canvasX, target.canvasY),
      disabled: askAroundDisabled,
    },
    { type: "separator" },
    { label: "Add Note", onClick: onAddNote },
    { type: "separator" },
    { label: "Select All", shortcut: "⌘A", onClick: onSelectAll },
    { type: "separator" },
    { label: "Reset View", onClick: onResetView },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}

function ContextMenuBase({
  position,
  entries,
  onClose,
}: {
  position: MenuPosition;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Prevent menu from going off-screen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const parent = el.offsetParent?.getBoundingClientRect();
    if (!parent) return;

    if (rect.right > parent.right) {
      el.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > parent.bottom) {
      el.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {entries.map((entry, i) =>
        isSeparator(entry) ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item ${entry.danger ? "danger" : ""} ${entry.disabled ? "disabled" : ""}`}
            disabled={entry.disabled}
            onClick={() => {
              if (entry.disabled) return;
              entry.onClick();
              onClose();
            }}
          >
            <span>{entry.label}</span>
            {entry.shortcut && <span className="context-menu-shortcut">{entry.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
