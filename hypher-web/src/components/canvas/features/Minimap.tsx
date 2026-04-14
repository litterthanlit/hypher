"use client";

import { useCallback, useRef } from "react";
import type { AnyObject } from "@/types";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface MinimapProps {
  items: AnyObject[];
  transform: Transform;
  containerWidth: number;
  containerHeight: number;
  onPanTo: (x: number, y: number) => void;
  visible: boolean;
}

const MINIMAP_W = 160;
const MINIMAP_H = 120;
const PADDING = 48;

const DOT_COLORS: Record<string, string> = {
  project: "var(--accent)",
  note: "#5b9bd5",
  artifact: "#d4a853",
};

export function Minimap({ items, transform, containerWidth, containerHeight, onPanTo, visible }: MinimapProps) {
  const dragging = useRef(false);

  if (!visible || items.length < 5) return null;

  // Compute bounding box of all items
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    if (!item.canvasPosition) continue;
    const { x, y } = item.canvasPosition;
    const w = item.canvasSize?.w ?? 224;
    const h = 120;
    if (x - w / 2 < minX) minX = x - w / 2;
    if (y - h / 2 < minY) minY = y - h / 2;
    if (x + w / 2 > maxX) maxX = x + w / 2;
    if (y + h / 2 > maxY) maxY = y + h / 2;
  }

  if (!isFinite(minX)) return null;

  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  // Viewport rectangle in minimap coordinates
  const vpLeft = (-transform.x / transform.k - minX) * scale;
  const vpTop = (-transform.y / transform.k - minY) * scale;
  const vpWidth = (containerWidth / transform.k) * scale;
  const vpHeight = (containerHeight / transform.k) * scale;

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).closest(".minimap")?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onPanTo(canvasX, canvasY);
  }, [scale, minX, minY, onPanTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".minimap-viewport")) {
      dragging.current = true;
      e.stopPropagation();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const rect = (e.target as HTMLElement).closest(".minimap")?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onPanTo(canvasX, canvasY);
  }, [scale, minX, minY, onPanTo]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="minimap"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {items.map((item) => {
          if (!item.canvasPosition) return null;
          const cx = (item.canvasPosition.x - minX) * scale;
          const cy = (item.canvasPosition.y - minY) * scale;
          return (
            <circle
              key={item.id}
              cx={cx}
              cy={cy}
              r={3}
              fill={DOT_COLORS[item.kind] ?? "#999"}
            />
          );
        })}
        <rect
          className="minimap-viewport"
          x={vpLeft}
          y={vpTop}
          width={Math.max(vpWidth, 4)}
          height={Math.max(vpHeight, 4)}
          fill="rgba(0, 122, 255, 0.08)"
          stroke="var(--accent)"
          strokeWidth={1}
          rx={2}
        />
      </svg>
    </div>
  );
}
