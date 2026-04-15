"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import type { AnyObject, Connection, ObjectKind, Note, Project, Artifact } from "@/types";
import { ProjectSettings } from "./ProjectSettings";
import { ConnectionPopover } from "./ConnectionPopover";
import { NoteIcon, ArtifactIcon } from "./Icons";
import { useCanvasTransform } from "./canvas/hooks/useCanvasTransform";
import { useSelectionState } from "./canvas/hooks/useSelectionState";
import { useDragInteraction } from "./canvas/hooks/useDragInteraction";
import { useKeyboardShortcuts } from "./canvas/hooks/useKeyboardShortcuts";
import type { CanvasMode } from "./canvas/hooks/useKeyboardShortcuts";
import { useRubberBand } from "./canvas/features/useRubberBand";
import { RubberBandSelect } from "./canvas/features/RubberBandSelect";
import { InlineEditor } from "./canvas/features/InlineEditor";
import { useResize } from "./canvas/features/useResize";
import { ResizeHandles } from "./canvas/features/ResizeHandles";
import { useSnapGuides, type SnapGuide } from "./canvas/features/useSnapGuides";
import { SnapGuides } from "./canvas/features/SnapGuides";
import { useUndoRedo } from "./canvas/hooks/useUndoRedo";
import { useContextMenu } from "./canvas/features/useContextMenu";
import { CardContextMenu, CanvasContextMenu } from "./canvas/features/ContextMenu";
import { ConnectionLines } from "./canvas/features/ConnectionLines";
import { useAnchorDrag } from "./canvas/features/useAnchorDrag";
import { AnchorPoints } from "./canvas/features/AnchorPoints";
import { getCardColor, getCardRotation } from "./canvas/cards/cardUtils";
import { StickyNote } from "./canvas/cards/StickyNote";
import { ProjectCard } from "./canvas/cards/ProjectCard";
import { ArtifactCard } from "./canvas/cards/ArtifactCard";

interface Props {
  project?: Project;
  items: AnyObject[];
  connections: Connection[];
  onSelect: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
  onConfirmConnection: (id: string) => void;
  onDismissConnection: (id: string) => void;
  onUpdateObject: (obj: AnyObject) => void;
  onDeleteObjects: (ids: string[]) => void;
  onDuplicateObjects: (ids: string[]) => Promise<string[]>;
  onRestoreObjects: (from: AnyObject[], to: AnyObject[]) => Promise<void>;
  onRestoreConnections: (from: Connection[], to: Connection[]) => Promise<void>;
  onCreateManualConnection: (sourceId: string, targetId: string) => Promise<void>;
  onLogView?: (projectId: string) => void;
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
  project, items, connections, onSelect,
  onUpdatePosition, onCreateAtPosition, onConfirmConnection, onDismissConnection,
  onUpdateObject, onDeleteObjects, onDuplicateObjects,
  onRestoreObjects, onRestoreConnections, onCreateManualConnection, onLogView,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inlineCreate, setInlineCreate] = useState<InlineCreate | null>(null);
  const [popover, setPopover] = useState<{ connection: Connection; x: number; y: number } | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive projectId from items
  const projectId = items.find(i => i.kind === "project")?.id ?? "default";

  // Log view activity after 10 seconds on canvas
  useEffect(() => {
    if (!project?.id || !onLogView) return;
    const timer = setTimeout(() => onLogView(project.id), 10_000);
    return () => clearTimeout(timer);
  }, [project?.id, onLogView]);

  // Hooks
  const { transform, setTransform, canvasBg, cycleBg, animateZoom, onWheel, screenToCanvas } =
    useCanvasTransform(containerRef, projectId);

  const selection = useSelectionState();

  const undoRedo = useUndoRedo({
    restoreObjects: onRestoreObjects,
    restoreConnections: onRestoreConnections,
  });

  const contextMenu = useContextMenu();

  const editStartSnapshot = useRef<AnyObject | null>(null);
  const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const resizeStartSnapshot = useRef<{ id: string; w: number; h: number } | null>(null);

  // Position items without canvasPosition
  const positioned = items.map((obj, i) => {
    if (obj.canvasPosition) return obj;
    const angle = i * 2.4;
    const dist = 140 + i * 35;
    return { ...obj, canvasPosition: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist } };
  });

  const getPositionedItems = useCallback(() => positioned, [positioned]);

  const getCardRects = useCallback(() => {
    const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const obj of positioned) {
      const el = document.getElementById(`card-${obj.id}`);
      if (el) {
        const r = el.getBoundingClientRect();
        rects.set(obj.id, { x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    return rects;
  }, [positioned]);

  const drag = useDragInteraction({
    transform,
    setTransform,
    selectedIds: selection.selectedIds,
    onUpdatePosition,
    getPositionedItems,
  });

  // Stub handlers (will be implemented in later tasks)
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDeleteSelected = useCallback(() => {
    const count = selection.selectedIds.size;
    if (count === 0) return;
    if (count > 3) {
      if (!window.confirm(`Delete ${count} items? This can't be undone.`)) return;
    }
    const ids = Array.from(selection.selectedIds);
    const deletedObjects = positioned.filter((o) => ids.includes(o.id));
    const deletedConnections = connections.filter(
      (c) => ids.includes(c.sourceId) || ids.includes(c.targetId)
    );

    undoRedo.pushUndo({
      description: `Delete ${count} item${count > 1 ? "s" : ""}`,
      before: { objects: deletedObjects, connections: deletedConnections },
      after: { objects: [], connections: [] },
    });

    onDeleteObjects(ids);
    selection.clearSelection();
  }, [selection, onDeleteObjects, positioned, connections, undoRedo]);

  const handleDuplicateSelected = useCallback(async () => {
    if (selection.selectedIds.size === 0) return;
    const newIds = await onDuplicateObjects(Array.from(selection.selectedIds));
    selection.selectAll(newIds);
  }, [selection, onDuplicateObjects]);

  const handleNudge = useCallback((dx: number, dy: number) => {
    for (const id of selection.selectedIds) {
      const obj = positioned.find((o) => o.id === id);
      if (!obj?.canvasPosition) continue;
      onUpdatePosition(id, obj.canvasPosition.x + dx, obj.canvasPosition.y + dy);
    }
  }, [selection.selectedIds, positioned, onUpdatePosition]);

  const handleEnterEdit = useCallback(() => {
    const first = Array.from(selection.selectedIds)[0];
    if (first) setEditingId(first);
  }, [selection.selectedIds]);

  const handleExitEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const onInlineSave = useCallback((updates: Record<string, unknown>) => {
    const obj = positioned.find((o) => o.id === editingId);
    if (!obj) return;
    const updated = { ...obj, ...updates, modifiedAt: Date.now() } as AnyObject;

    if (editStartSnapshot.current) {
      undoRedo.pushUndo({
        description: `Edit ${obj.kind}`,
        before: { objects: [editStartSnapshot.current], connections: [] },
        after: { objects: [updated], connections: [] },
      });
      editStartSnapshot.current = null;
    }

    onUpdateObject(updated);
  }, [editingId, positioned, onUpdateObject, undoRedo]);

  const onCardDoubleClick = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    e.stopPropagation();
    if (selection.selectionCount > 1) {
      selection.select(obj.id);
    }
    editStartSnapshot.current = { ...obj };
    setEditingId(obj.id);
  }, [selection]);

  const rubberBand = useRubberBand({
    onSelectIds: (ids) => selection.selectAll(ids),
    getCardRects,
  });

  const sizeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleUpdateSize = useCallback((id: string, w: number, h: number) => {
    clearTimeout(sizeTimers.current[id]);
    sizeTimers.current[id] = setTimeout(() => {
      delete sizeTimers.current[id];
      const obj = positioned.find((o) => o.id === id);
      if (!obj) return;
      onUpdateObject({ ...obj, canvasSize: { w, h }, modifiedAt: Date.now() } as AnyObject);
    }, 200);
  }, [positioned, onUpdateObject]);

  const { canvasMode, setCanvasMode, spaceHeld } = useKeyboardShortcuts({
    selectedIds: selection.selectedIds,
    clearSelection: selection.clearSelection,
    selectAll: (ids) => selection.selectAll(ids),
    allItemIds: positioned.map((o) => o.id),
    onDeleteSelected: handleDeleteSelected,
    onDuplicateSelected: handleDuplicateSelected,
    onNudge: handleNudge,
    onEnterEdit: handleEnterEdit,
    editingId,
    onExitEdit: handleExitEdit,
    onUndo: undoRedo.undo,
    onRedo: undoRedo.redo,
    onZoomIn: () => animateZoom(Math.min(3, transform.k * 1.25)),
    onZoomOut: () => animateZoom(Math.max(0.15, transform.k * 0.8)),
    onResetZoom: () => animateZoom(1),
  });

  const resize = useResize({
    zoomLevel: transform.k,
    onUpdateSize: handleUpdateSize,
    onUpdatePosition,
  });

  const anchorDrag = useAnchorDrag({
    onConnect: onCreateManualConnection,
    zoomLevel: transform.k,
  });

  const allRects = useMemo(() => {
    return positioned.map((obj) => ({
      id: obj.id,
      x: obj.canvasPosition?.x ?? 0,
      y: obj.canvasPosition?.y ?? 0,
      w: obj.canvasSize?.w ?? 224,
      h: 120, // approximate card height
    }));
  }, [positioned]);

  const snapThreshold = 8 / transform.k;
  const { computeSnap } = useSnapGuides(allRects, selection.selectedIds, snapThreshold);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

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
  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    contextMenu.close();
    if ((e.target as HTMLElement).closest(".spatial-card, .inline-create, .conn-popover, .spatial-controls, .canvas-toolbar")) return;
    setPopover(null);

    if (spaceHeld || canvasMode === "pan") {
      drag.startPan(e);
    } else if (canvasMode === "select") {
      rubberBand.startBand(e);
    } else {
      drag.startPan(e);
    }
  }, [drag, rubberBand, spaceHeld, canvasMode, contextMenu]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (anchorDrag.isDraggingAnchor) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        anchorDrag.onAnchorMouseMove(e.clientX, e.clientY, rect, transform.x, transform.y);
      }
      return;
    }
    if (resize.resizing) {
      resize.onResizeMove(e);
      return;
    }
    if (rubberBand.isActive) {
      rubberBand.moveBand(e);
      return;
    }
    drag.onMouseMove(e);

    // Compute snap guides during drag
    if (drag.dragging) {
      const dx = (e.clientX - drag.dragging.startX) / transform.k;
      const dy = (e.clientY - drag.dragging.startY) / transform.k;
      const obj = positioned.find((o) => o.id === drag.dragging!.id);
      if (obj) {
        const dragRect = {
          id: obj.id,
          x: drag.dragging.objX + dx,
          y: drag.dragging.objY + dy,
          w: obj.canvasSize?.w ?? 224,
          h: 120,
        };
        const result = computeSnap(dragRect);
        setActiveGuides(result.guides);

        // Apply snap offset to the dragged card position
        if (result.snapDx !== 0 || result.snapDy !== 0) {
          const el = document.getElementById(`card-${obj.id}`);
          if (el) {
            el.style.transform = `translate(${dragRect.x + result.snapDx}px, ${dragRect.y + result.snapDy}px)`;
          }
        }
      }
    }
  }, [drag, rubberBand, resize, transform.k, transform.x, transform.y, positioned, computeSnap, anchorDrag]);

  const onMouseUp = useCallback(() => {
    if (anchorDrag.isDraggingAnchor) {
      anchorDrag.cancelAnchorDrag();
      return;
    }

    setActiveGuides([]);

    // Handle resize undo
    if (resize.resizing) {
      const snap = resizeStartSnapshot.current;
      if (snap) {
        const obj = positioned.find((o) => o.id === snap.id);
        if (obj && obj.canvasSize && (obj.canvasSize.w !== snap.w || obj.canvasSize.h !== snap.h)) {
          undoRedo.pushUndo({
            description: "Resize card",
            before: { objects: [{ ...obj, canvasSize: { w: snap.w, h: snap.h } } as AnyObject], connections: [] },
            after: { objects: [obj], connections: [] },
          });
        }
        resizeStartSnapshot.current = null;
      }
      resize.endResize();
      return;
    }

    if (rubberBand.isActive) {
      rubberBand.endBand();
      return;
    }

    // Capture hasMoved before drag.onMouseUp() resets it
    const moved = drag.hasMoved;

    // Check if drag moved items — record undo
    if (moved && dragStartPositions.current.size > 0) {
      const beforeObjects: AnyObject[] = [];
      const afterObjects: AnyObject[] = [];
      for (const [id, startPos] of dragStartPositions.current) {
        const obj = positioned.find((o) => o.id === id);
        if (!obj) continue;
        beforeObjects.push({ ...obj, canvasPosition: startPos } as AnyObject);
        if (obj.canvasPosition && (obj.canvasPosition.x !== startPos.x || obj.canvasPosition.y !== startPos.y)) {
          afterObjects.push(obj);
        }
      }
      if (afterObjects.length > 0) {
        undoRedo.pushUndo({
          description: `Move ${afterObjects.length} item${afterObjects.length > 1 ? "s" : ""}`,
          before: { objects: beforeObjects, connections: [] },
          after: { objects: afterObjects, connections: [] },
        });
      }
      dragStartPositions.current = new Map();
    }

    drag.onMouseUp();
  }, [drag, rubberBand, resize, positioned, undoRedo, anchorDrag]);

  const onCardMouseDown = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    if (editingId === obj.id) return;
    const positions = new Map<string, { x: number; y: number }>();
    const ids = selection.selectedIds.has(obj.id)
      ? selection.selectedIds
      : new Set([obj.id]);
    for (const id of ids) {
      const item = positioned.find((o) => o.id === id);
      if (item?.canvasPosition) {
        positions.set(id, { ...item.canvasPosition });
      }
    }
    dragStartPositions.current = positions;
    drag.startDrag(e, obj);
  }, [drag, editingId, selection.selectedIds, positioned]);

  const onCardClick = useCallback((e: React.MouseEvent, id: string) => {
    if (!drag.didMove(e)) {
      if (e.shiftKey) {
        selection.toggleSelect(id);
      } else {
        selection.select(id);
      }
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


  // Connection line click
  const handleConnectionClick = useCallback((e: React.MouseEvent, conn: Connection) => {
    if (conn.type !== "ai_suggested") return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPopover({ connection: conn, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const canvasClassName = [
    "spatial-canvas",
    canvasMode === "text" ? "text-mode" : "",
    canvasMode === "pan" ? "pan-mode" : "",
    canvasMode === "select" && !spaceHeld ? "select-mode" : "",
    spaceHeld ? "space-pan" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={canvasClassName}
      ref={containerRef}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onClick={onCanvasClick}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".spatial-card, .canvas-toolbar, .conn-popover, .context-menu")) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pos = screenToCanvas(e.clientX, e.clientY);
        contextMenu.openCanvasMenu(e, pos.x, pos.y, rect);
      }}
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
          <ConnectionLines
            connections={activeConns}
            objectMap={objectMap}
            onConnectionClick={handleConnectionClick}
          />
          {/* Anchor points on hovered card */}
          {hoveredCardId && !drag.dragging && (() => {
            const obj = objectMap.get(hoveredCardId);
            if (!obj?.canvasPosition) return null;
            const w = obj.canvasSize?.w ?? 224;
            const h = obj.canvasSize?.h ?? 120;
            return (
              <AnchorPoints
                key={`anchor-${hoveredCardId}`}
                objId={hoveredCardId}
                x={obj.canvasPosition.x}
                y={obj.canvasPosition.y}
                width={w}
                height={h}
                onStartDrag={anchorDrag.startAnchorDrag}
              />
            );
          })()}

          {/* Drag-to-connect rubber band line */}
          {anchorDrag.anchorDrag && (
            <line
              className="anchor-drag-line"
              x1={anchorDrag.anchorDrag.sourceX}
              y1={anchorDrag.anchorDrag.sourceY}
              x2={anchorDrag.anchorDrag.currentX}
              y2={anchorDrag.anchorDrag.currentY}
            />
          )}

          {/* Snap guides */}
          <SnapGuides guides={activeGuides} />
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
              className={`spatial-card spatial-card-${obj.kind} ${isSelected ? "selected" : ""} ${editingId === obj.id ? "editing" : ""}`}
              data-color={color}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                width: obj.canvasSize?.w ?? 224,
                marginLeft: -(obj.canvasSize?.w ?? 224) / 2,
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
              onMouseEnter={() => setHoveredCardId(obj.id)}
              onMouseLeave={() => setHoveredCardId(null)}
              onMouseUp={() => {
                if (anchorDrag.isDraggingAnchor) {
                  anchorDrag.endAnchorDrag(obj.id);
                }
              }}
              onMouseDown={(e) => onCardMouseDown(e, obj)}
              onClick={(e) => onCardClick(e, obj.id)}
              onDoubleClick={(e) => onCardDoubleClick(e, obj)}
              onContextMenu={(e) => {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  if (!selection.isSelected(obj.id)) {
                    selection.select(obj.id);
                  }
                  contextMenu.openCardMenu(e, obj.id, rect);
                }
              }}
            >
              {obj.kind === "note" && <StickyNote obj={obj as Note} />}
              {obj.kind === "project" && <ProjectCard obj={obj as Project} />}
              {obj.kind === "artifact" && <ArtifactCard obj={obj as Artifact} />}
              {selection.selectionCount === 1 && isSelected && !isDragging && editingId !== obj.id && (
                <ResizeHandles
                  kind={obj.kind}
                  onStartResize={(e, handle) => {
                    const w = obj.canvasSize?.w ?? 224;
                    const h = obj.canvasSize?.h ?? 120;
                    resizeStartSnapshot.current = { id: obj.id, w, h };
                    resize.startResize(e, handle, obj.id, obj.kind, w, h, pos.x, pos.y);
                  }}
                />
              )}
            </motion.div>
          );
        })}

        {editingId && (() => {
          const editObj = positioned.find((o) => o.id === editingId);
          if (!editObj?.canvasPosition) return null;
          const pos = editObj.canvasPosition;
          return (
            <div
              className="inline-editor-container"
              style={{
                position: "absolute",
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                width: editObj.canvasSize?.w ?? 224,
                marginLeft: -(editObj.canvasSize?.w ?? 224) / 2,
                marginTop: -50,
                zIndex: 30,
              }}
            >
              <InlineEditor
                obj={editObj}
                onSave={onInlineSave}
                onExit={handleExitEdit}
              />
            </div>
          );
        })()}
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

      {rubberBand.isActive && (
        <RubberBandSelect rect={rubberBand.getBandRect(containerRef.current?.getBoundingClientRect() ?? new DOMRect())} />
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
            className={`canvas-mode-btn ${canvasMode === "pan" ? "active" : ""}`}
            onClick={() => setCanvasMode("pan")}
            title="Pan (H)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3.15M10.05 4.575a1.575 1.575 0 0 1 3.15 0v3.15M10.05 4.575v5.1M13.2 7.725a1.575 1.575 0 0 1 3.15 0v3m-3.15-3v5.1m0-5.1a1.575 1.575 0 0 1 3.15 0m-3.15 0v5.1m3.15-5.1v1.875c0 .621.504 1.125 1.125 1.125M13.2 12.825v-1.875m0 1.875c0 .621-.504 1.125-1.125 1.125m1.125-1.125a1.125 1.125 0 0 1 1.125 1.125m-1.125-1.125v1.875m-6.3-7.5v5.1m0-5.1a1.575 1.575 0 0 0-3.15 0m3.15 0v5.1m-3.15-5.1v1.875c0 .621-.504 1.125-1.125 1.125m0 0A1.125 1.125 0 0 1 3.75 12v-1.875" />
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

        {selection.selectionCount >= 2 && (
          <span className="selection-count">{selection.selectionCount} selected</span>
        )}

        {project && (
          <button
            className="canvas-mode-btn"
            onClick={() => setShowSettings(true)}
            title="Project Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        )}

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

      {contextMenu.menu && contextMenu.menu.target.type === "card" && (
        <CardContextMenu
          position={contextMenu.menu.position}
          target={contextMenu.menu.target}
          onEdit={() => {
            const target = contextMenu.menu?.target;
            if (target?.type === "card") setEditingId(target.id);
          }}
          onDuplicate={() => {
            handleDuplicateSelected();
          }}
          onDelete={() => {
            handleDeleteSelected();
          }}
          onClose={contextMenu.close}
        />
      )}
      {contextMenu.menu && contextMenu.menu.target.type === "canvas" && (
        <CanvasContextMenu
          position={contextMenu.menu.position}
          target={contextMenu.menu.target}
          onAddNote={() => {
            const t = contextMenu.menu?.target;
            if (t?.type === "canvas") {
              onCreateAtPosition("note", "", t.canvasX, t.canvasY);
            }
          }}
          onSelectAll={() => {
            selection.selectAll(positioned.map((o) => o.id));
          }}
          onResetView={() => {
            animateZoom(1);
          }}
          onClose={contextMenu.close}
        />
      )}

      {showSettings && project && (
        <ProjectSettings
          project={project}
          onUpdate={onUpdateObject}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
