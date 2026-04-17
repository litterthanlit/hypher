# Week 2 — Spec #02: Capture URL scheme handler

## Goal

One-shot capture for Raycast, Shortcuts, curl, and browser deep links: authenticated users create a note **server-side** without relying on client prefill.

## Route

- **`hypher-web/src/app/capture/route.ts`** — `GET` and `POST` (same handler).
- **Auth:** Clerk `auth()`. Signed-out → **302** to `/sign-in?redirect_url=…` (full path + query preserved).
- **Validation:**
  - **content** required (also accepts `text` / `q`); max **10,000** characters.
  - **project** optional; must match `^[a-zA-Z0-9_-]{6,64}$` (Convex object id segment); must be a **project** the user owns (`api.objects.getIfOwner`).
  - **tags** optional, comma-separated, max **10** tags.
- **Write:** `fetchMutation(api.objects.put, …)` with Clerk **convex** JWT (`getToken({ template: "convex" })`).
- **Content negotiation:** `Accept: application/json` → `{ success: true, id }`. Otherwise **302** to `/app?toast=captured` or `/app/p/<projectId>?toast=captured` when `project` is valid.

## App shell

- **`/app/p/[projectId]`** redirects to `/app?project=…&…` so the main client can select the project and show a toast.
- **`/app`** reads `project` + `toast=captured` once, then strips query params.

## Removed

- **`app/capture/page.tsx`** — deleted; the Route Handler fully replaces the old redirect + client prefill flow.

## Middleware

`/capture` stays public (Clerk runs inside the route). `/app/p/*` is public for the redirect page only.
