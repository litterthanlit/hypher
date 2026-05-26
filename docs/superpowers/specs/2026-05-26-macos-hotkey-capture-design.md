# Hypher macOS Hotkey Capture Design

## Goal

Build a small macOS companion that lets a user capture context from whatever they are doing and send it into Hypher with a global hotkey.

This is inspired by Codex Appshots, but v1 is smaller: it captures useful app/window/text/link context and sends it to Hypher as a note. It does not promise full window screenshots, OCR, or hidden offscreen text yet.

## Product Fit

Hypher's main wedge is the project context layer for builders and agents. The Mac companion makes that layer easier to feed.

The loop is:

1. User is in another app.
2. User presses a global shortcut.
3. Hypher opens a quick capture panel with detected context.
4. User adds a thought and picks a project.
5. Hypher saves the capture into the existing backend.

This keeps the original assistant/reminder vision alive because better reminders and agent briefs depend on having fresh project context first.

## V1 Scope

### Included

- Menu bar macOS app.
- Global shortcut, default `Cmd+Shift+H`.
- Quick capture panel.
- Capture frontmost app name.
- Capture focused window title when available.
- Capture selected text when possible.
- Fall back to clipboard text or URL when no selection is available.
- Text area for "Add a thought".
- Project picker loaded from Hypher.
- Save to Hypher through the existing `/api/capture` endpoint.
- Local settings for Hypher API origin and API key.
- Basic failed-send state so the user knows a capture did not save.
- Build fix for the existing macOS target if needed.

### Deferred

- Double-command hotkey.
- Screenshot/window image upload.
- OCR.
- Full app accessibility scrape beyond selected text/window title.
- Clerk native login.
- Convex Swift realtime client.
- iOS share extension.
- Background reminders.

## Why This Scope

The web backend already supports API-key capture with `/api/capture` and project listing with `/api/projects`. The Chrome extension already proves the capture pattern. V1 should reuse that backend contract instead of creating a second native data path.

Direct Convex + Clerk auth in Swift is a better v2 once the capture companion proves daily use.

## Current Repository Context

- Web capture endpoint exists in `hypher-web/convex/http.ts`.
- Capture accepts `content`, optional `projectId`, and optional `tags`.
- Project listing exists at `/api/projects`.
- Chrome extension already supports `Cmd+Shift+H` web capture.
- Existing macOS app is a SwiftUI/SwiftData local prototype and is not currently wired to Hypher backend.
- Existing macOS app has at least one build issue in `NoteFormView.swift` that should be fixed as part of implementation if the target is reused.

## Architecture

### macOS App

Use the existing `Hypher` Xcode project unless implementation proves it is cleaner to add a small companion target inside the same project.

Core pieces:

- `HypherApp`: owns app lifecycle, menu bar scene, and capture window.
- `HotkeyService`: registers the global shortcut.
- `ActiveContextService`: reads frontmost app/window metadata and best-effort selected text.
- `CaptureClient`: calls Hypher HTTP endpoints.
- `CaptureSettings`: stores API origin and API key locally.
- `CaptureDraft`: local model for the pending capture.
- `QuickCaptureView`: compact UI for editing and sending the capture.

### Backend

No backend schema changes are required for v1.

The macOS app calls:

- `GET /api/projects` with `Authorization: Bearer <api key>`
- `POST /api/capture` with `Authorization: Bearer <api key>`

V1 captures should be sent as `kind: "note"` with tags like:

- `from-macos`
- `hotkey-capture`
- app-specific tag when useful, for example `from-safari`

## Capture Format

The saved note content should be readable even without special UI support:

```text
Captured from: Safari
Window: OpenAI Developers on X
Source: https://x.com/OpenAIDevs/...

Selected text:
...

Thought:
...
```

If a field is unavailable, omit that section rather than inserting empty labels.

## Permissions

V1 should work with minimal permissions when possible.

- Global shortcut can use a normal hotkey registration path.
- Reading selected text may require accessibility access depending on the implementation and target app.
- Clipboard fallback needs no special permission.
- Screen Recording is not required in v1 because screenshot capture is deferred.

If accessibility access is needed, the app should show a clear prompt and still allow clipboard/manual capture without it.

## UX

The companion should feel like a utility, not a full workspace.

Menu bar:

- Open Capture
- Settings
- Quit

Quick capture panel:

- App/window context preview.
- Captured text/link preview.
- Thought text area.
- Project picker.
- Save button.
- Small status line for success/failure.

Settings:

- Hypher API origin, default production origin.
- API key input.
- Test connection button.
- Shortcut display.

## Error Handling

- Missing API key: open settings and explain that an API key is needed.
- Invalid API key: show a short auth error and keep the draft.
- No text detected: open the panel anyway so the user can type a thought.
- Network failure: keep the draft in the panel and show retry.
- Rate limit: show "Try again in a minute" and keep the draft.

## Testing

Verification should include:

- macOS app builds.
- Existing web tests still pass if backend code changes.
- Capture client formats requests correctly.
- `/api/projects` loads into the picker with a valid key.
- Saving creates a Hypher note with expected content.
- Missing/invalid API key path is handled.
- No-selection path still lets the user manually capture a thought.

## Success Criteria

- User can press `Cmd+Shift+H` from another app and save a capture to Hypher.
- Capture lands in the selected project or inbox.
- Capture includes enough source context to be useful later.
- No manual Convex setup is needed beyond having a working Hypher backend and an API key.
- The implementation does not fork Hypher's data model or create a separate native-only memory store.
