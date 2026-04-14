"use client";

import { useState, useCallback } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseRubberBandOptions {
  onSelectIds: (ids: string[]) => void;
  getCardRects: () => Map<string, Rect>;
}

export function useRubberBand({ onSelectIds, getCardRects }: UseRubberBandOptions) {
  const [band, setBand] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  const startBand = useCallback((e: React.MouseEvent) => {
    setBand({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  }, []);

  const moveBand = useCallback((e: React.MouseEvent) => {
    if (!band) return;
    setBand((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
  }, [band]);

  const endBand = useCallback(() => {
    if (!band) return;
    const rect: Rect = {
      x: Math.min(band.startX, band.currentX),
      y: Math.min(band.startY, band.currentY),
      w: Math.abs(band.currentX - band.startX),
      h: Math.abs(band.currentY - band.startY),
    };

    if (rect.w > 5 || rect.h > 5) {
      const cardRects = getCardRects();
      const intersecting: string[] = [];
      for (const [id, cr] of cardRects) {
        if (
          rect.x < cr.x + cr.w &&
          rect.x + rect.w > cr.x &&
          rect.y < cr.y + cr.h &&
          rect.y + rect.h > cr.y
        ) {
          intersecting.push(id);
        }
      }
      onSelectIds(intersecting);
    }

    setBand(null);
  }, [band, onSelectIds, getCardRects]);

  const getBandRect = useCallback((containerRect: DOMRect) => {
    if (!band) return null;
    return {
      left: Math.min(band.startX, band.currentX) - containerRect.left,
      top: Math.min(band.startY, band.currentY) - containerRect.top,
      width: Math.abs(band.currentX - band.startX),
      height: Math.abs(band.currentY - band.startY),
    };
  }, [band]);

  return {
    isActive: band !== null,
    startBand,
    moveBand,
    endBand,
    getBandRect,
  };
}
