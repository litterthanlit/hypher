# Adaptive Workspace Design

**Status:** Approved (implementation in progress)  
**Date:** 2026-06-12  
**Related:** [hypher-product-build-roadmap.md](../../product/hypher-product-build-roadmap.md)

## Goal

Hypher opens in the right workspace mode for the current project context — and remembers when the user disagrees. Structural customization via **presets**; adaptive behavior via a **signal router**. No page builder, no revived multi-view chrome.

## Layout presets (v1)

| Preset | Primary surface | Use when |
|--------|-----------------|----------|
| **Orient** | Project Pulse | Resume cold, review memory, agent updates |
| **Think** | Canvas | Spatial linking and exploration |
| **Triage** | Inbox (global) or List (project) | Clearing unsorted captures |

Maps to existing `WorkspaceContentMode` values — no new views.

## Signal priority

When signals conflict, apply in order:

1. **User pin** — explicit per-project `pinnedMode`
2. **Activation incomplete** — force Pulse; suppress adaptive nudges to canvas/list
3. **Agent inbox unreviewed** — global: Agent Inbox; project: Pulse with agent emphasis
4. **Inbox backlog** (≥ 5 unsorted) — global: Inbox; project: List (triage within project)
5. **Low project health** (< 60) or stale memory — Orient (Pulse)
6. **Last manual mode** — within 24h unless high-severity signal (inbox backlog or agent inbox)
7. **Global default** — Orient (Pulse)

## `workspacePrefs` schema

### Global row (`projectId` absent)

- `userId`
- `globalDefaultMode`: `pulse` | `canvas` | `list` (default `pulse`)

### Project row (`projectId` set)

- `userId`
- `projectId`
- `pinnedMode`: optional — wins over all signals
- `lastManualMode`: optional — last tab user chose
- `lastManualAt`: optional — ms timestamp for 24h override window

Indexes: `by_user`, `by_user_project`.

## Override rules

- **Pin** — user clicks "Pin for this project" on layout banner or view tabs; sets `pinnedMode`.
- **Manual tab click** — updates `lastManualMode` + `lastManualAt`; clears auto-switch banner for session.
- **Auto-switch** — shows dismissible banner with reason; does not re-fight user in same session after dismiss.
- **Migration** — one-time import of `localStorage` keys `hypher-view-mode-*` into project rows.

## Deferred (not v1)

- Right context rail / Handoff preset
- Pulse panel reorder
- Collapsible sidebar presets
- LLM explanations of layout choices
- Visual theme picker

## Success criteria

- Workspace with messy inbox opens in Triage (Inbox)
- Pinning Canvas for a project persists across devices
- Auto-switch shows a one-line reason; pin available from banner
- `resolveWorkspaceLayout()` covered by unit tests
