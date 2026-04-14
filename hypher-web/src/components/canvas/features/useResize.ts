"use client";

import { useState, useCallback, useRef } from "react";
import type { ObjectKind } from "@/types";

type HandlePos = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ResizeConfig {
  handles: HandlePos[];
  preserveAspect: boolean;
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  autoHeight: boolean;
}

export const RESIZE_CONFIG: Record<ObjectKind, ResizeConfig> = {
  note: {
    handles: ["e", "w"],
    preserveAspect: false,
    minSize: { w: 120, h: 60 },
    maxSize: { w: 800, h: 800 },
    autoHeight: true,
  },
  project: {
    handles: ["e", "w", "se", "sw"],
    preserveAspect: false,
    minSize: { w: 180, h: 100 },
    maxSize: { w: 800, h: 800 },
    autoHeight: false,
  },
  artifact: {
    handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
    preserveAspect: true,
    minSize: { w: 80, h: 80 },
    maxSize: { w: 800, h: 800 },
    autoHeight: false,
  },
};

interface ResizingState {
  id: string;
  handle: HandlePos;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startPosX: number;
  startPosY: number;
  config: ResizeConfig;
}

interface UseResizeOptions {
  zoomLevel: number;
  onUpdateSize: (id: string, w: number, h: number) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

export function useResize({ zoomLevel, onUpdateSize, onUpdatePosition }: UseResizeOptions) {
  const [resizing, setResizing] = useState<ResizingState | null>(null);
  const sizeOverride = useRef<{ w: number; h: number } | null>(null);

  const startResize = useCallback((
    e: React.MouseEvent,
    handle: HandlePos,
    objId: string,
    kind: ObjectKind,
    currentW: number,
    currentH: number,
    posX: number,
    posY: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const config = RESIZE_CONFIG[kind];
    setResizing({
      id: objId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentW,
      startH: currentH,
      startPosX: posX,
      startPosY: posY,
      config,
    });
  }, []);

  const onResizeMove = useCallback((e: React.MouseEvent) => {
    if (!resizing) return;
    const dx = (e.clientX - resizing.startX) / zoomLevel;
    const dy = (e.clientY - resizing.startY) / zoomLevel;
    const { handle, startW, startH, startPosX, startPosY, config } = resizing;
    const shiftHeld = e.shiftKey;

    let newW = startW;
    let newH = startH;
    let newX = startPosX;
    let newY = startPosY;

    if (handle.includes("e")) newW = startW + dx;
    if (handle.includes("w")) { newW = startW - dx; newX = startPosX + dx; }
    if (handle.includes("s")) newH = startH + dy;
    if (handle.includes("n")) { newH = startH - dy; newY = startPosY + dy; }

    // Aspect ratio lock (for artifacts, unless Shift to free-resize)
    if (config.preserveAspect && !shiftHeld && startH > 0) {
      const ratio = startW / startH;
      if (handle === "e" || handle === "w") {
        newH = newW / ratio;
      } else if (handle === "n" || handle === "s") {
        newW = newH * ratio;
      } else {
        const dw = Math.abs(newW - startW);
        const dh = Math.abs(newH - startH);
        if (dw > dh) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
    }

    newW = Math.max(config.minSize.w, Math.min(config.maxSize.w, newW));
    newH = Math.max(config.minSize.h, Math.min(config.maxSize.h, newH));

    const el = document.getElementById(`card-${resizing.id}`);
    if (el) {
      el.style.width = `${newW}px`;
      if (!config.autoHeight) el.style.height = `${newH}px`;
      el.style.transform = `translate(${newX}px, ${newY}px)`;
      el.style.marginLeft = `${-newW / 2}px`;
    }

    sizeOverride.current = { w: newW, h: newH };
  }, [resizing, zoomLevel]);

  const endResize = useCallback(() => {
    if (!resizing || !sizeOverride.current) { setResizing(null); return; }

    const el = document.getElementById(`card-${resizing.id}`);
    if (el) {
      const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      if (match) {
        onUpdatePosition(resizing.id, parseFloat(match[1]!), parseFloat(match[2]!));
      }
    }
    onUpdateSize(resizing.id, sizeOverride.current.w, sizeOverride.current.h);

    setResizing(null);
    sizeOverride.current = null;
  }, [resizing, onUpdateSize, onUpdatePosition]);

  return {
    resizing,
    startResize,
    onResizeMove,
    endResize,
  };
}
