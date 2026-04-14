"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, animate } from "framer-motion";
import type { AnyObject, Connection, ObjectKind } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon, FolderIcon, NoteIcon, ArtifactIcon } from "./Icons";
import { ConnectionPopover } from "./ConnectionPopover";

interface Props {
  items: AnyObject[];
  connections: Connection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
  onConfirmConnection: (id: string) => void;
  onDismissConnection: (id: string) => void;
}

const KIND_ACCENT: Record<ObjectKind, string> = {
  project: "var(--accent)",
  note: "var(--blue)",
  artifact: "var(--amber)",
};

const CARD_COLORS = ["yellow", "green", "blue", "pink", "purple", "orange", "red", "grey"] as const;

function defaultCardColor(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) hash = (hash * 31 + content.charCodeAt(i)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}

function getCardColor(obj: AnyObject): string {
  if (obj.canvasColor) return obj.canvasColor;
  if (obj.kind === "note") return defaultCardColor(obj.content);
  return "";
}

function getCardRotation(id: string): number {
  const c0 = id.charCodeAt(0) || 0;
  const c1 = id.charCodeAt(1) || 0;
  return ((c0 + c1) % 400) / 100 - 2;
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
  items, connections, selectedId, onSelect,
  onUpdatePosition, onCreateAtPosition, onConfirmConnection, onDismissConnection,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; objX: number; objY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null);
  const [popover, setPopover] = useState<{ connection: Connection; x: number; y: number } | null>(null);
  const [canvasMode, setCanvasMode] = useState<"select" | "text">("select");
  const inputRef = useRef<HTMLInputElement>(null);

  const [canvasBg, setCanvasBg] = useState<"dots" | "grid" | "lines" | "blank">(() => {
    if (typeof window === "undefined") return "dots";
    const projectId = items.find(i => i.kind === "project")?.id ?? "default";
    return (localStorage.getItem(`hypher-canvas-bg-${projectId}`) as any) ?? "dots";
  });

  const cycleBg = useCallback(() => {
    const order: Array<"dots" | "grid" | "lines" | "blank"> = ["dots", "grid", "lines", "blank"];
    const next = order[(order.indexOf(canvasBg) + 1) % order.length];
    setCanvasBg(next);
    const projectId = items.find(i => i.kind === "project")?.id ?? "default";
    localStorage.setItem(`hypher-canvas-bg-${projectId}`, next);
  }, [canvasBg, items]);

  // Position items without canvasPosition
  const positioned = items.map((obj, i) => {
    if (obj.canvasPosition) return obj;
    const angle = i * 2.4;
    const dist = 140 + i * 35;
    return { ...obj, canvasPosition: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist } };
  });

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
    setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y });
    panStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);
  }, [transform]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
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
  }, [dragging, panning, transform]);

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

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const onCardMouseDown = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    e.stopPropagation();
    const pos = obj.canvasPosition ?? { x: 0, y: 0 };
    setDragging({ id: obj.id, startX: e.clientX, startY: e.clientY, objX: pos.x, objY: pos.y });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);
  }, []);

  const onCardClick = useCallback((e: React.MouseEvent, id: string) => {
    // Only count as "moved" if mouse traveled > 4px (prevents micro-movements blocking clicks)
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        onSelect(id);
      }
    } else if (!hasMoved) {
      onSelect(id);
    }
  }, [hasMoved, onSelect]);

  // Click on empty space — behavior depends on mode
  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".spatial-card, .inline-create, .spatial-controls, .conn-popover, .canvas-toolbar")) return;
    if (inlineCreate) return;
    // Only if we didn't pan (< 5px movement)
    if (panStartPos.current) {
      const dx = e.clientX - panStartPos.current.x;
      const dy = e.clientY - panStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) return;
    }

    if (canvasMode === "text") {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - transform.x) / transform.k;
      const canvasY = (e.clientY - rect.top - transform.y) / transform.k;
      setInlineCreate({ canvasX, canvasY, screenX: e.clientX - rect.left, screenY: e.clientY - rect.top, text: "", step: "typing" });
    }
    // In select mode, clicking empty space deselects
    if (canvasMode === "select") {
      onSelect("");
    }
  }, [transform, inlineCreate, canvasMode, onSelect]);

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

  // Preview text
  const getPreview = (obj: AnyObject) => {
    if (obj.kind === "note") return obj.content.slice(0, 120);
    if (obj.kind === "artifact") return obj.fileReference || obj.type;
    return "";
  };

  const getStatus = (obj: AnyObject) => {
    if (obj.kind === "note") return obj.maturity;
    if (obj.kind === "artifact") return obj.type;
    return "";
  };

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
          const isSelected = obj.id === selectedId;
          const isDragging = dragging?.id === obj.id;
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
              {obj.kind === "note" && (
                <div className="spatial-card-body">
                  <span className="spatial-card-title">{getDisplayName(obj)}</span>
                  {getPreview(obj) && <p className="spatial-card-preview">{getPreview(obj)}</p>}
                  <div className="spatial-card-footer">
                    <span className="spatial-card-status">{getStatus(obj)}</span>
                    {obj.embedding && <span className="spatial-card-embedded" />}
                  </div>
                </div>
              )}

              {obj.kind === "project" && (
                <>
                  <div className="spatial-card-accent-bar" />
                  <div className="spatial-card-body">
                    <div className="spatial-card-header">
                      <KindIcon kind={obj.kind} className="kind-icon" />
                      <span className="spatial-card-title">{getDisplayName(obj)}</span>
                    </div>
                    {getPreview(obj) && <p className="spatial-card-preview">{getPreview(obj)}</p>}
                    <div className="spatial-card-footer">
                      <span className="spatial-card-status" style={{ color: KIND_ACCENT[obj.kind] }}>{getStatus(obj)}</span>
                    </div>
                  </div>
                </>
              )}

              {obj.kind === "artifact" && (
                <>
                  {(obj as any).thumbnailDataUrl ? (
                    <>
                      <img className="spatial-card-thumb" src={(obj as any).thumbnailDataUrl} alt={getDisplayName(obj)} />
                      <div className="spatial-card-thumb-label">{getDisplayName(obj)}</div>
                    </>
                  ) : (
                    <>
                      <div className="spatial-card-no-thumb">
                        <ArtifactIcon className="kind-icon" />
                      </div>
                      <div className="spatial-card-thumb-label">{getDisplayName(obj)}</div>
                    </>
                  )}
                </>
              )}
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
          <button className="btn-icon" onClick={() => setTransform((t) => ({ ...t, k: Math.min(3, t.k * 1.25) }))} title="Zoom in">+</button>
          <span className="spatial-zoom-label">{Math.round(transform.k * 100)}%</span>
          <button className="btn-icon" onClick={() => setTransform((t) => ({ ...t, k: Math.max(0.15, t.k * 0.8) }))} title="Zoom out">-</button>
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
