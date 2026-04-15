# Phase 3 — Power Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add undo/redo, right-click context menus, missing keyboard shortcuts, and polished connection lines to the freeform canvas.

**Architecture:** Snapshot-based undo/redo (not callback closures) stored in a React hook. Context menu as a positioned overlay component. Connection rendering extracted to its own component with SVG markers, anchor dots, and drag-to-connect. All new features wire into the existing callback-prop architecture — mutations stay in `useStore`, canvas orchestration in `SpatialCanvas`.

**Tech Stack:** React 19, TypeScript, Framer Motion, Convex (reactive queries/mutations), SVG for connections

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/components/canvas/hooks/useUndoRedo.ts` | Undo/redo command stack (50 max), snapshot storage, undo/redo execution |
| `src/components/canvas/features/ContextMenu.tsx` | Right-click menu component (card + canvas variants) |
| `src/components/canvas/features/useContextMenu.ts` | Menu open/close state, positioning, click-outside dismiss |
| `src/components/canvas/features/ConnectionLines.tsx` | SVG connection rendering: cubic beziers, arrowhead markers, line styles |
| `src/components/canvas/features/AnchorPoints.tsx` | Hover anchor dots on cards + drag-to-connect rubber band line |
| `src/components/canvas/features/useAnchorDrag.ts` | Drag-to-connect state machine (idle → dragging → complete/cancel) |

### Modified files
| File | Changes |
|------|---------|
| `src/components/SpatialCanvas.tsx` | Wire undo/redo, context menu, new connection components, anchor points |
| `src/components/canvas/hooks/useKeyboardShortcuts.ts` | Add Cmd+Z, Cmd+Shift+Z, Cmd+E, Cmd+0, Cmd+± (copy/paste deferred to Phase 4) |
| `src/app/page.tsx` | Pass undo/redo + createManualConnection callbacks to SpatialCanvas |
| `src/app/globals.css` | Context menu styles, anchor point styles, connection hover styles |

---

## Task 1: Undo/Redo Hook

**Files:**
- Create: `src/components/canvas/hooks/useUndoRedo.ts`

This hook manages a command stack with before/after object snapshots. No Convex calls — it receives restore functions from the parent.

- [ ] **Step 1: Create the useUndoRedo hook**

```typescript
// src/components/canvas/hooks/useUndoRedo.ts
import { useCallback, useRef } from "react";
import type { AnyObject, Connection } from "@/types";

const MAX_STACK = 50;

export interface UndoSnapshot {
  objects: AnyObject[];
  connections: Connection[];
}

export interface UndoCommand {
  description: string;
  before: UndoSnapshot;
  after: UndoSnapshot;
}

interface UseUndoRedoOptions {
  restoreObjects: (before: AnyObject[], after: AnyObject[]) => Promise<void>;
  restoreConnections: (before: Connection[], after: Connection[]) => Promise<void>;
}

export function useUndoRedo({ restoreObjects, restoreConnections }: UseUndoRedoOptions) {
  const undoStack = useRef<UndoCommand[]>([]);
  const redoStack = useRef<UndoCommand[]>([]);
  // Force re-render when stacks change (for canUndo/canRedo)
  const version = useRef(0);
  const [, setVersion] = useState(0);
  const bump = () => { version.current++; setVersion(version.current); };

  const pushUndo = useCallback((command: UndoCommand) => {
    undoStack.current.push(command);
    if (undoStack.current.length > MAX_STACK) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    bump();
  }, []);

  const undo = useCallback(async () => {
    const command = undoStack.current.pop();
    if (!command) return;
    redoStack.current.push(command);
    await restoreObjects(command.after.objects, command.before.objects);
    await restoreConnections(command.after.connections, command.before.connections);
    bump();
  }, [restoreObjects, restoreConnections]);

  const redo = useCallback(async () => {
    const command = redoStack.current.pop();
    if (!command) return;
    undoStack.current.push(command);
    await restoreObjects(command.before.objects, command.after.objects);
    await restoreConnections(command.before.connections, command.after.connections);
    bump();
  }, [restoreObjects, restoreConnections]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { pushUndo, undo, redo, canUndo, canRedo };
}
```

Note: add `import { useState } from "react";` to the import line.

- [ ] **Step 2: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to `useUndoRedo`

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/hooks/useUndoRedo.ts
git commit -m "feat: add useUndoRedo hook with snapshot-based command stack"
```

---

## Task 2: Wire Undo/Redo into Store and SpatialCanvas

**Files:**
- Modify: `src/lib/useStore.ts` — add `restoreObjects` and `restoreConnections` functions
- Modify: `src/components/SpatialCanvas.tsx` — add Props, wire hook, wrap actions
- Modify: `src/app/page.tsx` — pass new callbacks

The restore functions diff the "from" and "to" snapshots to determine what to create, update, or delete.

- [ ] **Step 1: Add restore functions to useStore**

In `src/lib/useStore.ts`, add these two functions inside `useStore()` before the `return` statement (around line 568):

```typescript
  /* ── Undo/redo restore helpers ───────────────────────────────────── */

  const restoreObjects = async (from: AnyObject[], to: AnyObject[]) => {
    const fromMap = new Map(from.map((o) => [o.id, o]));
    const toMap = new Map(to.map((o) => [o.id, o]));

    // Objects in "to" but not "from" → re-create
    for (const obj of to) {
      if (!fromMap.has(obj.id)) {
        await putObjectMut(convexUpdateArgs(obj));
      }
    }

    // Objects in "from" but not "to" → delete
    for (const obj of from) {
      if (!toMap.has(obj.id)) {
        await removeObjectMut({ id: obj.id as Id<"objects"> });
      }
    }

    // Objects in both → restore "to" state
    for (const obj of to) {
      if (fromMap.has(obj.id)) {
        await putObjectMut(convexUpdateArgs(obj));
      }
    }
  };

  const restoreConnections = async (from: Connection[], to: Connection[]) => {
    const fromMap = new Map(from.map((c) => [c.id, c]));
    const toMap = new Map(to.map((c) => [c.id, c]));

    for (const conn of to) {
      if (!fromMap.has(conn.id)) {
        const { id, ...data } = conn;
        await putConnectionMut({ id: id as Id<"connections">, ...data } as any);
      }
    }
    for (const conn of from) {
      if (!toMap.has(conn.id)) {
        await removeConnectionMut({ id: conn.id as Id<"connections"> });
      }
    }
    for (const conn of to) {
      if (fromMap.has(conn.id)) {
        const { id, ...data } = conn;
        await putConnectionMut({ id: id as Id<"connections">, ...data } as any);
      }
    }
  };
```

Add `restoreObjects` and `restoreConnections` to the return object.

- [ ] **Step 2: Add undo/redo props to SpatialCanvas**

In `src/components/SpatialCanvas.tsx`, update the `Props` interface (line 24):

```typescript
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
  onDuplicateObjects: (ids: string[]) => Promise<string[]>;
  onRemoveObject: (id: string) => void;
  onRestoreObjects: (from: AnyObject[], to: AnyObject[]) => Promise<void>;
  onRestoreConnections: (from: Connection[], to: Connection[]) => Promise<void>;
  onCreateManualConnection: (sourceId: string, targetId: string) => Promise<void>;
}
```

- [ ] **Step 3: Initialize useUndoRedo in SpatialCanvas**

Add import and hook call after the existing hooks (around line 63):

```typescript
import { useUndoRedo } from "./canvas/hooks/useUndoRedo";

// Inside the component, after selection hook:
const undoRedo = useUndoRedo({
  restoreObjects: onRestoreObjects,
  restoreConnections: onRestoreConnections,
});
```

- [ ] **Step 4: Wrap delete handler with undo recording**

Replace the existing `handleDeleteSelected` (line 98):

```typescript
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
```

- [ ] **Step 5: Wrap inline edit with undo recording**

Replace `onInlineSave` (line 132):

```typescript
const onInlineSave = useCallback((updates: Record<string, unknown>) => {
  const obj = positioned.find((o) => o.id === editingId);
  if (!obj) return;
  const updated = { ...obj, ...updates, modifiedAt: Date.now() } as AnyObject;

  undoRedo.pushUndo({
    description: `Edit ${obj.kind}`,
    before: { objects: [obj], connections: [] },
    after: { objects: [updated], connections: [] },
  });

  onUpdateObject(updated);
}, [editingId, positioned, onUpdateObject, undoRedo]);
```

- [ ] **Step 6: Track drag start positions for undo on move**

Add a ref to capture positions at drag start. In `SpatialCanvas`, add:

```typescript
const dragStartPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
```

Update `onCardMouseDown` to capture start positions:

```typescript
const onCardMouseDown = useCallback((e: React.MouseEvent, obj: AnyObject) => {
  if (editingId === obj.id) return;
  // Capture positions of all selected items for undo
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
```

In `onMouseUp`, after `drag.onMouseUp()`, push undo if positions changed:

```typescript
const onMouseUp = useCallback(() => {
  setActiveGuides([]);
  if (resize.resizing) {
    resize.endResize();
    return;
  }
  if (rubberBand.isActive) {
    rubberBand.endBand();
    return;
  }

  // Check if drag moved items — record undo
  if (drag.hasMoved && dragStartPositions.current.size > 0) {
    const beforeObjects: AnyObject[] = [];
    const afterObjects: AnyObject[] = [];
    for (const [id, startPos] of dragStartPositions.current) {
      const obj = positioned.find((o) => o.id === id);
      if (!obj) continue;
      beforeObjects.push({ ...obj, canvasPosition: startPos } as AnyObject);
      // Current position is wherever it ended up (from position overrides or DOM)
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
}, [drag, rubberBand, resize, positioned, undoRedo]);
```

Note: `drag.hasMoved` may need to be exposed from `useDragInteraction`. Check if it already is — the audit shows it returns `hasMoved`. If it's a function not a boolean, check the return value after calling `drag.onMouseUp()`. You may need to capture the moved state before calling `drag.onMouseUp()` since that resets state.

- [ ] **Step 6b: Capture size at resize start, record undo at resize end**

Add a ref for resize start state:

```typescript
const resizeStartSnapshot = useRef<{ id: string; w: number; h: number } | null>(null);
```

Modify the `onStartResize` call in the card rendering to also capture:

```typescript
onStartResize={(e, handle) => {
  const w = obj.canvasSize?.w ?? 224;
  const h = obj.canvasSize?.h ?? 120;
  resizeStartSnapshot.current = { id: obj.id, w, h };
  resize.startResize(e, handle, obj.id, obj.kind, w, h, pos.x, pos.y);
}}
```

In `onMouseUp`, after `resize.endResize()`, add undo recording:

```typescript
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
```

- [ ] **Step 6c: Capture content at edit start, record undo at edit save**

Add a ref for the pre-edit state:

```typescript
const editStartSnapshot = useRef<AnyObject | null>(null);
```

Update `onCardDoubleClick` to capture before state:

```typescript
const onCardDoubleClick = useCallback((e: React.MouseEvent, obj: AnyObject) => {
  e.stopPropagation();
  if (selection.selectionCount > 1) {
    selection.select(obj.id);
  }
  editStartSnapshot.current = { ...obj };
  setEditingId(obj.id);
}, [selection]);
```

Update `onInlineSave` to use the captured snapshot:

```typescript
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
```

- [ ] **Step 7: Update page.tsx to pass new props**

In `src/app/page.tsx`, update the SpatialCanvas usage (around line 291):

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
  onDuplicateObjects={store.duplicateObjects}
  onRemoveObject={store.removeObject}
  onRestoreObjects={store.restoreObjects}
  onRestoreConnections={store.restoreConnections}
  onCreateManualConnection={store.createManualConnection}
/>
```

- [ ] **Step 8: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -30`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/components/canvas/hooks/useUndoRedo.ts src/lib/useStore.ts src/components/SpatialCanvas.tsx src/app/page.tsx
git commit -m "feat: wire undo/redo into store and canvas with snapshot recording"
```

---

## Task 3: Keyboard Shortcuts for Undo/Redo + Gaps

**Files:**
- Modify: `src/components/canvas/hooks/useKeyboardShortcuts.ts`
- Modify: `src/components/SpatialCanvas.tsx` — pass new callbacks to hook

- [ ] **Step 1: Add new callbacks to useKeyboardShortcuts options**

In `useKeyboardShortcuts.ts`, extend the options interface:

```typescript
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
  // New Phase 3 callbacks:
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
}
```

- [ ] **Step 2: Add shortcut handlers to the keydown listener**

In the `handleKeyDown` function, add these cases before the existing `meta` key checks:

```typescript
// Undo: Cmd+Z (without Shift)
if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
  e.preventDefault();
  opts.onUndo?.();
  return;
}

// Redo: Cmd+Shift+Z
if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
  e.preventDefault();
  opts.onRedo?.();
  return;
}

// Edit selected: Cmd+E
if ((e.metaKey || e.ctrlKey) && e.key === "e") {
  e.preventDefault();
  opts.onEnterEdit();
  return;
}

// Reset zoom: Cmd+0
if ((e.metaKey || e.ctrlKey) && e.key === "0") {
  e.preventDefault();
  opts.onResetZoom?.();
  return;
}

// Zoom in: Cmd+=
if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
  e.preventDefault();
  opts.onZoomIn?.();
  return;
}

// Zoom out: Cmd+-
if ((e.metaKey || e.ctrlKey) && e.key === "-") {
  e.preventDefault();
  opts.onZoomOut?.();
  return;
}
```

- [ ] **Step 3: Wire new callbacks in SpatialCanvas**

Update the `useKeyboardShortcuts` call (around line 164):

```typescript
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
```

- [ ] **Step 4: Verify it compiles and test manually**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

Manual test: Open canvas, move a card, press Cmd+Z — card should return. Press Cmd+Shift+Z — card moves back.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/hooks/useKeyboardShortcuts.ts src/components/SpatialCanvas.tsx
git commit -m "feat: add Cmd+Z/Shift+Z undo/redo + Cmd+E/0/±/- shortcuts"
```

---

## Task 4: Right-Click Context Menu Component

**Files:**
- Create: `src/components/canvas/features/useContextMenu.ts`
- Create: `src/components/canvas/features/ContextMenu.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create useContextMenu hook**

```typescript
// src/components/canvas/features/useContextMenu.ts
import { useState, useCallback, useEffect } from "react";

export interface MenuPosition {
  x: number;
  y: number;
}

export type MenuTarget =
  | { type: "card"; id: string }
  | { type: "canvas"; canvasX: number; canvasY: number };

interface ContextMenuState {
  position: MenuPosition;
  target: MenuTarget;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const openCardMenu = useCallback((e: React.MouseEvent, id: string, containerRect: DOMRect) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      position: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top },
      target: { type: "card", id },
    });
  }, []);

  const openCanvasMenu = useCallback((e: React.MouseEvent, canvasX: number, canvasY: number, containerRect: DOMRect) => {
    e.preventDefault();
    setMenu({
      position: { x: e.clientX - containerRect.left, y: e.clientY - containerRect.top },
      target: { type: "canvas", canvasX, canvasY },
    });
  }, []);

  const close = useCallback(() => setMenu(null), []);

  // Close on any click or scroll
  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    window.addEventListener("mousedown", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [menu]);

  return { menu, openCardMenu, openCanvasMenu, close };
}
```

- [ ] **Step 2: Create ContextMenu component**

```tsx
// src/components/canvas/features/ContextMenu.tsx
"use client";

import { useRef, useEffect } from "react";
import type { MenuPosition, MenuTarget } from "./useContextMenu";

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}

interface MenuSeparator {
  type: "separator";
}

type MenuEntry = MenuItem | MenuSeparator;

function isSeparator(entry: MenuEntry): entry is MenuSeparator {
  return "type" in entry && entry.type === "separator";
}

interface CardMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "card" };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface CanvasMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "canvas" };
  onAddNote: () => void;
  onSelectAll: () => void;
  onResetView: () => void;
  onClose: () => void;
}

export function CardContextMenu({ position, onEdit, onDuplicate, onDelete, onClose }: CardMenuProps) {
  const entries: MenuEntry[] = [
    { label: "Edit", shortcut: "Enter", onClick: onEdit },
    { label: "Duplicate", shortcut: "⌘D", onClick: onDuplicate },
    { type: "separator" },
    { label: "Delete", shortcut: "⌫", onClick: onDelete, danger: true },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}

export function CanvasContextMenu({ position, onAddNote, onSelectAll, onResetView, onClose }: CanvasMenuProps) {
  const entries: MenuEntry[] = [
    { label: "Add Note", onClick: onAddNote },
    { type: "separator" },
    { label: "Select All", shortcut: "⌘A", onClick: onSelectAll },
    { type: "separator" },
    { label: "Reset View", onClick: onResetView },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}

function ContextMenuBase({
  position,
  entries,
  onClose,
}: {
  position: MenuPosition;
  entries: MenuEntry[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Prevent menu from going off-screen
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const parent = el.offsetParent?.getBoundingClientRect();
    if (!parent) return;

    if (rect.right > parent.right) {
      el.style.left = `${position.x - rect.width}px`;
    }
    if (rect.bottom > parent.bottom) {
      el.style.top = `${position.y - rect.height}px`;
    }
  }, [position]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {entries.map((entry, i) =>
        isSeparator(entry) ? (
          <div key={i} className="context-menu-separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item ${entry.danger ? "danger" : ""}`}
            onClick={() => {
              entry.onClick();
              onClose();
            }}
          >
            <span>{entry.label}</span>
            {entry.shortcut && <span className="context-menu-shortcut">{entry.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add context menu styles to globals.css**

Append to `src/app/globals.css`:

```css
/* ── Context menu ──────────────────────────────────────────────── */

.context-menu {
  position: absolute;
  z-index: 2000;
  min-width: 180px;
  padding: 4px 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08);
  animation: context-menu-in 120ms ease-out;
}

@keyframes context-menu-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 12px;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.context-menu-item:hover {
  background: var(--accent);
  color: white;
}

.context-menu-item.danger:hover {
  background: #e53e3e;
}

.context-menu-shortcut {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: 24px;
}

.context-menu-item:hover .context-menu-shortcut {
  color: rgba(255, 255, 255, 0.7);
}

.context-menu-separator {
  height: 1px;
  margin: 4px 12px;
  background: var(--border);
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/features/useContextMenu.ts src/components/canvas/features/ContextMenu.tsx src/app/globals.css
git commit -m "feat: add right-click context menu component and styles"
```

---

## Task 5: Wire Context Menu into SpatialCanvas

**Files:**
- Modify: `src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Import and initialize context menu**

Add imports:

```typescript
import { useContextMenu } from "./canvas/features/useContextMenu";
import { CardContextMenu, CanvasContextMenu } from "./canvas/features/ContextMenu";
```

Initialize in the component body (after `useUndoRedo`):

```typescript
const contextMenu = useContextMenu();
```

- [ ] **Step 2: Add onContextMenu handler to cards**

On the `motion.div` card element (line 420), add `onContextMenu`:

```tsx
onContextMenu={(e) => {
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect) {
    // Select the card if not already selected
    if (!selection.isSelected(obj.id)) {
      selection.select(obj.id);
    }
    contextMenu.openCardMenu(e, obj.id, rect);
  }
}}
```

- [ ] **Step 3: Add onContextMenu handler to canvas**

On the root `div` (the one with `className={canvasClassName}`), add:

```tsx
onContextMenu={(e) => {
  // Don't show canvas menu if right-clicking on a card
  if ((e.target as HTMLElement).closest(".spatial-card, .canvas-toolbar, .conn-popover")) return;
  const rect = containerRef.current?.getBoundingClientRect();
  if (!rect) return;
  const pos = screenToCanvas(e.clientX, e.clientY);
  contextMenu.openCanvasMenu(e, pos.x, pos.y, rect);
}}
```

- [ ] **Step 4: Render the context menu**

Add right before the closing `</div>` of the root container (before line 593):

```tsx
{contextMenu.menu && contextMenu.menu.target.type === "card" && (
  <CardContextMenu
    position={contextMenu.menu.position}
    target={contextMenu.menu.target}
    onEdit={() => {
      setEditingId(contextMenu.menu!.target.type === "card" ? contextMenu.menu!.target.id : null);
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
      const t = contextMenu.menu!.target;
      if (t.type === "canvas") {
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
```

- [ ] **Step 5: Close context menu on other interactions**

In `onCanvasMouseDown`, add `contextMenu.close()` at the top:

```typescript
const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
  contextMenu.close();
  // ... rest of existing code
```

- [ ] **Step 6: Verify it compiles and test manually**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

Manual test: Right-click a card → menu appears with Edit/Duplicate/Delete. Right-click canvas → menu with Add Note/Select All/Reset View. Clicking an action works and menu closes.

- [ ] **Step 7: Commit**

```bash
git add src/components/SpatialCanvas.tsx
git commit -m "feat: wire right-click context menu into canvas (card + canvas)"
```

---

## Task 6: Connection Line Polish — Arrowheads and Line Styles

**Files:**
- Create: `src/components/canvas/features/ConnectionLines.tsx`
- Modify: `src/components/SpatialCanvas.tsx` — swap inline SVG for new component

This extracts connection rendering and adds: cubic bezier curves, SVG arrowhead markers, differentiated line styles.

- [ ] **Step 1: Create ConnectionLines component**

```tsx
// src/components/canvas/features/ConnectionLines.tsx
"use client";

import type { Connection, AnyObject } from "@/types";

interface ConnectionLinesProps {
  connections: Connection[];
  objectMap: Map<string, AnyObject>;
  onConnectionClick: (e: React.MouseEvent, conn: Connection) => void;
}

export function ConnectionLines({ connections, objectMap, onConnectionClick }: ConnectionLinesProps) {
  return (
    <>
      <defs>
        {/* Solid arrowhead for confirmed/manual connections */}
        <marker
          id="arrow-solid"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8 Z" fill="var(--accent)" opacity={0.6} />
        </marker>

        {/* Open arrowhead for suggested connections */}
        <marker
          id="arrow-open"
          viewBox="0 0 10 8"
          refX="10"
          refY="4"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 4 L 0 8" fill="none" stroke="var(--accent)" strokeWidth={1.5} opacity={0.4} />
        </marker>
      </defs>

      {connections.map((conn) => {
        const source = objectMap.get(conn.sourceId);
        const target = objectMap.get(conn.targetId);
        if (!source?.canvasPosition || !target?.canvasPosition) return null;

        const sp = source.canvasPosition;
        const tp = target.canvasPosition;
        const isSuggested = conn.type === "ai_suggested";
        const isManual = conn.type === "manual";

        // Cubic bezier control points (smoother than quadratic)
        const dx = tp.x - sp.x;
        const dy = tp.y - sp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = Math.min(dist * 0.15, 60);
        // Perpendicular offset for curve
        const nx = -dy / (dist || 1);
        const ny = dx / (dist || 1);
        const cp1x = sp.x + dx * 0.33 + nx * offset;
        const cp1y = sp.y + dy * 0.33 + ny * offset;
        const cp2x = sp.x + dx * 0.67 + nx * offset;
        const cp2y = sp.y + dy * 0.67 + ny * offset;

        const pathD = `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tp.x} ${tp.y}`;

        // Line style per type
        const style = isSuggested
          ? { strokeWidth: 1, dasharray: "6 4", opacity: 0.25, marker: "url(#arrow-open)" }
          : isManual
            ? { strokeWidth: 2, dasharray: "none", opacity: 0.6, marker: "url(#arrow-solid)" }
            : { strokeWidth: 1.5, dasharray: "none", opacity: 0.4, marker: "url(#arrow-solid)" };

        return (
          <g key={conn.id} className="connection-line-group">
            {/* Invisible hit area */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: isSuggested ? "pointer" : "default" }}
              onClick={(e) => onConnectionClick(e as any, conn)}
            />
            {/* Visible line */}
            <path
              d={pathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.dasharray}
              opacity={style.opacity}
              markerEnd={style.marker}
              pointerEvents="none"
              className="connection-line"
            />
          </g>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Add connection hover styles to globals.css**

Append to `src/app/globals.css`:

```css
/* ── Connection line hover ─────────────────────────────────────── */

.connection-line-group:hover .connection-line {
  opacity: 0.8 !important;
  filter: brightness(1.1);
  transition: opacity 100ms ease, filter 100ms ease;
}
```

- [ ] **Step 3: Replace inline connection SVG in SpatialCanvas**

In `SpatialCanvas.tsx`, import the new component:

```typescript
import { ConnectionLines } from "./canvas/features/ConnectionLines";
```

Replace the inline connection mapping (lines 369–406) with:

```tsx
<svg className="spatial-connections" style={{ overflow: "visible" }}>
  <ConnectionLines
    connections={activeConns}
    objectMap={objectMap}
    onConnectionClick={handleConnectionClick}
  />
  <SnapGuides guides={activeGuides} />
</svg>
```

- [ ] **Step 4: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/features/ConnectionLines.tsx src/components/SpatialCanvas.tsx src/app/globals.css
git commit -m "feat: extract ConnectionLines with cubic beziers, arrowheads, and line styles"
```

---

## Task 7: Anchor Points and Drag-to-Connect

**Files:**
- Create: `src/components/canvas/features/useAnchorDrag.ts`
- Create: `src/components/canvas/features/AnchorPoints.tsx`
- Modify: `src/components/SpatialCanvas.tsx` — wire anchor drag
- Modify: `src/app/globals.css` — anchor dot styles

- [ ] **Step 1: Create useAnchorDrag hook**

```typescript
// src/components/canvas/features/useAnchorDrag.ts
import { useState, useCallback } from "react";

interface AnchorDragState {
  sourceId: string;
  sourceX: number;
  sourceY: number;
  currentX: number;
  currentY: number;
}

interface UseAnchorDragOptions {
  onConnect: (sourceId: string, targetId: string) => void;
  zoomLevel: number;
}

export function useAnchorDrag({ onConnect, zoomLevel }: UseAnchorDragOptions) {
  const [dragState, setDragState] = useState<AnchorDragState | null>(null);

  const startAnchorDrag = useCallback((
    e: React.MouseEvent,
    sourceId: string,
    anchorX: number,
    anchorY: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      sourceId,
      sourceX: anchorX,
      sourceY: anchorY,
      currentX: anchorX,
      currentY: anchorY,
    });
  }, []);

  const onMouseMove = useCallback((clientX: number, clientY: number, containerRect: DOMRect, transformX: number, transformY: number) => {
    if (!dragState) return;
    // Convert screen coords to canvas coords
    const canvasX = (clientX - containerRect.left - transformX) / zoomLevel;
    const canvasY = (clientY - containerRect.top - transformY) / zoomLevel;
    setDragState((prev) => prev ? { ...prev, currentX: canvasX, currentY: canvasY } : null);
  }, [dragState, zoomLevel]);

  const endAnchorDrag = useCallback((targetId: string | null) => {
    if (dragState && targetId && targetId !== dragState.sourceId) {
      onConnect(dragState.sourceId, targetId);
    }
    setDragState(null);
  }, [dragState, onConnect]);

  const cancelAnchorDrag = useCallback(() => {
    setDragState(null);
  }, []);

  return {
    anchorDrag: dragState,
    startAnchorDrag,
    onAnchorMouseMove: onMouseMove,
    endAnchorDrag,
    cancelAnchorDrag,
    isDraggingAnchor: dragState !== null,
  };
}
```

- [ ] **Step 2: Create AnchorPoints component**

```tsx
// src/components/canvas/features/AnchorPoints.tsx
"use client";

interface AnchorPointsProps {
  objId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onStartDrag: (e: React.MouseEvent, sourceId: string, anchorX: number, anchorY: number) => void;
}

export function AnchorPoints({ objId, x, y, width, height, onStartDrag }: AnchorPointsProps) {
  const halfW = width / 2;
  const halfH = height / 2;

  const anchors = [
    { cx: x, cy: y - halfH, label: "top" },         // top center
    { cx: x + halfW, cy: y, label: "right" },        // right center
    { cx: x, cy: y + halfH, label: "bottom" },       // bottom center
    { cx: x - halfW, cy: y, label: "left" },          // left center
  ];

  return (
    <g className="anchor-points">
      {anchors.map((a) => (
        <circle
          key={a.label}
          cx={a.cx}
          cy={a.cy}
          r={4}
          className="anchor-dot"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartDrag(e as any, objId, a.cx, a.cy);
          }}
        />
      ))}
    </g>
  );
}
```

- [ ] **Step 3: Add anchor dot styles to globals.css**

Append to `src/app/globals.css`:

```css
/* ── Anchor points ─────────────────────────────────────────────── */

.anchor-points {
  opacity: 0;
  transition: opacity 150ms ease;
  pointer-events: none;
}

.spatial-card:hover + .spatial-connections .anchor-points,
.anchor-points:hover {
  opacity: 1;
  pointer-events: auto;
}

.anchor-dot {
  fill: white;
  stroke: var(--accent);
  stroke-width: 1.5;
  cursor: crosshair;
  transition: transform 100ms ease;
}

.anchor-dot:hover {
  transform: scale(1.5);
  fill: var(--accent);
}

/* Rubber band line while dragging to connect */
.anchor-drag-line {
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 6 4;
  opacity: 0.5;
  pointer-events: none;
}
```

- [ ] **Step 4: Wire anchor drag into SpatialCanvas**

Import and initialize:

```typescript
import { useAnchorDrag } from "./canvas/features/useAnchorDrag";
import { AnchorPoints } from "./canvas/features/AnchorPoints";
```

Initialize hook:

```typescript
const anchorDrag = useAnchorDrag({
  onConnect: onCreateManualConnection,
  zoomLevel: transform.k,
});
```

In the SVG section, after `<ConnectionLines>`, render anchor points for the hovered/selected card. Since detecting hover in SVG is tricky, show anchors for all selected cards:

```tsx
{/* Anchor points on selected cards */}
{Array.from(selection.selectedIds).map((id) => {
  const obj = objectMap.get(id);
  if (!obj?.canvasPosition) return null;
  const w = obj.canvasSize?.w ?? 224;
  const h = 120;
  return (
    <AnchorPoints
      key={`anchor-${id}`}
      objId={id}
      x={obj.canvasPosition.x}
      y={obj.canvasPosition.y}
      width={w}
      height={h}
      onStartDrag={anchorDrag.startAnchorDrag}
    />
  );
})}

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
```

In the `onMouseMove` handler, add anchor drag tracking:

```typescript
if (anchorDrag.isDraggingAnchor) {
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect) {
    anchorDrag.onAnchorMouseMove(e.clientX, e.clientY, rect, transform.x, transform.y);
  }
  return;
}
```

In `onMouseUp`, add anchor drag completion:

```typescript
if (anchorDrag.isDraggingAnchor) {
  // Check if cursor is over a card
  const el = document.elementFromPoint(/* need clientX, clientY from event */);
  // Since onMouseUp doesn't have the event coords, we'll handle this differently.
  // Actually, use the `onMouseUp` on cards instead.
  anchorDrag.cancelAnchorDrag();
  return;
}
```

Better approach — add `onMouseUp` to each card that checks for anchor drag.

On each card `motion.div`, add:

```tsx
onMouseUp={() => {
  if (anchorDrag.isDraggingAnchor) {
    anchorDrag.endAnchorDrag(obj.id);
  }
}}
```

And keep the canvas-level mouseUp as a cancel (no event coords needed — the card-level handler fires first if cursor is over a card):

```typescript
// In onMouseUp, at the top:
if (anchorDrag.isDraggingAnchor) {
  anchorDrag.cancelAnchorDrag();
  return;
}
```

Additionally, track last mouse position in `useAnchorDrag` state so the rubber band line always has current coordinates without needing the mouseUp event:

```typescript
// Already tracked via onAnchorMouseMove updating currentX/currentY in dragState
// The rubber band line reads from anchorDrag.anchorDrag.currentX/Y
```

- [ ] **Step 5: Fix the anchor CSS approach**

The CSS approach for showing anchors on hover won't work well because the cards and SVG are separate DOM subtrees. Instead, manage a `hoveredCardId` state:

```typescript
const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
```

On each card `motion.div`:

```tsx
onMouseEnter={() => setHoveredCardId(obj.id)}
onMouseLeave={() => setHoveredCardId(null)}
```

Then in the SVG, render anchors for hoveredCardId:

```tsx
{hoveredCardId && !drag.dragging && (() => {
  const obj = objectMap.get(hoveredCardId);
  if (!obj?.canvasPosition) return null;
  const w = obj.canvasSize?.w ?? 224;
  return (
    <AnchorPoints
      key={`anchor-${hoveredCardId}`}
      objId={hoveredCardId}
      x={obj.canvasPosition.x}
      y={obj.canvasPosition.y}
      width={w}
      height={obj.canvasSize?.h ?? 120}
      onStartDrag={anchorDrag.startAnchorDrag}
    />
  );
})()}
```

Update the anchor CSS to always be visible (remove the opacity:0 hover approach):

```css
.anchor-points {
  pointer-events: auto;
}
```

- [ ] **Step 6: Verify it compiles and test manually**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

Manual test: Hover a card → 4 anchor dots appear. Drag from a dot to another card → connection created. Drag to empty space → cancelled.

- [ ] **Step 7: Commit**

```bash
git add src/components/canvas/features/useAnchorDrag.ts src/components/canvas/features/AnchorPoints.tsx src/components/SpatialCanvas.tsx src/app/globals.css
git commit -m "feat: anchor points with drag-to-connect for manual connections"
```

---

## Verification Checklist

After all tasks are complete, verify each Phase 3 feature:

- [ ] **Undo/Redo — Move**: Move a card → Cmd+Z reverses position → Cmd+Shift+Z re-applies
- [ ] **Undo/Redo — Delete**: Delete items → Cmd+Z restores them (including connections)
- [ ] **Undo/Redo — Edit**: Edit card content → Cmd+Z restores old text
- [ ] **Undo/Redo — Resize**: Resize a card → Cmd+Z restores old size
- [ ] **Undo/Redo — Multi-select move**: Move 3 cards at once → Cmd+Z restores all 3 positions as one action
- [ ] **Context Menu**: Right-click card → Edit/Duplicate/Delete menu. Right-click canvas → Add Note/Select All/Reset View. Actions work. Menu closes on click-outside.
- [ ] **Keyboard Shortcuts**: Cmd+Z, Cmd+Shift+Z, Cmd+E (edit), Cmd+0 (reset zoom), Cmd+± (zoom). All existing shortcuts still work.
- [ ] **Connection Lines**: Confirmed connections have solid arrowheads. Suggested have dashed + open arrowheads. Manual connections are thicker with solid arrows. Lines are smooth cubic beziers.
- [ ] **Anchor Points**: Hover card → 4 dots at edge midpoints. Drag from dot to another card → manual connection created. Visual rubber band line during drag.
- [ ] **No regressions**: Drag, select, rubber band, inline edit, resize, snap guides all still work.

## Follow-up Optimizations (not blocking)

- **Batch restore mutation**: Current `restoreObjects` calls `putObjectMut` sequentially per object. For undoing large deletes (10+ items), add a Convex `restoreBatch` mutation that handles creates/deletes/updates in a single call via `Promise.all`. Not needed for v1 but improves undo latency at scale.
- **Copy/paste (Cmd+C/V)**: Deferred to Phase 4 where the internal clipboard system is built.
