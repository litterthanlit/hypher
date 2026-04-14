"use client";

import { useState, useCallback, useRef } from "react";
import type { AnyObject } from "@/types";
import type { Transform } from "./useCanvasTransform";

interface DragState {
  id: string;
  startX: number;
  startY: number;
  objX: number;
  objY: number;
}

interface PanState {
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
}

interface UseDragInteractionOptions {
  transform: Transform;
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
  selectedIds: Set<string>;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  getPositionedItems: () => AnyObject[];
}

export function useDragInteraction({
  transform, setTransform, selectedIds, onUpdatePosition, getPositionedItems,
}: UseDragInteractionOptions) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const panStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const groupStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const startPan = useCallback((e: React.MouseEvent) => {
    setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y });
    panStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);
  }, [transform]);

  const startDrag = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    e.stopPropagation();
    const pos = obj.canvasPosition ?? { x: 0, y: 0 };
    setDragging({ id: obj.id, startX: e.clientX, startY: e.clientY, objX: pos.x, objY: pos.y });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);

    // Capture start positions for all selected items (group drag)
    if (selectedIds.has(obj.id) && selectedIds.size > 1) {
      const items = getPositionedItems();
      const map = new Map<string, { x: number; y: number }>();
      for (const id of selectedIds) {
        const item = items.find((i) => i.id === id);
        if (item?.canvasPosition) map.set(id, { ...item.canvasPosition });
      }
      groupStartPositions.current = map;
    } else {
      groupStartPositions.current = new Map();
    }
  }, [selectedIds, getPositionedItems]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / transform.k;
      const dy = (e.clientY - dragging.startY) / transform.k;

      // Move the dragged card
      const el = document.getElementById(`card-${dragging.id}`);
      if (el) el.style.transform = `translate(${dragging.objX + dx}px, ${dragging.objY + dy}px)`;

      // Move other selected cards (group drag)
      for (const [id, startPos] of groupStartPositions.current) {
        if (id === dragging.id) continue;
        const groupEl = document.getElementById(`card-${id}`);
        if (groupEl) groupEl.style.transform = `translate(${startPos.x + dx}px, ${startPos.y + dy}px)`;
      }

      setHasMoved(true);
      return;
    }
    if (panning) {
      setTransform((t) => ({
        ...t,
        x: panning.startTx + (e.clientX - panning.startX),
        y: panning.startTy + (e.clientY - panning.startY),
      }));
      setHasMoved(true);
    }
  }, [dragging, panning, transform.k, setTransform]);

  const onMouseUp = useCallback(() => {
    if (dragging && hasMoved) {
      // Persist dragged card position
      const el = document.getElementById(`card-${dragging.id}`);
      if (el) {
        const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        if (match) onUpdatePosition(dragging.id, parseFloat(match[1]!), parseFloat(match[2]!));
      }
      // Persist group positions
      for (const [id] of groupStartPositions.current) {
        if (id === dragging.id) continue;
        const groupEl = document.getElementById(`card-${id}`);
        if (groupEl) {
          const match = groupEl.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
          if (match) onUpdatePosition(id, parseFloat(match[1]!), parseFloat(match[2]!));
        }
      }
    }
    setDragging(null);
    setPanning(null);
    groupStartPositions.current = new Map();
  }, [dragging, hasMoved, onUpdatePosition]);

  const didMove = useCallback((e: React.MouseEvent): boolean => {
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      return Math.sqrt(dx * dx + dy * dy) >= 5;
    }
    return hasMoved;
  }, [hasMoved]);

  const didPanMove = useCallback((e: React.MouseEvent): boolean => {
    if (panStartPos.current) {
      const dx = e.clientX - panStartPos.current.x;
      const dy = e.clientY - panStartPos.current.y;
      return Math.sqrt(dx * dx + dy * dy) >= 5;
    }
    return false;
  }, []);

  return {
    dragging,
    panning,
    hasMoved,
    startPan,
    startDrag,
    onMouseMove,
    onMouseUp,
    didMove,
    didPanMove,
  };
}
