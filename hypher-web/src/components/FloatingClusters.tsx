"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import type { Project, AnyObject } from "@/types";

/* ── Types ──────────────────────────────────────────────────────── */

interface ClusterDot {
  ox: number; // offset from cluster center
  oy: number;
  kind: "note" | "artifact" | "project";
  size: number; // 6-12px
}

interface Cluster {
  projectId: string;
  name: string;
  color: string;
  dots: ClusterDot[];
  cx: number; // center x (viewport %)
  cy: number; // center y (viewport %)
  seed: number;
  relevance: number;
}

interface Props {
  projects: Project[];
  allObjects: AnyObject[];
  inputText: string;
  onProjectClick: (projectId: string) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const CLUSTER_POSITIONS = [
  { x: 14, y: 18 },
  { x: 86, y: 16 },
  { x: 10, y: 76 },
  { x: 88, y: 72 },
  { x: 11, y: 48 },
  { x: 90, y: 46 },
  { x: 50, y: 12 },
  { x: 50, y: 85 },
];

const PROJECT_COLORS = [
  "#3ecf8e", "#60a5fa", "#fbbf24", "#f472b6",
  "#a78bfa", "#fb923c", "#34d399", "#38bdf8",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function projectColor(name: string): string {
  return PROJECT_COLORS[hashString(name) % PROJECT_COLORS.length];
}

function buildClusters(projects: Project[], allObjects: AnyObject[]): Cluster[] {
  return projects.slice(0, CLUSTER_POSITIONS.length).map((p, i) => {
    const items = allObjects.filter((o) => o.projectId === p.id && o.kind !== "project");
    const count = Math.min(Math.max(items.length, 3), 8);
    const seed = hashString(p.id);

    const dots: ClusterDot[] = [];
    for (let j = 0; j < count; j++) {
      const angle = (j / count) * Math.PI * 2 + (seed % 100) * 0.01;
      const radius = 10 + (hashString(p.id + j) % 20);
      dots.push({
        ox: Math.cos(angle) * radius,
        oy: Math.sin(angle) * radius,
        kind: items[j]?.kind === "artifact" ? "artifact" : "note",
        size: 6 + (hashString(p.id + j + "s") % 7),
      });
    }

    const pos = CLUSTER_POSITIONS[i];
    return {
      projectId: p.id,
      name: p.name,
      color: p.canvasColor || projectColor(p.name),
      dots,
      cx: pos.x,
      cy: pos.y,
      seed,
      relevance: 0,
    };
  });
}

/* ── Component ───────────────────────────────────────────────────── */

export function FloatingClusters({ projects, allObjects, inputText, onProjectClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 }); // normalized 0-1
  const startTime = useRef(Date.now());
  const hoveredRef = useRef<string | null>(null);
  const clusterEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const dotEls = useRef<Map<string, HTMLDivElement[]>>(new Map());
  const labelEls = useRef<Map<string, HTMLSpanElement>>(new Map());

  const clusters = useMemo(
    () => buildClusters(projects, allObjects),
    [projects, allObjects]
  );

  // Compute relevance from input text (simple name-match v1)
  const relevanceMap = useMemo(() => {
    const map = new Map<string, number>();
    const q = inputText.trim().toLowerCase();
    if (q.length < 3) return map;
    for (const c of clusters) {
      if (c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())) {
        map.set(c.projectId, 1);
      }
    }
    return map;
  }, [inputText, clusters]);

  // Track mouse for parallax
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Animation loop — mutates DOM directly via refs, no re-renders
  const animate = useCallback(() => {
    const t = (Date.now() - startTime.current) * 0.001; // seconds
    const mx = mouseRef.current.x - 0.5; // -0.5 to 0.5
    const my = mouseRef.current.y - 0.5;

    for (const cluster of clusters) {
      const el = clusterEls.current.get(cluster.projectId);
      if (!el) continue;

      const isHovered = hoveredRef.current === cluster.projectId;
      const rel = relevanceMap.get(cluster.projectId) ?? 0;

      // Sinusoidal drift
      const driftX = Math.sin(t * 0.4 + cluster.seed * 0.01) * 6;
      const driftY = Math.cos(t * 0.48 + cluster.seed * 0.01) * 6;

      // Parallax — clusters move opposite to mouse
      const parallaxX = -mx * 15;
      const parallaxY = -my * 15;

      // Relevant clusters drift toward center
      const pullX = rel > 0 ? (50 - cluster.cx) * 0.15 : 0;
      const pullY = rel > 0 ? (50 - cluster.cy) * 0.15 : 0;

      const finalX = cluster.cx + driftX + parallaxX + pullX;
      const finalY = cluster.cy + driftY + parallaxY + pullY;

      el.style.left = `${finalX}%`;
      el.style.top = `${finalY}%`;

      // Opacity & scale
      const baseOpacity = rel > 0 ? 0.4 : 0.2;
      const opacity = isHovered ? 1 : baseOpacity;
      const scale = isHovered ? 1.1 : 1;
      el.style.opacity = String(opacity);
      el.style.transform = `translate(-50%, -50%) scale(${scale})`;

      // Glow on relevant clusters
      const dots = dotEls.current.get(cluster.projectId);
      if (dots) {
        for (const dot of dots) {
          dot.style.boxShadow = rel > 0
            ? `0 0 20px ${cluster.color}4d`
            : "none";
        }
      }

      // Label visibility
      const label = labelEls.current.get(cluster.projectId);
      if (label) {
        label.style.opacity = isHovered ? "1" : "0";
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [clusters, relevanceMap]);

  // Start/stop animation loop
  useEffect(() => {
    // Respect reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // Set static positions, skip animation
      for (const cluster of clusters) {
        const el = clusterEls.current.get(cluster.projectId);
        if (el) {
          el.style.left = `${cluster.cx}%`;
          el.style.top = `${cluster.cy}%`;
          el.style.opacity = "0.2";
          el.style.transform = "translate(-50%, -50%)";
        }
      }
      return;
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate, clusters]);

  if (projects.length === 0) return null;

  return (
    <div ref={containerRef} className="floating-clusters">
      {clusters.map((cluster) => (
        <div
          key={cluster.projectId}
          ref={(el) => { if (el) clusterEls.current.set(cluster.projectId, el); }}
          className="floating-cluster"
          onMouseEnter={() => { hoveredRef.current = cluster.projectId; }}
          onMouseLeave={() => { hoveredRef.current = null; }}
          onClick={() => onProjectClick(cluster.projectId)}
        >
          {cluster.dots.map((dot, j) => (
            <div
              key={j}
              ref={(el) => {
                if (el) {
                  const arr = dotEls.current.get(cluster.projectId) || [];
                  arr[j] = el;
                  dotEls.current.set(cluster.projectId, arr);
                }
              }}
              className="floating-dot"
              style={{
                width: dot.size,
                height: dot.size,
                left: 40 + dot.ox,
                top: 40 + dot.oy,
                backgroundColor: cluster.color,
              }}
            />
          ))}
          <span
            ref={(el) => { if (el) labelEls.current.set(cluster.projectId, el); }}
            className="floating-cluster-label"
          >
            {cluster.name}
          </span>
        </div>
      ))}
    </div>
  );
}
