# Hypher design tokens & accent zoning

Product: [`PRODUCT.md`](./PRODUCT.md). These tokens still mention leftover canvas/digest names in CSS. Do not treat that as a reason to rebuild those surfaces.

**Zoned accents** — capture uses blue; workspace uses sage (`#88BBA2` via `--accent`); shell bases are `#EBEBEB` (light) and `#2F2D2D` (dark); inbox uses amber; destructive uses red.

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
| `--glass-fill`, `--glass-fill-strong`, `--glass-stroke`, `--glass-inset`, `--glass-shadow`, `--glass-blur` | Logged-in glass panels (sidebar, workspace well, capture hero). Do not use on marketing. |
| `--app-mesh` | Soft Hypher mint + ice mesh behind the logged-in shell |

Implementation lives in [`hypher-web/src/app/globals.css`](../hypher-web/src/app/globals.css). When adding UI, extend tokens here rather than introducing one-off colors.
