# Spec: Chrome browser extension (MV3) — three capture modes

**Owner:** unassigned
**PR target branch:** `cursor/week-2-8-chrome-extension-XXXX`
**Depends on:**
- Week 1 Clerk auth PR — the extension authenticates via the Clerk session cookie set on the user's signed-in `hypher.app` tab; without Week 1 there is no session to read.
- Week 1 schema migration adding `userId` to `objects` (already at `hypher-web/convex/schema.ts:23`) — captures must land scoped to the right user.
- Spec 02 (URL scheme handler) — the extension's "send to Hypher" path piggybacks on the same `POST /capture` route handler, with the same payload-preserving sign-in flow if the user is signed out.
- Existing `api.ai.generateTags` Convex action at `hypher-web/convex/ai.ts:88` (called once per capture for tag suggestions).
- Existing API-key path at `POST /api/capture` on the Convex HTTP router (used as a fallback when the user has explicitly opted into API-key mode in extension settings — see "Auth modes" below).

**Conflicts with:**
- Any PR rewriting `hypher-web/src/app/capture/route.ts` (Spec 02).
- Any PR changing the API-key issuance flow at `hypher-web/convex/apiKeys.ts:create` (we expose the same plaintext-once contract through the extension's settings page).

---

## Why

The playbook calls the extension "the single feature most likely to convert Hypher from a weekly tool to a daily one." Highlight any text on any page, hit `Cmd+Shift+H`, and it lands in Hypher with the source URL as a backlink — that loop replaces "open Hypher → switch tab back → forget what you wanted to capture" with one keypress. Linear, Raindrop, Readwise, and Notion Web Clipper all built distribution this way; for Hypher it doubles as a feature *and* a Chrome Web Store listing that reaches users who never visit our marketing site.

## Scope

### In scope

#### Extension package

- A new top-level package at `extensions/chrome/` (a sibling of `hypher-web/` and `packages/core/`).
- `manifest.json` v3 with:
  - `manifest_version: 3`.
  - Permissions: `activeTab`, `contextMenus`, `storage`, `scripting`, `notifications`. **No** `tabs` permission (broad), **no** `<all_urls>` host permission (broad). Host permissions limited to `https://hypher.app/*` and `https://*.convex.cloud/*` for capture POSTs.
  - `background.service_worker: "background.js"`.
  - `commands.capture-highlight: { suggested_key: { default: "Ctrl+Shift+H", mac: "Command+Shift+H" } }`.
  - `action.default_popup: "popup.html"`.
  - `content_scripts`: a single tiny script injected on user gesture only (via `chrome.scripting.executeScript`) — no auto-injection across the web.
  - `options_page: "options.html"`.
  - `icons` 16/32/48/128.

#### Three capture modes

1. **Highlight + hotkey (`Cmd+Shift+H`).** Service worker listens for the registered command, calls `chrome.scripting.executeScript` to inject a one-shot helper into the active tab that returns `{ selection, pageTitle, pageUrl }`. The capture is sent immediately. Visible feedback: a `chrome.notifications.create` toast ("Captured to Hypher") and an extension-badge flash for 800ms.
2. **Toolbar popup.** Click the toolbar icon → a 360×420px popup (`popup.html`) shows: a textarea pre-filled with the current page selection (or empty), the page title and URL as a metadata strip, a project picker (search + create-new), a tag chip row with AI-suggested tags pre-selected, and a `Capture` button. `Enter` submits, `Esc` closes.
3. **Right-click context menu.** A single context-menu entry `"Send to Hypher"` registered via `chrome.contextMenus.create` with `contexts: ["selection", "link", "image"]`. On click, the worker grabs the matching content (`info.selectionText`, `info.linkUrl`, or `info.srcUrl`) and sends it without a popup — same path as the hotkey.

All three modes funnel through one `captureToHypher(payload)` function in the service worker.

#### Auth modes

Two paths, settable in the extension's options page:

- **Default — Clerk session passthrough.** The service worker sends a `POST` to `https://hypher.app/capture` with `credentials: "include"`. Chrome forwards the `__session` cookie that Clerk set when the user signed in to `hypher.app` in any tab. The route handler (Spec 02) authenticates via `auth()`, finds the user, writes the note. If the user is signed out, the route 302s through `/sign-in` (per Spec 02's payload-preserving cookie flow); the extension treats the 302 as "not signed in", surfaces a notification ("Sign in to Hypher to capture") with a click-to-open-tab action, and queues the capture (see "Offline / signed-out queue" below).
- **Optional — API key.** In options, the user pastes an API key (issued from the Hypher settings panel, existing flow at `convex/apiKeys.ts:create`). The worker stores the key in `chrome.storage.local` and uses it on `POST https://*.convex.cloud/api/capture` with `Authorization: Bearer <key>`. This bypasses Clerk entirely and is the right path for users on browsers/profiles where they aren't signed in to Hypher (e.g., a work browser). The key is never logged, never sent to any host other than the Convex HTTP endpoint, and is stored only in `chrome.storage.local` (not synced).

The default (session-cookie path) is what 95% of users will use. The API-key path exists for the long tail.

#### Project picker

- `GET https://hypher.app/api/projects` (Convex HTTP route at `hypher-web/convex/http.ts:97`, already supports API key + can be extended to support session cookie via a new Next.js Route Handler — see "Project list endpoint" below).
- The popup hits this on open, shows the projects in a search-filterable list. The most recently used 3 are pinned at the top.
- `Inbox (no project)` is the implicit default and renders as a faint top entry when no project is picked.
- Selecting a project saves it as the current default (in `chrome.storage.local.lastProjectId`) so subsequent hotkey captures go to the same place until changed.
- A "Create new project" link at the bottom opens `https://hypher.app/app?new-project=true` in a new tab.

#### Tag suggestion

- After the user types or pastes content into the popup textarea, debounce 600ms then call `POST https://hypher.app/api/tag-suggest` (a small new Next.js route — see below) with the content. The route forwards to `internal.ai.generateTags` and returns the array. The popup renders the result as toggleable chips, all pre-selected.
- Hotkey and context-menu modes skip this step (the capture must be instant) and rely on the existing client-side `api.ai.generateTags` post-write that other capture paths already trigger.

#### Offline / signed-out queue

- `chrome.storage.local.queue: Array<PendingCapture>` where `PendingCapture = { id, content, projectId?, tags?, sourceUrl, sourceTitle, createdAt, attempts }`.
- On capture-attempt failure (network error, 401, 503, timeout) the worker enqueues. A `chrome.alarms` alarm fires every 2 minutes and replays the queue head-first; on success the entry is deleted, on failure `attempts++` and the next replay backs off (capped at 30 min).
- After 24h of failures the entry is dropped and a notification surfaces: "3 captures couldn't reach Hypher. Sign in or check the extension options."
- The popup shows a small badge "(N queued)" if `queue.length > 0` and a "Retry now" button.

### Out of scope

- Firefox / Safari ports. MV3 in Safari is "supported but quirky"; ship Chrome (= Edge, Brave, Arc) first; revisit Firefox after the first 100 installs.
- Highlight-anywhere annotation overlay (Roam-style colored highlights pinned to URLs). Tier 2.
- Screen capture / screenshot capture. Tier 2.
- Reader-mode extraction (Mozilla Readability). v1 just captures the user's selection; if they want the article body, they `Cmd+A` first.
- Sync of `lastProjectId` across devices. v1 stores it locally. Cross-device default belongs in user settings on the server, not the extension.
- A "captured" indicator badge on already-captured pages. Requires querying the user's notes by URL on every page load — too much network traffic for v1.
- Voice capture from the popup.
- Sharing extension settings / API keys via `chrome.storage.sync` — see security note.

## Technical approach

### File layout

```
extensions/chrome/
├── manifest.json
├── background.ts               # service worker; bundled to background.js
├── popup.html
├── popup.tsx                   # React popup, bundled to popup.js
├── options.html
├── options.tsx                 # React settings page
├── content/
│   └── selection-helper.ts     # injected on demand to read window.getSelection()
├── lib/
│   ├── capture.ts              # captureToHypher() and queue
│   ├── auth.ts                 # session vs API-key resolution
│   └── api.ts                  # fetch wrappers, retries
├── styles.css
├── icons/{16,32,48,128}.png
├── package.json                # bun + tsup or vite-plugin-web-extension
└── tsconfig.json
```

Build pipeline: `bun run build` → outputs `extensions/chrome/dist/` ready for `chrome://extensions → Load unpacked`. CI step zips `dist/` for Web Store upload.

### Service worker — `background.ts`

```ts
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "capture-highlight") return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content/selection-helper.js"],
  });
  if (!result?.selection) {
    notify("Nothing selected", "Highlight some text first.");
    return;
  }
  await captureToHypher({
    content: result.selection,
    sourceUrl: tab.url ?? "",
    sourceTitle: tab.title ?? "",
  });
});

chrome.contextMenus.create({
  id: "send-to-hypher",
  title: "Send to Hypher",
  contexts: ["selection", "link", "image"],
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const content =
    info.selectionText ??
    info.linkUrl ??
    info.srcUrl ??
    "";
  if (!content) return;
  await captureToHypher({
    content,
    sourceUrl: tab?.url ?? info.linkUrl ?? "",
    sourceTitle: tab?.title ?? "",
  });
});

chrome.alarms.create("queue-replay", { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "queue-replay") replayQueue(); });
```

### `captureToHypher`

```ts
export async function captureToHypher(input: {
  content: string;
  sourceUrl: string;
  sourceTitle: string;
  projectId?: string;
  tags?: string[];
}) {
  const auth = await getAuthMode();
  const lastProject = await getLastProjectId();
  const projectId = input.projectId ?? lastProject ?? null;

  const body = {
    content: appendSourceFooter(input.content, input.sourceUrl, input.sourceTitle),
    projectId,
    tags: input.tags ?? [],
  };

  try {
    const res = await fetchWithTimeout(captureUrl(auth), {
      method: "POST",
      credentials: auth === "session" ? "include" : "omit",
      headers: headersFor(auth),
      body: JSON.stringify(body),
      redirect: "manual",                    // see signed-out handling
    });
    if (res.type === "opaqueredirect" || res.status === 0) {
      // 302 from Spec 02 means signed-out
      enqueue(input);
      notify("Sign in to Hypher", "Open hypher.app and sign in to send your captures.", openHypherAction());
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    flashBadge("✓");
    notify("Captured to Hypher", input.content.slice(0, 80));
  } catch {
    enqueue(input);
    flashBadge("…");
    notify("Capture queued", "Will retry when network is available.");
  }
}

function appendSourceFooter(content: string, url: string, title: string): string {
  if (!url) return content;
  return `${content}\n\n— from [${title || url}](${url})`;
}
```

### Project list endpoint — new Next.js route

The existing Convex `GET /api/projects` requires an API key. Add `hypher-web/src/app/api/projects/route.ts` (a Next.js Route Handler) that returns the same shape but authenticates via `auth()` (Clerk session). The extension calls this when it detects session-mode.

Two endpoints, one shape:
- `GET https://hypher.app/api/projects` (session-authed, new in this PR)
- `GET https://<convex>.convex.cloud/api/projects` (API-key-authed, existing at `hypher-web/convex/http.ts:97`)

### Tag-suggest endpoint — new Next.js route

`POST https://hypher.app/api/tag-suggest` — Clerk-session-authed Route Handler that forwards `{ content }` to `internal.ai.generateTags` via `ConvexHttpClient` and returns the array. Same auth posture as Spec 04's streaming digest endpoint. Rate-limit at 60/hour/user via the Day-3 Upstash limiter.

Used only by the popup; the hotkey and context-menu paths skip suggestion to stay instant.

### Popup UI

Plain React (no Next.js) bundled standalone. ~3 components:

```
<Popup>
  <Header pageTitle pageUrl />
  <ContentArea autofocus />
  <ProjectPicker projects lastProjectId onSelect />
  <TagChips suggested onToggle />
  <Footer queueLength onCapture onCancel />
</Popup>
```

Visual style: matches the in-app design — same `--accent`, same sticky-note-cream background. Reads CSS variables from `popup.css`; no shared bundle with `hypher-web` (the duplication is small and decouples deploy cycles).

### Storage shapes

```ts
// chrome.storage.local
type Stored = {
  authMode: "session" | "api-key";
  apiKey?: string;                 // never .sync — see security
  lastProjectId?: string | null;
  queue: PendingCapture[];
  hostOverride?: string;           // dev-only — point at localhost:3000
};
```

### Files changed summary

| File | Change |
|---|---|
| `extensions/chrome/manifest.json` | **NEW** — MV3 manifest with narrow permissions. |
| `extensions/chrome/background.ts` | **NEW** — service worker (commands + context menu + alarm). |
| `extensions/chrome/popup.{html,tsx}` | **NEW** — React popup. |
| `extensions/chrome/options.{html,tsx}` | **NEW** — auth-mode settings, queue inspector. |
| `extensions/chrome/content/selection-helper.ts` | **NEW** — `() => ({ selection: window.getSelection()?.toString(), … })`. |
| `extensions/chrome/lib/{capture,auth,api}.ts` | **NEW** — capture logic, auth resolution, fetch wrappers. |
| `extensions/chrome/package.json` | **NEW** — `bun` + `vite-plugin-web-extension` (or `tsup` + `web-ext`). |
| `extensions/chrome/icons/*.png` | **NEW** — placeholder icons (replace before Web Store submission). |
| `extensions/chrome/README.md` | **NEW** — install + dev instructions. |
| `hypher-web/src/app/api/projects/route.ts` | **NEW** — session-authed projects list mirror. |
| `hypher-web/src/app/api/tag-suggest/route.ts` | **NEW** — session-authed tag suggest forward. |
| `hypher-web/src/app/capture/route.ts` (from Spec 02) | Add `Access-Control-Allow-Origin: chrome-extension://<id>` to `OPTIONS` response and tighten the JSON-body branch to permit `sourceUrl` / `sourceTitle` metadata fields. |

### CORS

The Next.js Route Handlers at `/capture`, `/api/projects`, `/api/tag-suggest` must respond to `OPTIONS` preflights from `chrome-extension://<id>`. Echo `Origin` for the extension's specific ID (or use `*` only when there is no `Authorization` header — Chrome's preflight rules disallow `*` with credentials).

We do not yet know the extension's published Chrome Web Store ID. For dev: hard-code the `chrome-extension://*` permissive form. For prod: read the ID from `EXTENSION_ID` env and set the exact origin. Document in the route handler.

### External dependencies

- Build: `vite-plugin-web-extension` or equivalent (bundles a real MV3 service worker + injects manifest paths).
- Runtime in extension: `react`, `react-dom`. No fetch library; native `fetch`.
- Runtime in `hypher-web`: nothing new.

## Acceptance criteria

- Loading the unpacked extension in Chrome installs without warnings; `chrome://extensions` shows the icon and the `⌘⇧H` hotkey.
- Highlighting text on any HTTPS page and pressing `⌘⇧H` while signed in to `hypher.app` in another tab creates a `note` in Hypher within ~500ms with `content` ending in `— from [<title>](<url>)`. A native Chrome notification appears.
- The same flow while signed out shows a "Sign in to Hypher" notification, clicking it opens `hypher.app` in a new tab, and after sign-in the queued capture replays automatically within 2 minutes.
- Right-clicking a selection, link, or image and choosing "Send to Hypher" captures the appropriate value.
- Opening the toolbar popup pre-fills the textarea with the current selection, fetches projects, and shows AI-suggested tags within ~700ms after typing pauses.
- Selecting a project in the popup persists; subsequent hotkey captures go to that project until changed.
- The options page shows: auth mode toggle, API key field (write-only — never displayed after save), queue inspector with a "Retry now" button, and a "Reset extension" button.
- API-key auth mode: capturing routes through `https://<convex>.convex.cloud/api/capture` with `Authorization: Bearer …` and never sends cookies.
- Disabling internet, capturing 5 times, re-enabling internet — within 4 minutes all 5 captures land in Hypher.
- The extension never logs the user's content, API key, or session cookie to console (audited via Chrome's "Inspect service worker").
- Permissions in `manifest.json` do not include `tabs` or `<all_urls>` host permissions.
- Manual test: a malicious page calls `window.postMessage(...)` — the extension does not respond (no message listeners in the content script).

## How to test

1. Pull the branch. `cd extensions/chrome && bun install && bun run build`. Load `extensions/chrome/dist` as an unpacked extension in `chrome://extensions`.
2. Sign in to `hypher.app` in a tab.
3. Visit any HTTPS page. Highlight a paragraph. Press `Cmd+Shift+H`. Watch the notification. Open Hypher → confirm the note in the inbox or last-used project.
4. Right-click the selection. Choose "Send to Hypher". Confirm capture.
5. Right-click a link with no selection. Confirm the link URL is captured.
6. Click the toolbar icon. Confirm popup opens, shows the page selection, lists projects, suggests tags after a 600ms pause.
7. Pick a different project; capture. Confirm it lands there.
8. Sign out of `hypher.app`. Hit `Cmd+Shift+H` on a selection. Confirm "Sign in" notification + queued capture (visible in options page queue inspector).
9. Sign back in. Wait ≤2 minutes. Confirm the queued capture replays.
10. Open options. Switch to API-key mode. Paste a fresh API key from `hypher.app/app/settings`. Capture again. Confirm the request goes to `*.convex.cloud` (DevTools → Network on the service worker).
11. Use Chrome DevTools' Offline mode. Capture 3 things in a row. Re-enable network. Confirm all 3 land within 4 minutes.
12. Verify `chrome.storage.local` does not contain the API key after a "Reset extension" click.
13. Open the manifest in `chrome://extensions/?id=<id>` → confirm permission list matches the spec exactly.
14. Run `bun test extensions/chrome/lib/*.test.ts` — unit tests for queue replay, footer formatting, signed-out detection.

## Security & privacy notes

- **No `<all_urls>` host permission.** The extension reads page content only via `chrome.scripting.executeScript` triggered by an explicit user gesture (hotkey, context menu, popup). This is the MV3 best-practice posture and the one the Web Store reviewer will look for.
- **No content-script auto-injection.** The selection helper is injected on demand. There is no listener that watches every page load.
- **Session cookie passthrough.** When using session auth, Chrome attaches the `__session` cookie because of `credentials: "include"`. The extension never reads the cookie itself — it can't, because the cookie is `HttpOnly`. Only the browser's network stack handles it.
- **API keys.**
  - Stored only in `chrome.storage.local`, never in `chrome.storage.sync` (sync rides Chrome's account → cross-machine leak risk if account is compromised).
  - Never echoed to the popup UI after first save (input shows `••••` placeholder; a "Replace key" button clears + accepts a new one).
  - Sent only on requests to `https://*.convex.cloud/api/capture`. The fetch wrapper hard-codes the host check and refuses to attach the key elsewhere.
  - Revoking the key in the Hypher settings panel takes immediate effect server-side (existing `apiKeys.revoke` flow).
- **CORS for `chrome-extension://`.** Production routes whitelist the published extension ID via `EXTENSION_ID` env. Dev allows the broad form behind a `process.env.NODE_ENV === "development"` check. The `Authorization` header path requires explicit Origin echoing; the cookie path requires explicit Origin echoing too (cannot use `*`).
- **Captured content can be sensitive.** Page selections sometimes include passwords, 2FA codes, or personal data the user only meant to read. The extension captures *exactly* what was highlighted — no extra page scraping. Document this clearly in the options page (a single line: "Highlights are sent to Hypher exactly as selected.").
- **No telemetry.** No analytics, no Sentry in the extension. The Web Store reviewer flags this if added.
- **Permissions audit.** Run `web-ext lint` in CI; fail the build on any added `tabs`, `webNavigation`, or `<all_urls>` entry.
- **Service-worker idle.** MV3 service workers shut down after ~30s. The queue + auth-mode state live in `chrome.storage`, not memory. Any code path must be re-entrant after a worker restart.
- **Extension ID stability.** Use a static `key` in `manifest.json` so the unpacked extension's ID matches the eventual Web Store ID (so CORS allowlists don't break at publish). Generate the keypair once, store the public key in the manifest, keep the private key in 1Password.

## Known tradeoffs

- **Two project-list endpoints.** Existing API-key endpoint on Convex + new session-authed mirror on Next.js. The duplication is intentional — the extension cannot share auth contexts with both. **Sunset:** if/when Convex supports Clerk session auth on `httpAction`, fold the two together.
- **Tag suggestion only in the popup.** Hotkey + context-menu paths skip it for latency. Means hotkey-captured notes have no tags until the existing in-app tag pipeline runs. Acceptable. **Sunset:** when extension cold-start latency is reproducibly < 200ms end-to-end, add suggestion to the hotkey path with a 2-second background follow-up update.
- **No Firefox / Safari.** Chrome MV3 is the dominant browser; getting it right is more valuable than mediocre cross-browser. **Sunset:** Firefox once we hit 500 Chrome installs; Safari only if a paying customer asks.
- **No reader-mode body extraction.** Users wanting the full article body must `Cmd+A`. The cost of bundling Readability is +200KB. v1 says no.
- **Service-worker dies during retry.** A network outage during a queue replay leaves the alarm to fire again in 2 min; the half-completed retry simply re-runs. Idempotency on the server side is implicit (each capture is a new note — duplicates are *the worst case*, not the broken case). **Sunset:** add an idempotency key to the capture POST if duplicate complaints surface.
- **Plaintext key in `chrome.storage.local`.** Encryption-at-rest in `chrome.storage` is the OS keychain on macOS; on Windows/Linux it's weaker. We accept the same posture as 1Password's browser extensions and Notion Web Clipper. The mitigation is "rotate the key if your laptop is stolen" — documented in options page copy.
- **CORS `chrome-extension://*` in dev.** A wide allowlist in dev means any locally-installed extension can hit dev routes. Acceptable in dev. The prod build pins the exact ID.
- **No "captured-already" badge.** A page captured yesterday looks identical to a fresh page today. Building per-URL deduplication requires a query on every page load, which violates the no-`<all_urls>` posture. **Sunset:** add as a paid-tier feature once the user has explicitly opted in to URL-tracking.
- **Source footer is markdown.** Notes render the markdown via the existing in-app pipeline (or not — depending on the note renderer). If the renderer is plain text, the link comes through as raw markdown. Both states are tolerable; the URL is still selectable.
- **Manifest `commands.suggested_key` may collide.** `Cmd+Shift+H` collides with Chrome's built-in "Open History" shortcut on some users' setups. The extension cannot silently overwrite that — Chrome surfaces a conflict UI that the user resolves manually. Document in the README. The hotkey is configurable from `chrome://extensions/shortcuts`.
