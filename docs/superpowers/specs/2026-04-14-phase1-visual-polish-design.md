# Phase 1 — Visual Polish Design Spec

> Make canvas cards feel physically placed on a surface. Sticky notes, shadows, spring animations, color, and background options.

**Branch:** `litterthanlit/capture-first-ui`
**Dependencies:** Framer Motion (~30KB)
**Data model change:** Add `canvasColor?: string` to objects

---

## 1. Sticky Note Cards (notes only)

Notes render as colored sticky notes instead of white cards with accent bars.

### Visual treatment

- **Fill:** Solid pastel background from the 8-color palette (see section 5)
- **Border-radius:** 4px (tight, paper-like)
- **Corner fold:** CSS triangle in top-right corner, slightly darker shade of the card color. 18×18px. `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.06))`
- **Rotation:** Each card rotates between -2deg and +2deg, seeded by object ID (stable across renders). Use a simple hash: `(id.charCodeAt(0) + id.charCodeAt(1)) % 400 / 100 - 2`
- **No accent bar** on notes — the entire card is the color
- **No kind icon** on notes — color is the identity

### Typography

- Title/content: 14px, font-weight 400, color derived from card background (dark shade of the hue)
- Preview text: 12px, slightly lighter shade
- Status label (maturity): 10px monospace, very muted (40% opacity of text color)

### Text colors per card color

Each pastel needs a readable dark text color. Define as CSS variables:
```
--card-yellow-text: #3a3520;
--card-green-text: #2d4a30;
--card-blue-text: #1a2f4a;
--card-pink-text: #4a1a2d;
--card-purple-text: #3a1a4a;
--card-orange-text: #4a3520;
--card-red-text: #4a1a1a;
--card-grey-text: #3a3a3a;
```

## 2. Project Cards

Projects keep a structured layout with improved shadows.

- **Background:** white (`var(--bg-primary)`)
- **Left accent bar:** 4px wide, full height, accent color, left border-radius matches card
- **Border-radius:** 12px
- **Title:** 14px semibold
- **Description:** 12px, 2-line clamp, tertiary color
- **Shadow:** Uses the same depth system as notes (section 3)

## 3. Artifact Cards

Artifacts show thumbnails with minimal chrome.

- **Thumbnail:** Full-width image, 8px border-radius on all corners
- **Shadow:** Same depth system as other cards, applied to the thumbnail
- **Label:** Small filename below the thumbnail (outside the card container), 11px, muted color, centered, text-overflow ellipsis
- **No padded container** around the label — just the image with a name under it
- **File artifacts (no thumbnail):** Large file-type icon centered on a muted background, same shadow system, 8px radius

## 4. Shadow & Depth System (all card types)

Four states with progressive depth. All transitions powered by Framer Motion.

### Resting
```css
box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
```

### Hover
```css
box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
transform: scale(1.01);
```
Framer Motion `whileHover={{ scale: 1.01 }}` with spring transition.

### Dragging
```css
box-shadow: 0 8px 16px rgba(0,0,0,0.12), 0 24px 48px rgba(0,0,0,0.08);
transform: scale(1.03);
z-index: 1000;
```
- Additional subtle `rotate(1deg)` tilt while dragging for physical feel
- Framer Motion `layout` or manual animation on drag state change

### Selected
```css
box-shadow: 0 0 0 2px var(--accent), 0 4px 16px rgba(0,0,0,0.06);
```

### Drop bounce
On release after drag, Framer Motion spring transition to settle into final position:
```typescript
transition: { type: "spring", stiffness: 500, damping: 25 }
```

## 5. Card Color Palette

8 sticky note colors. Pastel values stay the same in both light and dark mode (paper on desk).

### CSS variables
```css
--card-yellow: #FFF9C4;
--card-green: #C8E6C9;
--card-blue: #BBDEFB;
--card-pink: #F8BBD0;
--card-purple: #E1BEE7;
--card-orange: #FFE0B2;
--card-red: #FFCDD2;
--card-grey: #F5F5F5;
```

These do NOT change between light/dark mode — sticky notes stay pastel in dark mode.

### Default assignment

Color auto-assigned by hashing note content (deterministic):
```typescript
const CARD_COLORS = ["yellow", "green", "blue", "pink", "purple", "orange", "red", "grey"];
function defaultCardColor(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) hash = (hash * 31 + content.charCodeAt(i)) | 0;
  return CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
}
```

### Data model

Add `canvasColor?: string` to:
- `HypherObject` interface in `types/index.ts`
- `objects` table in `convex/schema.ts` as `v.optional(v.string())`

When `canvasColor` is set, use it. When unset, use `defaultCardColor(content)`.

### Color picker UI

Deferred to Phase 3 (right-click context menu). Phase 1 only stores the field and auto-assigns.

## 6. Canvas Background Options

4 background patterns selectable from the canvas toolbar.

### Options

| Key | Pattern | CSS |
|-----|---------|-----|
| `dots` | Radial dot grid (current) | `radial-gradient(circle, <color> 1px, transparent 1px)` at 24px spacing |
| `grid` | Thin crosshatch lines | `linear-gradient(<color> 1px, transparent 1px), linear-gradient(90deg, <color> 1px, transparent 1px)` at 24px spacing |
| `lines` | Horizontal lines only | `linear-gradient(<color> 1px, transparent 1px)` at 24px spacing |
| `blank` | No pattern | None |

Grid color: `var(--border-default)` (adapts to light/dark theme automatically).

### Toolbar UI

Add a small grid icon button to the existing canvas toolbar (next to zoom controls). Clicking cycles through: dots → grid → lines → blank → dots.

### Storage

`localStorage` key: `hypher-canvas-bg-${projectId}`. Default: `dots`.

## 7. Framer Motion Integration

### Installation
```bash
npm install framer-motion
```

### Usage in SpatialCanvas

Wrap card elements with `motion.div` from Framer Motion:

```typescript
import { motion } from "framer-motion";

// Card wrapper
<motion.div
  whileHover={{ scale: 1.01 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
  // ... existing card props
>
```

### Zoom animation

Replace instant `setTransform` for zoom button clicks with animated transitions. Use Framer Motion's `useSpring` or `useMotionValue` for the transform values so zoom-in/zoom-out buttons and zoom-to-fit animate smoothly.

Wheel zoom remains instant (direct manipulation should feel immediate).

### Drag-drop animation

On mouse-up after drag, apply a spring transition to the final position. The card should settle with a slight bounce overshoot.

## 8. Files to Modify

| File | Changes |
|------|---------|
| `src/components/SpatialCanvas.tsx` | Framer Motion cards, drag/drop springs, zoom animation, background toggle, card rendering by kind |
| `src/app/globals.css` | Sticky note styles, shadow system, card color variables, background patterns, corner fold |
| `src/types/index.ts` | Add `canvasColor?: string` to `HypherObject` |
| `convex/schema.ts` | Add `canvasColor` field to objects table |
| `package.json` | Add `framer-motion` dependency |

No new files needed. No new components — all changes are within SpatialCanvas and CSS.
