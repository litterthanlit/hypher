# Hypher design tokens & accent zoning

**Decision:** **Zoned accents (Option A)** — capture uses blue; workspace and canvas use sage (`#88BBA2` via `--accent`); shell bases are `#EBEBEB` (light) and `#2F2D2D` (dark); inbox uses amber; destructive uses red.

| Token / role | Use |
|--------------|-----|
| `--accent`, `--accent-hover`, `--accent-subtle`, `--accent-muted` | Workspace: primary actions, sidebar selection indicator, digest project chips on hover, positive emphasis |
| `--text-on-accent` | Text on solid `--accent` fills (sage is light; use dark ink, not white) |
| `--canvas-conn-confirmed`, `--canvas-conn-manual`, `--canvas-conn-ai`, `--canvas-conn-suggested-stroke` | SVG connection lines: AI-confirmed vs manual vs suggested (neutral dashed suggested) |
| `--capture-blue`, `--capture-blue-soft`, `--capture-blue-border`, `--capture-blue-ring`, `--capture-blue-glow` | **Capture flow only:** composer field, cursor, drop hint, capture-adjacent focus |
| `--amber` | Inbox section titles, unassigned hints — **semantic “needs triage” only** |
| `--blue` (generic) | Non-capture informational accents (e.g. shipped status in dashboard) |
| `--danger`, `--red` | Errors, destructive actions, danger hover on menu items |
| `--bg-*`, `--border-*`, `--text-*` | Default chrome; prefer these over raw hex |

Implementation lives in [`hypher-web/src/app/globals.css`](../hypher-web/src/app/globals.css). When adding UI, extend tokens here rather than introducing one-off colors.

See also: [`UI-Refresh-Phase-2-Spec.md`](./UI-Refresh-Phase-2-Spec.md).
