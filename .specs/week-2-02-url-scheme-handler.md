# Spec: URL scheme handler — `hypher://capture` (web leg)

**Owner:** unassigned
**PR target branch:** `cursor/week-2-2-url-scheme-handler-XXXX`
**Depends on:**
- Week 1 Clerk auth PR (this route relies on `auth()` returning a real Clerk `userId` and on `objects` having a `userId` field — see Spec 01 dependency notes).
- Week 1 "app moves to `/app`" PR (the capture redirect lands the user on `/app/p/<projectId>` — if the route move hasn't merged yet, land on `/` as a fallback and update the redirect target in a follow-up).
- Week 1 rate-limit PR for public capture (this web route is session-authed, not API-key authed, so it inherits Clerk's abuse controls; but the same rate-limit infra should cover it once built).

**Conflicts with:** Any concurrent work touching `hypher-web/src/app/**/route.ts`, `hypher-web/src/lib/useStore.ts`'s `addQuickCapture`, or the Toast system.

---

## Why

Raycast, Alfred, iOS Shortcuts, and shell scripts all expose "open a URL" as their most reliable cross-app hook. A universal capture endpoint at `https://hypher.app/capture?content=...&project=...` unlocks free distribution through the Raycast store and lets power users wire Hypher into their workflow in minutes. The playbook calls this the single biggest distribution lever relative to effort ("two hours of work"). The native `hypher://` scheme will be registered later by the Tauri menu-bar app; this spec covers only the web handler that powers both paths.

## Scope

### In scope

- A Next.js Route Handler at `hypher-web/src/app/capture/route.ts` that:
  - Accepts `GET /capture?content=<urlencoded-text>&project=<projectId-or-slug>&title=<optional>&tags=<comma-separated>` and `POST /capture` with the same fields in a JSON body.
  - Authenticates via the Clerk session cookie (`auth()` from `@clerk/nextjs/server`).
  - If unauthenticated → 302 redirect to `/sign-in?redirect_url=<the-original-capture-url>` so the user lands back on the capture after sign-in.
  - Creates a new `note` object via the existing `api.objects.put` Convex mutation, with `userId`, `kind: "note"`, `content`, `maturity: "fleeting"`, and optional `tags` / `projectId`.
  - On success → 302 redirect to `/app?toast=captured` (or `/app/p/<projectId>?toast=captured` if `project` was supplied).
- A `toast=captured` query-param reader in `hypher-web/src/app/page.tsx` (or `/app/page.tsx` after the Week 1 move) that fires a toast via the existing `store.addToast` API on mount and strips the param from the URL.
- Progressive `navigator.registerProtocolHandler('web+hypher', '/capture?%s')` call in a small client component inside the app layout so signed-in users can register `web+hypher://` once and have it invoke the handler thereafter. This is best-effort and silently no-ops on browsers that reject it.
- Input validation: `content` must be present and ≤10,000 chars. `project` if supplied must match `^[a-zA-Z0-9_-]{6,64}$` (Convex ID pattern). `tags` if supplied is split on commas, trimmed, deduplicated, capped at 10, each tag ≤32 chars.
- Response semantics documented in a short `README.md` note under `.specs/` (not a top-level `README.md`).

### Out of scope

- The `hypher://` scheme itself — that is registered natively by the Tauri app (later). `web+hypher://` is opt-in on the web.
- The Tauri menu-bar app.
- The Raycast extension package (separate distribution task).
- API-key-authed capture — that flow exists already at `POST /api/capture` on the Convex HTTP router and is untouched by this spec.
- Offline capture queue. If the user is offline when the URL fires, the browser shows its default error page.
- Voice capture, streaming, or any AI-side processing on the captured content (Claude tags generation is invoked downstream by existing code, not by this handler).

## Technical approach

### New file: `hypher-web/src/app/capture/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
```

Exports `GET` and `POST` handlers. Both resolve the same `{ content, project, title, tags }` input, delegate to a shared `handleCapture({ userId, input })` function, and redirect or return JSON based on the `Accept` header (`text/html` → redirect, `application/json` → JSON `{ success, id }`).

Pseudocode:

```ts
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  if (!userId) {
    const redirectUrl = new URL(req.url);
    return NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl.toString())}`, req.url)
    );
  }
  const parsed = validate(params);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const now = Date.now();
  const id = await convex.mutation(api.objects.put, {
    kind: "note",
    content: parsed.content,
    maturity: "fleeting",
    createdAt: now,
    modifiedAt: now,
    projectId: parsed.projectId ?? null,
    tags: parsed.tags,
    userId, // from Clerk
  });

  const dest = parsed.projectId ? `/app/p/${parsed.projectId}` : "/app";
  return NextResponse.redirect(new URL(`${dest}?toast=captured`, req.url));
}
```

`POST` is identical except it reads the JSON body.

Things to get right:

- Use `ConvexHttpClient` (server-side) rather than the React client. `NEXT_PUBLIC_CONVEX_URL` is already set.
- The `api.objects.put` mutation in `hypher-web/convex/objects.ts` does **not** currently accept a `userId` arg — Week 1 must add that. This spec assumes Week 1 has landed. If not, the handler must fall back to passing `userId: "default"` until Week 1 lands, but ship a follow-up to remove that fallback.
- `auth()` must be called inside the handler, not at module top-level (Next.js 16 App Router requirement).
- On error (mutation throws, validation fails), return HTML response `/app?toast=capture-error&message=<urlencoded>` for browser-initiated captures, JSON for API-style.

### New file: `hypher-web/src/app/capture/validate.ts`

Exports `validate(params: Record<string,string>)` returning a discriminated union:

```ts
type ValidateResult =
  | { ok: true; content: string; projectId: string | null; tags: string[] | undefined; title: string | undefined }
  | { ok: false; error: string };
```

Rules (from "In scope"). The projectId regex is a lightweight guard; Convex rejects malformed IDs server-side anyway. Title is stored by prepending `# <title>\n\n` to the content when present.

### Toast delivery via query param

In `hypher-web/src/app/page.tsx` (or the Week-1 `/app/page.tsx`), after the existing mount effects add:

```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const toast = params.get("toast");
  if (toast === "captured") {
    store.addToast("Captured", { label: "View", onClick: () => { /* open inbox */ } });
  } else if (toast === "capture-error") {
    const message = params.get("message") ?? "Capture failed";
    store.addToast(message);
  }
  if (toast) {
    params.delete("toast");
    params.delete("message");
    const next = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", next);
  }
}, []);
```

Do not trigger this effect in capture mode (`appMode === "capture"`) — only in workspace. Or gate on `document.readyState` and run on first client hydration.

### Optional protocol handler registration

New client component `hypher-web/src/components/ProtocolHandlerRegistration.tsx`:

```tsx
"use client";
import { useEffect } from "react";

export function ProtocolHandlerRegistration() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("registerProtocolHandler" in navigator)) return;
    try {
      navigator.registerProtocolHandler(
        "web+hypher",
        `${window.location.origin}/capture?%s`
      );
    } catch {
      // Silently ignore — some browsers block this outside user gestures.
    }
  }, []);
  return null;
}
```

Mount inside `hypher-web/src/app/layout.tsx` (or inside the signed-in layout once auth splits layouts). This fires exactly once per origin per session and the browser persists the decision; repeat calls are cheap. Silent no-op when blocked — never surface to the user.

### External dependencies

- No new npm packages. `ConvexHttpClient` ships with `convex`; `auth()` ships with `@clerk/nextjs` added in Week 1.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/src/app/capture/route.ts` | **NEW** — GET + POST handler. |
| `hypher-web/src/app/capture/validate.ts` | **NEW** — input validation. |
| `hypher-web/src/components/ProtocolHandlerRegistration.tsx` | **NEW** — `registerProtocolHandler` call. |
| `hypher-web/src/app/layout.tsx` | Mount `<ProtocolHandlerRegistration />`. |
| `hypher-web/src/app/page.tsx` (or `/app/page.tsx` after Week 1) | Add `toast=captured` / `toast=capture-error` query-param reader that fires a Toast and strips the param. |
| `.specs/examples/capture-integrations.md` | **NEW** — short cookbook entries for Raycast, iOS Shortcuts, shell (non-code). |

### Shape of the cookbook file

Under `.specs/examples/capture-integrations.md` include three copy-pasteable recipes:

1. **Shell** — `curl -G "https://hypher.app/capture" --data-urlencode "content=$(pbpaste)"` (opens in default browser via `open` on macOS).
2. **Raycast** — Script Command or simple Quicklink pointing at `https://hypher.app/capture?content={argument}`.
3. **iOS Shortcut** — "Open URL" action with `https://hypher.app/capture?content=[input]`.

The cookbook is reference-only, not executable; the implementation agent does not need to test these but should verify the URL shape in the route matches what these recipes send.

## Acceptance criteria

- `GET https://<app>/capture?content=hello` while signed-in creates a note with `content="hello"`, `projectId=null`, `userId=<clerk user id>`, and redirects to `/app?toast=captured`.
- `GET /capture?content=hello&project=<validProjectId>` puts the note in that project and lands on `/app/p/<projectId>?toast=captured`.
- `GET /capture?content=hello&tags=ideas,launch` yields `tags: ["ideas","launch"]` on the note. Empty / duplicate tags are stripped. >10 tags are truncated to the first 10.
- Missing `content`, empty `content`, or `content` longer than 10,000 chars returns HTTP 400 with a JSON body `{ "error": "..." }` (or redirects to `/app?toast=capture-error&message=...` if the client prefers HTML).
- Unauthenticated request redirects to `/sign-in?redirect_url=<original>`; after sign-in the user is returned to the capture URL and the capture then happens transparently.
- Invalid `project` parameter (fails regex) returns 400 and creates nothing.
- Posting with `Accept: application/json` returns `{ success: true, id: "<id>" }` instead of redirecting.
- Toast appears on `/app` after a successful redirect and the `?toast=captured` param is removed from the URL bar within the same tick.
- Re-firing the same URL in a second tab creates a second note (no dedup — this is user-intended behavior).
- `tsc --noEmit` in `hypher-web/` passes with zero errors.
- `next build` in `hypher-web/` passes with zero errors, and `/capture` appears in the route manifest as a Node.js route handler.

## How to test

1. Pull the branch. `bun install`.
2. `npx convex dev` + `bun dev`.
3. Sign in with a Clerk test user.
4. In a new browser tab: `http://localhost:3000/capture?content=hello%20from%20the%20url`. Confirm a new note appears in the sidebar inbox and a "Captured" toast fires on `/app`.
5. Copy an existing projectId from the URL (`/app/p/<id>`) and test `http://localhost:3000/capture?content=inside&project=<id>`. Confirm it lands in that project.
6. Test in Raycast: install a Quicklink `https://localhost:3000/capture?content={argument}` and fire it. Confirm the note appears.
7. Sign out. Fire a capture URL again. Confirm redirect to `/sign-in`, then after sign-in confirm the note was created and the toast fires.
8. Test malformed inputs:
   - `/capture` (missing content) → 400.
   - `/capture?content=<25000-char-string>` → 400.
   - `/capture?content=x&project=../admin` → 400.
   - `/capture?content=x&tags=,,,,,` → tags stripped to `[]`.
9. Test `curl -G http://localhost:3000/capture -H "Accept: application/json" --cookie "__session=<test-session>" --data-urlencode "content=curl"`. Confirm JSON response, not redirect.
10. `navigator.registerProtocolHandler` flow: open DevTools console on `/app`, confirm no errors. In Firefox (the most forgiving browser for this), visit `web+hypher://capture?content=hi` in the URL bar — confirm it delegates to `/capture?capture?content=hi` (or similar — exact shape depends on how `%s` is substituted; verify and adjust the template if needed). Silent failures in other browsers are acceptable.

## Security & privacy notes

- All captures are session-authed via Clerk. No API key path goes through this route — that is still the `/api/capture` Convex HTTP route guarded by hashed keys.
- `content` is user input and stored verbatim. It is rendered in React components that already escape text; no dangerouslySetInnerHTML anywhere in the note path. Do not decode URL entities twice.
- The `redirect_url` passed to Clerk sign-in must be validated as same-origin before being passed through. Clerk itself rejects cross-origin redirects, but we should pre-empt by using `req.nextUrl` rather than user-supplied `Referer`.
- `project` param is matched against `^[a-zA-Z0-9_-]{6,64}$` before being passed to Convex. Even if a malicious caller guesses a valid-shaped id for another user's project, Convex queries scoped by `userId` (post Week 1) should reject writes to mismatched records. **Follow-up:** after Week 1 lands, add a server-side check that the supplied `projectId` belongs to the authed `userId` before inserting; do not silently drop it.
- No IP logging or fingerprinting by this route. Rate limiting is out of scope here; the Week 1 rate limiter should cover this endpoint by path.
- `registerProtocolHandler` registers a handler only on the user's browser profile and only after a user-gesture prompt in most browsers. It does not leak data.
- Error responses never echo the `content` field back (avoids URL-param exfiltration in shared error logs).

## Known tradeoffs

- **GET accepts side-effectful writes.** HTTP purists will flag this: a GET shouldn't mutate. We accept it because Raycast, Alfred, iOS Shortcuts, and shell `open` all speak GET far more reliably than POST, and that is the whole point. The POST variant exists for callers who can speak it (shell scripts using curl, Raycast native extensions). **Sunset:** do not change; this is intentional.
- **`web+hypher://` vs. `hypher://`.** Browsers require the `web+` prefix for custom protocols unless on an allowlist. Only the native Tauri app can register bare `hypher://`. Users who haven't installed the app get the `web+` variant. Document this in the cookbook.
- **No offline queue.** If the user is offline when the URL fires, the capture fails and the browser shows its error page. Fixing this requires a service worker, which is out of scope for v1. **Sunset:** revisit if >10% of captures fail for network reasons in production logs.
- **No dedup.** Firing the same URL twice creates two notes. Users might hit this with a runaway Shortcut. Acceptable v1 — the fix is a `captureIdempotencyKey` param that we don't want to design yet. **Sunset:** add if flagged in user feedback within first 30 days.
- **Redirect swallows the response.** Callers who want the `id` of the created note can't get it from the redirect path. They must use `Accept: application/json`. Document this; don't try to squeeze it into the query param. **Sunset:** stays.
- **JSON response for POST/Accept routes bypasses the toast system.** That's intentional — API-style callers don't want a toast. The toast only fires via the redirect path.
