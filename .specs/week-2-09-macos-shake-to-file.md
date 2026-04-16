# Spec: macOS shake-to-file gesture (stub for native app)

**Owner:** unassigned-macos
**PR target branch:** `cursor/week-2-9-macos-shake-to-file-XXXX`
**Status:** **Stub — depends on macOS app stack decision.** This spec describes the interaction and the data plumbing in detail so the moment we pick Tauri vs. native Swift, the implementer has a concrete target. No code from this spec ships in `hypher-web/` (browsers can't reliably read OS-level mouse-velocity events outside a focused tab; this gesture is a native-app feature only).

**Depends on:**
- A decision on the macOS app stack: **Tauri 2 + Rust** (favored — same TS UI as web, smaller binary, sandboxed by default) **or native Swift/AppKit** (favored if we want first-class Sequoia integration like Stage Manager + Continuity Camera). Until the decision lands, this spec describes the interaction in stack-agnostic terms and flags the per-stack implementation differences in a dedicated section.
- Whichever native app exposes a draggable representation of a note / inbox card (the same drag the web canvas already supports — `SpatialCanvas.tsx`'s `useDragInteraction` hook is the analogue).
- An IPC surface from the dragged-card view to a "shell" controller that can render the project drawer (Tauri webview window, or AppKit `NSPanel`).
- Week 1 Clerk auth + per-user `objects` (already in the schema). The drawer reads the user's projects via the same Convex query the web app uses (`api.objects.list` filtered to `kind === "project"`).

**Conflicts with:**
- Whatever native equivalent of `useDragInteraction` exists by the time this lands. The shake detector composes onto the existing drag pipeline — it is not a fork.
- Any concurrent work introducing a different "global drag overlay" pattern (e.g., a side-panel quick-move). One overlay system at a time.

---

## Why

The single most-asked-for filing affordance in capture-first tools is "drop this somewhere quickly without opening menus." Things 3 has the magic plus button. Notion has the slash menu. Hypher's spatial canvas has drag-and-drop already — but the inbox sidebar and the floating-clusters home don't. Filing an inbox note today requires opening the project, dragging the card in, and re-zooming. Shake-to-file collapses that into one gesture: pick up a card, give it a wiggle, the project drawer slides in, drop it on a target. This is the kind of micro-interaction that gets a screenshot on X and makes long-time users feel like the app is *theirs*. It only works on macOS (the OS-level mouse velocity APIs are reliable; trackpad gestures are precise enough) and only in a native shell — the web build doesn't get this.

## Scope

### In scope

#### Interaction

1. User starts dragging a card (note or inbox item) from the inbox sidebar, the floating clusters home, or the canvas. Standard drag — same modifier-free left-click-and-hold the web app already uses.
2. While dragging, the shake detector (a small Rust / Swift module — see "Stack notes" below) samples the mouse position at the OS pointer-update cadence (~120Hz on modern Macs).
3. A "shake" is registered when the cursor's *X-axis* velocity reverses sign **3 or more times** within a **500ms** rolling window. Y-axis movement is ignored on purpose — vertical jitter happens during normal drag toward edges; horizontal reversals are a deliberate gesture.
4. On detected shake:
   - A subtle haptic tap fires (`NSHapticFeedbackManager.performFeedback` on Swift, the Tauri equivalent via the `tauri-plugin-haptic` shim).
   - A drawer slides in from the right edge over 220ms (ease-out cubic). The drawer is ~360px wide, full-window-height, with a translucent background (NSVisualEffectView on Swift, `backdrop-filter: blur(20px)` on Tauri).
   - The drawer lists every active project as a stacked card with: project name, item count, the last-touched timestamp, and a generous drop zone (the entire row). Archived/shipped projects are excluded.
   - At the top: a search field (focused, but typed text doesn't steal pointer focus from the drag — the search filters projects in real time as the user types with the *non-dragging* hand).
   - At the bottom: a special "Inbox (no project)" zone for un-filing.
5. The user releases the mouse over a project row → the card is filed (its `projectId` is set to the target). The drawer slides out, the card visibly "lands" with a small pulse animation in the drawer's row that just received it.
6. The user releases anywhere else, or presses Escape, → the drawer slides out, the card returns to its original position with no change.
7. If the user shakes again *while the drawer is already open*, nothing happens — the drawer stays put. Rapid re-shakes don't toggle.

#### Settings

A new "Gestures" section in the macOS app's settings (mirrors `hypher-web/src/components/ApiKeysPanel.tsx`'s settings panel pattern). Three controls:

- **Enable shake-to-file** — boolean, default `true`.
- **Shake sensitivity** — `Low` / `Medium` / `High` mapped to `{ reversals: 4, window: 600 }`, `{ reversals: 3, window: 500 }`, `{ reversals: 2, window: 400 }`. Default `Medium`.
- **Reduce haptic feedback** — boolean, default tied to macOS's `prefers-reduced-motion` if exposed by the OS.

Saved per-user via Clerk + Convex. New mutation `api.preferences.setGesturePrefs({ shakeEnabled, sensitivity, hapticReduced })` and table:

```ts
gesturePrefs: defineTable({
  userId: v.string(),
  shakeEnabled: v.boolean(),
  sensitivity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  hapticReduced: v.boolean(),
}).index("by_user", ["userId"]),
```

#### Data plumbing

- The drag carries the card's `objectId` and a snapshot of its current `projectId` (for undo).
- The drop calls the existing `api.objects.put` mutation with `{ id: objectId, projectId: targetProjectId }`. No new mutation needed.
- Undo: standard `Cmd+Z` after filing reverts via the existing undo stack (`hypher-web/src/components/canvas/hooks/useUndoRedo.ts` analogue).

### Out of scope

- iOS / iPadOS gestures. Touch shake detection is a different problem (accelerometer, not mouse velocity) and the Hypher mobile story is unclear.
- Windows / Linux. macOS first; if Tauri is the stack the same code *might* run on Windows by reading `RawInput`, but that's a follow-up — not promised.
- Filing into a *new* project (no quick-create from the drawer in v1). Tier 2.
- Multi-card filing (shake while a multi-select is active → file all). Tier 2; the drag pipeline doesn't yet carry multi-select snapshots universally.
- Filing artifact uploads (images, files dragged from Finder). Tier 2 — Finder's drag pasteboard format is different and worth a dedicated spec.
- Shake-to-trash or shake-to-archive. Conceptually nice; concretely overloads one gesture with destructive variants. Skip.
- A web-platform fallback. Browsers don't expose pointer velocity outside the focused window's bounds, can't intercept system-level mouse events, and can't render an overlay outside the page. The web app gets a *different* affordance (right-click → "File to project…" menu) tracked in a separate spec.

## Technical approach

### Stack notes — Tauri 2 vs. native Swift

| Concern | Tauri 2 + Rust | Native Swift / AppKit |
|---|---|---|
| Shake detector | `device_query` crate or a small Rust struct reading `tao::event::WindowEvent::CursorMoved` deltas. Ring buffer of last 60 samples. | `NSEvent.addLocalMonitorForEvents(matching: .mouseMoved)`. Same ring buffer logic. |
| Drawer overlay | A second Tauri webview window (`always_on_top`, transparent background, bounds = main window). | An `NSPanel` with `.borderless` + `NSWindowCollectionBehavior.fullScreenAuxiliary`, pinned to the main window's frame. |
| Animation | CSS transition / Framer Motion in the second webview. | `NSAnimationContext` with `kCAMediaTimingFunctionEaseOut`. |
| Haptic | `tauri-plugin-haptic` (community plugin; verify maintained — wire a no-op fallback if absent). | `NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .default)`. |
| Settings persistence | Same Convex mutation as web — Tauri's webview talks to Convex directly. | A small Swift `ConvexClient` wrapper, or use a hidden webview just for the Convex calls. **Tauri wins on this axis.** |
| Bundle size | ~5 MB for app + webview. | ~2 MB. |
| Sandbox + Notarization | Tauri ships an entitled binary; Apple notarization works. | Standard. |

**Recommendation embedded in this spec:** pick **Tauri 2** unless we have a hard requirement for a native-only macOS feature (Continuity Camera capture, Stage Manager affinity, Live Activities). The shake gesture itself works equally well on either; the rest of the menu-bar app + capture flow is materially easier in Tauri because it shares the React UI with the web build.

### Shake detector pseudo-Rust

```rust
struct ShakeDetector {
    sensitivity: Sensitivity,        // low / medium / high
    samples: VecDeque<(Instant, f32)>,  // (timestamp, x_position)
}

impl ShakeDetector {
    fn observe(&mut self, x: f32, now: Instant) -> bool {
        let (window_ms, threshold) = self.sensitivity.params();
        self.samples.push_back((now, x));
        let cutoff = now - Duration::from_millis(window_ms);
        while let Some(&(t, _)) = self.samples.front() {
            if t < cutoff { self.samples.pop_front(); } else { break; }
        }
        let mut reversals = 0;
        let mut prev_dir = 0i8;
        for w in self.samples.iter().collect::<Vec<_>>().windows(2) {
            let dx = w[1].1 - w[0].1;
            let dir = if dx > 0.5 { 1 } else if dx < -0.5 { -1 } else { 0 };
            if dir != 0 && dir != prev_dir && prev_dir != 0 {
                reversals += 1;
            }
            if dir != 0 { prev_dir = dir; }
        }
        reversals >= threshold
    }
}
```

The 0.5px deadband filters out trackpad noise. The threshold is "≥ N reversals", not "exactly N", so a vigorous shake doesn't *fail* by exceeding the count.

### Drawer interaction state machine

```
idle ── drag-start ──▶ dragging ── shake-detected ──▶ drawer-open
drawer-open ── drop-on-project ──▶ filing ──▶ idle  (success animation)
drawer-open ── drop-elsewhere ──▶ closing ──▶ idle  (no-op)
drawer-open ── escape ──▶ closing ──▶ idle
drawer-open ── drag-end-without-drop ──▶ closing ──▶ idle  (mouse released over edge)
filing ── mutation-success ──▶ idle
filing ── mutation-error ──▶ idle  (toast: "Couldn't move card. Try again.")
```

A single state variable in the shell controller. The drawer view subscribes; the dragged-card view subscribes. No global event bus.

### Drawer UI

Conceptual layout (adapt to Tauri webview / SwiftUI):

```
┌──────────────────────────────────────┐
│  🔍 Search projects                  │
├──────────────────────────────────────┤
│  ▸ Hypher MVP            12 items    │
│       Last touched 2h ago            │
├──────────────────────────────────────┤
│  ▸ Side project          5 items     │
│       Last touched 3d ago            │
├──────────────────────────────────────┤
│  …                                   │
├──────────────────────────────────────┤
│  Inbox (no project)                  │
└──────────────────────────────────────┘
```

Drop targets are the entire row, including the metadata. Hover state: row background lifts to `var(--bg-tertiary)` + a 2px left border in `var(--accent)`. Drop snaps the card to that row's center for 100ms before the drawer closes.

Search filters by `project.name` (case-insensitive substring). Pinned projects (last 3 used) sit above the alphabetic list when search is empty.

### Files changed summary (when unstubbed)

| File | Change |
|---|---|
| `apps/macos/src/shake/detector.{rs,swift}` | **NEW** — sample buffer + reversal counting. |
| `apps/macos/src/shake/index.{ts}` (Tauri only) | **NEW** — TS bridge calling `invoke("subscribe_shake")`. |
| `apps/macos/src/components/ProjectDrawer.tsx` (Tauri) or `apps/macos/UI/ProjectDrawer.swift` | **NEW** — drawer view. |
| `apps/macos/src/state/dragShake.ts` | **NEW** — state machine. |
| `apps/macos/src/views/Settings/Gestures.tsx` (or Swift equivalent) | **NEW** — settings UI. |
| `hypher-web/convex/schema.ts` | Add `gesturePrefs` table. |
| `hypher-web/convex/preferences.ts` | **NEW** (or extend existing) — `setGesturePrefs` + `getGesturePrefs`. |

### External dependencies

- (Tauri) `device_query` or `tao` event integration; `tauri-plugin-haptic` (verify maintenance — wire a no-op fallback if absent or unmaintained at build time).
- (Swift) None beyond AppKit + Combine.

## Acceptance criteria

(All evaluated against the eventual native app — `hypher-web/` can't satisfy these.)

- Drag a note, shake horizontally with at least 3 X-direction reversals within 500ms → drawer slides in within 250ms.
- Release over a project row → the note's `projectId` is set to that project; verifiable via `api.objects.get`.
- Release over the "Inbox" zone → the note's `projectId` is set to `null`.
- Release outside the drawer or press Escape → no mutation; the note returns to its origin.
- The drawer never appears when the user is *not* dragging (idle shake = no-op).
- Setting "Enable shake-to-file" to false suppresses the drawer for that user; setting persists across app restarts and across devices.
- Setting sensitivity to "Low" → a 3-reversal/500ms shake is below threshold; the drawer does not open.
- Setting sensitivity to "High" → a 2-reversal/400ms shake opens the drawer.
- `prefers-reduced-motion: reduce` (or "Reduce haptic feedback" toggled) → no haptic tap, drawer slide drops to a 60ms fade.
- Cmd+Z after filing reverts the move via the existing undo stack.
- VoiceOver users: drawer rows are focusable and labeled `"File to <project name>, <N> items, last touched <relative-time>"`.
- The shake detector consumes < 1% CPU during a 30-second drag (verified via Instruments / Activity Monitor).
- The drawer renders within 60ms of shake detection on an M1 MacBook Air.
- Filing 100 cards in a row via shake-then-drop never produces a duplicate or a stuck-open drawer state.

## How to test

(Once the native app exists.)

1. Build and run the macOS app. Sign in. Have at least 5 active projects.
2. Drag an inbox card. Shake horizontally (~3 quick left-right wiggles in half a second). Confirm drawer slides in.
3. Drop on the second project row. Confirm the card is filed (the inbox sidebar updates).
4. Press `Cmd+Z`. Confirm the card returns to inbox.
5. Drag again, shake, press Escape. Confirm drawer closes with no change.
6. Drag again, shake, release over the empty area between drawer and main window. Confirm drawer closes with no change.
7. Open Settings → Gestures. Disable shake-to-file. Repeat step 2. Confirm no drawer.
8. Re-enable. Set sensitivity Low. Repeat step 2 with a normal-vigor shake. Confirm no drawer. Shake harder. Confirm drawer.
9. Toggle "Reduce haptic feedback" off (default on macOS sometimes). Repeat step 2. Confirm haptic tap.
10. Open Instruments → Time Profiler. Drag-and-shake for 30 seconds without dropping. Confirm CPU < 1% on the shake-detector thread.
11. Run automated UI test: simulate 100 shake-and-drop cycles via XCTest / Tauri's WebDriver harness. Confirm no orphaned drawer state.
12. Test with a Bluetooth mouse (lower sample rate) and a Magic Trackpad (higher). Confirm both register a deliberate shake.
13. Test cross-device persistence: change a setting on one Mac, sign in on another, confirm setting transferred via Convex.

## Security & privacy notes

- **OS-level mouse capture.** The shake detector reads global pointer position only while the user is actively dragging an in-app object. Stop sampling when the drag ends. Do not register a global mouse hook. (Apple's Privacy & Security review blocks apps that hook all mouse events without the "Input Monitoring" entitlement; we don't want to ask for that entitlement.)
- **Tauri permission scope.** If using Tauri's `device_query`, the relevant capability is `core:event:default` for window events — *not* the global pointer capability. Confirm the manifest doesn't drift toward broader permissions during implementation.
- **No telemetry.** The shake detector does not record where the user shook, how many times, or which projects they file most. (Tier-2: opt-in usage stats.)
- **Drawer renders project names.** Same scope as the web app's project list; no new exposure.
- **Settings table is per-user.** `gesturePrefs` table indexed by `userId`; `requireUserId` on every read/write.

## Known tradeoffs

- **Stack-agnostic spec.** Means the implementer reads two columns and picks one. If the macOS app stack is decided before this spec lands, drop the column that doesn't apply. Don't try to keep both implementations forever.
- **Horizontal-only shake.** Vertical jitter during edge-scrolling produces false positives if both axes count. Forcing X-only is the right call; the cost is users can't shake "up-down" to file. Document in the settings page tooltip.
- **Sensitivity is three preset buckets, not a slider.** A continuous slider invites tinkering; presets cover the cases. **Sunset:** add a slider only if a meaningful number of users say presets don't fit them.
- **Shake fires once per drag.** A user who shakes, sees the drawer, decides "wrong project," releases over nothing → drawer closes. They have to re-shake to reopen. This is intentional — re-opening on continued shake creates flicker. Cost: an extra wiggle to reconsider.
- **Drawer always slides from the right.** Left-handed users with the dock on the right have the drawer overlap the dock. Acceptable for v1 — left-edge mode is a tier-2 setting.
- **Search field steals keyboard focus.** During the drag, the user's hand is on the mouse; typing requires the other hand. The drag is held even while typing because the mouse button is down. This works on Magic Mouse / Trackpad (no separate "click + hold" keyboard required) and on most external mice. Edge case: drag-lock setups (rare) might break — document as a known issue.
- **No multi-card.** Filing 5 selected cards via one shake is a tier-2 ask. The drag pipeline today only carries the dragged card; extending it is an entire sub-spec. Skip.
- **Haptic plugin maintenance risk (Tauri).** `tauri-plugin-haptic` is community-maintained and may go unmaintained. Implementation must wire a no-op fallback if the plugin's macOS path returns an error, and the build should not fail when the plugin is absent at compile time. Document the fallback in the implementation PR.
- **Shake might confuse users on first encounter.** No discoverability — there is no UI hint. Tier-2: a one-time onboarding tooltip ("Tip: shake the card to file it") that fires on the third drag. Out of scope here.
- **Mouse vs trackpad sample rates differ.** A 60Hz Bluetooth mouse may produce fewer samples in 500ms than a 120Hz trackpad; the threshold is "≥ N reversals" so this only affects how *vigorous* the shake must be. Acceptable. **Sunset:** auto-tune the window per-device if reports come in.
- **The detector's 60-sample ring buffer.** Allocates ~960 bytes per shake-eligible window. Negligible. Mentioned only because a future "shake history" feature might want to reuse it.
- **Cmd+Z reverts the file but not the drawer animation.** The drawer is already gone when the undo fires — the visual undo is just "the card reappears in inbox." Acceptable.
