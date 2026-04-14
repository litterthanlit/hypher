# Phase 2 — Core Interactions Design Spec

> Add inline editing, resize handles, multi-select with rubber band, and alignment snapping to the spatial canvas.

**Branch:** `litterthanlit/capture-first-ui`
**Prerequisites:** Phase 1 (Framer Motion, sticky notes, card colors)
**Data model change:** Add `canvasSize?: { w: number; h: number }` to objects

---

## 0. Architecture: Extract Shared Interaction Layer

SpatialCanvas.tsx is ~500 lines. Before adding Phase 2 features, extract shared hooks so new features plug into clean APIs.

### File structure

```
components/canvas/
  SpatialCanvas.tsx              ← thin orchestrator (~200 lines)
  hooks/
    useCanvasTransform.ts        ← pan, zoom, viewport math, animateZoom
    useSelectionState.ts         ← selectedIds Set, toggle, clear, selectAll
    useDragInteraction.ts        ← drag start/move/end, position updates
    useKeyboardShortcuts.ts      ← V/H/T/Space + Delete, Cmd+A, Cmd+D, arrows
  features/
    SnapGuides.tsx               ← renders guide lines in SVG layer
    useSnapGuides.ts             ← computes snap positions from card rects
    ResizeHandles.tsx            ← renders handle dots/bars on selected card
    useResize.ts                 ← resize drag logic, config per card kind
    RubberBandSelect.tsx         ← renders selection rectangle
    useRubberBand.ts             ← rubber band drag logic, intersection test
    InlineEditor.tsx             ← edit overlay for notes/projects/artifacts
  cards/
    StickyNote.tsx               ← note card rendering
    ProjectCard.tsx              ← project card rendering
    ArtifactCard.tsx             ← artifact card rendering
```

### Extraction rules

- Each hook exposes a clear interface (state + handlers)
- SpatialCanvas orchestrates: wires hooks, renders layers (grid → connections → cards → guides → rubber band → inline editor)
- Card components receive props, no internal state beyond local UI (hover, etc.)
- Existing behavior must be preserved exactly during extraction — no feature changes in the refactor step

---

## 1. Inline Editing (Double-Click)

### Entry

- **Double-click** any card → enters edit mode on that card
- **Enter key** with exactly one item selected → enters edit mode
- **Double-click during multi-select** → clears selection, selects clicked card, enters edit mode

### Edit UI per card kind

- **Notes:** `<textarea>` replaces preview text. Full content visible. Auto-grows height. Font/size matches display style (14px, 400 weight, card color text).
- **Projects:** Name becomes `<input>` (14px semibold), description becomes `<textarea>` (12px). Two fields, Tab moves between them.
- **Artifacts:** Name becomes `<input>` (11px). Single field.

### Behavior

- **Exit:** Escape, click outside card, or blur. Auto-saves on blur with 300ms debounce via `updateObject()`.
- **While editing:** card dragging disabled (`pointer-events` on text, not drag). Cursor = text. Subtle blue border (`0 0 0 2px var(--blue)`).
- **Focus management:** On enter, focus the input/textarea and select all text. On exit, return focus to the card element.
- **State:** `editingId: string | null` in the orchestrator. Passed to `InlineEditor` component which renders the appropriate inputs.

### InlineEditor component

```typescript
interface InlineEditorProps {
  obj: AnyObject;
  onSave: (updates: Partial<AnyObject>) => void;
  onExit: () => void;
}
```

Renders absolutely positioned over the card. Matches card dimensions. Different input layouts per `obj.kind`.

---

## 2. Resize Handles

### Card-type-aware config

| Kind | Handles | Aspect Lock | Auto-Height | Handle Visual |
|------|---------|-------------|-------------|---------------|
| Note | E, W (sides only) | No | Yes | Bar (4×24px vertical) |
| Project | E, W, SE, SW | No | No | Dot (8×8px circle) |
| Artifact | All 8 | Yes (Shift = free) | No | Dot (8×8px circle) |

### Config type

```typescript
interface ResizeConfig {
  handles: ("n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw")[];
  preserveAspect: boolean;
  minSize: { w: number; h: number };
  maxSize: { w: number; h: number };
  autoHeight: boolean;
}

const RESIZE_CONFIG: Record<ObjectKind, ResizeConfig> = {
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
```

### Visibility

- Handles visible only when **exactly 1 item** is selected and not dragging
- Multi-select shows selection borders on each card, no resize handles
- Handles appear on hover of the selected card as well

### Handle visuals

- **Dot handles:** 8×8px circles, white fill, 1px border `rgba(0,0,0,0.2)`, positioned at edge midpoints and corners
- **Bar handles (notes):** 4×24px rounded rectangles, white fill, 1px border, positioned at left/right edge centers
- Cursor changes per handle position: `ew-resize`, `ns-resize`, `nwse-resize`, `nesw-resize`

### Auto-height for notes

Width is resizable, height adjusts to content. Implementation: render a hidden measuring div with the same font/padding/width, read its `scrollHeight`, apply as card height.

Soft cap: 600px max auto-height. Beyond that, card gets internal scroll with a fade-out gradient at bottom. Scrollbar: hidden by default, appears on hover. Thin (6px), rounded, `rgba(0,0,0,0.2)`.

### Data model

Add `canvasSize?: { w: number; h: number }` to:
- `HypherObject` interface in `types/index.ts`
- `objects` table in `convex/schema.ts` as `v.optional(v.object({ w: v.number(), h: v.number() }))`
- `put` mutation args in `convex/objects.ts`

Default width when `canvasSize` is not set: 224px (current fixed width).

Writes use the same debounced pattern as position updates (200ms timer, local override for smooth resize).

---

## 3. Multi-Select + Rubber Band

### Mode behavior

| Mode | Key | Empty canvas drag | Card drag | Space+drag |
|------|-----|-------------------|-----------|------------|
| Select | V | Rubber band | Move card(s) | Temporary pan |
| Pan | H | Pan | Pan | Pan |
| Text | T | Place text (existing) | — | — |

### Rubber band selection

- In select mode, drag on empty canvas draws a selection rectangle
- Rectangle: 1px solid `#007AFF`, fill `rgba(0, 122, 255, 0.08)`
- All items whose bounding box intersects the rectangle become selected
- Rendered as a div in the canvas layer (screen coordinates, above cards)

### Selection interactions

| Action | Behavior |
|--------|----------|
| Click card | Clear selection, select that card |
| Shift+Click card | Toggle card in/out of selection |
| Cmd+A | Select all items on canvas |
| Escape | Clear selection |
| Click empty canvas | Clear selection |
| Delete/Backspace | Remove selected items. Confirm if >3: native `window.confirm("Delete N items? This can't be undone.")` |
| Cmd+D | Duplicate selected items (+20px, +20px offset). New Convex IDs via `addObject()`. Connections between duplicated items are preserved (new connection IDs). |
| Drag selected card | Move entire selection group |
| Arrow keys | Nudge selection 1px |
| Shift+Arrow | Nudge selection 10px |

### Toolbar indicator

When 2+ items selected, show "N selected" in the canvas toolbar (between mode switcher and background toggle).

### Data model change

Replace `selectedId: string | null` with `selectedIds: Set<string>` in `useSelectionState`. The `selected` convenience getter returns the first item (for detail panel compatibility).

### Space-to-pan

- Hold Space → `spaceHeld` state becomes true → cursor changes to `grab`
- Space+drag → pans canvas (same as current pan logic)
- Release Space → returns to select mode behavior
- `e.preventDefault()` on Space keydown to prevent page scroll

### Pan mode (H)

- New persistent mode: H key activates, V key returns to select
- In pan mode, all drag = pan, no rubber band, no card interaction
- Cursor: `grab` / `grabbing`

### First-use toast

First time entering select mode, show toast: "Drag to select · Hold Space to pan"
Dismiss after 4s. Never show again (`localStorage` flag: `hypher-select-hint-shown`).

---

## 4. Alignment & Snapping Guides

### What snaps

When dragging card(s), detect alignment with other (non-selected) cards:

- **Edge alignment:** left↔left, right↔right, top↔top, bottom↔bottom, left↔right, top↔bottom
- **Center alignment:** horizontal center, vertical center
- **Snap threshold:** 8px (at current zoom level, i.e., 8px / transform.k in canvas coords)

### Multi-select snapping

When dragging a group, guides align to the **group bounding box**, not individual cards. The bounding box is the min/max of all selected card positions + sizes.

### Visual

- 1px lines, color `#007AFF`
- Extend across full canvas viewport
- Appear/disappear with 100ms opacity transition
- Only show nearest match per axis (not all possible alignments)
- Rendered as `<line>` elements in the SVG connections layer

### Performance

Use spatial grid bucketing for O(1) lookups:

```typescript
interface SpatialGrid {
  cellSize: number; // e.g., 100px
  cells: Map<string, string[]>; // "x,y" → object IDs
}
```

- Build grid when items change (memo'd)
- During drag, only check cards in nearby cells
- Throttle guide computation to ~30fps (use `requestAnimationFrame`, skip if <33ms since last)

### Equal spacing

Deferred — adds significant complexity for modest UX gain in v1.

---

## 5. Keyboard Shortcuts Summary

| Shortcut | Action | Mode |
|----------|--------|------|
| V | Select mode | Global |
| H | Pan mode | Global |
| T | Text mode | Global |
| Space (hold) | Temporary pan | Select mode |
| Delete/Backspace | Delete selected | Select mode |
| Cmd+A | Select all | Select mode |
| Cmd+D | Duplicate selected (+20px offset) | Select mode |
| Enter | Edit selected card (single selection) | Select mode |
| Escape | Clear selection / exit edit mode | Global |
| Arrow keys | Nudge selected 1px | Select mode |
| Shift+Arrow | Nudge selected 10px | Select mode |

Shortcuts suppressed when an input/textarea is focused (existing pattern).

---

## 6. Files to Create/Modify

### New files

| File | Purpose |
|------|---------|
| `components/canvas/hooks/useCanvasTransform.ts` | Pan, zoom, viewport math extracted from SpatialCanvas |
| `components/canvas/hooks/useSelectionState.ts` | selectedIds Set, toggle, clear, selectAll |
| `components/canvas/hooks/useDragInteraction.ts` | Drag start/move/end, position writes |
| `components/canvas/hooks/useKeyboardShortcuts.ts` | All keyboard shortcuts |
| `components/canvas/features/SnapGuides.tsx` | SVG guide line rendering |
| `components/canvas/features/useSnapGuides.ts` | Snap computation + spatial grid |
| `components/canvas/features/ResizeHandles.tsx` | Handle rendering + resize drag |
| `components/canvas/features/useResize.ts` | Resize logic, config per kind |
| `components/canvas/features/RubberBandSelect.tsx` | Selection rectangle rendering |
| `components/canvas/features/useRubberBand.ts` | Rubber band drag + intersection |
| `components/canvas/features/InlineEditor.tsx` | Edit overlay per card kind |
| `components/canvas/cards/StickyNote.tsx` | Note card component |
| `components/canvas/cards/ProjectCard.tsx` | Project card component |
| `components/canvas/cards/ArtifactCard.tsx` | Artifact card component |

### Modified files

| File | Changes |
|------|---------|
| `components/SpatialCanvas.tsx` | Rewrite as thin orchestrator importing hooks + features |
| `src/types/index.ts` | Add `canvasSize` to HypherObject |
| `convex/schema.ts` | Add `canvasSize` field |
| `convex/objects.ts` | Add `canvasSize` to mutation args |
| `src/app/globals.css` | Resize handle styles, rubber band styles, inline editor styles, pan/select cursor states |
| `src/lib/useStore.ts` | Add `duplicateObjects()` mutation helper |
