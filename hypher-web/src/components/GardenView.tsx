"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Project, Connection } from "@/types";
import { useCanvasTheme } from "@/lib/useTheme";

interface Props {
  projects: Project[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  seed: "#666666",
  growing: "#3ecf8e",
  active: "#0091ff",
  shipped: "#a78bfa",
  dormant: "#ffb224",
  archived: "#444444",
};

const STATUS_PULSE: Record<string, number> = {
  seed: 0.3,
  growing: 0.7,
  active: 1,
  shipped: 0.4,
  dormant: 0.15,
  archived: 0,
};

export function GardenView({ projects, connections, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number; r: number }>>(new Map());
  const theme = useCanvasTheme();

  // Calculate connection count per project
  const getConnectionCount = useCallback((projectId: string) => {
    return connections.filter(
      (c) =>
        (c.type === "ai_confirmed" || c.type === "manual") &&
        (c.sourceId === projectId || c.targetId === projectId)
    ).length;
  }, [connections]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d")!;
    let running = true;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Layout projects in an organic spiral
    const layoutProjects = () => {
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const positions = new Map<string, { x: number; y: number; r: number }>();

      if (projects.length === 0) return positions;
      if (projects.length === 1) {
        const p = projects[0]!;
        const conns = getConnectionCount(p.id);
        const r = Math.max(36, 36 + conns * 6);
        positions.set(p.id, { x: cx, y: cy, r });
        return positions;
      }

      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const spacing = Math.min(rect.width, rect.height) * 0.12;

      projects.forEach((p, i) => {
        const conns = getConnectionCount(p.id);
        const r = Math.max(28, 28 + conns * 5);
        const theta = i * goldenAngle;
        const dist = spacing * Math.sqrt(i + 1);
        const x = cx + Math.cos(theta) * dist;
        const y = cy + Math.sin(theta) * dist;
        positions.set(p.id, { x, y, r });
      });

      return positions;
    };

    positionsRef.current = layoutProjects();

    const draw = () => {
      if (!running) return;
      time += 0.016;
      const rect = container.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const positions = positionsRef.current;

      // Draw connection threads between projects
      const activeConns = connections.filter(
        (c) => c.type === "ai_confirmed" || c.type === "manual"
      );
      for (const conn of activeConns) {
        const sp = positions.get(conn.sourceId);
        const tp = positions.get(conn.targetId);
        if (!sp || !tp) continue;

        ctx.beginPath();
        // Organic curved line
        const midX = (sp.x + tp.x) / 2 + Math.sin(time * 0.5) * 8;
        const midY = (sp.y + tp.y) / 2 + Math.cos(time * 0.7) * 8;
        ctx.moveTo(sp.x, sp.y);
        ctx.quadraticCurveTo(midX, midY, tp.x, tp.y);
        ctx.strokeStyle = theme.linkSuggested;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw project organisms
      for (const project of projects) {
        const pos = positions.get(project.id);
        if (!pos) continue;

        const color = STATUS_COLORS[project.status] ?? "#666";
        const pulse = STATUS_PULSE[project.status] ?? 0;
        const isSelected = project.id === selectedId;
        const isHovered = project.id === hoveredRef.current;

        // Breathing animation
        const breath = 1 + Math.sin(time * (0.8 + pulse * 0.5)) * pulse * 0.04;
        const r = pos.r * breath;

        // Outer glow (ambient)
        if (pulse > 0) {
          const glowAlpha = 0.03 + pulse * 0.04 + Math.sin(time * 1.2) * 0.01;
          const gradient = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r * 2.5);
          gradient.addColorStop(0, color + Math.round(glowAlpha * 255).toString(16).padStart(2, "0"));
          gradient.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Selection ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 8, 0, Math.PI * 2);
          ctx.strokeStyle = color + "44";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected || isHovered ? color + "18" : theme.organismFill;
        ctx.fill();
        ctx.strokeStyle = isSelected ? color : isHovered ? color + "66" : theme.organismStroke;
        ctx.lineWidth = isSelected ? 1.5 : 1;
        ctx.stroke();

        // Status dot
        ctx.beginPath();
        ctx.arc(pos.x + r * 0.6, pos.y - r * 0.6, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Name
        ctx.fillStyle = isSelected || isHovered ? theme.labelHover : theme.label;
        ctx.font = "500 12px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const name = project.name.length > 18 ? project.name.slice(0, 18) + "..." : project.name;
        ctx.fillText(name, pos.x, pos.y + r + 10);

        // Status label
        ctx.fillStyle = color + "88";
        ctx.font = "400 10px 'Geist Mono', monospace";
        ctx.fillText(project.status, pos.x, pos.y + r + 26);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [projects, connections, selectedId, getConnectionCount, theme]);

  const hitTest = useCallback(
    (clientX: number, clientY: number): string | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      for (const [id, pos] of positionsRef.current) {
        const dx = mx - pos.x;
        const dy = my - pos.y;
        if (dx * dx + dy * dy < (pos.r + 8) * (pos.r + 8)) return id;
      }
      return null;
    },
    []
  );

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const id = hitTest(e.clientX, e.clientY);
      if (id) onSelect(id);
    },
    [hitTest, onSelect]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const id = hitTest(e.clientX, e.clientY);
      hoveredRef.current = id;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = id ? "pointer" : "default";
      }
    },
    [hitTest]
  );

  return (
    <div className="garden-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onClick={onClick}
        onMouseMove={onMouseMove}
      />

      <div className="garden-legend">
        {Object.entries(STATUS_COLORS).filter(([k]) => k !== "archived").map(([status, color]) => (
          <div key={status} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            <span>{status}</span>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="garden-empty">
          <p className="garden-empty-title">Your garden is empty</p>
          <p className="garden-empty-sub">Create a project to plant your first seed.</p>
        </div>
      )}
    </div>
  );
}
