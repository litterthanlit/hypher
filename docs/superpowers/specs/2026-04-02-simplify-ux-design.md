# Hypher UX Simplification: Two-Mode Visual Workspace

## Problem

The workspace UI is overloaded: 5 view tabs (Canvas, Garden, Focus, Stream, Graph), a 3-column layout with a tabbed right panel, 4 sidebar sections, and 15-20 interactive elements in the detail view. Users don't know what the views do and don't use most of them. The primary job — quickly capture and file a thought — gets buried under chrome.

## Design Philosophy

Apple Notes meets Figma. Minimal chrome, maximum canvas. Two screens (capture home + project workspace), two modes (canvas + list), nothing else.

## Architecture

### Two Screens

1. **Capture Home** — blank page, centered input, assign to project. No changes from current implementation.
2. **Project Workspace** — two-column layout: sidebar (left) + content area (right). No right panel.

### Layout

```
+------------------+----------------------------------------+
| Sidebar          | Content Area                           |
| (240px)          | (canvas or list, fills remaining space) |
|                  |                                        |
| [hypher] [+]     | [toggle: canvas/list]     [search]    |
|                  |                                        |
| INBOX (3)        |  (project content here)                |
|   note: idea...  |                                        |
|   artifact: ...  |                                        |
|                  |                                        |
| PROJECTS         |                                        |
|   Brand Refresh  |                                        |
|   Research       |                                        |
|                  |                                        |
+------------------+----------------------------------------+
```

Two columns. No right panel. Single toggle button in toolbar replaces the 5-tab ViewSwitcher.

## Sidebar (Simplified)

### What stays
- Logo button (click returns to capture home)
- Create button (+) in header
- **Inbox** section: unattached notes/artifacts, shown above projects
- **Projects** section: project list with name + status badge

### What gets removed
- Notes section (notes live inside projects or inbox)
- Artifacts section (same)
- Bottom 3-button action bar (+ button covers this)

### Behavior
- Click a project: content area shows that project's notes and artifacts
- Click an inbox item: selects it, shows in content area
- Logo click or Cmd+N: returns to capture home

## Content Area: Canvas Mode

The canvas shows a single project's contents as draggable cards on an infinite 2D surface.

### Cards
- Each note or artifact belonging to the selected project is a card
- Cards show: kind icon, title/preview (3 lines), status badge
- Cards are draggable; positions persist to IndexedDB per-object
- Double-click empty space to create a new note/artifact inside this project

### Connection Lines
- AI-confirmed and manual connections drawn as curved SVG lines between cards
- AI-suggested connections drawn as dashed/faded lines

### AI Connection Review (Inline)
- When AI finds new connections: toast at bottom ("Found 2 connections")
- Tapping the toast highlights connected cards with a pulse animation
- Clicking a connection line opens a small popover with: confidence badge, reason text, Confirm/Dismiss buttons
- No separate suggestions panel

### Zoom and Pan
- Scroll to zoom, drag empty space to pan (keep existing mechanics)
- Zoom controls at bottom-right (keep existing)

## Content Area: List Mode

Same project, rendered as a vertical scrollable list instead of spatial cards.

### Layout
- Notes: expandable text blocks, click to expand/edit inline
- Artifacts: compact rows with type icon + name
- Connected items: subtle link indicator (small icon) next to the item name
- Default sort: most recently modified first

### Inline Editing
- Click a note in the list to expand and edit its content inline
- Click an artifact to see its details inline
- Status/maturity/type dropdown available inline (no separate detail view)

## Mode Toggle

A single icon button in the content area toolbar:
- Grid icon = canvas mode
- Lines icon = list mode
- No label text, just the icon
- Toggle state persists per-project in localStorage

## What Gets Removed

| Component | Current State | Action |
|-----------|---------------|--------|
| ViewSwitcher.tsx (5 tabs) | 5 views: canvas, garden, focus, stream, graph | Rewrite as simple 2-icon toggle |
| GardenView.tsx | Animated organism visualization | Delete |
| GraphView.tsx | Force-directed network graph | Delete |
| StreamView.tsx | Chronological activity feed | Delete |
| DetailView.tsx | Full-screen detail editor | Delete; replace with inline editing on canvas/list |
| SuggestionsPanel.tsx | Right panel with Inbox + Suggestions tabs | Delete; inbox moves to sidebar, suggestions become toasts + inline popovers |
| InboxSidebar.tsx | Inbox tab content in right panel | Delete; inbox is now a sidebar section |
| Sidebar Notes section | Top-level list of all notes | Remove; notes live inside projects |
| Sidebar Artifacts section | Top-level list of all artifacts | Remove; artifacts live inside projects |
| Bottom action bar (3 buttons) | Project / Note / Artifact create buttons | Remove; single + button in header |

## Components After Simplification

### Kept (modified)
- **CaptureHome.tsx** — no changes
- **ProjectAssignPopup.tsx** — no changes
- **Sidebar.tsx** — simplified to inbox + projects only
- **SpatialCanvas.tsx** — reworked to show single-project contents (not all-objects or clusters)
- **SearchDialog.tsx** — no changes
- **Toast.tsx** — no changes
- **Icons.tsx** — no changes
- **ConfidenceBadge.tsx** — used in connection popovers
- **CreateForm.tsx** — no changes

### New
- **ListView.tsx** — vertical scrollable list view for a project's contents
- **ConnectionPopover.tsx** — inline confirm/dismiss popover on connection lines
- **InlineEditor.tsx** — click-to-edit component for notes/artifacts in list and canvas views

### Deleted
- GardenView.tsx
- GraphView.tsx
- StreamView.tsx
- DetailView.tsx
- SuggestionsPanel.tsx
- InboxSidebar.tsx
- ProjectCluster.tsx
- ViewSwitcher.tsx (rewritten as simple toggle, not a separate component)

## Data Model

No schema changes. The existing `projectId` field on objects, `canvasPosition` for spatial layout, and `Connection` model all work as-is.

One new localStorage key: `hypher-view-mode-{projectId}` storing `"canvas" | "list"` per project.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Cmd+N | Go to capture home |
| Cmd+K | Search |
| Cmd+Shift+V | Clipboard capture |
| Tab | Toggle canvas/list (when not in input) |

Remove: 1-5 view switching (no longer applicable).

## Success Criteria

1. User opens app, captures a thought, assigns to project in under 5 seconds
2. User clicks a project and immediately sees its contents — no mode selection needed
3. No UI element on screen that the user can't explain the purpose of
4. Canvas mode feels like Figma; list mode feels like Apple Notes
5. AI connections surface via toasts and inline popovers, not a dedicated panel
