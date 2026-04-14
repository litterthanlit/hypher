# Phase 2 — Core Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline editing, resize handles, multi-select with rubber band, and alignment snapping to the spatial canvas — preceded by an architecture extraction that splits the monolithic SpatialCanvas into focused hooks and components.

**Architecture:** Extract shared interaction state into hooks (`useCanvasTransform`, `useSelectionState`, `useDragInteraction`). Build each Phase 2 feature as a hook + component pair that consumes those shared hooks. SpatialCanvas becomes a thin orchestrator.

**Tech Stack:** React 19, Framer Motion, TypeScript, Convex, CSS

---

## File Map

### New files (in `hypher-web/src/components/canvas/`)

| File | Responsibility |
|------|---------------|
| `hooks/useCanvasTransform.ts` | Pan, zoom, animated zoom, viewport math |
| `hooks/useSelectionState.ts` | `selectedIds` Set, toggle, clear, selectAll |
| `hooks/useDragInteraction.ts` | Card drag start/move/end, position writes |
| `hooks/useKeyboardShortcuts.ts` | All keyboard shortcuts (V/H/T/Space/Delete/Cmd+A/D/arrows) |
| `features/RubberBandSelect.tsx` | Selection rectangle component |
| `features/useRubberBand.ts` | Rubber band drag logic + intersection test |
| `features/InlineEditor.tsx` | Edit overlay per card kind |
| `features/ResizeHandles.tsx` | Handle rendering component |
| `features/useResize.ts` | Resize drag logic + config per kind |
| `features/SnapGuides.tsx` | SVG guide line rendering |
| `features/useSnapGuides.ts` | Snap computation + spatial grid |
| `cards/StickyNote.tsx` | Note card component |
| `cards/ProjectCard.tsx` | Project card component |
| `cards/ArtifactCard.tsx` | Artifact card component |
| `cards/cardUtils.ts` | Shared: `getCardColor`, `getCardRotation`, `getPreview`, `getStatus`, `KIND_ACCENT` |

### Modified files

| File | Changes |
|------|---------|
| `src/components/SpatialCanvas.tsx` | Rewrite as thin orchestrator importing hooks + features + cards |
| `src/types/index.ts` | Add `canvasSize` to `HypherObject` |
| `convex/schema.ts` | Add `canvasSize` field |
| `convex/objects.ts` | Add `canvasSize` to mutation args |
| `src/app/globals.css` | Resize handles, rubber band, inline editor, cursor states, pan mode styles |
| `src/app/page.tsx` | Pass new props (`onUpdateObject`, `onDeleteObjects`, `onDuplicateObjects`) |
| `src/lib/useStore.ts` | Add `duplicateObjects()` helper |

---

## Group A: Architecture Extraction (checkpoint after)

> After this group, SpatialCanvas is decomposed into hooks + card components. All existing behavior preserved exactly. No new features.

---

### Task 1: Create cardUtils and card components

**Files:**
- Create: `hypher-web/src/components/canvas/cards/cardUtils.ts`
- Create: `hypher-web/src/components/canvas/cards/StickyNote.tsx`
- Create: `hypher-web/src/components/canvas/cards/ProjectCard.tsx`
- Create: `hypher-web/src/components/canvas/cards/ArtifactCard.tsx`

- [ ] **Step 1: Create cardUtils.ts**

Extract the utility functions and constants from SpatialCanvas.tsx:

```typescript
// hypher-web/src/components/canvas/cards/cardUtils.ts
import type { AnyObject, ObjectKind } from "@/types";
import { getDisplayName } from "@/types";

export const KIND_ACCENT: Record<ObjectKind, string> = {
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

export function getCardColor(obj: AnyObject): string {
  if (obj.canvasColor) return obj.canvasColor;
  if (obj.kind === "note") return defaultCardColor(obj.content);
  return "";
}

export function getCardRotation(id: string): number {
  const c0 = id.charCodeAt(0) || 0;
  const c1 = id.charCodeAt(1) || 0;
  return ((c0 + c1) % 400) / 100 - 2;
}

export function getPreview(obj: AnyObject): string {
  if (obj.kind === "note") return obj.content.slice(0, 120);
  if (obj.kind === "artifact") return obj.fileReference || obj.type;
  return "";
}

export function getStatus(obj: AnyObject): string {
  if (obj.kind === "note") return obj.maturity;
  if (obj.kind === "artifact") return obj.type;
  return "";
}
```

- [ ] **Step 2: Create StickyNote.tsx**

```tsx
// hypher-web/src/components/canvas/cards/StickyNote.tsx
"use client";

import type { Note } from "@/types";
import { getDisplayName } from "@/types";
import { getPreview, getStatus } from "./cardUtils";

interface Props {
  obj: Note;
}

export function StickyNote({ obj }: Props) {
  return (
    <div className="spatial-card-body">
      <span className="spatial-card-title">{getDisplayName(obj)}</span>
      {getPreview(obj) && <p className="spatial-card-preview">{getPreview(obj)}</p>}
      <div className="spatial-card-footer">
        <span className="spatial-card-status">{getStatus(obj)}</span>
        {obj.embedding && <span className="spatial-card-embedded" />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ProjectCard.tsx**

```tsx
// hypher-web/src/components/canvas/cards/ProjectCard.tsx
"use client";

import type { Project } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "../Icons";
import { KIND_ACCENT, getPreview, getStatus } from "./cardUtils";

interface Props {
  obj: Project;
}

export function ProjectCard({ obj }: Props) {
  return (
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
  );
}
```

Note: `KindIcon` import path is `"../Icons"` because card components are in `canvas/cards/` and Icons is in `components/`.

- [ ] **Step 4: Create ArtifactCard.tsx**

```tsx
// hypher-web/src/components/canvas/cards/ArtifactCard.tsx
"use client";

import type { Artifact } from "@/types";
import { getDisplayName } from "@/types";
import { ArtifactIcon } from "../Icons";

interface Props {
  obj: Artifact;
}

export function ArtifactCard({ obj }: Props) {
  return (
    <>
      {obj.thumbnailDataUrl ? (
        <>
          <img className="spatial-card-thumb" src={obj.thumbnailDataUrl} alt={getDisplayName(obj)} />
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
  );
}
```

- [ ] **Step 5: Verify Icons import path**

The Icons file is at `src/components/Icons.tsx`. Card components at `src/components/canvas/cards/`. So the import should be `"../../Icons"`. Read `src/components/Icons.tsx` to confirm it exports `KindIcon`, `ArtifactIcon`, etc., and adjust the import paths in ProjectCard and ArtifactCard if needed.

- [ ] **Step 6: Commit**

```bash
git add hypher-web/src/components/canvas/
git commit -m "refactor: extract card components and cardUtils from SpatialCanvas"
```

---

### Task 2: Create useCanvasTransform hook

**Files:**
- Create: `hypher-web/src/components/canvas/hooks/useCanvasTransform.ts`

- [ ] **Step 1: Create useCanvasTransform.ts**

Extract pan, zoom, animated zoom, and background state from SpatialCanvas:

```typescript
// hypher-web/src/components/canvas/hooks/useCanvasTransform.ts
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newK = Math.min(3, Math.max(0.15, transform.k * delta));
    const ratio = newK / transform.k;
    setTransform({ k: newK, x: mouseX - (mouseX - transform.x) * ratio, y: mouseY - (mouseY - transform.y) * ratio });
  }, [transform, containerRef]);

  // Convert screen coords to canvas coords
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
```

- [ ] **Step 2: Commit**

```bash
git add hypher-web/src/components/canvas/hooks/useCanvasTransform.ts
git commit -m "refactor: extract useCanvasTransform hook from SpatialCanvas"
```

---

### Task 3: Create useSelectionState hook (with multi-select)

**Files:**
- Create: `hypher-web/src/components/canvas/hooks/useSelectionState.ts`

This hook replaces `selectedId: string | null` with `selectedIds: Set<string>` from the start. It also exposes a `primarySelectedId` for backward compatibility with the detail panel.

- [ ] **Step 1: Create useSelectionState.ts**

```typescript
// hypher-web/src/components/canvas/hooks/useSelectionState.ts
"use client";

import { useState, useCallback, useMemo } from "react";

export function useSelectionState() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const primarySelectedId = useMemo(() => {
    const arr = Array.from(selectedIds);
    return arr.length > 0 ? arr[0] : null;
  }, [selectedIds]);

  const select = useCallback((id: string) => {
    if (!id) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return {
    selectedIds,
    primarySelectedId,
    select,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    selectionCount: selectedIds.size,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hypher-web/src/components/canvas/hooks/useSelectionState.ts
git commit -m "refactor: extract useSelectionState hook with multi-select support"
```

---

### Task 4: Create useDragInteraction hook

**Files:**
- Create: `hypher-web/src/components/canvas/hooks/useDragInteraction.ts`

- [ ] **Step 1: Create useDragInteraction.ts**

Extract drag and pan logic. This hook takes the transform and selection state as inputs:

```typescript
// hypher-web/src/components/canvas/hooks/useDragInteraction.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { AnyObject } from "@/types";
import type { Transform } from "./useCanvasTransform";

interface DragState {
  id: string;
  startX: number;
  startY: number;
  objX: number;
  objY: number;
}

interface PanState {
  startX: number;
  startY: number;
  startTx: number;
  startTy: number;
}

interface UseDragInteractionOptions {
  transform: Transform;
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
  selectedIds: Set<string>;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  getPositionedItems: () => AnyObject[];
}

export function useDragInteraction({
  transform, setTransform, selectedIds, onUpdatePosition, getPositionedItems,
}: UseDragInteractionOptions) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const panStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  // Store original positions for multi-select group drag
  const groupStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const startPan = useCallback((e: React.MouseEvent) => {
    setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y });
    panStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);
  }, [transform]);

  const startDrag = useCallback((e: React.MouseEvent, obj: AnyObject) => {
    e.stopPropagation();
    const pos = obj.canvasPosition ?? { x: 0, y: 0 };
    setDragging({ id: obj.id, startX: e.clientX, startY: e.clientY, objX: pos.x, objY: pos.y });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setHasMoved(false);

    // Capture start positions for all selected items (group drag)
    if (selectedIds.has(obj.id) && selectedIds.size > 1) {
      const items = getPositionedItems();
      const map = new Map<string, { x: number; y: number }>();
      for (const id of selectedIds) {
        const item = items.find((i) => i.id === id);
        if (item?.canvasPosition) map.set(id, { ...item.canvasPosition });
      }
      groupStartPositions.current = map;
    } else {
      groupStartPositions.current = new Map();
    }
  }, [selectedIds, getPositionedItems]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / transform.k;
      const dy = (e.clientY - dragging.startY) / transform.k;

      // Move the dragged card
      const el = document.getElementById(`card-${dragging.id}`);
      if (el) el.style.transform = `translate(${dragging.objX + dx}px, ${dragging.objY + dy}px)`;

      // Move other selected cards (group drag)
      for (const [id, startPos] of groupStartPositions.current) {
        if (id === dragging.id) continue;
        const el = document.getElementById(`card-${id}`);
        if (el) el.style.transform = `translate(${startPos.x + dx}px, ${startPos.y + dy}px)`;
      }

      setHasMoved(true);
      return;
    }
    if (panning) {
      setTransform((t) => ({
        ...t,
        x: panning.startTx + (e.clientX - panning.startX),
        y: panning.startTy + (e.clientY - panning.startY),
      }));
      setHasMoved(true);
    }
  }, [dragging, panning, transform.k, setTransform]);

  const onMouseUp = useCallback(() => {
    if (dragging && hasMoved) {
      const dx = (0 as number); // We read final position from DOM
      // Persist dragged card position
      const el = document.getElementById(`card-${dragging.id}`);
      if (el) {
        const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        if (match) onUpdatePosition(dragging.id, parseFloat(match[1]!), parseFloat(match[2]!));
      }
      // Persist group positions
      for (const [id] of groupStartPositions.current) {
        if (id === dragging.id) continue;
        const el = document.getElementById(`card-${id}`);
        if (el) {
          const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
          if (match) onUpdatePosition(id, parseFloat(match[1]!), parseFloat(match[2]!));
        }
      }
    }
    setDragging(null);
    setPanning(null);
    groupStartPositions.current = new Map();
  }, [dragging, hasMoved, onUpdatePosition]);

  const didMove = useCallback((e: React.MouseEvent): boolean => {
    if (dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      return Math.sqrt(dx * dx + dy * dy) >= 5;
    }
    return hasMoved;
  }, [hasMoved]);

  const didPanMove = useCallback((e: React.MouseEvent): boolean => {
    if (panStartPos.current) {
      const dx = e.clientX - panStartPos.current.x;
      const dy = e.clientY - panStartPos.current.y;
      return Math.sqrt(dx * dx + dy * dy) >= 5;
    }
    return false;
  }, []);

  return {
    dragging,
    panning,
    hasMoved,
    startPan,
    startDrag,
    onMouseMove,
    onMouseUp,
    didMove,
    didPanMove,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add hypher-web/src/components/canvas/hooks/useDragInteraction.ts
git commit -m "refactor: extract useDragInteraction hook with group drag support"
```

---

### Task 5: Rewrite SpatialCanvas as orchestrator

**Files:**
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`
- Modify: `hypher-web/src/app/page.tsx`

This is the integration task. Rewrite SpatialCanvas to import hooks and card components. Update the Props interface to support multi-select. Update page.tsx to pass new props.

- [ ] **Step 1: Update SpatialCanvas Props**

The new Props interface:

```typescript
interface Props {
  items: AnyObject[];
  connections: Connection[];
  onSelect: (id: string) => void;           // Called when primary selection changes (for sidebar/detail panel)
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onCreateAtPosition: (kind: ObjectKind, text: string, x: number, y: number) => void;
  onConfirmConnection: (id: string) => void;
  onDismissConnection: (id: string) => void;
  onUpdateObject: (obj: AnyObject) => void;  // For inline editing
  onDeleteObjects: (ids: string[]) => void;  // For multi-select delete
}
```

Remove `selectedId` from Props — selection state now lives inside the canvas via `useSelectionState`.

- [ ] **Step 2: Rewrite SpatialCanvas**

Rewrite the component to use extracted hooks and card components. The file should import:
- `useCanvasTransform` for pan/zoom/background
- `useSelectionState` for selection
- `useDragInteraction` for drag/pan
- `StickyNote`, `ProjectCard`, `ArtifactCard` for card rendering
- `getCardColor`, `getCardRotation` from `cardUtils`

The component body should:
1. Initialize hooks
2. Derive `positioned` items and `activeConns` (same logic as before)
3. Derive `projectId` for background localStorage key
4. Wire `onCanvasMouseDown` to call `startPan` (delegates to drag hook)
5. Wire `onCanvasClick` to call `clearSelection` in select mode, or `setInlineCreate` in text mode
6. Wire `onCardMouseDown` to call `startDrag`
7. Wire `onCardClick` to call `select(id)` (or `toggleSelect(id)` if Shift held)
8. Render layers: grid → connections SVG → cards → popover → inline create → toolbar
9. Pass `onSelect(primarySelectedId)` up to parent whenever selection changes (via `useEffect`)
10. Keep existing inline create, connection popover, and mode switching logic

Key: the existing connection line rendering, inline create flow, popover, and toolbar stay in SpatialCanvas. Only card rendering bodies and state management are extracted.

- [ ] **Step 3: Update page.tsx**

Change the SpatialCanvas usage in page.tsx:

```tsx
<SpatialCanvas
  items={projectItems}
  connections={projectConnections}
  onSelect={store.setSelectedId}
  onUpdatePosition={store.updatePosition}
  onCreateAtPosition={handleCreateAtPosition}
  onConfirmConnection={store.confirmConnection}
  onDismissConnection={store.dismissConnection}
  onUpdateObject={store.updateObject}
  onDeleteObjects={async (ids) => { for (const id of ids) await store.removeObject(id); }}
/>
```

Remove `selectedId={store.selectedId}` since selection is now internal to the canvas.

- [ ] **Step 4: Verify build compiles**

```bash
cd hypher-web && npx next build 2>&1 | tail -10
```

Expected: Compiled successfully.

- [ ] **Step 5: Commit**

```bash
git add hypher-web/src/components/SpatialCanvas.tsx hypher-web/src/app/page.tsx
git commit -m "refactor: rewrite SpatialCanvas as orchestrator with extracted hooks"
```

---

### Task 6: Extraction checkpoint — verify everything works

**Files:** None (verification only)

- [ ] **Step 1: Run build**

```bash
cd hypher-web && npx next build 2>&1 | tail -10
```

- [ ] **Step 2: Manual verification checklist**

Start dev servers and verify:
- [ ] Cards render correctly (notes = sticky notes, projects = accent bar, artifacts = thumbnails)
- [ ] Click card = selects it
- [ ] Drag card = moves it
- [ ] Pan canvas = works
- [ ] Zoom (wheel + buttons) = works
- [ ] Background toggle = cycles patterns
- [ ] Connection lines + popover = works
- [ ] Text mode + inline create = works

- [ ] **Step 3: Fix any issues, commit**

```bash
git add -A && git commit -m "fix: extraction checkpoint fixes"
```

---

## Group B: Data Model + CSS Foundation

---

### Task 7: Add canvasSize to data model + Phase 2 CSS

**Files:**
- Modify: `hypher-web/src/types/index.ts`
- Modify: `hypher-web/convex/schema.ts`
- Modify: `hypher-web/convex/objects.ts`
- Modify: `hypher-web/src/app/globals.css`

- [ ] **Step 1: Add canvasSize to HypherObject**

In `types/index.ts`, add after `canvasColor`:

```typescript
canvasSize?: { w: number; h: number };
```

- [ ] **Step 2: Add canvasSize to Convex schema**

In `convex/schema.ts`, add after `canvasColor`:

```typescript
canvasSize: v.optional(v.object({ w: v.number(), h: v.number() })),
```

- [ ] **Step 3: Add canvasSize to put mutation**

In `convex/objects.ts`, add after `canvasColor`:

```typescript
canvasSize: v.optional(v.object({ w: v.number(), h: v.number() })),
```

- [ ] **Step 4: Add Phase 2 CSS**

Add to `globals.css`:

```css
/* ── Resize handles ── */
.resize-handle {
  position: absolute;
  background: white;
  border: 1px solid rgba(0,0,0,0.2);
  z-index: 10;
  pointer-events: auto;
}

.resize-handle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: -4px;
}

.resize-handle-bar {
  width: 4px;
  height: 24px;
  border-radius: 2px;
  margin-top: -12px;
  margin-left: -2px;
}

/* Handle positions */
.resize-handle[data-pos="n"] { top: 0; left: 50%; cursor: ns-resize; }
.resize-handle[data-pos="s"] { bottom: 0; left: 50%; cursor: ns-resize; }
.resize-handle[data-pos="e"] { top: 50%; right: 0; cursor: ew-resize; }
.resize-handle[data-pos="w"] { top: 50%; left: 0; cursor: ew-resize; }
.resize-handle[data-pos="ne"] { top: 0; right: 0; cursor: nesw-resize; }
.resize-handle[data-pos="nw"] { top: 0; left: 0; cursor: nwse-resize; }
.resize-handle[data-pos="se"] { bottom: 0; right: 0; cursor: nwse-resize; }
.resize-handle[data-pos="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }

/* ── Rubber band selection ── */
.rubber-band {
  position: absolute;
  border: 1px solid #007AFF;
  background: rgba(0, 122, 255, 0.08);
  pointer-events: none;
  z-index: 999;
}

/* ── Inline editor ── */
.inline-editor {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
}

.inline-editor textarea,
.inline-editor input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  resize: none;
  color: inherit;
}

.inline-editor textarea {
  font-size: 14px;
  line-height: 1.5;
}

.spatial-card.editing {
  box-shadow: 0 0 0 2px var(--blue);
  z-index: 30;
}

/* ── Cursor states ── */
.spatial-canvas.pan-mode {
  cursor: grab;
}

.spatial-canvas.pan-mode:active {
  cursor: grabbing;
}

.spatial-canvas.select-mode {
  cursor: crosshair;
}

.spatial-canvas.space-pan {
  cursor: grab;
}

.spatial-canvas.space-pan:active {
  cursor: grabbing;
}

/* ── Snap guides ── */
.snap-guide {
  stroke: #007AFF;
  stroke-width: 1;
  pointer-events: none;
  opacity: 0;
  transition: opacity 100ms ease;
}

.snap-guide.visible {
  opacity: 1;
}

/* ── Selection count indicator ── */
.selection-count {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  padding: 4px 8px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
}

/* ── Auto-height scroll for long notes ── */
.spatial-card-note .spatial-card-body.scrollable {
  max-height: 600px;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
}

.spatial-card-note .spatial-card-body.scrollable::-webkit-scrollbar {
  width: 6px;
}

.spatial-card-note .spatial-card-body.scrollable::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.2);
  border-radius: 3px;
}

.spatial-card-note .spatial-card-body.scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.3);
}
```

- [ ] **Step 5: Commit**

```bash
git add hypher-web/src/types/index.ts hypher-web/convex/schema.ts hypher-web/convex/objects.ts hypher-web/src/app/globals.css
git commit -m "feat: add canvasSize data model and Phase 2 CSS foundation"
```

---

## Group C: Features

---

### Task 8: Keyboard shortcuts + pan mode + Space-to-pan

**Files:**
- Create: `hypher-web/src/components/canvas/hooks/useKeyboardShortcuts.ts`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx` (wire in hook)

- [ ] **Step 1: Create useKeyboardShortcuts.ts**

```typescript
// hypher-web/src/components/canvas/hooks/useKeyboardShortcuts.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import type { AnyObject } from "@/types";

export type CanvasMode = "select" | "pan" | "text";

interface UseKeyboardShortcutsOptions {
  selectedIds: Set<string>;
  clearSelection: () => void;
  selectAll: (ids: string[]) => void;
  allItemIds: string[];
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onNudge: (dx: number, dy: number) => void;
  onEnterEdit: () => void;
  editingId: string | null;
  onExitEdit: () => void;
}

export function useKeyboardShortcuts({
  selectedIds, clearSelection, selectAll, allItemIds,
  onDeleteSelected, onDuplicateSelected, onNudge,
  onEnterEdit, editingId, onExitEdit,
}: UseKeyboardShortcutsOptions) {
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("select");
  const [spaceHeld, setSpaceHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      // Space-to-pan (always, unless typing)
      if (e.code === "Space" && !e.repeat && !isInput) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      // Escape — exit edit or clear selection
      if (e.key === "Escape") {
        if (editingId) {
          onExitEdit();
        } else {
          clearSelection();
        }
        return;
      }

      // Don't handle shortcuts when in an input
      if (isInput) return;

      // Mode switching
      if (e.key === "v" || e.key === "V") { setCanvasMode("select"); return; }
      if (e.key === "h" || e.key === "H") { setCanvasMode("pan"); return; }
      if (e.key === "t" || e.key === "T") { setCanvasMode("text"); return; }

      // Selection shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        selectAll(allItemIds);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (selectedIds.size > 0) onDuplicateSelected();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) onDeleteSelected();
        return;
      }

      // Enter to edit (single selection only)
      if (e.key === "Enter" && selectedIds.size === 1 && !editingId) {
        onEnterEdit();
        return;
      }

      // Arrow key nudge
      const nudgeAmount = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") { e.preventDefault(); onNudge(0, -nudgeAmount); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); onNudge(0, nudgeAmount); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); onNudge(-nudgeAmount, 0); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); onNudge(nudgeAmount, 0); return; }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedIds, clearSelection, selectAll, allItemIds, onDeleteSelected, onDuplicateSelected, onNudge, editingId, onExitEdit, onEnterEdit]);

  return { canvasMode, setCanvasMode, spaceHeld };
}
```

- [ ] **Step 2: Wire into SpatialCanvas**

In SpatialCanvas, replace the existing `canvasMode` state and keyboard `useEffect` with `useKeyboardShortcuts`. Update the canvas className to reflect mode:

```tsx
const canvasClassName = [
  "spatial-canvas",
  canvasMode === "text" ? "text-mode" : "",
  canvasMode === "pan" ? "pan-mode" : "",
  canvasMode === "select" && !spaceHeld ? "select-mode" : "",
  spaceHeld ? "space-pan" : "",
].filter(Boolean).join(" ");
```

Update `onCanvasMouseDown`: if `spaceHeld || canvasMode === "pan"`, call `startPan`. Otherwise in select mode, this is where rubber band will start (Task 9). For now, just call `startPan` as before.

Add H button to toolbar mode switcher (between V and T):

```tsx
<button
  className={`canvas-mode-btn ${canvasMode === "pan" ? "active" : ""}`}
  onClick={() => setCanvasMode("pan")}
  title="Pan (H)"
>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.05 4.575a1.575 1.575 0 1 0-3.15 0v3.15M10.05 4.575a1.575 1.575 0 0 1 3.15 0v3.15M10.05 4.575v5.1M13.2 7.725a1.575 1.575 0 0 1 3.15 0v3m-3.15-3v5.1m0-5.1a1.575 1.575 0 0 1 3.15 0m-3.15 0v5.1m3.15-5.1v1.875c0 .621.504 1.125 1.125 1.125M13.2 12.825v-1.875m0 1.875c0 .621-.504 1.125-1.125 1.125m1.125-1.125a1.125 1.125 0 0 1 1.125 1.125m-1.125-1.125v1.875m-6.3-7.5v5.1m0-5.1a1.575 1.575 0 0 0-3.15 0m3.15 0v5.1m-3.15-5.1v1.875c0 .621-.504 1.125-1.125 1.125m0 0A1.125 1.125 0 0 1 3.75 12v-1.875" />
  </svg>
</button>
```

- [ ] **Step 2b: Implement onNudge handler**

In SpatialCanvas, create the `onNudge` handler that updates positions of all selected items:

```typescript
const handleNudge = useCallback((dx: number, dy: number) => {
  for (const id of selectedIds) {
    const obj = positioned.find((o) => o.id === id);
    if (!obj?.canvasPosition) continue;
    onUpdatePosition(id, obj.canvasPosition.x + dx, obj.canvasPosition.y + dy);
  }
}, [selectedIds, positioned, onUpdatePosition]);
```

Pass it as `onNudge={handleNudge}` to `useKeyboardShortcuts`.

- [ ] **Step 3: Show first-use toast**

In SpatialCanvas, add a `useEffect` that checks `localStorage` for `hypher-select-hint-shown`. If not set and mode is "select", show toast "Drag to select · Hold Space to pan" via `addToast` (pass as prop or call directly). Set the flag.

- [ ] **Step 4: Show selection count in toolbar**

When `selectionCount >= 2`, show between mode switcher and bg toggle:

```tsx
{selectionCount >= 2 && (
  <span className="selection-count">{selectionCount} selected</span>
)}
```

- [ ] **Step 5: Commit**

```bash
git add hypher-web/src/components/canvas/hooks/useKeyboardShortcuts.ts hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: keyboard shortcuts, pan mode (H), Space-to-pan, selection count"
```

---

### Task 9: Rubber band selection

**Files:**
- Create: `hypher-web/src/components/canvas/features/useRubberBand.ts`
- Create: `hypher-web/src/components/canvas/features/RubberBandSelect.tsx`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Create useRubberBand.ts**

```typescript
// hypher-web/src/components/canvas/features/useRubberBand.ts
"use client";

import { useState, useCallback, useRef } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseRubberBandOptions {
  onSelectIds: (ids: string[]) => void;
  getCardRects: () => Map<string, Rect>; // id → { x, y, w, h } in screen coords
}

export function useRubberBand({ onSelectIds, getCardRects }: UseRubberBandOptions) {
  const [band, setBand] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const startBand = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    startRef.current = { x, y };
    setBand({ startX: x, startY: y, currentX: x, currentY: y });
  }, []);

  const moveBand = useCallback((e: React.MouseEvent) => {
    if (!band) return;
    setBand((prev) => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
  }, [band]);

  const endBand = useCallback(() => {
    if (!band) return;
    // Compute selection rectangle in screen space
    const rect: Rect = {
      x: Math.min(band.startX, band.currentX),
      y: Math.min(band.startY, band.currentY),
      w: Math.abs(band.currentX - band.startX),
      h: Math.abs(band.currentY - band.startY),
    };

    // Only select if band is big enough (> 5px)
    if (rect.w > 5 || rect.h > 5) {
      const cardRects = getCardRects();
      const intersecting: string[] = [];
      for (const [id, cr] of cardRects) {
        // AABB intersection test
        if (
          rect.x < cr.x + cr.w &&
          rect.x + rect.w > cr.x &&
          rect.y < cr.y + cr.h &&
          rect.y + rect.h > cr.y
        ) {
          intersecting.push(id);
        }
      }
      onSelectIds(intersecting);
    }

    setBand(null);
    startRef.current = null;
  }, [band, onSelectIds, getCardRects]);

  // Get CSS rect for rendering (relative to container)
  const getBandRect = useCallback((containerRect: DOMRect) => {
    if (!band) return null;
    return {
      left: Math.min(band.startX, band.currentX) - containerRect.left,
      top: Math.min(band.startY, band.currentY) - containerRect.top,
      width: Math.abs(band.currentX - band.startX),
      height: Math.abs(band.currentY - band.startY),
    };
  }, [band]);

  return {
    isActive: band !== null,
    startBand,
    moveBand,
    endBand,
    getBandRect,
  };
}
```

- [ ] **Step 2: Create RubberBandSelect.tsx**

```tsx
// hypher-web/src/components/canvas/features/RubberBandSelect.tsx
"use client";

interface Props {
  rect: { left: number; top: number; width: number; height: number } | null;
}

export function RubberBandSelect({ rect }: Props) {
  if (!rect) return null;
  return (
    <div
      className="rubber-band"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
```

- [ ] **Step 3: Wire rubber band into SpatialCanvas**

In `onCanvasMouseDown`, when in select mode and not `spaceHeld`:
- If clicking on empty canvas, start rubber band instead of pan
- In `onMouseMove`, if rubber band is active, call `moveBand`
- In `onMouseUp`, if rubber band is active, call `endBand`
- Render `<RubberBandSelect rect={...} />` in the canvas container

Implement `getCardRects()` that reads bounding rects of all card DOM elements via `document.getElementById(`card-${id}`)?.getBoundingClientRect()`.

- [ ] **Step 4: Wire Shift+click for toggle select**

In `onCardClick`, check if `e.shiftKey`. If true, call `toggleSelect(id)` instead of `select(id)`.

- [ ] **Step 5: Commit**

```bash
git add hypher-web/src/components/canvas/features/useRubberBand.ts hypher-web/src/components/canvas/features/RubberBandSelect.tsx hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: rubber band selection and Shift+click toggle"
```

---

### Task 10: Inline editing

**Files:**
- Create: `hypher-web/src/components/canvas/features/InlineEditor.tsx`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Create InlineEditor.tsx**

```tsx
// hypher-web/src/components/canvas/features/InlineEditor.tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { AnyObject, Note, Project, Artifact } from "@/types";

interface Props {
  obj: AnyObject;
  onSave: (updates: Partial<Note> | Partial<Project> | Partial<Artifact>) => void;
  onExit: () => void;
}

export function InlineEditor({ obj, onSave, onExit }: Props) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-save on changes (debounced 300ms)
  const debouncedSave = useCallback((updates: Record<string, string>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onSave(updates as any);
    }, 300);
  }, [onSave]);

  // Click outside to exit
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Flush any pending save
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        onExit();
      }
    };
    // Delay to avoid the double-click that opened the editor
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [onExit]);

  // Handle Escape
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onExit();
    }
  };

  if (obj.kind === "note") return <NoteEditor note={obj as Note} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  if (obj.kind === "project") return <ProjectEditor project={obj as Project} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  if (obj.kind === "artifact") return <ArtifactEditor artifact={obj as Artifact} debouncedSave={debouncedSave} onKeyDown={onKeyDown} containerRef={containerRef} />;
  return null;
}

function NoteEditor({ note, debouncedSave, onKeyDown, containerRef }: {
  note: Note;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [content, setContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          debouncedSave({ content: e.target.value });
        }}
        style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.5 }}
        rows={Math.max(3, content.split("\n").length)}
      />
    </div>
  );
}

function ProjectEditor({ project, debouncedSave, onKeyDown, containerRef }: {
  project: Project;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          debouncedSave({ name: e.target.value, description });
        }}
        style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}
      />
      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          debouncedSave({ name, description: e.target.value });
        }}
        style={{ fontSize: 12 }}
        rows={2}
      />
    </div>
  );
}

function ArtifactEditor({ artifact, debouncedSave, onKeyDown, containerRef }: {
  artifact: Artifact;
  debouncedSave: (u: Record<string, string>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [name, setName] = useState(artifact.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div ref={containerRef} className="inline-editor" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          debouncedSave({ name: e.target.value });
        }}
        style={{ fontSize: 11 }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire inline editing into SpatialCanvas**

Add `editingId` state. On card double-click (`onDoubleClick`):
- If multi-select active: clear selection, select clicked card, set `editingId`
- If single select: set `editingId` to clicked card

When `editingId` is set:
- Render `<InlineEditor>` positioned over the card (same position/size as the card)
- Add `editing` class to the card
- Suppress drag on that card (`onMouseDown` returns early if `editingId === obj.id`)

`onSave` calls `onUpdateObject({ ...obj, ...updates, modifiedAt: Date.now() })`.
`onExit` sets `editingId` to null.

- [ ] **Step 3: Commit**

```bash
git add hypher-web/src/components/canvas/features/InlineEditor.tsx hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: inline editing with double-click on cards"
```

---

### Task 11: Resize handles

**Files:**
- Create: `hypher-web/src/components/canvas/features/useResize.ts`
- Create: `hypher-web/src/components/canvas/features/ResizeHandles.tsx`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Create useResize.ts**

```typescript
// hypher-web/src/components/canvas/features/useResize.ts
"use client";

import { useState, useCallback, useRef } from "react";
import type { ObjectKind } from "@/types";

type HandlePos = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ResizeConfig {
  handles: HandlePos[];
  preserveAspect: boolean;
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  autoHeight: boolean;
}

export const RESIZE_CONFIG: Record<ObjectKind, ResizeConfig> = {
  note: {
    handles: ["e", "w"],
    preserveAspect: false,
    minSize: { w: 120, h: 60 },
    maxSize: { w: 800, h: 800 },
    autoHeight: true,
  },
  project: {
    handles: ["e", "w", "se", "sw"],
    preserveAspect: false,
    minSize: { w: 180, h: 100 },
    maxSize: { w: 800, h: 800 },
    autoHeight: false,
  },
  artifact: {
    handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
    preserveAspect: true,
    minSize: { w: 80, h: 80 },
    maxSize: { w: 800, h: 800 },
    autoHeight: false,
  },
};

interface ResizingState {
  id: string;
  handle: HandlePos;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startPosX: number;
  startPosY: number;
  config: ResizeConfig;
  shiftHeld: boolean;
}

interface UseResizeOptions {
  zoomLevel: number;
  onUpdateSize: (id: string, w: number, h: number) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

export function useResize({ zoomLevel, onUpdateSize, onUpdatePosition }: UseResizeOptions) {
  const [resizing, setResizing] = useState<ResizingState | null>(null);
  const sizeOverride = useRef<{ w: number; h: number } | null>(null);

  const startResize = useCallback((
    e: React.MouseEvent,
    handle: HandlePos,
    objId: string,
    kind: ObjectKind,
    currentW: number,
    currentH: number,
    posX: number,
    posY: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const config = RESIZE_CONFIG[kind];
    setResizing({
      id: objId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: currentW,
      startH: currentH,
      startPosX: posX,
      startPosY: posY,
      config,
      shiftHeld: e.shiftKey,
    });
  }, []);

  const onResizeMove = useCallback((e: React.MouseEvent) => {
    if (!resizing) return;
    const dx = (e.clientX - resizing.startX) / zoomLevel;
    const dy = (e.clientY - resizing.startY) / zoomLevel;
    const { handle, startW, startH, startPosX, startPosY, config } = resizing;
    const shiftHeld = e.shiftKey;

    let newW = startW;
    let newH = startH;
    let newX = startPosX;
    let newY = startPosY;

    // Apply deltas based on handle
    if (handle.includes("e")) newW = startW + dx;
    if (handle.includes("w")) { newW = startW - dx; newX = startPosX + dx; }
    if (handle.includes("s")) newH = startH + dy;
    if (handle.includes("n")) { newH = startH - dy; newY = startPosY + dy; }

    // Aspect ratio lock (for artifacts, unless Shift to free-resize)
    if (config.preserveAspect && !shiftHeld) {
      const ratio = startW / startH;
      if (handle === "e" || handle === "w") {
        newH = newW / ratio;
      } else if (handle === "n" || handle === "s") {
        newW = newH * ratio;
      } else {
        // Corner handles: use the larger delta
        const dw = newW - startW;
        const dh = newH - startH;
        if (Math.abs(dw) > Math.abs(dh)) {
          newH = newW / ratio;
        } else {
          newW = newH * ratio;
        }
      }
    }

    // Clamp
    newW = Math.max(config.minSize.w, Math.min(config.maxSize.w, newW));
    newH = Math.max(config.minSize.h, Math.min(config.maxSize.h, newH));

    // Apply via DOM for smooth feedback
    const el = document.getElementById(`card-${resizing.id}`);
    if (el) {
      el.style.width = `${newW}px`;
      if (!config.autoHeight) el.style.height = `${newH}px`;
      el.style.transform = `translate(${newX}px, ${newY}px)`;
      el.style.marginLeft = `${-newW / 2}px`;
    }

    sizeOverride.current = { w: newW, h: newH };
  }, [resizing, zoomLevel]);

  const endResize = useCallback(() => {
    if (!resizing || !sizeOverride.current) { setResizing(null); return; }

    const el = document.getElementById(`card-${resizing.id}`);
    if (el) {
      const match = el.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
      if (match) {
        onUpdatePosition(resizing.id, parseFloat(match[1]!), parseFloat(match[2]!));
      }
    }
    onUpdateSize(resizing.id, sizeOverride.current.w, sizeOverride.current.h);

    setResizing(null);
    sizeOverride.current = null;
  }, [resizing, onUpdateSize, onUpdatePosition]);

  return {
    resizing,
    startResize,
    onResizeMove,
    endResize,
  };
}
```

- [ ] **Step 2: Create ResizeHandles.tsx**

```tsx
// hypher-web/src/components/canvas/features/ResizeHandles.tsx
"use client";

import type { ObjectKind } from "@/types";
import { RESIZE_CONFIG } from "./useResize";

type HandlePos = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Props {
  kind: ObjectKind;
  onStartResize: (e: React.MouseEvent, handle: HandlePos) => void;
}

export function ResizeHandles({ kind, onStartResize }: Props) {
  const config = RESIZE_CONFIG[kind];
  const isBar = kind === "note"; // Notes get bar handles

  return (
    <>
      {config.handles.map((handle) => (
        <div
          key={handle}
          className={`resize-handle ${isBar ? "resize-handle-bar" : "resize-handle-dot"}`}
          data-pos={handle}
          onMouseDown={(e) => onStartResize(e, handle)}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 3: Wire resize into SpatialCanvas**

Initialize `useResize` in SpatialCanvas. Pass `onUpdateSize` that updates `canvasSize` on the object (same debounced pattern as position).

Render `<ResizeHandles>` inside each card's `motion.div` when:
- Exactly 1 item selected (`selectionCount === 1`)
- That item is the current card (`isSelected`)
- Not dragging
- Not editing

Card width: use `obj.canvasSize?.w ?? 224` instead of hardcoded 224px.
Card height: for non-autoHeight kinds, use `obj.canvasSize?.h` if set.

Add resize move/end to the canvas mouse move/up handlers.

- [ ] **Step 4: Commit**

```bash
git add hypher-web/src/components/canvas/features/useResize.ts hypher-web/src/components/canvas/features/ResizeHandles.tsx hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: resize handles with card-type-aware config"
```

---

### Task 12: Snap guides

**Files:**
- Create: `hypher-web/src/components/canvas/features/useSnapGuides.ts`
- Create: `hypher-web/src/components/canvas/features/SnapGuides.tsx`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Create useSnapGuides.ts**

```typescript
// hypher-web/src/components/canvas/features/useSnapGuides.ts
"use client";

import { useMemo, useCallback, useRef } from "react";

interface CardRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  axis: "x" | "y";
  position: number;
}

interface SnapResult {
  guides: SnapGuide[];
  snapDx: number;
  snapDy: number;
}

const CELL_SIZE = 100;

function buildSpatialGrid(rects: CardRect[]): Map<string, string[]> {
  const grid = new Map<string, string[]>();
  for (const r of rects) {
    const x0 = Math.floor(r.x / CELL_SIZE);
    const y0 = Math.floor(r.y / CELL_SIZE);
    const x1 = Math.floor((r.x + r.w) / CELL_SIZE);
    const y1 = Math.floor((r.y + r.h) / CELL_SIZE);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const key = `${cx},${cy}`;
        const arr = grid.get(key) ?? [];
        arr.push(r.id);
        grid.set(key, arr);
      }
    }
  }
  return grid;
}

function getNearbyIds(grid: Map<string, string[]>, rect: CardRect, exclude: Set<string>): Set<string> {
  const ids = new Set<string>();
  const buffer = 2; // Check 2 cells around
  const x0 = Math.floor(rect.x / CELL_SIZE) - buffer;
  const y0 = Math.floor(rect.y / CELL_SIZE) - buffer;
  const x1 = Math.floor((rect.x + rect.w) / CELL_SIZE) + buffer;
  const y1 = Math.floor((rect.y + rect.h) / CELL_SIZE) + buffer;
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const arr = grid.get(`${cx},${cy}`);
      if (arr) for (const id of arr) if (!exclude.has(id)) ids.add(id);
    }
  }
  return ids;
}

export function useSnapGuides(allRects: CardRect[], selectedIds: Set<string>, threshold: number) {
  const grid = useMemo(() => {
    const nonSelected = allRects.filter((r) => !selectedIds.has(r.id));
    return buildSpatialGrid(nonSelected);
  }, [allRects, selectedIds]);

  const rectsMap = useMemo(() => {
    const map = new Map<string, CardRect>();
    for (const r of allRects) map.set(r.id, r);
    return map;
  }, [allRects]);

  const lastCompute = useRef(0);

  const computeSnap = useCallback((dragRect: CardRect): SnapResult => {
    // Throttle to ~30fps
    const now = performance.now();
    if (now - lastCompute.current < 33) return { guides: [], snapDx: 0, snapDy: 0 };
    lastCompute.current = now;

    const nearbyIds = getNearbyIds(grid, dragRect, selectedIds);
    const guides: SnapGuide[] = [];
    let snapDx = 0;
    let snapDy = 0;
    let bestXDist = threshold + 1;
    let bestYDist = threshold + 1;

    const dragCx = dragRect.x + dragRect.w / 2;
    const dragCy = dragRect.y + dragRect.h / 2;
    const dragR = dragRect.x + dragRect.w;
    const dragB = dragRect.y + dragRect.h;

    for (const id of nearbyIds) {
      const r = rectsMap.get(id);
      if (!r) continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rr = r.x + r.w;
      const rb = r.y + r.h;

      // X-axis alignments
      const xChecks = [
        { dragVal: dragRect.x, targetVal: r.x },      // left-left
        { dragVal: dragR, targetVal: rr },              // right-right
        { dragVal: dragCx, targetVal: cx },             // center-center
        { dragVal: dragRect.x, targetVal: rr },         // left-right
        { dragVal: dragR, targetVal: r.x },             // right-left
      ];
      for (const { dragVal, targetVal } of xChecks) {
        const dist = Math.abs(dragVal - targetVal);
        if (dist < bestXDist) {
          bestXDist = dist;
          snapDx = targetVal - dragVal;
          guides.push({ axis: "x", position: targetVal });
        }
      }

      // Y-axis alignments
      const yChecks = [
        { dragVal: dragRect.y, targetVal: r.y },        // top-top
        { dragVal: dragB, targetVal: rb },               // bottom-bottom
        { dragVal: dragCy, targetVal: cy },              // center-center
        { dragVal: dragRect.y, targetVal: rb },          // top-bottom
        { dragVal: dragB, targetVal: r.y },              // bottom-top
      ];
      for (const { dragVal, targetVal } of yChecks) {
        const dist = Math.abs(dragVal - targetVal);
        if (dist < bestYDist) {
          bestYDist = dist;
          snapDy = targetVal - dragVal;
          guides.push({ axis: "y", position: targetVal });
        }
      }
    }

    // Only keep the best guide per axis
    const finalGuides: SnapGuide[] = [];
    if (bestXDist <= threshold) {
      const bestX = guides.filter((g) => g.axis === "x").pop();
      if (bestX) finalGuides.push(bestX);
    } else {
      snapDx = 0;
    }
    if (bestYDist <= threshold) {
      const bestY = guides.filter((g) => g.axis === "y").pop();
      if (bestY) finalGuides.push(bestY);
    } else {
      snapDy = 0;
    }

    return { guides: finalGuides, snapDx, snapDy };
  }, [grid, rectsMap, selectedIds, threshold]);

  return { computeSnap };
}
```

- [ ] **Step 2: Create SnapGuides.tsx**

```tsx
// hypher-web/src/components/canvas/features/SnapGuides.tsx
"use client";

import type { SnapGuide } from "./useSnapGuides";

interface Props {
  guides: SnapGuide[];
  viewportWidth: number;
  viewportHeight: number;
}

export function SnapGuides({ guides, viewportWidth, viewportHeight }: Props) {
  return (
    <>
      {guides.map((guide, i) => (
        guide.axis === "x" ? (
          <line
            key={`guide-${i}`}
            className="snap-guide visible"
            x1={guide.position}
            y1={-10000}
            x2={guide.position}
            y2={10000}
          />
        ) : (
          <line
            key={`guide-${i}`}
            className="snap-guide visible"
            x1={-10000}
            y1={guide.position}
            x2={10000}
            y2={guide.position}
          />
        )
      ))}
    </>
  );
}
```

- [ ] **Step 3: Wire snap guides into SpatialCanvas**

During drag: compute snap guides and apply `snapDx`/`snapDy` to the card position. Render `<SnapGuides>` in the SVG connections layer. Clear guides on drag end.

Build `allRects` from positioned items: `{ id, x: pos.x, y: pos.y, w: obj.canvasSize?.w ?? 224, h: cardHeight }`.

For multi-select drag, compute the group bounding box and snap against that.

- [ ] **Step 4: Commit**

```bash
git add hypher-web/src/components/canvas/features/useSnapGuides.ts hypher-web/src/components/canvas/features/SnapGuides.tsx hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: alignment snap guides with spatial grid bucketing"
```

---

## Group D: Integration + Polish

---

### Task 13: Duplicate objects + delete confirmation

**Files:**
- Modify: `hypher-web/src/lib/useStore.ts`
- Modify: `hypher-web/src/app/page.tsx`
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Add duplicateObjects to useStore**

In `useStore.ts`, add a `duplicateObjects` function that:
1. Takes an array of object IDs
2. For each, reads the object, strips the ID, offsets position by +20px/+20px
3. Calls `addObject` for each (gets new Convex ID)
4. Finds connections between the duplicated objects, creates new connections with new IDs
5. Returns the new IDs

```typescript
const duplicateObjects = async (ids: string[]) => {
  const idMap = new Map<string, string>(); // old ID → new ID
  for (const oldId of ids) {
    const obj = objects.find((o) => o.id === oldId);
    if (!obj) continue;
    const pos = obj.canvasPosition ?? { x: 0, y: 0 };
    const newObj = {
      ...obj,
      id: crypto.randomUUID(), // temporary, will be replaced by Convex
      canvasPosition: { x: pos.x + 20, y: pos.y + 20 },
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    const newId = await addObject(newObj);
    idMap.set(oldId, newId);
  }

  // Duplicate connections between the duplicated items
  const duplicatedSet = new Set(ids);
  const internalConns = connections.filter(
    (c) =>
      (c.type === "manual" || c.type === "ai_confirmed") &&
      duplicatedSet.has(c.sourceId) &&
      duplicatedSet.has(c.targetId)
  );
  for (const conn of internalConns) {
    const newSource = idMap.get(conn.sourceId);
    const newTarget = idMap.get(conn.targetId);
    if (newSource && newTarget) {
      await createManualConnection(newSource, newTarget);
    }
  }

  return Array.from(idMap.values());
};
```

Add `duplicateObjects` to the return object.

- [ ] **Step 2: Wire delete confirmation and duplicate in SpatialCanvas**

The `onDeleteSelected` handler passed to `useKeyboardShortcuts`:

```typescript
const handleDeleteSelected = useCallback(() => {
  const count = selectedIds.size;
  if (count === 0) return;
  if (count > 3) {
    if (!window.confirm(`Delete ${count} items? This can't be undone.`)) return;
  }
  onDeleteObjects(Array.from(selectedIds));
  clearSelection();
}, [selectedIds, onDeleteObjects, clearSelection]);
```

The `onDuplicateSelected` handler:

```typescript
const handleDuplicateSelected = useCallback(async () => {
  const newIds = await onDuplicateObjects(Array.from(selectedIds));
  selectAll(newIds); // Select the new duplicates
}, [selectedIds, onDuplicateObjects, selectAll]);
```

Add `onDuplicateObjects` to Props:

```typescript
onDuplicateObjects: (ids: string[]) => Promise<string[]>;
```

- [ ] **Step 3: Update page.tsx**

Pass the new prop:

```tsx
onDuplicateObjects={store.duplicateObjects}
```

- [ ] **Step 4: Commit**

```bash
git add hypher-web/src/lib/useStore.ts hypher-web/src/app/page.tsx hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: duplicate objects (Cmd+D) and delete confirmation"
```

---

### Task 14: Smoke test

**Files:** None (manual verification)

- [ ] **Step 1: Build check**

```bash
cd hypher-web && npx next build 2>&1 | tail -10
```

- [ ] **Step 2: Multi-select**

- Click card → selects single card
- Shift+click another → both selected
- Cmd+A → all selected
- Escape → clears selection
- Click empty canvas → clears selection
- Drag empty canvas in select mode → rubber band appears, selects intersecting cards
- Toolbar shows "N selected"

- [ ] **Step 3: Pan modes**

- Press H → cursor changes to grab, drag = pan
- Press V → back to select mode
- Hold Space in select mode → temporary pan (cursor = grab)
- Release Space → back to crosshair

- [ ] **Step 4: Inline editing**

- Double-click note → textarea appears with content, cursor in field
- Edit text → auto-saves after 300ms
- Escape → exits edit mode
- Click outside → exits edit mode
- Double-click project → name and description editable
- Enter key with single selection → enters edit
- Double-click during multi-select → clears others, edits clicked card

- [ ] **Step 5: Resize**

- Select single note → side bar handles appear (E, W)
- Drag side handle → width changes, height auto-adjusts
- Select artifact → 8 dot handles appear
- Drag corner → resizes with aspect ratio lock
- Hold Shift → free resize
- Select project → E, W, SE, SW handles
- Multi-select → no resize handles, just selection borders

- [ ] **Step 6: Snap guides**

- Drag a card near another → blue guide lines appear
- Card snaps to alignment
- Guides disappear on release
- Multi-select drag → guides align to group bounding box

- [ ] **Step 7: Keyboard shortcuts**

- Delete/Backspace → removes selected (confirms if >3)
- Cmd+D → duplicates selected (+20px offset)
- Arrow keys → nudge 1px
- Shift+Arrow → nudge 10px

- [ ] **Step 8: Fix any issues, commit**

```bash
git add -A && git commit -m "fix: Phase 2 smoke test fixes"
```
