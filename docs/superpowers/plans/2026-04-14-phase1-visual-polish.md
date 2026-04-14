# Phase 1 — Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canvas cards feel physically placed — sticky notes with pastel fills, corner folds, rotation, spring animations via Framer Motion, card colors, and canvas background options.

**Architecture:** CSS-driven visual redesign + Framer Motion for hover/drag/drop springs. Data model gets one new field (`canvasColor`). No new components — all changes are within existing files.

**Tech Stack:** Framer Motion, CSS, Convex schema migration, localStorage for background preference.

---

## File Map

| File | Changes |
|------|---------|
| `hypher-web/package.json` | Add `framer-motion` dependency |
| `hypher-web/src/types/index.ts` | Add `canvasColor?: string` to `HypherObject` |
| `hypher-web/convex/schema.ts` | Add `canvasColor` field to objects table |
| `hypher-web/convex/objects.ts` | Add `canvasColor` to `put` mutation args |
| `hypher-web/src/app/globals.css` | Sticky note styles, shadow system, card colors, corner fold, backgrounds |
| `hypher-web/src/components/SpatialCanvas.tsx` | Framer Motion cards, kind-specific rendering, background toggle, zoom animation |

---

### Task 1: Install Framer Motion

**Files:**
- Modify: `hypher-web/package.json`

- [ ] **Step 1: Install framer-motion**

```bash
cd hypher-web && npm install framer-motion
```

- [ ] **Step 2: Verify installation**

```bash
cd hypher-web && node -e "require('framer-motion'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add hypher-web/package.json hypher-web/package-lock.json
git commit -m "feat: add framer-motion dependency for canvas animations"
```

---

### Task 2: Add `canvasColor` to Data Model

**Files:**
- Modify: `hypher-web/src/types/index.ts:13-23`
- Modify: `hypher-web/convex/schema.ts:4-32`
- Modify: `hypher-web/convex/objects.ts:27-56`

- [ ] **Step 1: Add `canvasColor` to `HypherObject` interface**

In `hypher-web/src/types/index.ts`, add `canvasColor` to the `HypherObject` interface after `lastSurfacedAt`:

```typescript
export interface HypherObject {
  id: string;
  kind: ObjectKind;
  createdAt: number;
  modifiedAt: number;
  embedding?: number[];
  embeddingText?: string;
  tags?: string[];
  canvasPosition?: CanvasPosition;
  projectId?: string | null;
  lastSurfacedAt?: number;
  canvasColor?: string;
}
```

- [ ] **Step 2: Add `canvasColor` to Convex schema**

In `hypher-web/convex/schema.ts`, add to the objects table definition, after `canvasPosition`:

```typescript
canvasColor: v.optional(v.string()),
```

- [ ] **Step 3: Add `canvasColor` to `put` mutation args**

In `hypher-web/convex/objects.ts`, add to the `put` mutation args object, after `canvasPosition`:

```typescript
canvasColor: v.optional(v.string()),
```

- [ ] **Step 4: Push schema to Convex**

```bash
cd hypher-web && npx convex dev --once
```

Expected: Schema pushed successfully, no errors.

- [ ] **Step 5: Commit**

```bash
git add hypher-web/src/types/index.ts hypher-web/convex/schema.ts hypher-web/convex/objects.ts
git commit -m "feat: add canvasColor field to data model"
```

---

### Task 3: Add Card Color CSS Variables and Sticky Note Styles

**Files:**
- Modify: `hypher-web/src/app/globals.css`

- [ ] **Step 1: Add card color variables to the `:root` block**

After the existing `--shadow-card` line (line 43), add:

```css
  /* Card colors — same in light and dark mode */
  --card-yellow: #FFF9C4;
  --card-green: #C8E6C9;
  --card-blue: #BBDEFB;
  --card-pink: #F8BBD0;
  --card-purple: #E1BEE7;
  --card-orange: #FFE0B2;
  --card-red: #FFCDD2;
  --card-grey: #F5F5F5;

  --card-yellow-text: #3a3520;
  --card-green-text: #2d4a30;
  --card-blue-text: #1a2f4a;
  --card-pink-text: #4a1a2d;
  --card-purple-text: #3a1a4a;
  --card-orange-text: #4a3520;
  --card-red-text: #4a1a1a;
  --card-grey-text: #3a3a3a;
```

Also duplicate these same values inside the `@media (prefers-color-scheme: dark)` block so they stay pastel in dark mode.

- [ ] **Step 2: Replace the `.spatial-card` base styles**

Replace the existing `.spatial-card` block (lines 738–751) with:

```css
.spatial-card {
  position: absolute;
  width: 224px;
  cursor: grab;
  overflow: visible;
  will-change: transform;
  margin-left: -112px;
  margin-top: -50px;
}

.spatial-card:active {
  cursor: grabbing;
}
```

Remove the old `.spatial-card:hover` block (lines 753–757) and `.spatial-card:active` block (lines 759–761) and `.spatial-card.selected` block (lines 763–767). These states will be handled by Framer Motion and kind-specific classes.

- [ ] **Step 3: Add sticky note styles (for notes)**

After the base `.spatial-card` styles, add:

```css
/* ── Sticky note (notes only) ── */
.spatial-card-note {
  background: var(--card-yellow);
  border-radius: 4px;
  border: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  position: relative;
}

.spatial-card-note .spatial-card-body {
  padding: 16px 18px;
}

.spatial-card-note .spatial-card-title {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  white-space: normal;
}

.spatial-card-note .spatial-card-preview {
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.spatial-card-note .spatial-card-status {
  opacity: 0.4;
}

/* Corner fold */
.spatial-card-note::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.06));
  border-radius: 0 4px 0 0;
  pointer-events: none;
}

/* Per-color note overrides */
.spatial-card-note[data-color="yellow"] { background: var(--card-yellow); color: var(--card-yellow-text); }
.spatial-card-note[data-color="green"] { background: var(--card-green); color: var(--card-green-text); }
.spatial-card-note[data-color="blue"] { background: var(--card-blue); color: var(--card-blue-text); }
.spatial-card-note[data-color="pink"] { background: var(--card-pink); color: var(--card-pink-text); }
.spatial-card-note[data-color="purple"] { background: var(--card-purple); color: var(--card-purple-text); }
.spatial-card-note[data-color="orange"] { background: var(--card-orange); color: var(--card-orange-text); }
.spatial-card-note[data-color="red"] { background: var(--card-red); color: var(--card-red-text); }
.spatial-card-note[data-color="grey"] { background: var(--card-grey); color: var(--card-grey-text); }

.spatial-card-note .spatial-card-title,
.spatial-card-note .spatial-card-preview,
.spatial-card-note .spatial-card-status {
  color: currentColor;
}

.spatial-card-note .spatial-card-preview {
  opacity: 0.75;
}

.spatial-card-note.selected {
  box-shadow: 0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.06);
}
```

- [ ] **Step 4: Add project card styles**

```css
/* ── Project card ── */
.spatial-card-project {
  background: var(--bg-primary);
  border-radius: 12px;
  border: 1px solid var(--border-default);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
  display: flex;
  overflow: hidden;
}

.spatial-card-project .spatial-card-accent-bar {
  width: 4px;
  background: var(--accent);
  flex-shrink: 0;
  border-radius: 12px 0 0 12px;
}

.spatial-card-project .spatial-card-title {
  font-size: 14px;
  font-weight: 600;
}

.spatial-card-project .spatial-card-preview {
  font-size: 12px;
  -webkit-line-clamp: 2;
}

.spatial-card-project.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle), 0 4px 16px rgba(0,0,0,0.06);
}
```

- [ ] **Step 5: Add artifact card styles**

```css
/* ── Artifact card ── */
.spatial-card-artifact {
  overflow: visible;
}

.spatial-card-artifact .spatial-card-thumb {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 8px;
  display: block;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}

.spatial-card-artifact .spatial-card-thumb-label {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spatial-card-artifact .spatial-card-no-thumb {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  background: var(--bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
}

.spatial-card-artifact .spatial-card-no-thumb .kind-icon {
  width: 32px;
  height: 32px;
  color: var(--text-quaternary);
}

.spatial-card-artifact.selected .spatial-card-thumb,
.spatial-card-artifact.selected .spatial-card-no-thumb {
  box-shadow: 0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.06);
}
```

- [ ] **Step 6: Add canvas background pattern styles**

Replace the existing `.spatial-grid` rule (lines 711–716) with:

```css
.spatial-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.spatial-grid[data-bg="dots"] {
  background-image: radial-gradient(circle, var(--border-default) 1px, transparent 1px);
}

.spatial-grid[data-bg="grid"] {
  background-image:
    linear-gradient(var(--border-default) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-default) 1px, transparent 1px);
}

.spatial-grid[data-bg="lines"] {
  background-image: linear-gradient(var(--border-default) 1px, transparent 1px);
}

.spatial-grid[data-bg="blank"] {
  background-image: none;
}
```

- [ ] **Step 7: Clean up removed styles**

Remove these now-unused rules from globals.css:
- `.spatial-card-accent` (lines 769–773)
- `.spatial-card.selected .spatial-card-accent` (lines 775–777)
- `.spatial-card-body.compact` and `.spatial-card-body.compact .spatial-card-title` (lines 852–859)

- [ ] **Step 8: Commit**

```bash
git add hypher-web/src/app/globals.css
git commit -m "feat: add sticky note, project, artifact card styles and background patterns"
```

---

### Task 4: Rewrite SpatialCanvas Card Rendering with Framer Motion

**Files:**
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

This is the main task — rewrite the card rendering section to use kind-specific layouts and Framer Motion.

- [ ] **Step 1: Add imports and card color utility**

At the top of `SpatialCanvas.tsx`, add the Framer Motion import and card color utility:

```typescript
import { motion, animate } from "framer-motion";
```

After the `KIND_ACCENT` constant, add:

```typescript
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
```

- [ ] **Step 2: Add background state**

Inside the `SpatialCanvas` component, after the `canvasMode` state, add:

```typescript
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
```

- [ ] **Step 3: Update the spatial-grid div**

Replace the existing `<div className="spatial-grid" ...>` with:

```tsx
<div className="spatial-grid" data-bg={canvasBg} style={{
  backgroundPosition: `${transform.x}px ${transform.y}px`,
  backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
}} />
```

- [ ] **Step 4: Replace card rendering with kind-specific layouts**

Replace the entire `{positioned.map((obj) => { ... })}` block (lines 278–315) with:

```tsx
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
```

- [ ] **Step 5: Add background toggle to the toolbar**

In the `canvas-toolbar` div, add a background toggle button between the mode switcher and zoom controls:

```tsx
<button
  className="canvas-mode-btn"
  onClick={cycleBg}
  title={`Background: ${canvasBg}`}
>
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={16} height={16}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
  </svg>
</button>
```

- [ ] **Step 6: Commit**

```bash
git add hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: kind-specific card rendering with Framer Motion and background toggle"
```

---

### Task 5: Animated Zoom

**Files:**
- Modify: `hypher-web/src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Replace zoom button handlers with animated zoom**

Replace the zoom button `onClick` handlers in the toolbar (the `+` and `-` buttons) to use Framer Motion's `animate` for smooth spring transitions:

```tsx
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
}, [transform]);
```

Update the zoom buttons:

```tsx
<button className="btn-icon" onClick={() => animateZoom(Math.min(3, transform.k * 1.25))} title="Zoom in">+</button>
<span className="spatial-zoom-label">{Math.round(transform.k * 100)}%</span>
<button className="btn-icon" onClick={() => animateZoom(Math.max(0.15, transform.k * 0.8))} title="Zoom out">-</button>
```

Keep the `onWheel` handler unchanged — wheel zoom stays instant (direct manipulation).

- [ ] **Step 2: Commit**

```bash
git add hypher-web/src/components/SpatialCanvas.tsx
git commit -m "feat: animated spring zoom on button click"
```

---

### Task 6: Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev servers**

In two terminals:
```bash
cd hypher-web && npx convex dev
```
```bash
cd hypher-web && npm run dev
```

- [ ] **Step 2: Verify sticky note rendering**

Open the app. Navigate to a project with notes. Confirm:
- Notes render as pastel sticky notes with corner folds and slight rotation
- Each note has a different color based on content
- Text is readable (dark text on pastel background)

- [ ] **Step 3: Verify project and artifact cards**

Confirm:
- Project cards have white background with left accent bar
- Artifact cards show thumbnail with 8px radius and small label underneath
- Artifacts without thumbnails show a centered icon

- [ ] **Step 4: Verify shadow depth states**

- Hover a card: subtle lift + shadow increase
- Drag a card: deeper shadow, slight scale up, tilt
- Release: spring bounce settle
- Click to select: accent glow ring

- [ ] **Step 5: Verify zoom animation**

- Click zoom `+` button: smooth spring animation
- Click zoom `-` button: smooth spring animation
- Scroll wheel: still instant (no animation)

- [ ] **Step 6: Verify background toggle**

- Click the grid icon in the toolbar
- Cycles through: dots → grid → lines → blank
- Refresh page: preference persists

- [ ] **Step 7: Verify dark mode**

- Switch system theme to dark mode
- Sticky notes remain pastel (light paper on dark desk)
- Project/artifact cards adapt to dark theme
- Background patterns adapt to dark theme

- [ ] **Step 8: Fix any issues found, commit fixes**

```bash
git add -A
git commit -m "fix: phase 1 visual polish adjustments from smoke test"
```
