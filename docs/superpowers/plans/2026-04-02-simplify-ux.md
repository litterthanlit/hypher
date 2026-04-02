# UX Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the workspace from 5 views + 3 columns down to a 2-column layout with a single canvas/list toggle per project.

**Architecture:** Delete GardenView, GraphView, StreamView, DetailView, SuggestionsPanel, InboxSidebar, ProjectCluster, ViewSwitcher. Rewrite Sidebar to show only inbox + projects. Rewrite SpatialCanvas to show a single project's contents. Create ListView for the list mode. Create ConnectionPopover for inline AI review. Rewrite page.tsx to use the simplified 2-column layout.

**Tech Stack:** React 19, Next.js 16, TypeScript, CSS (globals.css), IndexedDB (idb)

---

### Task 1: Delete unused component files

**Files:**
- Delete: `src/components/GardenView.tsx`
- Delete: `src/components/GraphView.tsx`
- Delete: `src/components/StreamView.tsx`
- Delete: `src/components/DetailView.tsx`
- Delete: `src/components/SuggestionsPanel.tsx`
- Delete: `src/components/InboxSidebar.tsx`
- Delete: `src/components/ProjectCluster.tsx`
- Delete: `src/components/ViewSwitcher.tsx`

- [ ] **Step 1: Delete the 8 component files**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
rm src/components/GardenView.tsx \
   src/components/GraphView.tsx \
   src/components/StreamView.tsx \
   src/components/DetailView.tsx \
   src/components/SuggestionsPanel.tsx \
   src/components/InboxSidebar.tsx \
   src/components/ProjectCluster.tsx \
   src/components/ViewSwitcher.tsx
```

- [ ] **Step 2: Uninstall d3-force (only used by GraphView)**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npm uninstall d3-force @types/d3-force
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Remove 8 unused view/panel components and d3-force dependency"
```

---

### Task 2: Rewrite Sidebar to inbox + projects only

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Rewrite Sidebar.tsx**

Replace the entire file with a simplified version. The new sidebar has only two sections (Inbox, Projects), no Notes/Artifacts sections, and no bottom action bar. The + button in the header opens a CreateForm. Clicking a project calls `onSelectProject`. Clicking an inbox item calls `onSelectInboxItem`.

```tsx
"use client";

import { useState } from "react";
import type { Project, AnyObject } from "@/types";
import { getDisplayName } from "@/types";
import { CreateForm } from "./CreateForm";
import { FolderIcon, KindIcon, PlusIcon } from "./Icons";

interface Props {
  projects: Project[];
  inboxItems: AnyObject[];
  selectedProjectId: string | null;
  selectedObjectId: string | null;
  onSelectProject: (id: string) => void;
  onSelectInboxItem: (id: string) => void;
  onAdd: (obj: AnyObject) => void;
  onGoHome: () => void;
}

export function Sidebar({
  projects, inboxItems, selectedProjectId, selectedObjectId,
  onSelectProject, onSelectInboxItem, onAdd, onGoHome,
}: Props) {
  const [showForm, setShowForm] = useState<"project" | "note" | "artifact" | null>(null);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="logo-btn" onClick={onGoHome} title="Capture (Cmd+N)">
          <span className="logo">hypher</span>
        </button>
        <button className="btn-icon" onClick={() => setShowForm("project")} title="Create">
          <PlusIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        {inboxItems.length > 0 && (
          <div className="section">
            <h2 className="section-title inbox-title">
              Inbox <span className="count inbox-count">{inboxItems.length}</span>
            </h2>
            <ul>
              {inboxItems.map((item) => (
                <li
                  key={item.id}
                  className={`sidebar-item ${selectedObjectId === item.id ? "selected" : ""}`}
                  onClick={() => onSelectInboxItem(item.id)}
                >
                  <KindIcon kind={item.kind} className="kind-icon" />
                  <div className="item-text">
                    <span className="item-name">{getDisplayName(item)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="section">
          <h2 className="section-title">
            Projects <span className="count">{projects.length}</span>
          </h2>
          <ul>
            {projects.map((p) => (
              <li
                key={p.id}
                className={`sidebar-item ${selectedProjectId === p.id ? "selected" : ""}`}
                onClick={() => onSelectProject(p.id)}
              >
                <FolderIcon className="kind-icon" />
                <div className="item-text">
                  <span className="item-name">{p.name}</span>
                  <span className="item-sub">{p.status}</span>
                </div>
              </li>
            ))}
            {projects.length === 0 && <li className="empty-hint">No projects yet</li>}
          </ul>
        </div>
      </nav>

      {showForm && (
        <CreateForm
          kind={showForm}
          onSubmit={(obj) => { onAdd(obj); setShowForm(null); }}
          onCancel={() => setShowForm(null)}
        />
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles (will fail — page.tsx still references old props). This is expected.**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors in page.tsx (old imports and props). Sidebar.tsx itself should be clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "Simplify Sidebar to inbox + projects only"
```

---

### Task 3: Create ConnectionPopover component

**Files:**
- Create: `src/components/ConnectionPopover.tsx`

- [ ] **Step 1: Create ConnectionPopover.tsx**

A small popover that appears when clicking a connection line on the canvas. Shows confidence, reason text, and Confirm/Dismiss buttons.

```tsx
"use client";

import type { Connection } from "@/types";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  connection: Connection;
  position: { x: number; y: number };
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function ConnectionPopover({ connection, position, onConfirm, onDismiss, onClose }: Props) {
  return (
    <div
      className="conn-popover"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="conn-popover-header">
        <ConfidenceBadge confidence={connection.confidence} />
        <button className="conn-popover-close" onClick={onClose}>×</button>
      </div>
      {connection.reason && (
        <p className="conn-popover-reason">{connection.reason}</p>
      )}
      <div className="conn-popover-actions">
        <button className="btn-dismiss" onClick={() => { onDismiss(connection.id); onClose(); }}>
          Dismiss
        </button>
        <button className="btn-confirm" onClick={() => { onConfirm(connection.id); onClose(); }}>
          Confirm
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ConnectionPopover.tsx
git commit -m "Add ConnectionPopover for inline AI connection review"
```

---

### Task 4: Create InlineEditor component

**Files:**
- Create: `src/components/InlineEditor.tsx`

- [ ] **Step 1: Create InlineEditor.tsx**

A click-to-edit component used in both canvas cards and list view. Shows display text; clicking switches to an input/textarea. Pressing Enter or blurring saves.

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onSave: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export function InlineEditor({ value, onSave, multiline, placeholder, className, displayClassName }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  if (!editing) {
    return (
      <span
        className={displayClassName ?? className}
        onClick={() => setEditing(true)}
        style={{ cursor: "text" }}
      >
        {value || placeholder || "Click to edit..."}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        className={className}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        rows={4}
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={save}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InlineEditor.tsx
git commit -m "Add InlineEditor for click-to-edit in canvas and list views"
```

---

### Task 5: Create ListView component

**Files:**
- Create: `src/components/ListView.tsx`

- [ ] **Step 1: Create ListView.tsx**

A vertical scrollable list of a project's notes and artifacts. Each item is expandable for inline editing. Connected items show a link indicator.

```tsx
"use client";

import { useState } from "react";
import type { AnyObject, Connection, NoteMaturity, ArtifactType } from "@/types";
import { getDisplayName } from "@/types";
import { KindIcon } from "./Icons";
import { InlineEditor } from "./InlineEditor";

interface Props {
  items: AnyObject[];
  connections: Connection[];
  onUpdate: (obj: AnyObject) => void;
  onDelete: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ListView({ items, connections, onUpdate, onDelete, selectedId, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => b.modifiedAt - a.modifiedAt);

  const hasConnection = (id: string) =>
    connections.some(
      (c) => (c.type === "ai_confirmed" || c.type === "manual") && (c.sourceId === id || c.targetId === id)
    );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    onSelect(id);
  };

  if (items.length === 0) {
    return (
      <div className="list-empty">
        <p>No items in this project yet.</p>
        <p className="list-empty-sub">Capture a thought from the home screen and assign it here.</p>
      </div>
    );
  }

  return (
    <div className="list-view">
      {sorted.map((item) => {
        const isExpanded = expandedId === item.id;
        const linked = hasConnection(item.id);

        return (
          <div
            key={item.id}
            className={`list-item ${isExpanded ? "expanded" : ""} ${selectedId === item.id ? "selected" : ""}`}
            onClick={() => toggleExpand(item.id)}
          >
            <div className="list-item-header">
              <KindIcon kind={item.kind} className="kind-icon" />
              <span className="list-item-name">{getDisplayName(item)}</span>
              {linked && <span className="list-item-linked" title="Has connections" />}
              <span className="list-item-time">
                {new Date(item.modifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>

            {isExpanded && (
              <div className="list-item-expanded" onClick={(e) => e.stopPropagation()}>
                {item.kind === "note" && (
                  <>
                    <InlineEditor
                      value={item.content}
                      onSave={(v) => onUpdate({ ...item, content: v, modifiedAt: Date.now() })}
                      multiline
                      className="list-edit-textarea"
                      displayClassName="list-edit-display"
                    />
                    <select
                      className="list-status-select"
                      value={item.maturity}
                      onChange={(e) => onUpdate({ ...item, maturity: e.target.value as NoteMaturity, modifiedAt: Date.now() })}
                    >
                      {["fleeting", "developing", "structured", "reference"].map((m) => (
                        <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                      ))}
                    </select>
                  </>
                )}
                {item.kind === "artifact" && (
                  <>
                    <InlineEditor
                      value={item.name}
                      onSave={(v) => onUpdate({ ...item, name: v, modifiedAt: Date.now() })}
                      className="list-edit-input"
                      displayClassName="list-edit-display"
                    />
                    <select
                      className="list-status-select"
                      value={item.type}
                      onChange={(e) => onUpdate({ ...item, type: e.target.value as ArtifactType, modifiedAt: Date.now() })}
                    >
                      {["image", "video", "code", "document", "font", "audio", "other"].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </>
                )}
                <button className="btn-ghost danger-text" onClick={() => onDelete(item.id)}>Delete</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ListView.tsx
git commit -m "Add ListView for scrollable project content view"
```

---

### Task 6: Rewrite SpatialCanvas for single-project view

**Files:**
- Modify: `src/components/SpatialCanvas.tsx`

- [ ] **Step 1: Rewrite SpatialCanvas.tsx**

Strip out project clustering logic. The canvas now receives a flat list of items (notes + artifacts for one project) and renders each as a draggable card. Connection lines are drawn between connected items. Clicking a connection line opens a ConnectionPopover.

Key changes from current:
- Remove `ProjectCluster` import and rendering
- Remove `projectMembers`, `positionedProjects`, `sharedObjectIds` logic
- Props change: `items` (the project's contents) replaces `objects` (all objects)
- Add `onConfirmConnection` and `onDismissConnection` props for inline review
- Add connection line click → popover state
- Keep: pan/zoom, drag cards, double-click to create, inline create flow

The full file is ~300 lines. The structure:
1. Props: `items`, `connections`, `selectedId`, `onSelect`, `onUpdatePosition`, `onCreateAtPosition`, `onConfirmConnection`, `onDismissConnection`
2. Position items without canvasPosition using spiral layout
3. Filter connections to only those between items in the list
4. Render connection SVG lines (clickable for suggested connections)
5. Render item cards (kind icon, title, preview, status)
6. ConnectionPopover state: when a suggested connection line is clicked, show popover at click position
7. Keep existing: pan, zoom, drag, double-click create, inline create picker

- [ ] **Step 2: Verify the component compiles in isolation (page.tsx will still fail)**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1 | grep -c "SpatialCanvas"
```

Expected: 0 errors from SpatialCanvas.tsx (errors from page.tsx are expected)

- [ ] **Step 3: Commit**

```bash
git add src/components/SpatialCanvas.tsx
git commit -m "Rework SpatialCanvas to show single-project contents with inline connection review"
```

---

### Task 7: Rewrite page.tsx with simplified 2-column layout

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

The workspace mode becomes a 2-column layout (sidebar + content area). The content area renders either SpatialCanvas or ListView based on a per-project toggle stored in localStorage.

Key changes:
- Remove imports: GardenView, GraphView, StreamView, DetailView, SuggestionsPanel, ViewSwitcher
- Add imports: ListView, ConnectionPopover
- Replace `viewMode` state (5 views) with `contentMode` state: `"canvas" | "list"`
- Add `selectedProjectId` state (which project is open)
- Content area: toolbar with toggle icon + search button, then canvas or list
- Remove keyboard shortcuts 1-5; add Tab for canvas/list toggle
- Keep: Cmd+N, Cmd+K, Cmd+Shift+V, file drop, rediscovery, toasts

The workspace mode JSX structure:
```
<main className="app-layout-simple">
  <Sidebar ... />
  <div className="main-panel">
    <div className="main-toolbar">
      <button toggle canvas/list />
      <spacer />
      <button search />
    </div>
    {contentMode === "canvas" ? <SpatialCanvas .../> : <ListView .../>}
  </div>
  <ToastContainer .../>
  {showSearch && <SearchDialog .../>}
  {dragOver && <DropOverlay />}
  {modelLoading && <LoadingBar />}
</main>
```

- [ ] **Step 2: Verify TypeScript compiles with zero errors**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1
```

Expected: No output (zero errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Rewrite page.tsx with simplified 2-column layout and canvas/list toggle"
```

---

### Task 8: Update globals.css — remove dead sections, add new styles

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Remove CSS sections for deleted components**

Delete these CSS sections entirely:
- `/* ─── Detail ─── */` through end of detail styles
- `/* ─── Detail Editing ─── */` through end
- `/* ─── Connection Picker ─── */` through end
- `/* ─── Delete ─── */` through end
- `/* ─── Suggestions Panel ─── */` through all right-tab, inbox-panel, inbox-card styles
- `/* ─── Graph View ─── */` through end
- `/* ─── Stream View ─── */` through end
- `/* ─── Garden View ─── */` through end
- `/* ─── Project Clusters ─── */` through end
- `/* ─── Shared Object Pulse ─── */` through end
- `/* ─── View Switcher ─── */` (the 5-tab version)

- [ ] **Step 2: Update the layout grid**

Change `.app-layout` from 3 columns to 2:

```css
.app-layout-simple {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100vh;
}
```

- [ ] **Step 3: Add new CSS sections**

Add styles for:
- `.conn-popover` — positioned absolutely, background card with shadow, rounded corners, confirm/dismiss buttons
- `.list-view` — scrollable container with padding
- `.list-item` — compact row with header, expandable body
- `.list-item-header` — flex row: icon + name + linked indicator + date
- `.list-item-expanded` — slide-down expansion with edit fields
- `.list-item-linked` — small green dot indicating connections
- `.list-edit-textarea`, `.list-edit-input` — inline edit styling
- `.list-status-select` — compact dropdown
- `.list-empty` — centered empty state
- `.mode-toggle` — single icon button for canvas/list switching
- `.inline-editor-display` — editable display text style

- [ ] **Step 4: Verify the dev server renders correctly**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1
```

Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "Clean up CSS: remove deleted component styles, add list view and connection popover styles"
```

---

### Task 9: Update keyboard shortcuts and localStorage toggle

**Files:**
- Modify: `src/app/page.tsx` (keyboard handler section)

- [ ] **Step 1: Update keyboard handler in page.tsx**

In the `useEffect` keyboard handler:
- Remove: `if (e.key === "1") ...` through `if (e.key === "5") ...`
- Add: Tab key toggles `contentMode` between "canvas" and "list" (only when not in an input/textarea/select)
- Keep: Cmd+N, Cmd+K, Cmd+Shift+V, Escape

- [ ] **Step 2: Add localStorage persistence for content mode per project**

When `contentMode` changes, save to `localStorage.setItem(`hypher-view-mode-${selectedProjectId}`, contentMode)`.

When `selectedProjectId` changes, read from `localStorage.getItem(`hypher-view-mode-${selectedProjectId}`)` and set `contentMode` (default to "canvas").

- [ ] **Step 3: Verify keyboard shortcuts work**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1
```

Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "Update keyboard shortcuts: remove 1-5 view keys, add Tab for canvas/list toggle"
```

---

### Task 10: Final integration test and cleanup

**Files:**
- Verify all files compile and work together

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx tsc --noEmit 2>&1
```

Expected: Zero errors

- [ ] **Step 2: Check no dead imports remain**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
grep -r "GardenView\|GraphView\|StreamView\|DetailView\|SuggestionsPanel\|InboxSidebar\|ProjectCluster\|ViewSwitcher" src/ --include="*.tsx" --include="*.ts"
```

Expected: No matches (all references removed)

- [ ] **Step 3: Check no dead CSS class references**

Spot-check that removed CSS classes (`.garden-container`, `.graph-container`, `.stream-view`, `.detail-content`, `.suggestions-panel`, `.project-cluster`) are not referenced in any remaining component.

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Users/niki_g/conductor/workspaces/hypher/krakow/hypher-web
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git commit -m "Final cleanup: verify no dead references after UX simplification"
git push
```
