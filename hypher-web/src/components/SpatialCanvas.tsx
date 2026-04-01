"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { AnyObject, Connection, ObjectKind } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, FolderIcon, NoteIcon, ArtifactIcon } from "./Icons";

interface Props {
  objects: AnyObject[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
}

const KIND_ACCENT: Record<ObjectKind, string> = {
  project: "var(--accent)",
  note: "var(--blue)",
  artifact: "var(--amber)",
};

function getCardCenter(obj: AnyObject): { x: number; y: number } {
  if (obj.canvasPosition) return obj.canvasPosition;
  return { x: 0, y: 0 };
}

interface InlineCreate {
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
  text: string;
  step: "typing" | "picking";
}

export function SpatialCanvas({ objects, connections, selectedId, onSelect, onUpdatePosition, onCreateAtPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; objX: number; objY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-layout objects that don't have positions
  const positionedObjects = objects.map((obj, i) => {
    if (obj.canvasPosition) return obj;
    const angle = i * 2.4;
    const dist = 180 + i * 40;
    return {
      ...obj,
      canvasPosition: {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      },
    };
  });

  const activeConns = connections.filter(
    (c) => c.type === "ai_confirmed" || c.type === "manual" || c.type === "ai_suggested"
  );

  const objectMap = new Map(positionedObjects.map((o) => [o.id, o]));

  // Panning
  const onCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".spatial-card")) return;
      if ((e.target as HTMLElement).closest(".inline-create")) return;
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        startTx: transform.x,
        startTy: transform.y,
      });
      setHasMoved(false);
    },
    [transform]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / transform.k;
        const dy = (e.clientY - dragging.startY) / transform.k;
        const card = document.getElementById(`card-${dragging.id}`);
        if (card) {
          card.style.transform = `translate(${dragging.objX + dx}px, ${dragging.objY + dy}px)`;
        }
        setHasMoved(true);
        return;
      }
      if (panning) {
        setTransform({
          ...transform,
          x: panning.startTx + (e.clientX - panning.startX),
          y: panning.startTy + (e.clientY - panning.startY),
        });
        setHasMoved(true);
      }
    },
    [dragging, panning, transform]
  );

  const onMouseUp = useCallback(() => {
    if (dragging && hasMoved) {
      const card = document.getElementById(`card-${dragging.id}`);
      if (card) {
        const style = card.style.transform;
        const match = style.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        if (match) {
          onUpdatePosition(dragging.id, parseFloat(match[1]!), parseFloat(match[2]!));
        }
      }
    }
    setDragging(null);
    setPanning(null);
  }, [dragging, hasMoved, onUpdatePosition]);

  const onCardMouseDown = useCallback(
    (e: React.MouseEvent, obj: AnyObject) => {
      e.stopPropagation();
      const pos = obj.canvasPosition ?? { x: 0, y: 0 };
      setDragging({
        id: obj.id,
        startX: e.clientX,
        startY: e.clientY,
        objX: pos.x,
        objY: pos.y,
      });
      setHasMoved(false);
    },
    []
  );

  const onCardClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!hasMoved) {
        onSelect(id);
      }
    },
    [hasMoved, onSelect]
  );

  // Double-click to create
  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".spatial-card")) return;
      if ((e.target as HTMLElement).closest(".inline-create")) return;
      if ((e.target as HTMLElement).closest(".spatial-controls")) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert screen coords to canvas coords
      const canvasX = (e.clientX - rect.left - transform.x) / transform.k;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.k;

      setInlineCreate({
        canvasX,
        canvasY,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        text: "",
        step: "typing",
      });
    },
    [transform]
  );

  // Focus input when inline create appears
  useEffect(() => {
    if (inlineCreate?.step === "typing") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inlineCreate?.step]);

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inlineCreate && inlineCreate.text.trim()) {
      e.preventDefault();
      setInlineCreate({ ...inlineCreate, step: "picking" });
    }
    if (e.key === "Escape") {
      setInlineCreate(null);
    }
  };

  const handlePickKind = (kind: ObjectKind) => {
    if (!inlineCreate) return;
    onCreateAtPosition(kind, inlineCreate.text.trim(), inlineCreate.canvasX, inlineCreate.canvasY);
    setInlineCreate(null);
  };

  // Zoom
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

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
    },
    [transform]
  );

  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 });
    }
  }, []);

  const renderConnections = () => {
    return activeConns.map((conn) => {
      const source = objectMap.get(conn.sourceId);
      const target = objectMap.get(conn.targetId);
      if (!source || !target) return null;

      const sp = getCardCenter(source);
      const tp = getCardCenter(target);
      const isSuggested = conn.type === "ai_suggested";

      const mx = (sp.x + tp.x) / 2;
      const my = (sp.y + tp.y) / 2;
      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const cx = mx - dy * 0.1;
      const cy = my + dx * 0.1;

      return (
        <g key={conn.id}>
          <path
            d={`M ${sp.x} ${sp.y} Q ${cx} ${cy} ${tp.x} ${tp.y}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={isSuggested ? 1 : 1.5}
            strokeDasharray={isSuggested ? "6 4" : "none"}
            opacity={isSuggested ? 0.2 : 0.35}
          />
          {!isSuggested && conn.confidence < 1 && (
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fill="var(--text-quaternary)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              {Math.round(conn.confidence * 100)}%
            </text>
          )}
        </g>
      );
    });
  };

  const getPreview = (obj: AnyObject) => {
    if (obj.kind === "project") return obj.description ? obj.description.slice(0, 120) : "No description";
    if (obj.kind === "note") return obj.content.slice(0, 160);
    if (obj.kind === "artifact") return obj.fileReference || obj.type;
    return "";
  };

  const getStatusLabel = (obj: AnyObject) => {
    if (obj.kind === "project") return obj.status;
    if (obj.kind === "note") return obj.maturity;
    return obj.type;
  };

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

      <div
        className="spatial-transform"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: "0 0",
        }}
      >
        <svg className="spatial-connections" style={{ overflow: "visible" }}>
          {renderConnections()}
        </svg>

        {positionedObjects.map((obj) => {
          const pos = obj.canvasPosition!;
          const isSelected = obj.id === selectedId;
          const connCount = activeConns.filter(
            (c) => (c.sourceId === obj.id || c.targetId === obj.id) && c.type !== "ai_suggested"
          ).length;

          return (
            <div
              key={obj.id}
              id={`card-${obj.id}`}
              className={`spatial-card ${isSelected ? "selected" : ""} kind-${obj.kind}`}
              style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
              onMouseDown={(e) => onCardMouseDown(e, obj)}
              onClick={(e) => onCardClick(e, obj.id)}
            >
              <div className="spatial-card-accent" style={{ background: KIND_ACCENT[obj.kind] }} />
              <div className="spatial-card-body">
                <div className="spatial-card-header">
                  <KindIcon kind={obj.kind} className="kind-icon" />
                  <span className="spatial-card-title">{getDisplayName(obj)}</span>
                </div>
                <p className="spatial-card-preview">{getPreview(obj)}</p>
                <div className="spatial-card-footer">
                  <span className="spatial-card-status" style={{ color: KIND_ACCENT[obj.kind] }}>
                    {getStatusLabel(obj)}
                  </span>
                  {connCount > 0 && (
                    <span className="spatial-card-conns">
                      {connCount} link{connCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {obj.embedding && <span className="spatial-card-embedded" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline create UI — positioned in screen space */}
      {inlineCreate && (
        <div
          className="inline-create"
          style={{
            left: inlineCreate.screenX,
            top: inlineCreate.screenY,
          }}
        >
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
                <button className="inline-create-option" onClick={() => handlePickKind("project")}>
                  <FolderIcon className="kind-icon" />
                  <span>Project</span>
                </button>
                <button className="inline-create-option" onClick={() => handlePickKind("note")}>
                  <NoteIcon className="kind-icon" />
                  <span>Note</span>
                </button>
                <button className="inline-create-option" onClick={() => handlePickKind("artifact")}>
                  <ArtifactIcon className="kind-icon" />
                  <span>Artifact</span>
                </button>
              </div>
              <span className="inline-create-hint">Choose a type</span>
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="spatial-controls">
        <button
          className="btn-icon"
          onClick={() => setTransform((t) => ({ ...t, k: Math.min(3, t.k * 1.25) }))}
          title="Zoom in"
        >
          +
        </button>
        <span className="spatial-zoom-label">{Math.round(transform.k * 100)}%</span>
        <button
          className="btn-icon"
          onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.15, t.k * 0.8) }))}
          title="Zoom out"
        >
          −
        </button>
        <button
          className="btn-icon"
          onClick={() => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) setTransform({ x: rect.width / 2, y: rect.height / 2, k: 1 });
          }}
          title="Reset view"
        >
          ⌀
        </button>
      </div>

      {objects.length === 0 && (
        <div className="spatial-empty">
          <p className="spatial-empty-title">Your canvas is empty</p>
          <p className="spatial-empty-sub">Double-click anywhere to create an object, or use the sidebar.</p>
        </div>
      )}
    </div>
  );
}
