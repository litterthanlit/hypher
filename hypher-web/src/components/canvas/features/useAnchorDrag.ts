import { useState, useCallback } from "react";

interface AnchorDragState {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

interface UseAnchorDragOptions {
  onConnect: (sourceId: string, targetId: string) => void;
  zoomLevel: number;
}

export function useAnchorDrag({ onConnect, zoomLevel }: UseAnchorDragOptions) {
  const [dragState, setDragState] = useState<AnchorDragState | null>(null);

  const startAnchorDrag = useCallback((
    e: React.MouseEvent,
    sourceId: string,
    anchorX: number,
    anchorY: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      sourceId,
      sourceX: anchorX,
      sourceY: anchorY,
      currentX: anchorX,
      currentY: anchorY,
    });
  }, []);

  const onMouseMove = useCallback((clientX: number, clientY: number, containerRect: DOMRect, transformX: number, transformY: number) => {
    if (!dragState) return;
    const canvasX = (clientX - containerRect.left - transformX) / zoomLevel;
    const canvasY = (clientY - containerRect.top - transformY) / zoomLevel;
    setDragState((prev) => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
  }, [dragState, zoomLevel]);

  const endAnchorDrag = useCallback((targetId: string | null) => {
    if (dragState && targetId && targetId !== dragState.sourceId) {
      onConnect(dragState.sourceId, targetId);
    }
    setDragState(null);
  }, [dragState, onConnect]);

  const cancelAnchorDrag = useCallback(() => {
    setDragState(null);
  }, []);

  return {
    anchorDrag: dragState,
    startAnchorDrag,
    onAnchorMouseMove: onMouseMove,
    endAnchorDrag,
    cancelAnchorDrag,
    isDraggingAnchor: dragState !== null,
  };
}
