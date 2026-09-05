# Hypher design tokens & accent zoning

Product: [`PRODUCT.md`](./PRODUCT.md). These tokens still mention leftover canvas/digest names in CSS. Do not treat that as a reason to rebuild those surfaces.

The signed-in app and marketing site share a **Turrell field**: deep navy void, a cyan-blue core, periwinkle haze at the edges, white type. Scoped via `body:has(.marketing-root | .capture-root | .app-layout-simple | .settings-api-keys-page)` so stray pages keep the old paper tokens.

**Zoned accents** — capture uses the field glow (`--capture-blue`); workspace uses periwinkle (`#9AA6FF` via `--accent`); inbox uses amber; destructive uses red.

| Token / role | Use |
|--------------|-----|
| `--accent`, `--accent-hover`, `--accent-subtle`, `--accent-muted` | Workspace: primary actions, sidebar selection, positive emphasis |
| `--text-on-accent` | Text on solid `--accent` fills (periwinkle is light; use `#07091A`) |
| `--capture-blue`, `--capture-blue-soft`, `--capture-blue-border`, `--capture-blue-ring`, `--capture-blue-glow` | **Capture flow only:** composer field, drop hint, capture-adjacent focus |
| `--amber` | Inbox section titles, unassigned hints — **semantic “needs triage” only** |
| `--blue` (generic) | Non-capture informational accents |
| `--danger`, `--red` | Errors, destructive actions |
| `--bg-*`, `--border-*`, `--text-*` | Default chrome; prefer these over raw hex |
| `--glass-fill`, `--glass-fill-strong`, `--glass-stroke`, `--glass-inset`, `--glass-shadow`, `--glass-blur` | Logged-in glass panels (sidebar, workspace well, capture composer) |
| `--app-mesh` | Navy / cyan / periwinkle field behind the logged-in shell and marketing |
| `--m-ink`, `--m-muted`, `--m-faint`, `--m-line`, `--m-mark` | Marketing type and hairlines on the field |

Implementation lives in [`hypher-web/src/app/globals.css`](../hypher-web/src/app/globals.css). When adding UI, extend tokens here rather than introducing one-off colors.
