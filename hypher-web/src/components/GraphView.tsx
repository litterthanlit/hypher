"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { AnyObject, Connection, ObjectKind } from "@/types";
import { getDisplayName } from "@/types";
import { useCanvasTheme } from "@/lib/useTheme";

interface Props {
  objects: AnyObject[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface GraphNode extends SimulationNodeDatum {
  id: string;
  kind: ObjectKind;
  label: string;
  hasEmbedding: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  type: Connection["type"];
  confidence: number;
}

const KIND_RADIUS: Record<ObjectKind, number> = {
  project: 24,
  note: 18,
  artifact: 18,
};

export function GraphView({ objects, connections, selectedId, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const animRef = useRef<number>(0);
  const theme = useCanvasTheme();

  const kindColors = (kind: ObjectKind) => {
    if (kind === "project") return theme.accent;
    if (kind === "note") return theme.blue;
    return theme.amber;
  };

  // Build graph data
  useEffect(() => {
    const activeConns = connections.filter(
      (c) => c.type === "ai_confirmed" || c.type === "manual" || c.type === "ai_suggested"
    );

    const nodes: GraphNode[] = objects.map((obj) => {
      const existing = nodesRef.current.find((n) => n.id === obj.id);
      return {
        id: obj.id,
        kind: obj.kind,
        label: getDisplayName(obj),
        hasEmbedding: !!(obj.embedding && obj.embedding.length > 0),
        x: existing?.x,
        y: existing?.y,
        vx: existing?.vx,
        vy: existing?.vy,
      };
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = activeConns
      .filter((c) => nodeIds.has(c.sourceId) && nodeIds.has(c.targetId))
      .map((c) => ({
        id: c.id,
        source: c.sourceId,
        target: c.targetId,
        type: c.type,
        confidence: c.confidence,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    const sim = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(120)
          .strength((d) => d.confidence * 0.5)
      )
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<GraphNode>().radius((d) => KIND_RADIUS[d.kind] + 8))
      .alphaDecay(0.02)
      .on("tick", () => {});

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [objects, connections]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d")!;
    let running = true;

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

    const draw = () => {
      if (!running) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const t = transformRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + t.x, h / 2 + t.y);
      ctx.scale(t.k, t.k);

      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Draw links
      for (const link of links) {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (!source.x || !source.y || !target.x || !target.y) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (link.type === "ai_suggested") {
          ctx.strokeStyle = theme.linkSuggested;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = theme.linkColor;
          ctx.lineWidth = 1.5;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = KIND_RADIUS[node.kind];
        const color = kindColors(node.kind);
        const isSelected = node.id === selectedId;
        const isHovered = node.id === hoveredRef.current;

        // Glow for selected
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + Math.round(theme.glowAlpha * 255).toString(16).padStart(2, "0");
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected || isHovered ? color + "18" : theme.nodeFill;
        ctx.fill();
        ctx.strokeStyle = isSelected ? color : isHovered ? color + "88" : theme.nodeStroke;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        // Kind icon (letter)
        ctx.fillStyle = color;
        ctx.font = `500 ${r * 0.6}px 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const kindLetter = node.kind === "project" ? "P" : node.kind === "note" ? "N" : "A";
        ctx.fillText(kindLetter, node.x, node.y);

        // Label
        ctx.fillStyle = isSelected || isHovered ? theme.labelHover : theme.label;
        ctx.font = `400 11px 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = node.label.length > 20 ? node.label.slice(0, 20) + "..." : node.label;
        ctx.fillText(label, node.x, node.y + r + 6);

        // Embedding dot
        if (node.hasEmbedding) {
          ctx.beginPath();
          ctx.arc(node.x + r * 0.65, node.y - r * 0.65, 3, 0, Math.PI * 2);
          ctx.fillStyle = theme.accent;
          ctx.fill();
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [selectedId, theme]);

  // Hit test
  const hitTest = useCallback(
    (clientX: number, clientY: number): GraphNode | null => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return null;

      const rect = container.getBoundingClientRect();
      const t = transformRef.current;
      const mx = (clientX - rect.left - rect.width / 2 - t.x) / t.k;
      const my = (clientY - rect.top - rect.height / 2 - t.y) / t.k;

      for (const node of nodesRef.current) {
        if (node.x == null || node.y == null) continue;
        const r = KIND_RADIUS[node.kind] + 4;
        const dx = mx - node.x;
        const dy = my - node.y;
        if (dx * dx + dy * dy < r * r) return node;
      }
      return null;
    },
    []
  );

  // Mouse events
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const node = hitTest(e.clientX, e.clientY);
      if (node && node.x != null && node.y != null) {
        const rect = containerRef.current!.getBoundingClientRect();
        const t = transformRef.current;
        const mx = (e.clientX - rect.left - rect.width / 2 - t.x) / t.k;
        const my = (e.clientY - rect.top - rect.height / 2 - t.y) / t.k;
        dragRef.current = { node, offsetX: node.x - mx, offsetY: node.y - my };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        panRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startTx: transformRef.current.x,
          startTy: transformRef.current.y,
        };
      }
    },
    [hitTest]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const rect = containerRef.current!.getBoundingClientRect();
        const t = transformRef.current;
        const mx = (e.clientX - rect.left - rect.width / 2 - t.x) / t.k;
        const my = (e.clientY - rect.top - rect.height / 2 - t.y) / t.k;
        dragRef.current.node.fx = mx + dragRef.current.offsetX;
        dragRef.current.node.fy = my + dragRef.current.offsetY;
        return;
      }

      if (panRef.current) {
        transformRef.current.x = panRef.current.startTx + (e.clientX - panRef.current.startX);
        transformRef.current.y = panRef.current.startTy + (e.clientY - panRef.current.startY);
        return;
      }

      const node = hitTest(e.clientX, e.clientY);
      const newHovered = node?.id ?? null;
      if (newHovered !== hoveredRef.current) {
        hoveredRef.current = newHovered;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = newHovered ? "grab" : "default";
        }
      }
    },
    [hitTest]
  );

  const onMouseUp = useCallback(() => {
    if (dragRef.current) {
      const node = dragRef.current.node;
      onSelect(node.id);
      node.fx = null;
      node.fy = null;
      simRef.current?.alphaTarget(0);
      dragRef.current = null;
      return;
    }
    panRef.current = null;
  }, [onSelect]);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current || panRef.current) return;
      const node = hitTest(e.clientX, e.clientY);
      if (node) onSelect(node.id);
    },
    [hitTest, onSelect]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newK = Math.min(3, Math.max(0.2, transformRef.current.k * delta));
    transformRef.current.k = newK;
  }, []);

  const confirmedCount = connections.filter((c) => c.type === "ai_confirmed" || c.type === "manual").length;
  const suggestedCount = connections.filter((c) => c.type === "ai_suggested").length;

  return (
    <div className="graph-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onClick}
        onWheel={onWheel}
      />

      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: theme.accent }} />
          <span>Project</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: theme.blue }} />
          <span>Note</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: theme.amber }} />
          <span>Artifact</span>
        </div>
        <div className="legend-divider" />
        <div className="legend-item">
          <span className="legend-line solid" />
          <span>Confirmed ({confirmedCount})</span>
        </div>
        <div className="legend-item">
          <span className="legend-line dashed" />
          <span>Suggested ({suggestedCount})</span>
        </div>
      </div>

      {/* Stats */}
      <div className="graph-stats">
        <span className="mono">{objects.length} nodes</span>
        <span className="graph-stats-dot" />
        <span className="mono">{confirmedCount + suggestedCount} edges</span>
      </div>

      {objects.length === 0 && (
        <div className="graph-empty">
          <p>Add some objects to see the graph</p>
        </div>
      )}
    </div>
  );
}
