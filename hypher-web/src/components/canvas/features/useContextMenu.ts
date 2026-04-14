import { useState, useCallback, useEffect } from "react";

export interface MenuPosition {
  x: number;
  y: number;
}

export type MenuTarget =
  | { type: "card"; id: string }
  | { type: "canvas"; canvasX: number; canvasY: number };

interface ContextMenuState {
  position: MenuPosition;
  target: MenuTarget;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openCardMenu = useCallback((e: React.MouseEvent, id: string, containerRect: DOMRect) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      position: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top },
      target: { type: "card", id },
    });
  }, []);

  const openCanvasMenu = useCallback((e: React.MouseEvent, canvasX: number, canvasY: number, containerRect: DOMRect) => {
    e.preventDefault();
    setMenu({
      position: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top },
      target: { type: "canvas", canvasX, canvasY },
    });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  // Close on any click or scroll
  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    window.addEventListener("mousedown", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [menu]);

  return { menu, openCardMenu, openCanvasMenu, close };
}
