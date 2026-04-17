# Week 2 — Spec #03: Public shareable canvases

## Goal

Project owners can create a read-only share link. Visitors see the canvas without signing in. Secrets are hashed server-side; embeddings are stripped from the public snapshot.

## Data model

- `canvasShares` table: `userId`, `projectId`, `publicSlug`, `tokenHash` (bcrypt), optional `label`, `revokedAt`.

## Convex

- `canvasShares.create` — owner-only; returns `publicSlug`, `secret` (shown once), builds share URL.
- `canvasShares.listForProject` / `revoke` — owner.
- `canvasShares.getPublicSnapshot` — unauthenticated query; validates slug + token; returns project + objects + connections (no embeddings).

## UI

- Project settings: create link (copy full URL with `?t=`), list active links, revoke.
- `src/app/share/s/[slug]/page.tsx` — server page; `fetchQuery` snapshot; renders `ShareWatermark` (server component, no `"use client"`) + `PublicCanvasView`.
- `SpatialCanvas` — `readOnly` mode: pan/zoom only; no edit, drag, rubber band, context menu, etc.

## Follow-up

- Production runtime throws if `NEXT_PUBLIC_CONVEX_URL` is still the CI placeholder (client-side check in `ConvexProvider`).
