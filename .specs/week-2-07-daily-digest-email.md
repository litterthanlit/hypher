# Spec: Daily digest email + "Reply to add a thought" capture

**Owner:** unassigned
**PR target branch:** `cursor/week-2-7-daily-digest-email-XXXX`
**Depends on:**
- Week 1 Clerk auth PR (Clerk holds the user's email + the user's preferred timezone if set; we read both via `auth()` / Clerk API).
- Week 1 schema migration adding `userId` to `objects` (already present at `hypher-web/convex/schema.ts:23`).
- Spec 01 (seed demo project) — *not* a hard dep, but the email's "Reply to add" lands in a default project, and that project should be the seeded "Try Hypher" if no other inbox exists. If Spec 01 hasn't merged when this lands, the fallback is to create a `kind: "note"` with `projectId: null` and surface it in the existing inbox sidebar.
- Existing `api.ai.generateDigest` Convex action at `hypher-web/convex/ai.ts:47` (reused as-is — we don't need streaming for an email).

**Conflicts with:**
- Any PR rewriting `hypher-web/convex/ai.ts:generateDigest`.
- Any PR rewriting `hypher-web/convex/crons.ts` (we add a new cron entry there).
- Any PR adding a `userPreferences` table — this spec adds a small `digestPrefs` table; if a broader prefs table is in flight, merge into that instead.

---

## Why

The in-app digest is great if you open the app. The playbook flags the missed beat: most builders open Linear / GitHub / email in the morning, not Hypher. A 5-line email at 8am local that mirrors the in-app digest brings Hypher into the morning routine — *without* requiring a habit change. The "Reply to add a thought" hook is the second half: an email is a place where thoughts happen, and turning a reply into a captured note completes the loop without ever opening the app. Linear and Cron both win mornings this way.

## Scope

### In scope

- A new Convex `internalAction` `internal.digestEmail.sendForUser({ userId })` that:
  - Reads the user's email + timezone from Clerk (server-side; no PII leaves Convex except to Resend).
  - Calls `internal.ai.generateDigest` with the same project shape the in-app digest uses (extract that from `ai.ts:generateDigest` into a shared helper if it isn't already).
  - Sends an HTML+text email via Resend to the user's primary email.
  - Logs an `activity` row: `action: "updated"`, `objectKind: "system"`, `summary: "Daily digest emailed"` (so we can audit deliveries).
- A new cron at `hypher-web/convex/crons.ts` that runs every 15 minutes and dispatches `sendForUser` to every user whose local time is currently 08:00 ± 7 minutes (so the 15-min cron grain doesn't miss anyone).
- A new table `digestPrefs` (`userId`, `enabled`, `localHour`, `timezone`, `lastSentAt`) so users can disable the email or change the hour. Default-on for every user when the cron first runs and finds no row.
- A small settings UI in `hypher-web/src/components/ApiKeysPanel.tsx` (or a new "Notifications" tab — pick the location closest to the existing settings; do not invent a new modal): toggle for "Daily email digest" + an hour picker + a timezone display (read-only, sourced from `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- A new HTTP endpoint `POST /api/email/inbound` (Resend Inbound webhook target) that:
  - Verifies the request via Resend's `svix-signature`-style HMAC (Resend signs inbound webhooks; secret stored in `RESEND_INBOUND_SECRET`).
  - Parses the email body (text/plain preferred; strip the quoted-reply chain).
  - Looks up the recipient's `userId` by matching the digest's `Reply-To` token (a per-send opaque token; see "Reply addressing" below).
  - Inserts a new note via `internal.objects.putForApiUser` with `content: <body>`, `maturity: "fleeting"`, `tags: ["from-email"]`, and `projectId` = the user's "inbox" project (the seeded demo project, or null if none exists).
- Email template (HTML + plain-text) with: greeting, the digest paragraph, up to 3 "Open in Hypher" links to the most-mentioned projects, an "Add a thought (just reply)" footer, and an unsubscribe link.

### Out of scope

- Per-project digest emails ("send me an email when project X has a new blocker"). Tier 2.
- A rich email composer / template editor. Email content is fully derived from `generateDigest` output.
- Sending emails on behalf of the user (transactional outbound *for* the user). This is purely Hypher → user.
- Any SMS / Slack / push notification surface.
- Markdown / rich-text replies. Email replies are parsed as plain text, first non-quoted block becomes the note `content`.
- Attachments in replies. v1 ignores attachments; the note carries only the text.
- Per-team digests (multi-user accounts). Hypher is solo-first.
- A web preview of the digest email. The email is the email; the in-app digest is the in-app digest. Same content, two channels.
- Sending if no projects exist. The cron skips users with zero non-archived projects.

## Technical approach

### New table: `digestPrefs` in `hypher-web/convex/schema.ts`

```ts
digestPrefs: defineTable({
  userId: v.string(),
  enabled: v.boolean(),
  localHour: v.number(),       // 0–23, default 8
  timezone: v.string(),         // IANA, e.g. "America/Los_Angeles"
  lastSentAt: v.optional(v.number()),
}).index("by_user", ["userId"]),
```

### New file: `hypher-web/convex/digestEmail.ts`

```ts
"use node";

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Resend } from "resend";

export const sendForUser = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { console.warn("RESEND_API_KEY missing — skipping digest"); return; }

    const profile = await ctx.runQuery(internal.digestEmail.getProfile, { userId });
    if (!profile?.email) return;

    const projects = await ctx.runQuery(internal.digestEmail.projectInputs, { userId });
    if (projects.length === 0) return;

    const text = await ctx.runAction(internal.ai.generateDigest, { projects });
    if (!text || text.startsWith("Daily digest unavailable")) return;

    const replyToken = crypto.randomUUID(); // 128-bit, used as the reply-id
    await ctx.runMutation(internal.digestEmail.recordSend, {
      userId, sentAt: Date.now(), replyToken,
    });

    const resend = new Resend(apiKey);
    const replyAddress = `reply+${replyToken}@inbound.hypher.app`;
    await resend.emails.send({
      from: "Hypher Digest <digest@hypher.app>",
      to: profile.email,
      replyTo: replyAddress,
      subject: subjectLineForToday(),
      html: renderHtml({ text, projects: top3MentionedProjects(text, projects) }),
      text: renderText(text),
      headers: {
        "List-Unsubscribe": `<${process.env.NEXT_PUBLIC_APP_URL}/digest/unsubscribe?token=${replyToken}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  },
});

export const getProfile = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Clerk lookup happens via a small helper that calls Clerk's REST API server-side.
    // (Convex can't import @clerk/nextjs/server — Node runtime only — so this is a fetch call to /v1/users/{id}.)
    const email = await fetchClerkEmail(userId);
    return { email };
  },
});

export const projectInputs = internalQuery({...}); // mirrors DailyDigest.tsx:41 logic

export const recordSend = internalMutation({...}); // upserts digestPrefs.lastSentAt and stores replyToken
```

`fetchClerkEmail` is a server-side fetch to `https://api.clerk.com/v1/users/{userId}` with `Authorization: Bearer ${process.env.CLERK_SECRET_KEY}`. Token is already in env from Week 1.

### New file: `hypher-web/convex/digestEmailDispatcher.ts`

The 15-minute cron walks `digestPrefs` and dispatches `sendForUser` for any user whose local hour is currently `localHour` and who has no `lastSentAt` within the last 23 hours.

```ts
"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

export const dispatchDigests = internalAction({
  handler: async (ctx) => {
    const now = Date.now();
    const allPrefs = await ctx.runQuery(internal.digestEmail.listEnabled);
    for (const pref of allPrefs) {
      const localNow = new Date(now).toLocaleString("en-US", { timeZone: pref.timezone, hour: "numeric", hour12: false });
      const localHour = parseInt(localNow, 10);
      if (localHour !== pref.localHour) continue;
      if (pref.lastSentAt && now - pref.lastSentAt < 23 * 3600_000) continue;
      await ctx.runAction(internal.digestEmail.sendForUser, { userId: pref.userId });
    }
  },
});
```

The 23-hour gate is the idempotency guard: even if the cron fires twice in the same hour (it shouldn't, but Convex doesn't guarantee at-most-once), no user gets two emails in a single calendar day.

Also bootstraps `digestPrefs` rows for users without one: when any user's first `objects.list` query runs after sign-in (in `hypher-web/src/components/ConvexProvider.tsx` or similar), check-and-create a row with defaults `{ enabled: true, localHour: 8, timezone: <browser-detected> }`. That keeps the cron from missing anyone.

### Updated: `hypher-web/convex/crons.ts`

```ts
crons.interval(
  "dispatch-digest-emails",
  { minutes: 15 },
  internal.digestEmailDispatcher.dispatchDigests,
);
```

### Reply addressing

The reply target is `reply+<replyToken>@inbound.hypher.app`, where `<replyToken>` is the per-send UUID stored in `digestPrefs` (we extend the row to carry the most recent token, plus an array of recent tokens for short-window matching — see "Schema for tokens" below).

**Why per-send tokens, not per-user?** A per-user reply address (e.g., `reply+<userId>@…`) makes it trivially easy for an attacker who knows a user's Clerk ID to forge inbound notes by spoofing the sender. A per-send opaque token is unguessable and rotates daily; even if leaked, it's only valid for ~7 days (window during which the token is still recognized).

**Schema additions for tokens** (extend the table above):

```ts
digestPrefs: defineTable({
  // ... fields above ...
  recentReplyTokens: v.optional(v.array(v.object({
    token: v.string(),
    sentAt: v.number(),
  }))),
}).index("by_user", ["userId"])
  .index("by_token", ["recentReplyTokens.token"]), // see Convex docs on indexed array fields; if not supported, swap to a sibling table.
```

Convex doesn't support nested-array indexes natively. Two options:
- (a) Use a sibling table `digestReplyTokens(token, userId, createdAt)` indexed by `token`. Cleaner. **Use this.**
- (b) Store tokens denormalized and walk all `digestPrefs` rows on inbound. Cheap because tokens are short-lived; but slow as `digestPrefs` grows. Avoid.

Going with (a). Add to schema:

```ts
digestReplyTokens: defineTable({
  token: v.string(),
  userId: v.string(),
  createdAt: v.number(),
  consumedAt: v.optional(v.number()),
}).index("by_token", ["token"]),
```

The cron prunes tokens older than 14 days (small mutation appended to `dispatchDigests`).

### Inbound email handler

Resend Inbound forwards parsed-email JSON to a configured webhook. Add a route to `hypher-web/convex/http.ts`:

```ts
http.route({
  path: "/api/email/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const sig = request.headers.get("svix-signature");
    const id = request.headers.get("svix-id");
    const ts = request.headers.get("svix-timestamp");
    const body = await request.text();

    if (!verifyResendSignature({ id, ts, sig, body, secret: process.env.RESEND_INBOUND_SECRET! })) {
      return new Response("bad-signature", { status: 401 });
    }

    const parsed = JSON.parse(body) as ResendInbound;
    const toAddress = parsed.to[0]?.address ?? "";
    const tokenMatch = toAddress.match(/^reply\+([a-f0-9-]{36})@/i);
    if (!tokenMatch) return new Response("ok", { status: 200 }); // not for us; ack so Resend stops retrying

    const token = tokenMatch[1];
    const tokenRow = await ctx.runQuery(internal.digestEmail.lookupToken, { token });
    if (!tokenRow) return new Response("ok", { status: 200 });
    if (Date.now() - tokenRow.createdAt > 14 * 86_400_000) return new Response("ok", { status: 200 });

    const text = stripQuotedReply(parsed.text ?? "");
    if (!text || text.length > 4000) return new Response("ok", { status: 200 });

    const projectId = await ctx.runQuery(internal.digestEmail.getInboxProjectId, { userId: tokenRow.userId });
    const now = Date.now();
    await ctx.runMutation(internal.objects.putForApiUser, {
      userId: tokenRow.userId,
      kind: "note",
      content: text,
      maturity: "fleeting",
      tags: ["from-email"],
      projectId: projectId ?? null,
      createdAt: now,
      modifiedAt: now,
    });

    return new Response("ok", { status: 200 });
  }),
});
```

`stripQuotedReply` is a small regex-based helper: cut at the first line matching `^>` or `^On .* wrote:$` or `^---+ Original Message ---+$`. Standard email convention. Keep it conservative (false negatives — leaving a quoted block in — are tolerable; false positives — eating the user's content — are not).

`verifyResendSignature` follows Resend's HMAC-SHA-256 docs (their inbound webhooks use the Svix format). Reuse the Svix npm package already pulled in for the Clerk webhook in Spec 01 — it handles both providers identically.

### Email template

Two renderers, plain and HTML. Plain is the source of truth.

```ts
function renderText({ text }: { text: string }): string {
  return [
    "Good morning.",
    "",
    text.trim(),
    "",
    "—",
    "Reply to add a thought to your inbox.",
    `Open Hypher: ${process.env.NEXT_PUBLIC_APP_URL}/app`,
  ].join("\n");
}
```

HTML version uses inline CSS (no `<style>`-tag rules — Gmail strips them). One-column, system-font, light/dark-aware via `@media (prefers-color-scheme: dark)` inside a `<style>` tag (Gmail web ignores it; Apple Mail honors it). Up to 3 project links rendered as buttons. Footer carries the unsubscribe link with both `<a>` and the `List-Unsubscribe` header for one-click compliance.

Skip for v1: a separate React Email component setup. Inline strings are fine until the template gets complex.

### Settings UI

Add to `hypher-web/src/components/ApiKeysPanel.tsx` (or its parent settings layout):

- Section heading: "Daily email digest"
- Toggle: enabled/disabled (Sonner toast on save: "Saved.")
- Hour picker: 0–23 select; default 8.
- Timezone: read-only, computed via `Intl.DateTimeFormat().resolvedOptions().timeZone` and stored on every save.
- Unsubscribe link rendered as a button (same effect as the email's link — toggles `enabled = false`).

A Convex mutation `api.digestEmail.savePrefs({ enabled, localHour, timezone })` upserts the row keyed by `requireUserId`.

### Files changed summary

| File | Change |
|---|---|
| `hypher-web/convex/schema.ts` | Add `digestPrefs` and `digestReplyTokens` tables. |
| `hypher-web/convex/digestEmail.ts` | **NEW** — `sendForUser`, `savePrefs`, helpers. |
| `hypher-web/convex/digestEmailDispatcher.ts` | **NEW** — cron handler. |
| `hypher-web/convex/crons.ts` | Add 15-minute dispatcher entry. |
| `hypher-web/convex/http.ts` | Add `/api/email/inbound` route. |
| `hypher-web/convex/lib/clerk.ts` | **NEW** — server-side `fetchClerkEmail` helper. |
| `hypher-web/convex/lib/quotedReply.ts` | **NEW** — `stripQuotedReply`. |
| `hypher-web/src/app/digest/unsubscribe/route.ts` | **NEW** — GET handler that flips `enabled = false` for the token. |
| `hypher-web/src/components/ApiKeysPanel.tsx` | Add the digest settings section. |
| `hypher-web/package.json` | Add `resend`. |

### External dependencies

- `resend` npm package (new). Resend Inbound is a paid add-on; the app must be configured to forward `inbound.hypher.app` MX records to Resend. Document in PR.
- `RESEND_API_KEY`, `RESEND_INBOUND_SECRET`, `NEXT_PUBLIC_APP_URL` env vars in Convex + Vercel.
- Existing `CLERK_SECRET_KEY` (used to read user emails server-side).

## Acceptance criteria

- A user with `digestPrefs.enabled = true` and `localHour = 8` receives one email at 8am local time, with content matching the in-app digest for the same project set.
- The cron does not double-send: if it fires twice within the same hour, the 23-hour `lastSentAt` guard blocks the second send.
- A user with zero non-archived projects receives no email and no error.
- A user with `digestPrefs.enabled = false` receives no email.
- A user toggling the setting from the UI sees the change reflected in `digestPrefs` immediately and in the next morning's send (or non-send).
- Replying to the digest email creates a new `kind: "note"` with `tags: ["from-email"]` and `content` equal to the unquoted reply body. The note appears in the user's inbox sidebar within 30 seconds.
- A reply to a token older than 14 days is silently dropped (200 ack to Resend; no note inserted).
- A spoofed inbound POST without a valid Resend signature returns 401.
- The unsubscribe link works (one-click flips `enabled = false`).
- `tsc --noEmit` in `hypher-web/` passes. Convex schema migration applies cleanly.
- A test fixture email with a 50-line quoted-reply chain produces a note containing only the user's new content, not the chain.

## How to test

1. Pull the branch. `bun install`. Set `RESEND_API_KEY`, `RESEND_INBOUND_SECRET` in `.env.local` and Convex env. Configure `inbound.hypher.app` MX records to Resend (or use Resend's test inbound for local).
2. Sign in. Confirm `digestPrefs` row created on first project list (or call `api.digestEmail.savePrefs` from the dashboard manually).
3. Trigger the dispatcher manually: in the Convex dashboard, run `internal.digestEmailDispatcher.dispatchDigests`. With `localHour` set to the current local hour, you receive an email within ~10 seconds.
4. Inspect the email: Reply-To address matches `reply+<uuid>@inbound.hypher.app`; content matches the in-app digest.
5. Reply to the email with a one-line message. Within ~30 seconds, a new note with that content + tag `from-email` appears in your inbox sidebar.
6. Reply with a multi-paragraph message that includes the entire quoted digest. Confirm only the new content lands in the note.
7. From the settings UI, toggle the digest off. Confirm the next dispatcher run skips you.
8. Spoof a POST to `/api/email/inbound` without Resend signature headers — confirm 401.
9. Spoof a POST with a forged `to` matching `reply+<garbage>@inbound.hypher.app` — confirm 200 ack with no note created.
10. Wait 14+ days; reply to an old digest. Confirm no note created.
11. Run `bun test hypher-web/convex/lib/quotedReply.test.ts`.

## Security & privacy notes

- **Inbound webhook signature verification is mandatory.** Without it, anyone who guesses the route can forge inbound notes for any user. Verify before doing anything else.
- **Reply tokens are 128-bit UUIDs.** Unguessable. Even leaked, scoped to one user and one ~14-day window.
- **Token storage in a separate table** (`digestReplyTokens`) keeps the hot path narrow: an inbound email looks up by token via a single indexed query.
- **Unsubscribe link** is one-click via the `List-Unsubscribe` header (Gmail/Apple compliance). The `/digest/unsubscribe` route accepts the token via query string; this is fine because the worst an attacker can do with a leaked token is unsubscribe the user — annoying, not damaging. If we ever store more than email prefs behind a token, switch to signed cookies or POST-only.
- **Email content** contains project names, statuses, blocker text, and the digest's prose. Same data the in-app digest already shows. New surface: project names + blocker text now travel through Resend's infrastructure. Resend's privacy policy + DPA must be acceptable; document in PR.
- **Reply body content** can contain anything the user types. We store it verbatim as a note — same shape as `/api/capture`. No parsing, no AI processing on the inbound path. If a user emails their bank statement to their own digest, that's their choice and we treat it like any other note.
- **Clerk email lookup** is server-side via `CLERK_SECRET_KEY`. Never exposed client-side. The Convex action's logs must not include the email — log `userId` only.
- **Rate limit on inbound.** Resend's own inbound infrastructure rate-limits, but a malicious actor with a stolen token could spam notes. Cap inbound to 50 notes/hour per token; reuse the Day-3 Upstash limiter.
- **PII in subject line.** Don't include the user's name or email in the subject. Use a static "Your Hypher digest, Tuesday morning" pattern.
- **Quoted-reply stripping is conservative.** A false-positive (chopping the user's content) is worse than a false-negative (storing the chain). Default to leaving content in if the regex is unsure.

## Known tradeoffs

- **15-minute cron cadence with a ±7-min window.** A user wanting an exact 8:00 send might get 7:53 or 8:07. Acceptable — the cost of finer granularity is more cron invocations and more clock-edge corner cases. **Sunset:** tighten to per-minute cron only if users report timing as a problem.
- **23-hour idempotency window.** A user changing their `localHour` from 8 to 9 the same morning gets only one email — the 8am one. Switching takes effect next day. Acceptable for v1.
- **Per-send tokens grow the `digestReplyTokens` table linearly.** 14-day cleanup keeps it bounded, but for 10k users that's ~140k rows in steady state. Convex handles this fine; just don't forget the cleanup mutation.
- **Resend Inbound is a paid add-on.** If we don't want to pay, fall back to a "view in app" CTA instead of reply-to-add. The reply hook is the differentiator, though, so paying is worth it.
- **Email rendering is hand-rolled HTML.** No React Email setup. If templates get complex, switch to React Email later. v1's email is text-mostly, ~5 lines of meaningful content.
- **No "I'm on vacation" auto-pause.** A user away for 2 weeks gets 14 emails. Tier 2: detect bounce streaks and auto-disable; or add a "pause until X" UI control. Not now.
- **Cron timezone math runs once per pref per cron tick.** With 10k users and a 15-min cadence, that's ~960 invocations/hour and ~10k `Intl.DateTimeFormat` calls per tick. Cheap, but if it ever isn't, batch by timezone.
- **The "inbox project" fallback is fuzzy.** If the seeded "Try Hypher" project (Spec 01) doesn't exist (user archived it, or Spec 01 isn't merged yet), the inbound note lands with `projectId: null` and shows in the inbox sidebar. Fine. **Sunset:** add an explicit per-user "default capture project" pref if confusion comes up.
- **Reply-To uses a sub-addressed alias** (`reply+<token>@inbound.hypher.app`). Some corporate mail servers strip plus-addressing on outbound. If reports of dropped replies pile up, switch to a separate hostname per token (`<token>.inbound.hypher.app`) or to a dedicated mailbox lookup. Not common enough to design for now.
