"use client";

import { useState, useCallback, useEffect } from "react";
import { animate } from "framer-motion";

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export type CanvasBg = "dots" | "grid" | "lines" | "blank";

export function useCanvasTransform(containerRef: React.RefObject<HTMLDivElement | null>, projectId: string) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [canvasBg, setCanvasBg] = useState<CanvasBg>(() => {
    if (typeof window === "undefined") return "dots";
    return (localStorage.getItem(`hypher-canvas-bg-${projectId}`) as CanvasBg) ?? "dots";
  });

  // Center canvas on mount
  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 });
  }, [containerRef]);

  const cycleBg = useCallback(() => {
    const order: CanvasBg[] = ["dots", "grid", "lines", "blank"];
    const next = order[(order.indexOf(canvasBg) + 1) % order.length];
    setCanvasBg(next);
    localStorage.setItem(`hypher-canvas-bg-${projectId}`, next);
  }, [canvasBg, projectId]);

  const animateZoom = useCallback((newK: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const ratio = newK / transform.k;
    const targetX = cx - (cx - transform.x) * ratio;
    const targetY = cy - (cy - transform.y) * ratio;
    const startK = transform.k;
    const startX = transform.x;
    const startY = transform.y;

    animate(0, 1, {
      type: "spring",
      stiffness: 300,
      damping: 30,
      onUpdate: (t) => {
        setTransform({
          k: startK + (newK - startK) * t,
          x: startX + (targetX - startX) * t,
          y: startY + (targetY - startY) * t,
        });
      },
    });
  }, [transform, containerRef]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.ctrlKey) {
      // Trackpad pinch-to-zoom (Chrome/Firefox send ctrlKey+deltaY for pinch)
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = -e.deltaY * 0.01;
      const newK = Math.min(3, Math.max(0.15, transform.k * (1 + delta)));
      const ratio = newK / transform.k;
      setTransform({
        k: newK,
        x: mouseX - (mouseX - transform.x) * ratio,
        y: mouseY - (mouseY - transform.y) * ratio,
      });
    } else if (e.deltaMode === 0 && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0)) {
      // Pixel mode (trackpad two-finger scroll) → direct pan
      setTransform((t) => ({
        ...t,
        x: t.x - e.deltaX,
        y: t.y - e.deltaY,
      }));
    } else {
      // Line mode (mouse wheel) → zoom at cursor
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      const newK = Math.min(3, Math.max(0.15, transform.k * delta));
      const ratio = newK / transform.k;
      setTransform({
        k: newK,
        x: mouseX - (mouseX - transform.x) * ratio,
        y: mouseY - (mouseY - transform.y) * ratio,
      });
    }
  }, [transform, containerRef]);

  const screenToCanvas = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (screenX - rect.left - transform.x) / transform.k,
      y: (screenY - rect.top - transform.y) / transform.k,
    };
  }, [transform, containerRef]);

  return {
    transform,
    setTransform,
    canvasBg,
    cycleBg,
    animateZoom,
    onWheel,
    screenToCanvas,
  };
}
