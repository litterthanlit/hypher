"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { AnyObject, Connection, ObjectKind, Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, FolderIcon, NoteIcon, ArtifactIcon } from "./Icons";
import { ProjectCluster } from "./ProjectCluster";

interface Props {
  objects: AnyObject[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
  onProjectClick?: (projectId: string) => void;
  onAssignToProject?: (objectId: string, projectId: string) => void;
}

interface InlineCreate {
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
  text: string;
  step: "typing" | "picking";
}

export function SpatialCanvas({
  objects, connections, selectedId, onSelect,
  onUpdatePosition, onCreateAtPosition, onProjectClick, onAssignToProject,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; objX: number; objY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group objects: projects get clusters, unassigned get individual cards
  const projects = useMemo(() => objects.filter((o): o is Project => o.kind === "project"), [objects]);
  const projectMembers = useMemo(() => {
    const map = new Map<string, AnyObject[]>();
    for (const p of projects) map.set(p.id, []);
    for (const obj of objects) {
      if (obj.kind === "project") continue;
      if (obj.projectId && map.has(obj.projectId)) {
        map.get(obj.projectId)!.push(obj);
      }
    }
    return map;
  }, [objects, projects]);

  const inboxObjects = useMemo(
    () => objects.filter((o) => o.kind !== "project" && !o.projectId),
    [objects]
  );

  // Position projects that don't have canvasPosition
  const positionedProjects = projects.map((p, i) => {
    if (p.canvasPosition) return p;
    const angle = i * (Math.PI * 2 / Math.max(projects.length, 1));
    const dist = 200 + projects.length * 20;
    return { ...p, canvasPosition: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist } };
  });

  // Position inbox objects in a cluster on the side
  const positionedInbox = inboxObjects.map((obj, i) => {
    if (obj.canvasPosition) return obj;
    return { ...obj, canvasPosition: { x: -300, y: -200 + i * 60 } };
  });

  // Find shared objects — connected across different projects
  const sharedObjectIds = useMemo(() => {
    const shared = new Set<string>();
    const activeC = connections.filter((c) => c.type === "ai_confirmed" || c.type === "manual");
    for (const conn of activeC) {
      const sourceObj = objects.find((o) => o.id === conn.sourceId);
      const targetObj = objects.find((o) => o.id === conn.targetId);
      if (sourceObj && targetObj && sourceObj.projectId && targetObj.projectId && sourceObj.projectId !== targetObj.projectId) {
        shared.add(sourceObj.id);
        shared.add(targetObj.id);
      }
    }
    return shared;
  }, [objects, connections]);

  const activeConns = connections.filter(
    (c) => c.type === "ai_confirmed" || c.type === "manual" || c.type === "ai_suggested"
  );

  // Connection count per project
  const projectConnCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const members = projectMembers.get(p.id) ?? [];
      const memberIds = new Set([p.id, ...members.map((m) => m.id)]);
      let count = 0;
      for (const conn of activeConns) {
        if (conn.type === "ai_suggested") continue;
        const hasSource = memberIds.has(conn.sourceId);
        const hasTarget = memberIds.has(conn.targetId);
        if (hasSource !== hasTarget) count++; // external connection
      }
      counts.set(p.id, count);
    }
    return counts;
  }, [projects, projectMembers, activeConns]);

  // Render connection lines between projects
  const renderConnections = () => {
    // Build project position map
    const projectPosMap = new Map(positionedProjects.map((p) => [p.id, p.canvasPosition!]));

    // Find connections between different projects
    const projectPairs = new Map<string, number>();
    for (const conn of activeConns) {
      if (conn.type === "ai_suggested") continue;
      let sourceProject: string | null = null;
      let targetProject: string | null = null;

      for (const [pid, members] of projectMembers) {
        const memberIds = new Set([pid, ...members.map((m) => m.id)]);
        if (memberIds.has(conn.sourceId)) sourceProject = pid;
        if (memberIds.has(conn.targetId)) targetProject = pid;
      }

      if (sourceProject && targetProject && sourceProject !== targetProject) {
        const key = [sourceProject, targetProject].sort().join("|");
        projectPairs.set(key, (projectPairs.get(key) ?? 0) + 1);
      }
    }

    return Array.from(projectPairs.entries()).map(([key, count]) => {
      const [id1, id2] = key.split("|");
      const p1 = projectPosMap.get(id1!);
      const p2 = projectPosMap.get(id2!);
      if (!p1 || !p2) return null;

      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const cx = mx - dy * 0.08;
      const cy = my + dx * 0.08;

      return (
        <g key={key}>
          <path
            d={`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={Math.min(1 + count * 0.5, 4)}
            opacity={0.25}
          />
          <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--text-quaternary)" fontSize="9" fontFamily="var(--font-mono)">
            {count}
          </text>
        </g>
      );
    });
  };

  // ── Event handlers ──
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".project-cluster")) return;
      if ((e.target as HTMLElement).closest(".spatial-card")) return;
      if ((e.target as HTMLElement).closest(".inline-create")) return;
      setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y });
      setHasMoved(false);
    },
    [transform]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / transform.k;
        const dy = (e.clientY - dragging.startY) / transform.k;
        const el = document.getElementById(`card-${dragging.id}`);
        if (el) el.style.transform = `translate(${dragging.objX + dx}px, ${dragging.objY + dy}px)`;
        setHasMoved(true);
        return;
      }
      if (panning) {
        setTransform({ ...transform, x: panning.startTx + (e.clientX - panning.startX), y: panning.startTy + (e.clientY - panning.startY) });
        setHasMoved(true);
      }
    },
    [dragging, panning, transform]
  );

  const onMouseUp = useCallback(() => {
    if (dragging && hasMoved) {
      const el = document.getElementById(`card-${dragging.id}`);
      if (el) {
        const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        if (match) onUpdatePosition(dragging.id, parseFloat(match[1]!), parseFloat(match[2]!));
      }
    }
    setDragging(null);
    setPanning(null);
  }, [dragging, hasMoved, onUpdatePosition]);

  const onItemMouseDown = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    e.stopPropagation();
    const pos = obj.canvasPosition ?? { x: 0, y: 0 };
    setDragging({ id: obj.id, startX: e.clientX, startY: e.clientY, objX: pos.x, objY: pos.y });
    setHasMoved(false);
  }, []);

  const onItemClick = useCallback((e: React.MouseEvent, id: string) => {
    if (!hasMoved) onSelect(id);
  }, [hasMoved, onSelect]);

  const onClusterClick = useCallback((projectId: string) => {
    if (!hasMoved && onProjectClick) onProjectClick(projectId);
    else if (!hasMoved) onSelect(projectId);
  }, [hasMoved, onProjectClick, onSelect]);

  // Double-click to create
  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".project-cluster")) return;
    if ((e.target as HTMLElement).closest(".spatial-card")) return;
    if ((e.target as HTMLElement).closest(".inline-create")) return;
    if ((e.target as HTMLElement).closest(".spatial-controls")) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = (e.clientX - rect.left - transform.x) / transform.k;
    const canvasY = (e.clientY - rect.top - transform.y) / transform.k;
    setInlineCreate({ canvasX, canvasY, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top, text: "", step: "typing" });
  }, [transform]);

  useEffect(() => {
    if (inlineCreate?.step === "typing") setTimeout(() => inputRef.current?.focus(), 50);
  }, [inlineCreate?.step]);

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inlineCreate?.text.trim()) { e.preventDefault(); setInlineCreate({ ...inlineCreate, step: "picking" }); }
    if (e.key === "Escape") setInlineCreate(null);
  };

  const handlePickKind = (kind: ObjectKind) => {
    if (!inlineCreate) return;
    onCreateAtPosition(kind, inlineCreate.text.trim(), inlineCreate.canvasX, inlineCreate.canvasY);
    setInlineCreate(null);
  };

  // Zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newK = Math.min(3, Math.max(0.15, transform.k * delta));
    const ratio = newK / transform.k;
    setTransform({ k: newK, x: mouseX - (mouseX - transform.x) * ratio, y: mouseY - (mouseY - transform.y) * ratio });
  }, [transform]);

  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 });
  }, []);

  // Drop handler for drag-from-inbox
  const handleClusterDrop = useCallback((e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    const objectId = e.dataTransfer.getData("text/plain");
    if (objectId && onAssignToProject) onAssignToProject(objectId, projectId);
  }, [onAssignToProject]);

  return (
    <div
      className="spatial-canvas"
      ref={containerRef}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      <div className="spatial-grid" style={{
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
      }} />

      <div className="spatial-transform" style={{
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
        transformOrigin: "0 0",
      }}>
        <svg className="spatial-connections" style={{ overflow: "visible" }}>
          {renderConnections()}
        </svg>

        {/* Project clusters */}
        {positionedProjects.map((project) => {
          const pos = project.canvasPosition!;
          const members = projectMembers.get(project.id) ?? [];
          const connCount = projectConnCount.get(project.id) ?? 0;

          return (
            <div
              key={project.id}
              id={`card-${project.id}`}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, position: "absolute", marginLeft: "-150px", marginTop: "-80px" }}
              onMouseDown={(e) => onItemMouseDown(e, project)}
              onClick={() => onClusterClick(project.id)}
            >
              <ProjectCluster
                project={project}
                members={members}
                connectionCount={connCount}
                isSelected={selectedId === project.id}
                sharedObjectIds={sharedObjectIds}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleClusterDrop(e, project.id)}
              />
            </div>
          );
        })}

        {/* Inbox items as individual cards */}
        {positionedInbox.map((obj) => {
          const pos = obj.canvasPosition!;
          return (
            <div
              key={obj.id}
              id={`card-${obj.id}`}
              className={`spatial-card ${selectedId === obj.id ? "selected" : ""}`}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
              onMouseDown={(e) => onItemMouseDown(e, obj)}
              onClick={(e) => onItemClick(e, obj.id)}
            >
              <div className="spatial-card-accent" style={{ background: obj.kind === "note" ? "var(--blue)" : "var(--amber)" }} />
              <div className="spatial-card-body">
                <div className="spatial-card-header">
                  <KindIcon kind={obj.kind} className="kind-icon" />
                  <span className="spatial-card-title">{getDisplayName(obj)}</span>
                </div>
                <div className="spatial-card-footer">
                  <span className="spatial-card-status inbox-label">inbox</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline create */}
      {inlineCreate && (
        <div className="inline-create" style={{ left: inlineCreate.screenX, top: inlineCreate.screenY }}>
          {inlineCreate.step === "typing" && (
            <div className="inline-create-input-wrap">
              <input
                ref={inputRef}
                className="inline-create-input"
                value={inlineCreate.text}
                onChange={(e) => setInlineCreate({ ...inlineCreate, text: e.target.value })}
                onKeyDown={handleInlineKeyDown}
                onBlur={() => { if (!inlineCreate.text.trim()) setInlineCreate(null); }}
                placeholder="Type a name..."
              />
              <span className="inline-create-hint">Enter to choose type</span>
            </div>
          )}
          {inlineCreate.step === "picking" && (
            <div className="inline-create-picker">
              <div className="inline-create-preview">{inlineCreate.text}</div>
              <div className="inline-create-options">
                <button className="inline-create-option" onClick={() => handlePickKind("project")}><FolderIcon className="kind-icon" /><span>Project</span></button>
                <button className="inline-create-option" onClick={() => handlePickKind("note")}><NoteIcon className="kind-icon" /><span>Note</span></button>
                <button className="inline-create-option" onClick={() => handlePickKind("artifact")}><ArtifactIcon className="kind-icon" /><span>Artifact</span></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="spatial-controls">
        <button className="btn-icon" onClick={() => setTransform((t) => ({ ...t, k: Math.min(3, t.k * 1.25) }))} title="Zoom in">+</button>
        <span className="spatial-zoom-label">{Math.round(transform.k * 100)}%</span>
        <button className="btn-icon" onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.15, t.k * 0.8) }))} title="Zoom out">−</button>
        <button className="btn-icon" onClick={() => { const rect = containerRef.current?.getBoundingClientRect(); if (rect) setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 }); }} title="Reset view">⌀</button>
      </div>

      {objects.length === 0 && (
        <div className="spatial-empty">
          <p className="spatial-empty-title">Your canvas is empty</p>
          <p className="spatial-empty-sub">Double-click to create, or capture thoughts from the home screen.</p>
        </div>
      )}
    </div>
  );
}
