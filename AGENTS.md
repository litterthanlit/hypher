# AGENTS.md

## Cursor Cloud specific instructions

This is a monorepo. The primary product is the **`hypher-web`** Next.js 16 app
(Convex backend + Clerk auth). Supporting JS/TS workspaces are **`packages/core`**
(`@hypher/core` library) and **`extensions/chrome`** (MV3 browser extension). The
top-level **`Hypher/`** directory is a native macOS/iOS Swift Xcode app and
**cannot be built or run on the Linux cloud VM** (needs macOS + Xcode via
`script/build_and_run.sh`); treat it as out of scope here.

### Dependency install (important, non-obvious)

The root `package.json` declares npm `workspaces`, but that is only used for
`npm --prefix … run …` script orchestration. **Do not install via a workspace-root
`npm install`** — hoisting corrupts the tree: it mixes React 18 (chrome) and
React 19 (web) `@types/react` (breaks `hypher-web` typecheck) and drops the `svix`
transitive dep that `convex/http.ts` imports directly (breaks Convex + typecheck).

Install each package **standalone** from its own lockfile-adjacent `package.json`
using `--prefix` from the repo root (this is what the startup update script does):

```
npm install --prefix packages/core
npm install --prefix extensions/chrome
npm install --prefix hypher-web
```

Gotchas: `npm ci` inside a package dir fails here — nvm's global `.npmrc` sets
`package-lock=false` (so `ci` refuses to read the lockfile) and npm auto-scopes to
the workspace when run from inside a member. `--prefix <pkg>` from the repo root
sidesteps both by treating the package as its own project root.

### Lint / test / typecheck / build

There is **no ESLint config**; the static-check gate is TypeScript. All commands
are already defined as root scripts in `package.json` (they fan out to the three
JS workspaces via `npm --prefix`):

- `npm run typecheck` — `tsc --noEmit` across web/extension/core (use as lint)
- `npm test` — Vitest across all three (no running backend required)
- `npm run build` — production builds of all three

### Running the web app in dev

`hypher-web` needs a Convex backend and the Next dev server running together (two
processes). Use the anonymous local Convex deployment (no Convex login needed):

1. Convex backend (also writes `NEXT_PUBLIC_CONVEX_URL` etc. to `hypher-web/.env.local`):
   `cd hypher-web && CONVEX_AGENT_MODE=anonymous npx convex dev`
   - First run downloads a local backend binary. It also **fails the first push**
     until `CLERK_JWT_ISSUER_DOMAIN` is set, because `convex/auth.config.ts` throws
     when it is unset. Set a value in the deployment env, then it succeeds:
     `CONVEX_AGENT_MODE=anonymous npx convex env set CLERK_JWT_ISSUER_DOMAIN https://example.clerk.accounts.dev`
     (use a real Clerk issuer URL once Clerk keys are available).
2. Next dev server (separate terminal): `cd hypher-web && npm run dev` → http://localhost:3000

### Auth / secrets

No secrets are provisioned by default. Without real Clerk keys the app runs in
Clerk **keyless dev mode**: public pages (`/`, `/pricing`) render and `/app` shows
a "sign in required" gate. Full sign-in and every beta-gated Convex query/mutation
(anything using `requireBetaAccess`) need real Clerk keys. The complete secret list
and where each goes (`.env.local` vs `npx convex env set`) lives in
`docs/launch/01-env-vars-punchlist.md`.

To exercise the core capture → project-memory loop without auth, call the internal
Convex functions directly against the running local backend, e.g.
`CONVEX_AGENT_MODE=anonymous npx convex run objects:putForApiUser '{"userId":"demo-user","kind":"note","content":"…","createdAt":<ms>,"modifiedAt":<ms>}'`
and read back with `objects:listForApiUser '{"userId":"demo-user"}'`.
