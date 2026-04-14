"use client";

import { useMemo, useCallback, useRef } from "react";

interface CardRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  axis: "x" | "y";
  position: number;
}

interface SnapResult {
  guides: SnapGuide[];
  snapDx: number;
  snapDy: number;
}

const CELL_SIZE = 100;

function buildSpatialGrid(rects: CardRect[]): Map<string, string[]> {
  const grid = new Map<string, string[]>();
  for (const r of rects) {
    const x0 = Math.floor(r.x / CELL_SIZE);
    const y0 = Math.floor(r.y / CELL_SIZE);
    const x1 = Math.floor((r.x + r.w) / CELL_SIZE);
    const y1 = Math.floor((r.y + r.h) / CELL_SIZE);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = `${cx},${cy}`;
        const arr = grid.get(key) ?? [];
        arr.push(r.id);
        grid.set(key, arr);
      }
    }
  }
  return grid;
}

function getNearbyIds(grid: Map<string, string[]>, rect: CardRect, exclude: Set<string>): Set<string> {
  const ids = new Set<string>();
  const buffer = 2;
  const x0 = Math.floor(rect.x / CELL_SIZE) - buffer;
  const y0 = Math.floor(rect.y / CELL_SIZE) - buffer;
  const x1 = Math.floor((rect.x + rect.w) / CELL_SIZE) + buffer;
  const y1 = Math.floor((rect.y + rect.h) / CELL_SIZE) + buffer;
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const arr = grid.get(`${cx},${cy}`);
      if (arr) for (const id of arr) if (!exclude.has(id)) ids.add(id);
    }
  }
  return ids;
}

export function useSnapGuides(allRects: CardRect[], selectedIds: Set<string>, threshold: number) {
  const grid = useMemo(() => {
    const nonSelected = allRects.filter((r) => !selectedIds.has(r.id));
    return buildSpatialGrid(nonSelected);
  }, [allRects, selectedIds]);

  const rectsMap = useMemo(() => {
    const map = new Map<string, CardRect>();
    for (const r of allRects) map.set(r.id, r);
    return map;
  }, [allRects]);

  const lastCompute = useRef(0);

  const computeSnap = useCallback((dragRect: CardRect): SnapResult => {
    const now = performance.now();
    if (now - lastCompute.current < 33) return { guides: [], snapDx: 0, snapDy: 0 };
    lastCompute.current = now;

    const nearbyIds = getNearbyIds(grid, dragRect, selectedIds);
    let bestXDist = threshold + 1;
    let bestYDist = threshold + 1;
    let snapDx = 0;
    let snapDy = 0;
    let bestXGuide: SnapGuide | null = null;
    let bestYGuide: SnapGuide | null = null;

    const dragCx = dragRect.x + dragRect.w / 2;
    const dragCy = dragRect.y + dragRect.h / 2;
    const dragR = dragRect.x + dragRect.w;
    const dragB = dragRect.y + dragRect.h;

    for (const id of nearbyIds) {
      const r = rectsMap.get(id);
      if (!r) continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rr = r.x + r.w;
      const rb = r.y + r.h;

      // X-axis
      const xChecks = [
        { dragVal: dragRect.x, targetVal: r.x },
        { dragVal: dragR, targetVal: rr },
        { dragVal: dragCx, targetVal: cx },
        { dragVal: dragRect.x, targetVal: rr },
        { dragVal: dragR, targetVal: r.x },
      ];
      for (const { dragVal, targetVal } of xChecks) {
        const dist = Math.abs(dragVal - targetVal);
        if (dist < bestXDist) {
          bestXDist = dist;
          snapDx = targetVal - dragVal;
          bestXGuide = { axis: "x", position: targetVal };
        }
      }

      // Y-axis
      const yChecks = [
        { dragVal: dragRect.y, targetVal: r.y },
        { dragVal: dragB, targetVal: rb },
        { dragVal: dragCy, targetVal: cy },
        { dragVal: dragRect.y, targetVal: rb },
        { dragVal: dragB, targetVal: r.y },
      ];
      for (const { dragVal, targetVal } of yChecks) {
        const dist = Math.abs(dragVal - targetVal);
        if (dist < bestYDist) {
          bestYDist = dist;
          snapDy = targetVal - dragVal;
          bestYGuide = { axis: "y", position: targetVal };
        }
      }
    }

    const guides: SnapGuide[] = [];
    if (bestXDist <= threshold && bestXGuide) guides.push(bestXGuide); else snapDx = 0;
    if (bestYDist <= threshold && bestYGuide) guides.push(bestYGuide); else snapDy = 0;

    return { guides, snapDx, snapDy };
  }, [grid, rectsMap, selectedIds, threshold]);

  return { computeSnap };
}
