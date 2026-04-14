"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import type { AnyObject, Connection, ObjectKind, Note, Project, Artifact } from "@/types";
import { ConnectionPopover } from "./ConnectionPopover";
import { NoteIcon, ArtifactIcon } from "./Icons";
import { useCanvasTransform } from "./canvas/hooks/useCanvasTransform";
import { useSelectionState } from "./canvas/hooks/useSelectionState";
import { useDragInteraction } from "./canvas/hooks/useDragInteraction";
import { getCardColor, getCardRotation } from "./canvas/cards/cardUtils";
import { StickyNote } from "./canvas/cards/StickyNote";
import { ProjectCard } from "./canvas/cards/ProjectCard";
import { ArtifactCard } from "./canvas/cards/ArtifactCard";

interface Props {
  items: AnyObject[];
  connections: Connection[];
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
  onConfirmConnection: (id: string) => void;
  onDismissConnection: (id: string) => void;
  onUpdateObject: (obj: AnyObject) => void;
  onDeleteObjects: (ids: string[]) => void;
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
  items, connections, onSelect,
  onUpdatePosition, onCreateAtPosition, onConfirmConnection, onDismissConnection,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null);
  const [popover, setPopover] = useState<{ connection: Connection; x: number; y: number } | null>(null);
  const [canvasMode, setCanvasMode] = useState<"select" | "text">("select");
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive projectId from items
  const projectId = items.find(i => i.kind === "project")?.id ?? "default";

  // Hooks
  const { transform, setTransform, canvasBg, cycleBg, animateZoom, onWheel, screenToCanvas } =
    useCanvasTransform(containerRef, projectId);

  const selection = useSelectionState();

  // Position items without canvasPosition
  const positioned = items.map((obj, i) => {
    if (obj.canvasPosition) return obj;
    const angle = i * 2.4;
    const dist = 140 + i * 35;
    return { ...obj, canvasPosition: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist } };
  });

  const getPositionedItems = useCallback(() => positioned, [positioned]);

  const drag = useDragInteraction({
    transform,
    setTransform,
    selectedIds: selection.selectedIds,
    onUpdatePosition,
    getPositionedItems,
  });

  // Notify parent when primary selection changes
  useEffect(() => {
    onSelect(selection.primarySelectedId ?? "");
  }, [selection.primarySelectedId, onSelect]);

  // Filter connections to only those between items in our list
  const itemIds = new Set(items.map((o) => o.id));
  const activeConns = connections.filter(
    (c) => c.type !== "dismissed" && itemIds.has(c.sourceId) && itemIds.has(c.targetId)
  );

  const objectMap = new Map(positioned.map((o) => [o.id, o]));

  // ── Event handlers ──
  const panStartPos = useRef<{ x: number; y: number } | null>(null);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".spatial-card, .inline-create, .conn-popover, .spatial-controls")) return;
    setPopover(null);
    drag.startPan(e);
    panStartPos.current = { x: e.clientX, y: e.clientY };
  }, [drag]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    drag.onMouseMove(e);
  }, [drag]);

  const onMouseUp = useCallback(() => {
    drag.onMouseUp();
  }, [drag]);

  const onCardMouseDown = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    drag.startDrag(e, obj);
  }, [drag]);

  const onCardClick = useCallback((e: React.MouseEvent, id: string) => {
    if (!drag.didMove(e)) {
      selection.select(id);
    }
  }, [drag, selection]);

  // Click on empty space — behavior depends on mode
  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".spatial-card, .inline-create, .spatial-controls, .conn-popover, .canvas-toolbar")) return;
    if (inlineCreate) return;
    // Only if we didn't pan (< 5px movement)
    if (drag.didPanMove(e)) return;

    if (canvasMode === "text") {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setInlineCreate({
        canvasX: pos.x,
        canvasY: pos.y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        text: "",
        step: "typing",
      });
    }
    // In select mode, clicking empty space deselects
    if (canvasMode === "select") {
      selection.clearSelection();
    }
  }, [drag, inlineCreate, canvasMode, screenToCanvas, selection]);

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

  // Keyboard shortcuts for mode switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "v" || e.key === "V") setCanvasMode("select");
      if (e.key === "t" || e.key === "T") setCanvasMode("text");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Connection line click
  const handleConnectionClick = useCallback((e: React.MouseEvent, conn: Connection) => {
    if (conn.type !== "ai_suggested") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopover({ connection: conn, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  return (
    <div
      className={`spatial-canvas ${canvasMode === "text" ? "text-mode" : ""}`}
      ref={containerRef}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onClick={onCanvasClick}
    >
      <div className="spatial-grid" data-bg={canvasBg} style={{
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
      }} />

      <div className="spatial-transform" style={{
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
        transformOrigin: "0 0",
      }}>
        {/* Connection lines */}
        <svg className="spatial-connections" style={{ overflow: "visible" }}>
          {activeConns.map((conn) => {
            const source = objectMap.get(conn.sourceId);
            const target = objectMap.get(conn.targetId);
            if (!source?.canvasPosition || !target?.canvasPosition) return null;
            const sp = source.canvasPosition;
            const tp = target.canvasPosition;
            const isSuggested = conn.type === "ai_suggested";
            const mx = (sp.x + tp.x) / 2;
            const my = (sp.y + tp.y) / 2;
            const dx = tp.x - sp.x;
            const dy = tp.y - sp.y;
            const cx = mx - dy * 0.1;
            const cy = my + dx * 0.1;

            return (
              <g key={conn.id}>
                {/* Invisible wider hit area for clicking */}
                <path
                  d={`M ${sp.x} ${sp.y} Q ${cx} ${cy} ${tp.x} ${tp.y}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: isSuggested ? "pointer" : "default" }}
                  onClick={(e) => handleConnectionClick(e as any, conn)}
                />
                <path
                  d={`M ${sp.x} ${sp.y} Q ${cx} ${cy} ${tp.x} ${tp.y}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={isSuggested ? 1 : 1.5}
                  strokeDasharray={isSuggested ? "6 4" : "none"}
                  opacity={isSuggested ? 0.25 : 0.4}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>

        {/* Item cards */}
        {positioned.map((obj) => {
          const pos = obj.canvasPosition!;
          const isSelected = selection.isSelected(obj.id);
          const isDragging = drag.dragging?.id === obj.id;
          const color = getCardColor(obj);
          const rotation = obj.kind === "note" ? getCardRotation(obj.id) : 0;

          return (
            <motion.div
              key={obj.id}
              id={`card-${obj.id}`}
              className={`spatial-card spatial-card-${obj.kind} ${isSelected ? "selected" : ""}`}
              data-color={color}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                rotate: isDragging ? rotation + 1 : rotation,
                zIndex: isDragging ? 1000 : isSelected ? 20 : undefined,
              }}
              whileHover={!isDragging ? {
                scale: 1.01,
                boxShadow: "0 2px 4px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
              } : undefined}
              animate={isDragging ? {
                scale: 1.03,
                boxShadow: "0 8px 16px rgba(0,0,0,0.12), 0 24px 48px rgba(0,0,0,0.08)",
              } : {
                scale: 1,
              }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              onMouseDown={(e) => onCardMouseDown(e, obj)}
              onClick={(e) => onCardClick(e, obj.id)}
            >
              {obj.kind === "note" && <StickyNote obj={obj as Note} />}
              {obj.kind === "project" && <ProjectCard obj={obj as Project} />}
              {obj.kind === "artifact" && <ArtifactCard obj={obj as Artifact} />}
            </motion.div>
          );
        })}
      </div>

      {/* Connection popover */}
      {popover && (
        <ConnectionPopover
          connection={popover.connection}
          position={{ x: popover.x, y: popover.y }}
          onConfirm={onConfirmConnection}
          onDismiss={onDismissConnection}
          onClose={() => setPopover(null)}
        />
      )}

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
                <button className="inline-create-option" onClick={() => handlePickKind("note")}><NoteIcon className="kind-icon" /><span>Note</span></button>
                <button className="inline-create-option" onClick={() => handlePickKind("artifact")}><ArtifactIcon className="kind-icon" /><span>Artifact</span></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom toolbar: mode switcher + zoom */}
      <div className="canvas-toolbar">
        <div className="canvas-mode-switcher">
          <button
            className={`canvas-mode-btn ${canvasMode === "select" ? "active" : ""}`}
            onClick={() => setCanvasMode("select")}
            title="Select (V)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
            </svg>
          </button>
          <button
            className={`canvas-mode-btn ${canvasMode === "text" ? "active" : ""}`}
            onClick={() => setCanvasMode("text")}
            title="Text (T)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.2 48.2 0 0 0 5.887-.375c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          </button>
        </div>

        <button
          className="canvas-mode-btn"
          onClick={cycleBg}
          title={`Background: ${canvasBg}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
          </svg>
        </button>

        <div className="spatial-controls">
          <button className="btn-icon" onClick={() => animateZoom(Math.min(3, transform.k * 1.25))} title="Zoom in">+</button>
          <span className="spatial-zoom-label">{Math.round(transform.k * 100)}%</span>
          <button className="btn-icon" onClick={() => animateZoom(Math.max(0.15, transform.k * 0.8))} title="Zoom out">-</button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="spatial-empty">
          <p className="spatial-empty-title">This project is empty</p>
          <p className="spatial-empty-sub">Click anywhere to start typing, or capture from the home screen.</p>
        </div>
      )}
    </div>
  );
}
