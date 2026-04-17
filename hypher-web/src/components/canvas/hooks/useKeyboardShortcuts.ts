"use client";

import { useState, useEffect } from "react";

export type CanvasMode = "select" | "pan" | "text";

interface UseKeyboardShortcutsOptions {
  /** When false (e.g. read-only public canvas), no shortcuts are registered */
  enabled?: boolean;
  selectedIds: Set<string>;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  allItemIds: string[];
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onNudge: (dx: number, dy: number) => void;
  onEnterEdit: () => void;
  editingId: string | null;
  onExitEdit: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
}

export function useKeyboardShortcuts({
  enabled = true,
  selectedIds, clearSelection, selectAll, allItemIds,
  onDeleteSelected, onDuplicateSelected, onNudge,
  onEnterEdit, editingId, onExitEdit,
  onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom,
}: UseKeyboardShortcutsOptions) {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      // Space-to-pan (always, unless typing)
      if (e.code === "Space" && !e.repeat && !isInput) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      // Escape — exit edit or clear selection
      if (e.key === "Escape") {
        if (editingId) {
          onExitEdit();
        } else {
          clearSelection();
        }
        return;
      }

      // Don't handle shortcuts when in an input
      if (isInput) return;

      // Mode switching
      if (e.key === "v" || e.key === "V") { setCanvasMode("select"); return; }
      if (e.key === "h" || e.key === "H") { setCanvasMode("pan"); return; }
      if (e.key === "t" || e.key === "T") { setCanvasMode("text"); return; }

      // Undo: Cmd+Z (without Shift)
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Redo: Cmd+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Edit selected: Cmd+E
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        onEnterEdit();
        return;
      }

      // Reset zoom: Cmd+0
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        onResetZoom?.();
        return;
      }

      // Zoom in: Cmd+=
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }

      // Zoom out: Cmd+-
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        onZoomOut?.();
        return;
      }

      // Selection shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll(allItemIds);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (selectedIds.size > 0) onDuplicateSelected();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) onDeleteSelected();
        return;
      }

      // Enter to edit (single selection only)
      if (e.key === "Enter" && selectedIds.size === 1 && !editingId) {
        onEnterEdit();
        return;
      }

      // Arrow key nudge
      const nudgeAmount = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") { e.preventDefault(); onNudge(0, -nudgeAmount); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); onNudge(0, nudgeAmount); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); onNudge(-nudgeAmount, 0); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNudge(nudgeAmount, 0); return; }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled, selectedIds, clearSelection, selectAll, allItemIds, onDeleteSelected, onDuplicateSelected, onNudge, editingId, onExitEdit, onEnterEdit, onUndo, onRedo, onZoomIn, onZoomOut, onResetZoom]);

  return { canvasMode, setCanvasMode, spaceHeld };
}
