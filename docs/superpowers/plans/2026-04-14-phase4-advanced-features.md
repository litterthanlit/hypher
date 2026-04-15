# Phase 4 — Advanced Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add z-order layering, copy/paste/duplicate clipboard, improved trackpad/touch support, and a minimap overview to the freeform canvas.

**Architecture:** Z-order is stored as `canvasZIndex` on each object (Convex schema + types), rendered via inline style, with auto-raise on click. Copy/paste uses an internal clipboard ref (not system clipboard) with deep clone + new IDs on paste. Trackpad support improves the existing `onWheel` handler to distinguish pinch (ctrlKey) from scroll. Minimap renders a scaled-down view of all items as colored dots with a draggable viewport rectangle.

**Tech Stack:** React 19, TypeScript, Convex, Framer Motion, SVG

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/components/canvas/features/Minimap.tsx` | Minimap overlay: scaled dots, viewport rect, click-to-jump, drag-to-pan |
| `src/components/canvas/hooks/useClipboard.ts` | Internal clipboard: copy, cut, paste with offset logic |
| `src/components/canvas/hooks/useTouchInteraction.ts` | Touch event handling: one-finger pan/drag, two-finger zoom, long-press |

### Modified files
| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `canvasZIndex?: number` to `HypherObject` |
| `convex/schema.ts` | Add `canvasZIndex` field to objects table |
| `src/components/SpatialCanvas.tsx` | Wire z-order rendering, clipboard, minimap, touch events, trackpad improvements |
| `src/components/canvas/hooks/useCanvasTransform.ts` | Improve onWheel for trackpad pinch vs scroll, add pan inertia |
| `src/components/canvas/hooks/useKeyboardShortcuts.ts` | Add Cmd+C, Cmd+V, Cmd+X, Cmd+M shortcuts |
| `src/components/canvas/features/ContextMenu.tsx` | Add "Bring to Front" / "Send to Back" to card menu |
| `src/app/globals.css` | Minimap styles |

---

## Task 1: Z-Order Data Model

**Files:**
- Modify: `src/types/index.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add canvasZIndex to HypherObject type**

In `src/types/index.ts`, add to the `HypherObject` interface after `canvasSize`:

```typescript
  canvasZIndex?: number;
```

- [ ] **Step 2: Add canvasZIndex to Convex schema**

In `convex/schema.ts`, add to the objects table definition after `canvasSize`:

```typescript
    canvasZIndex: v.optional(v.number()),
```

- [ ] **Step 3: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts convex/schema.ts
git commit -m "feat: add canvasZIndex field to data model for z-order layering"
```

---

## Task 2: Z-Order Rendering and Context Menu Actions

**Files:**
- Modify: `src/components/SpatialCanvas.tsx`
- Modify: `src/components/canvas/features/ContextMenu.tsx`

- [ ] **Step 1: Update card z-index rendering in SpatialCanvas**

Find the card `motion.div` style (currently `zIndex: isDragging ? 1000 : isSelected ? 20 : undefined`). Replace with:

```typescript
zIndex: isDragging ? 1000 : isSelected ? 20 : (obj.canvasZIndex ?? 0),
```

- [ ] **Step 2: Add auto-raise on click**

In the `onCardClick` handler, after selection logic, add z-index raise. First, compute max z-index. Add a helper inside the component:

```typescript
const getMaxZIndex = useCallback(() => {
  let max = 0;
  for (const obj of positioned) {
    if ((obj.canvasZIndex ?? 0) > max) max = obj.canvasZIndex ?? 0;
  }
  return max;
}, [positioned]);
```

Then update `onCardClick`:

```typescript
const onCardClick = useCallback((e: React.MouseEvent, id: string) => {
  if (!drag.didMove(e)) {
    if (e.shiftKey) {
      selection.toggleSelect(id);
    } else {
      selection.select(id);
    }
    // Auto-raise clicked card
    const obj = positioned.find((o) => o.id === id);
    if (obj) {
      const maxZ = getMaxZIndex();
      const currentZ = obj.canvasZIndex ?? 0;
      if (currentZ < maxZ) {
        onUpdateObject({ ...obj, canvasZIndex: maxZ + 1, modifiedAt: Date.now() } as AnyObject);
      }
    }
  }
}, [drag, selection, positioned, getMaxZIndex, onUpdateObject]);
```

- [ ] **Step 3: Add bring-to-front / send-to-back helpers**

Add these callbacks in SpatialCanvas:

```typescript
const handleBringToFront = useCallback(() => {
  const maxZ = getMaxZIndex();
  for (const id of selection.selectedIds) {
    const obj = positioned.find((o) => o.id === id);
    if (obj) {
      onUpdateObject({ ...obj, canvasZIndex: maxZ + 1, modifiedAt: Date.now() } as AnyObject);
    }
  }
}, [selection.selectedIds, positioned, getMaxZIndex, onUpdateObject]);

const handleSendToBack = useCallback(() => {
  let minZ = 0;
  for (const obj of positioned) {
    if ((obj.canvasZIndex ?? 0) < minZ) minZ = obj.canvasZIndex ?? 0;
  }
  for (const id of selection.selectedIds) {
    const obj = positioned.find((o) => o.id === id);
    if (obj) {
      onUpdateObject({ ...obj, canvasZIndex: minZ - 1, modifiedAt: Date.now() } as AnyObject);
    }
  }
}, [selection.selectedIds, positioned, onUpdateObject]);
```

- [ ] **Step 4: Update CardContextMenu to include z-order actions**

In `src/components/canvas/features/ContextMenu.tsx`, update `CardMenuProps`:

```typescript
interface CardMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "card" };
  onEdit: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
  onClose: () => void;
}
```

Update `CardContextMenu` entries:

```typescript
export function CardContextMenu({ position, onEdit, onDuplicate, onBringToFront, onSendToBack, onDelete, onClose }: CardMenuProps) {
  const entries: MenuEntry[] = [
    { label: "Edit", shortcut: "Enter", onClick: onEdit },
    { label: "Duplicate", shortcut: "⌘D", onClick: onDuplicate },
    { type: "separator" },
    { label: "Bring to Front", onClick: onBringToFront },
    { label: "Send to Back", onClick: onSendToBack },
    { type: "separator" },
    { label: "Delete", shortcut: "⌫", onClick: onDelete, danger: true },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}
```

- [ ] **Step 5: Wire new context menu props in SpatialCanvas**

Find the `<CardContextMenu>` rendering and add the new props:

```tsx
<CardContextMenu
  position={contextMenu.menu.position}
  target={contextMenu.menu.target}
  onEdit={() => {
    const target = contextMenu.menu?.target;
    if (target?.type === "card") setEditingId(target.id);
  }}
  onDuplicate={() => handleDuplicateSelected()}
  onBringToFront={handleBringToFront}
  onSendToBack={handleSendToBack}
  onDelete={() => handleDeleteSelected()}
  onClose={contextMenu.close}
/>
```

- [ ] **Step 6: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/SpatialCanvas.tsx src/components/canvas/features/ContextMenu.tsx
git commit -m "feat: z-order layering with auto-raise and context menu actions"
```

---

## Task 3: Internal Clipboard Hook (Copy/Paste)

**Files:**
- Create: `src/components/canvas/hooks/useClipboard.ts`

- [ ] **Step 1: Create the useClipboard hook**

```typescript
// src/components/canvas/hooks/useClipboard.ts
import { useCallback, useRef } from "react";
import type { AnyObject, Connection } from "@/types";

interface ClipboardEntry {
  objects: AnyObject[];
  connections: Connection[];
}

interface UseClipboardOptions {
  getSelectedObjects: () => AnyObject[];
  getConnectionsBetween: (ids: string[]) => Connection[];
  onPaste: (objects: AnyObject[], connections: Connection[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
  screenToCanvas: (x: number, y: number) => { x: number; y: number };
}

export function useClipboard({
  getSelectedObjects,
  getConnectionsBetween,
  onPaste,
  onDelete,
  screenToCanvas,
}: UseClipboardOptions) {
  const clipboard = useRef<ClipboardEntry | null>(null);
  const pasteCount = useRef(0);

  const copy = useCallback(() => {
    const objects = getSelectedObjects();
    if (objects.length === 0) return;
    const ids = objects.map((o) => o.id);
    const connections = getConnectionsBetween(ids);
    clipboard.current = { objects, connections };
    pasteCount.current = 0;
  }, [getSelectedObjects, getConnectionsBetween]);

  const cut = useCallback(() => {
    const objects = getSelectedObjects();
    if (objects.length === 0) return;
    const ids = objects.map((o) => o.id);
    const connections = getConnectionsBetween(ids);
    clipboard.current = { objects, connections };
    pasteCount.current = 0;
    onDelete(ids);
  }, [getSelectedObjects, getConnectionsBetween, onDelete]);

  const paste = useCallback(async (mouseX?: number, mouseY?: number) => {
    if (!clipboard.current || clipboard.current.objects.length === 0) return;
    pasteCount.current++;
    const offset = pasteCount.current * 20;

    // Clone objects with new IDs and offset positions
    const idMap = new Map<string, string>();
    const newObjects = clipboard.current.objects.map((obj) => {
      const newId = crypto.randomUUID();
      idMap.set(obj.id, newId);
      const pos = obj.canvasPosition ?? { x: 0, y: 0 };
      return {
        ...obj,
        id: newId,
        canvasPosition: { x: pos.x + offset, y: pos.y + offset },
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      } as AnyObject;
    });

    // Clone connections between pasted items
    const newConnections = clipboard.current.connections
      .filter((c) => idMap.has(c.sourceId) && idMap.has(c.targetId))
      .map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        sourceId: idMap.get(c.sourceId)!,
        targetId: idMap.get(c.targetId)!,
        createdAt: Date.now(),
      }));

    await onPaste(newObjects, newConnections);
  }, [onPaste]);

  const hasClipboard = clipboard.current !== null && clipboard.current.objects.length > 0;

  return { copy, cut, paste, hasClipboard };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/hooks/useClipboard.ts
git commit -m "feat: add useClipboard hook with copy/cut/paste and ID remapping"
```

---

## Task 4: Wire Clipboard into Canvas + Keyboard Shortcuts

**Files:**
- Modify: `src/components/SpatialCanvas.tsx`
- Modify: `src/components/canvas/hooks/useKeyboardShortcuts.ts`
- Modify: `src/lib/useStore.ts` — add `pasteObjects` function
- Modify: `src/app/page.tsx` — pass new prop

- [ ] **Step 1: Add pasteObjects to useStore**

In `src/lib/useStore.ts`, add before the return statement:

```typescript
  const pasteObjects = async (objects: AnyObject[], conns: Connection[]) => {
    for (const obj of objects) {
      await putObjectMut(convexInsertArgs(obj));
    }
    for (const conn of conns) {
      const { id, ...data } = conn;
      await putConnectionMut(data as any);
    }
  };
```

Add `pasteObjects` to the return object.

- [ ] **Step 2: Add onPasteObjects prop to SpatialCanvas**

In SpatialCanvas Props interface, add:

```typescript
  onPasteObjects: (objects: AnyObject[], connections: Connection[]) => Promise<void>;
```

Destructure it in the component signature.

- [ ] **Step 3: Wire useClipboard in SpatialCanvas**

Add import and initialize:

```typescript
import { useClipboard } from "./canvas/hooks/useClipboard";

// After other hooks:
const clipboard = useClipboard({
  getSelectedObjects: () => {
    return positioned.filter((o) => selection.selectedIds.has(o.id));
  },
  getConnectionsBetween: (ids: string[]) => {
    const idSet = new Set(ids);
    return connections.filter(
      (c) => (c.type === "manual" || c.type === "ai_confirmed") &&
        idSet.has(c.sourceId) && idSet.has(c.targetId)
    );
  },
  onPaste: async (objects, conns) => {
    await onPasteObjects(objects, conns);
    // Select the pasted items
    selection.selectAll(objects.map((o) => o.id));
  },
  onDelete: (ids) => onDeleteObjects(ids),
  screenToCanvas,
});
```

- [ ] **Step 4: Add clipboard shortcuts to useKeyboardShortcuts**

In the options interface, add:

```typescript
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
```

In `handleKeyDown`, add before the existing Cmd+A check:

```typescript
// Copy: Cmd+C
if ((e.metaKey || e.ctrlKey) && e.key === "c") {
  e.preventDefault();
  opts.onCopy?.();
  return;
}

// Cut: Cmd+X
if ((e.metaKey || e.ctrlKey) && e.key === "x") {
  e.preventDefault();
  opts.onCut?.();
  return;
}

// Paste: Cmd+V
if ((e.metaKey || e.ctrlKey) && e.key === "v") {
  e.preventDefault();
  opts.onPaste?.();
  return;
}
```

- [ ] **Step 5: Wire clipboard callbacks in SpatialCanvas's useKeyboardShortcuts call**

Add to the existing hook options:

```typescript
onCopy: clipboard.copy,
onCut: clipboard.cut,
onPaste: () => clipboard.paste(),
```

- [ ] **Step 6: Add "Paste" to canvas context menu**

In `ContextMenu.tsx`, update `CanvasMenuProps`:

```typescript
interface CanvasMenuProps {
  position: MenuPosition;
  target: MenuTarget & { type: "canvas" };
  onAddNote: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onResetView: () => void;
  onClose: () => void;
}
```

Update `CanvasContextMenu` entries:

```typescript
export function CanvasContextMenu({ position, onAddNote, onPaste, onSelectAll, onResetView, onClose }: CanvasMenuProps) {
  const entries: MenuEntry[] = [
    { label: "Add Note", onClick: onAddNote },
    { type: "separator" },
    { label: "Paste", shortcut: "⌘V", onClick: onPaste },
    { label: "Select All", shortcut: "⌘A", onClick: onSelectAll },
    { type: "separator" },
    { label: "Reset View", onClick: onResetView },
  ];

  return <ContextMenuBase position={position} entries={entries} onClose={onClose} />;
}
```

- [ ] **Step 7: Wire paste in canvas context menu rendering**

In SpatialCanvas, update the `<CanvasContextMenu>` to pass `onPaste`:

```tsx
onPaste={() => clipboard.paste()}
```

- [ ] **Step 8: Pass pasteObjects from page.tsx**

In `src/app/page.tsx`, add to the SpatialCanvas props:

```tsx
onPasteObjects={store.pasteObjects}
```

- [ ] **Step 9: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/SpatialCanvas.tsx src/components/canvas/hooks/useKeyboardShortcuts.ts src/components/canvas/features/ContextMenu.tsx src/lib/useStore.ts src/app/page.tsx
git commit -m "feat: wire copy/cut/paste with Cmd+C/X/V and context menu"
```

---

## Task 5: Improved Trackpad Support

**Files:**
- Modify: `src/components/canvas/hooks/useCanvasTransform.ts`

The current `onWheel` treats all wheel events the same. We need to distinguish trackpad pinch (ctrlKey) from two-finger scroll, and make pinch zoom smoother.

- [ ] **Step 1: Update onWheel to distinguish pinch from scroll**

Replace the current `onWheel` in `useCanvasTransform.ts`:

```typescript
const onWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault();
  const rect = containerRef.current?.getBoundingClientRect();
  if (!rect) return;

  if (e.ctrlKey) {
    // Trackpad pinch-to-zoom (Chrome/Firefox send ctrlKey+deltaY for pinch)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.01;
    const newK = Math.min(3, Math.max(0.15, transform.k * (1 + delta)));
    const ratio = newK / transform.k;
    setTransform({
      k: newK,
      x: mouseX - (mouseX - transform.x) * ratio,
      y: mouseY - (mouseY - transform.y) * ratio,
    });
  } else if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
    // Two-finger scroll → pan
    // Also handles mouse wheel (deltaY only, no deltaX)
    if (e.deltaMode === 0) {
      // Pixel mode (trackpad) — direct pan
      setTransform((t) => ({
        ...t,
        x: t.x - e.deltaX,
        y: t.y - e.deltaY,
      }));
    } else {
      // Line mode (mouse wheel) — zoom at cursor
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
    }
  }
}, [transform, containerRef]);
```

Key changes:
- `ctrlKey` → pinch-to-zoom with smooth scaling (`deltaY * 0.01`)
- `deltaMode === 0` (pixel) → two-finger scroll pans directly
- `deltaMode !== 0` (line) → mouse wheel zooms at cursor (existing behavior)

- [ ] **Step 2: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/canvas/hooks/useCanvasTransform.ts
git commit -m "feat: improve trackpad support — pinch-to-zoom and two-finger pan"
```

---

## Task 6: Touch Event Support

**Files:**
- Create: `src/components/canvas/hooks/useTouchInteraction.ts`
- Modify: `src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Create useTouchInteraction hook**

```typescript
// src/components/canvas/hooks/useTouchInteraction.ts
import { useCallback, useRef } from "react";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface UseTouchOptions {
  transform: Transform;
  setTransform: (t: Transform | ((prev: Transform) => Transform)) => void;
  onCardDragStart?: (id: string, e: TouchEvent) => void;
  onLongPress?: (x: number, y: number) => void;
}

interface TouchState {
  type: "pan" | "pinch";
  startX: number;
  startY: number;
  startDist?: number;
  startK?: number;
  startTransform: Transform;
}

export function useTouchInteraction({ transform, setTransform, onLongPress }: UseTouchOptions) {
  const touchState = useRef<TouchState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const getTouchDist = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    clearLongPress();

    if (e.touches.length === 2) {
      // Two-finger pinch
      e.preventDefault();
      const dist = getTouchDist(e.touches[0]!, e.touches[1]!);
      const center = getTouchCenter(e.touches[0]!, e.touches[1]!);
      touchState.current = {
        type: "pinch",
        startX: center.x,
        startY: center.y,
        startDist: dist,
        startK: transform.k,
        startTransform: { ...transform },
      };
    } else if (e.touches.length === 1) {
      // Single finger — could be pan or long press
      const touch = e.touches[0]!;
      touchState.current = {
        type: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        startTransform: { ...transform },
      };

      // Long press detection (500ms)
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          onLongPress(touch.clientX, touch.clientY);
          touchState.current = null;
        }, 500);
      }
    }
  }, [transform, onLongPress]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    clearLongPress();
    if (!touchState.current) return;

    if (touchState.current.type === "pinch" && e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches[0]!, e.touches[1]!);
      const center = getTouchCenter(e.touches[0]!, e.touches[1]!);
      const scale = dist / (touchState.current.startDist ?? 1);
      const newK = Math.min(3, Math.max(0.15, (touchState.current.startK ?? 1) * scale));
      const ratio = newK / (touchState.current.startK ?? 1);

      // Pan + zoom relative to pinch center
      const st = touchState.current.startTransform;
      const rect = (e.target as HTMLElement).closest(".spatial-canvas")?.getBoundingClientRect();
      if (!rect) return;
      const cx = touchState.current.startX - rect.left;
      const cy = touchState.current.startY - rect.top;
      const dx = center.x - touchState.current.startX;
      const dy = center.y - touchState.current.startY;

      setTransform({
        k: newK,
        x: cx - (cx - st.x) * ratio + dx,
        y: cy - (cy - st.y) * ratio + dy,
      });
    } else if (touchState.current.type === "pan" && e.touches.length === 1) {
      const touch = e.touches[0]!;
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;
      const st = touchState.current.startTransform;
      setTransform({ ...st, x: st.x + dx, y: st.y + dy });
    }
  }, [setTransform]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPress();
    if (e.touches.length === 0) {
      touchState.current = null;
    } else if (e.touches.length === 1 && touchState.current?.type === "pinch") {
      // Went from 2 fingers to 1 — switch to pan
      const touch = e.touches[0]!;
      touchState.current = {
        type: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        startTransform: { ...transform },
      };
    }
  }, [transform]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
```

- [ ] **Step 2: Wire touch events into SpatialCanvas**

Add import:

```typescript
import { useTouchInteraction } from "./canvas/hooks/useTouchInteraction";
```

Initialize hook:

```typescript
const touch = useTouchInteraction({
  transform,
  setTransform,
  onLongPress: (clientX, clientY) => {
    // Open context menu at long-press position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = screenToCanvas(clientX, clientY);
    contextMenu.openCanvasMenu(
      { preventDefault: () => {}, clientX, clientY } as any,
      pos.x, pos.y, rect
    );
  },
});
```

Add touch handlers to the root div (alongside existing mouse handlers):

```tsx
onTouchStart={touch.onTouchStart}
onTouchMove={touch.onTouchMove}
onTouchEnd={touch.onTouchEnd}
```

- [ ] **Step 3: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/canvas/hooks/useTouchInteraction.ts src/components/SpatialCanvas.tsx
git commit -m "feat: touch support — one-finger pan, two-finger pinch-to-zoom, long-press menu"
```

---

## Task 7: Minimap Component

**Files:**
- Create: `src/components/canvas/features/Minimap.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create Minimap component**

```tsx
// src/components/canvas/features/Minimap.tsx
"use client";

import { useCallback, useRef } from "react";
import type { AnyObject } from "@/types";

interface Transform {
  x: number;
  y: number;
  k: number;
}

interface MinimapProps {
  items: AnyObject[];
  transform: Transform;
  containerWidth: number;
  containerHeight: number;
  onPanTo: (x: number, y: number) => void;
  visible: boolean;
}

const MINIMAP_W = 160;
const MINIMAP_H = 120;
const PADDING = 48;

const DOT_COLORS: Record<string, string> = {
  project: "var(--accent)",
  note: "#5b9bd5",
  artifact: "#d4a853",
};

export function Minimap({ items, transform, containerWidth, containerHeight, onPanTo, visible }: MinimapProps) {
  const dragging = useRef(false);

  if (!visible || items.length < 5) return null;

  // Compute bounding box of all items
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    if (!item.canvasPosition) continue;
    const { x, y } = item.canvasPosition;
    const w = item.canvasSize?.w ?? 224;
    const h = 120;
    if (x - w / 2 < minX) minX = x - w / 2;
    if (y - h / 2 < minY) minY = y - h / 2;
    if (x + w / 2 > maxX) maxX = x + w / 2;
    if (y + h / 2 > maxY) maxY = y + h / 2;
  }

  if (!isFinite(minX)) return null;

  // Add padding
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  // Viewport rectangle in minimap coordinates
  const vpLeft = (-transform.x / transform.k - minX) * scale;
  const vpTop = (-transform.y / transform.k - minY) * scale;
  const vpWidth = (containerWidth / transform.k) * scale;
  const vpHeight = (containerHeight / transform.k) * scale;

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).closest(".minimap")?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert minimap coords to canvas coords
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onPanTo(canvasX, canvasY);
  }, [scale, minX, minY, onPanTo]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".minimap-viewport")) {
      dragging.current = true;
      e.stopPropagation();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const rect = (e.target as HTMLElement).closest(".minimap")?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const canvasX = mx / scale + minX;
    const canvasY = my / scale + minY;
    onPanTo(canvasX, canvasY);
  }, [scale, minX, minY, onPanTo]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      className="minimap"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H}>
        {/* Item dots */}
        {items.map((item) => {
          if (!item.canvasPosition) return null;
          const cx = (item.canvasPosition.x - minX) * scale;
          const cy = (item.canvasPosition.y - minY) * scale;
          return (
            <circle
              key={item.id}
              cx={cx}
              cy={cy}
              r={3}
              fill={DOT_COLORS[item.kind] ?? "#999"}
            />
          );
        })}

        {/* Viewport rectangle */}
        <rect
          className="minimap-viewport"
          x={vpLeft}
          y={vpTop}
          width={Math.max(vpWidth, 4)}
          height={Math.max(vpHeight, 4)}
          fill="rgba(0, 122, 255, 0.08)"
          stroke="var(--accent)"
          strokeWidth={1}
          rx={2}
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Add minimap styles to globals.css**

Append:

```css
/* ── Minimap ───────────────────────────────────────────────────── */

.minimap {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 160px;
  height: 120px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 100;
  cursor: pointer;
  overflow: hidden;
}

.minimap-viewport {
  cursor: grab;
}

.minimap-viewport:active {
  cursor: grabbing;
}
```

- [ ] **Step 3: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/canvas/features/Minimap.tsx src/app/globals.css
git commit -m "feat: add minimap component with viewport navigation"
```

---

## Task 8: Wire Minimap into Canvas + Toggle Shortcut

**Files:**
- Modify: `src/components/SpatialCanvas.tsx`
- Modify: `src/components/canvas/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Add Cmd+M toggle shortcut**

In `useKeyboardShortcuts.ts`, add to options interface:

```typescript
  onToggleMinimap?: () => void;
```

Add handler in `handleKeyDown`:

```typescript
// Toggle minimap: Cmd+M
if ((e.metaKey || e.ctrlKey) && e.key === "m") {
  e.preventDefault();
  opts.onToggleMinimap?.();
  return;
}
```

- [ ] **Step 2: Wire minimap into SpatialCanvas**

Add import:

```typescript
import { Minimap } from "./canvas/features/Minimap";
```

Add state:

```typescript
const [minimapVisible, setMinimapVisible] = useState(true);
```

Add `panTo` helper:

```typescript
const panTo = useCallback((canvasX: number, canvasY: number) => {
  const rect = containerRef.current?.getBoundingClientRect();
  if (!rect) return;
  // Center the target point in the viewport
  setTransform((t) => ({
    ...t,
    x: rect.width / 2 - canvasX * t.k,
    y: rect.height / 2 - canvasY * t.k,
  }));
}, [containerRef, setTransform]);
```

Wire `onToggleMinimap` in useKeyboardShortcuts call:

```typescript
onToggleMinimap: () => setMinimapVisible((v) => !v),
```

Render minimap after the canvas toolbar (inside root div):

```tsx
<Minimap
  items={positioned}
  transform={transform}
  containerWidth={containerRef.current?.clientWidth ?? 0}
  containerHeight={containerRef.current?.clientHeight ?? 0}
  onPanTo={panTo}
  visible={minimapVisible}
/>
```

- [ ] **Step 3: Verify and commit**

Run: `cd hypher-web && npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/SpatialCanvas.tsx src/components/canvas/hooks/useKeyboardShortcuts.ts
git commit -m "feat: wire minimap with Cmd+M toggle and click-to-navigate"
```

---

## Verification Checklist

- [ ] **Z-order**: Click a card → it comes to front. Right-click → "Bring to Front" / "Send to Back" work. Z-order persists across reload.
- [ ] **Copy/paste**: Select cards → Cmd+C → Cmd+V → pasted copies appear offset +20px. Cmd+X cuts (removes originals). Connections between copied items are duplicated.
- [ ] **Trackpad**: Two-finger scroll pans. Pinch zooms at cursor center. Mouse wheel still zooms.
- [ ] **Touch**: One-finger drag pans canvas. Two-finger pinch zooms. Long-press opens context menu.
- [ ] **Minimap**: Shows colored dots for all items. Viewport rectangle matches screen view. Click minimap jumps to area. Drag viewport to pan. Cmd+M toggles visibility. Auto-hides with < 5 items.
- [ ] **No regressions**: Undo/redo, context menu, drag, select, connections all still work.

## Follow-up Optimizations (not blocking)

- **Pan inertia**: After releasing two-finger pan, apply momentum with exponential decay. Requires tracking velocity from last 3 touch/wheel events.
- **Minimap connection lines**: Draw thin grey lines between dots for connections. Skipped in v1 for simplicity.
- **Paste at mouse position**: Currently pastes offset from original position. Could paste centered on current mouse position if tracked.
