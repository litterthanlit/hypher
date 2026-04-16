# Week 2 — Spec #02: Capture URL scheme handler

## Goal

Support deep links into capture flow: `GET /capture?text=...` redirects signed-in users to `/app` with query params so the capture screen opens with prefilled text (for `hypher://capture` style handlers that map to HTTPS).

## Implementation

- `src/app/capture/page.tsx` — server redirect to `/app?capture=1&...` preserving query string.
- `src/app/app/page.tsx` — on load, if `capture=1`, switch to capture mode, read `text` or `q`, strip params from URL with `history.replaceState`.
- `CaptureHome` — optional `initialPrefillText` prop.

## Middleware

`/capture` is a public route (no auth required for redirect; Clerk still applies to `/app`).
