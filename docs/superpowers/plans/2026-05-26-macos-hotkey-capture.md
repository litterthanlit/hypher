# macOS Hotkey Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS menu-bar hotkey companion that captures active app context and saves it to Hypher through the existing capture API.

**Architecture:** Reuse the existing `Hypher` Xcode app target. Add small Swift services for settings, HTTP capture, active app context, and hotkey registration, then wire them into a compact SwiftUI menu-bar capture panel.

**Tech Stack:** SwiftUI, AppKit, Carbon global hotkey APIs, Foundation `URLSession`, existing Convex HTTP capture endpoints.

---

## File Structure

- Modify: `Hypher/Hypher/HypherApp.swift`  
  Add shared state, menu bar scene, settings scene, and hotkey startup.
- Modify: `Hypher/Hypher/Views/ContentView.swift`  
  Keep the existing workspace window working while adding capture environment objects only if needed.
- Modify: `Hypher/Hypher/Views/Forms/NoteFormView.swift`  
  Fix the existing `.frame(width:minHeight:)` compile error.
- Create: `Hypher/Hypher/Models/CaptureProject.swift`  
  Project DTO returned from `/api/projects`.
- Create: `Hypher/Hypher/Models/CaptureDraft.swift`  
  Editable capture draft and note formatting.
- Create: `Hypher/Hypher/Models/CaptureSettings.swift`  
  API origin and API key persistence using `UserDefaults`.
- Create: `Hypher/Hypher/Services/CaptureClient.swift`  
  HTTP client for `/api/projects` and `/api/capture`.
- Create: `Hypher/Hypher/Services/ActiveContextService.swift`  
  Best-effort frontmost app/window/selected-text/clipboard context.
- Create: `Hypher/Hypher/Services/HotkeyService.swift`  
  Register `Cmd+Shift+H` and call a supplied handler.
- Create: `Hypher/Hypher/Views/Capture/QuickCaptureView.swift`  
  Main capture panel.
- Create: `Hypher/Hypher/Views/Capture/CaptureSettingsView.swift`  
  API key/origin settings view.
- Modify: `Hypher/Hypher.xcodeproj/project.pbxproj`  
  Add new Swift files to the app target sources.
- Create: `script/build_and_run.sh`  
  Stable build/run entrypoint for Codex.
- Create or modify: `.codex/environments/environment.toml`  
  Adds a Run action pointing at `script/build_and_run.sh`.

## Task 1: Repair Build Baseline and Add Run Script

**Files:**
- Modify: `Hypher/Hypher/Views/Forms/NoteFormView.swift`
- Create: `script/build_and_run.sh`
- Create: `.codex/environments/environment.toml`

- [ ] **Step 1: Fix the known SwiftUI frame compile error**

Replace this line:

```swift
.frame(width: 400, minHeight: 250)
```

With:

```swift
.frame(width: 400)
.frame(minHeight: 250)
```

- [ ] **Step 2: Add the macOS build/run script**

Create `script/build_and_run.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT_DIR/Hypher/Hypher.xcodeproj"
SCHEME="Hypher"
CONFIGURATION="Debug"
DERIVED_DATA="$ROOT_DIR/.build/xcode-derived-data"
APP_PATH="$DERIVED_DATA/Build/Products/$CONFIGURATION/Hypher.app"

if pgrep -x "Hypher" >/dev/null 2>&1; then
  pkill -x "Hypher" || true
fi

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "platform=macOS" \
  -derivedDataPath "$DERIVED_DATA" \
  build

/usr/bin/open -n "$APP_PATH"

if [[ "${1:-}" == "--verify" ]]; then
  sleep 2
  pgrep -x "Hypher" >/dev/null
fi
```

Then make it executable:

```bash
chmod +x script/build_and_run.sh
```

- [ ] **Step 3: Add Codex Run action**

Create `.codex/environments/environment.toml`:

```toml
[[actions]]
name = "Run"
command = "./script/build_and_run.sh"
```

- [ ] **Step 4: Verify baseline build**

Run:

```bash
xcodebuild -project Hypher/Hypher.xcodeproj -scheme Hypher -configuration Debug -destination "platform=macOS" build
```

Expected: build succeeds or shows the next real compile error to fix before continuing.

## Task 2: Add Capture Models, Settings, and HTTP Client

**Files:**
- Create: `Hypher/Hypher/Models/CaptureProject.swift`
- Create: `Hypher/Hypher/Models/CaptureDraft.swift`
- Create: `Hypher/Hypher/Models/CaptureSettings.swift`
- Create: `Hypher/Hypher/Services/CaptureClient.swift`
- Modify: `Hypher/Hypher.xcodeproj/project.pbxproj`

- [ ] **Step 1: Create project DTO**

Create `CaptureProject.swift`:

```swift
import Foundation

struct CaptureProject: Identifiable, Hashable, Decodable {
    let id: String
    let name: String
    let status: String?
    let priority: Double?
}

struct CaptureProjectsResponse: Decodable {
    let projects: [CaptureProject]
}
```

- [ ] **Step 2: Create capture draft formatter**

Create `CaptureDraft.swift`:

```swift
import Foundation

struct CaptureDraft: Equatable {
    var appName: String
    var windowTitle: String
    var source: String
    var selectedText: String
    var thought: String
    var projectId: String?

    var hasContent: Bool {
        !source.trimmed.isEmpty || !selectedText.trimmed.isEmpty || !thought.trimmed.isEmpty
    }

    var formattedContent: String {
        var sections: [String] = []
        if !appName.trimmed.isEmpty {
            sections.append("Captured from: \(appName.trimmed)")
        }
        if !windowTitle.trimmed.isEmpty {
            sections.append("Window: \(windowTitle.trimmed)")
        }
        if !source.trimmed.isEmpty {
            sections.append("Source: \(source.trimmed)")
        }
        if !selectedText.trimmed.isEmpty {
            sections.append("Selected text:\n\(selectedText.trimmed)")
        }
        if !thought.trimmed.isEmpty {
            sections.append("Thought:\n\(thought.trimmed)")
        }
        return sections.joined(separator: "\n\n")
    }
}

extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
```

- [ ] **Step 3: Create persisted settings**

Create `CaptureSettings.swift`:

```swift
import Foundation
import Observation

@Observable
final class CaptureSettings {
    private let defaults: UserDefaults

    var apiOrigin: String {
        didSet { defaults.set(apiOrigin, forKey: Keys.apiOrigin) }
    }

    var apiKey: String {
        didSet { defaults.set(apiKey, forKey: Keys.apiKey) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.apiOrigin = defaults.string(forKey: Keys.apiOrigin) ?? "https://hypher.app"
        self.apiKey = defaults.string(forKey: Keys.apiKey) ?? ""
    }

    var normalizedOrigin: URL? {
        let value = apiOrigin.trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: value)
    }

    var hasApiKey: Bool {
        !apiKey.trimmed.isEmpty
    }

    private enum Keys {
        static let apiOrigin = "hypher.capture.apiOrigin"
        static let apiKey = "hypher.capture.apiKey"
    }
}
```

- [ ] **Step 4: Create HTTP client**

Create `CaptureClient.swift`:

```swift
import Foundation

enum CaptureClientError: LocalizedError {
    case missingOrigin
    case missingApiKey
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingOrigin:
            return "Set a valid Hypher API origin."
        case .missingApiKey:
            return "Add a Hypher API key in Settings."
        case .invalidResponse:
            return "Hypher returned an unexpected response."
        case .server(let message):
            return message
        }
    }
}

struct CaptureClient {
    var session: URLSession = .shared

    func fetchProjects(settings: CaptureSettings) async throws -> [CaptureProject] {
        let origin = try origin(from: settings)
        var request = URLRequest(url: origin.appending(path: "/api/projects"))
        request.setValue("Bearer \(settings.apiKey.trimmed)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(CaptureProjectsResponse.self, from: data).projects
    }

    func save(draft: CaptureDraft, settings: CaptureSettings) async throws {
        let origin = try origin(from: settings)
        var request = URLRequest(url: origin.appending(path: "/api/capture"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(settings.apiKey.trimmed)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "kind": "note",
            "content": draft.formattedContent,
            "projectId": draft.projectId as Any,
            "tags": ["from-macos", "hotkey-capture"]
        ])
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    private func origin(from settings: CaptureSettings) throws -> URL {
        guard let origin = settings.normalizedOrigin else { throw CaptureClientError.missingOrigin }
        guard settings.hasApiKey else { throw CaptureClientError.missingApiKey }
        return origin
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw CaptureClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data)["error"]) ?? "Hypher request failed."
            throw CaptureClientError.server(message)
        }
    }
}
```

- [ ] **Step 5: Add new files to Xcode target**

Add the four new Swift files to `PBXSourcesBuildPhase` in `Hypher/Hypher.xcodeproj/project.pbxproj`. Follow the existing ID style and place model files under the `Models` group and `CaptureClient.swift` under `Services`.

## Task 3: Add Active Context and Hotkey Services

**Files:**
- Create: `Hypher/Hypher/Services/ActiveContextService.swift`
- Create: `Hypher/Hypher/Services/HotkeyService.swift`
- Modify: `Hypher/Hypher.xcodeproj/project.pbxproj`

- [ ] **Step 1: Create active context reader**

Create `ActiveContextService.swift`:

```swift
import AppKit
import Foundation

struct ActiveAppContext: Equatable {
    var appName: String
    var windowTitle: String
    var selectedText: String
    var clipboardText: String

    func draft() -> CaptureDraft {
        let text = selectedText.trimmed.isEmpty ? clipboardText : selectedText
        let source = text.looksLikeURL ? text : ""
        return CaptureDraft(
            appName: appName,
            windowTitle: windowTitle,
            source: source,
            selectedText: source.isEmpty ? text : "",
            thought: "",
            projectId: nil
        )
    }
}

struct ActiveContextService {
    func read() -> ActiveAppContext {
        let app = NSWorkspace.shared.frontmostApplication
        let appName = app?.localizedName ?? ""
        let windowTitle = focusedWindowTitle(processIdentifier: app?.processIdentifier)
        let selectedText = selectedText(processIdentifier: app?.processIdentifier)
        let clipboardText = NSPasteboard.general.string(forType: .string) ?? ""
        return ActiveAppContext(
            appName: appName,
            windowTitle: windowTitle,
            selectedText: selectedText,
            clipboardText: clipboardText
        )
    }

    private func focusedWindowTitle(processIdentifier: pid_t?) -> String {
        guard let processIdentifier else { return "" }
        let appElement = AXUIElementCreateApplication(processIdentifier)
        var focusedWindow: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &focusedWindow)
        guard result == .success, let focusedWindow else { return "" }
        var title: CFTypeRef?
        AXUIElementCopyAttributeValue(focusedWindow as! AXUIElement, kAXTitleAttribute as CFString, &title)
        return title as? String ?? ""
    }

    private func selectedText(processIdentifier: pid_t?) -> String {
        guard let processIdentifier else { return "" }
        let appElement = AXUIElementCreateApplication(processIdentifier)
        var focusedElement: CFTypeRef?
        let focusResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)
        guard focusResult == .success, let focusedElement else { return "" }
        var selectedText: CFTypeRef?
        AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedText)
        return selectedText as? String ?? ""
    }
}

private extension String {
    var looksLikeURL: Bool {
        guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }
}
```

- [ ] **Step 2: Create global hotkey service**

Create `HotkeyService.swift`:

```swift
import Carbon
import Foundation

final class HotkeyService {
    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private var onPressed: (() -> Void)?

    deinit {
        unregister()
    }

    func register(onPressed: @escaping () -> Void) {
        self.onPressed = onPressed
        unregister()

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, userData in
                guard let userData else { return noErr }
                let service = Unmanaged<HotkeyService>.fromOpaque(userData).takeUnretainedValue()
                service.onPressed?()
                return noErr
            },
            1,
            &eventType,
            Unmanaged.passUnretained(self).toOpaque(),
            &eventHandler
        )

        var hotKeyID = EventHotKeyID(signature: OSType(0x48595048), id: 1)
        RegisterEventHotKey(
            UInt32(kVK_ANSI_H),
            UInt32(cmdKey | shiftKey),
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }

    func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
            self.hotKeyRef = nil
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
            self.eventHandler = nil
        }
    }
}
```

- [ ] **Step 3: Add files to Xcode target**

Add both files to the `Services` group and app target sources in `project.pbxproj`.

## Task 4: Add Capture UI and Wire App Lifecycle

**Files:**
- Create: `Hypher/Hypher/Views/Capture/QuickCaptureView.swift`
- Create: `Hypher/Hypher/Views/Capture/CaptureSettingsView.swift`
- Modify: `Hypher/Hypher/HypherApp.swift`
- Modify: `Hypher/Hypher.xcodeproj/project.pbxproj`

- [ ] **Step 1: Create quick capture UI**

Create `QuickCaptureView.swift` with:

```swift
import SwiftUI

struct QuickCaptureView: View {
    @Bindable var settings: CaptureSettings
    @State private var draft: CaptureDraft
    @State private var projects: [CaptureProject] = []
    @State private var isSaving = false
    @State private var status = ""

    private let client = CaptureClient()

    init(settings: CaptureSettings, draft: CaptureDraft) {
        self.settings = settings
        _draft = State(initialValue: draft)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Capture to Hypher")
                .font(.headline)

            contextPreview

            TextEditor(text: $draft.thought)
                .frame(minHeight: 90)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.quaternary))

            Picker("Project", selection: Binding(
                get: { draft.projectId ?? "" },
                set: { draft.projectId = $0.isEmpty ? nil : $0 }
            )) {
                Text("Inbox").tag("")
                ForEach(projects) { project in
                    Text(project.name).tag(project.id)
                }
            }

            HStack {
                Text(status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button(isSaving ? "Saving..." : "Save") {
                    Task { await save() }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(isSaving || !draft.hasContent)
            }
        }
        .padding(18)
        .frame(width: 420)
        .task { await loadProjects() }
    }

    private var contextPreview: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !draft.appName.trimmed.isEmpty {
                Label(draft.appName, systemImage: "macwindow")
            }
            if !draft.windowTitle.trimmed.isEmpty {
                Text(draft.windowTitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if !draft.source.trimmed.isEmpty {
                Text(draft.source)
                    .font(.caption)
                    .foregroundStyle(.blue)
                    .lineLimit(2)
            }
            if !draft.selectedText.trimmed.isEmpty {
                Text(draft.selectedText)
                    .font(.caption)
                    .lineLimit(4)
            }
        }
    }

    private func loadProjects() async {
        do {
            projects = try await client.fetchProjects(settings: settings)
        } catch {
            status = error.localizedDescription
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await client.save(draft: draft, settings: settings)
            status = "Saved"
            draft.thought = ""
        } catch {
            status = error.localizedDescription
        }
    }
}
```

- [ ] **Step 2: Create settings UI**

Create `CaptureSettingsView.swift` with:

```swift
import SwiftUI

struct CaptureSettingsView: View {
    @Bindable var settings: CaptureSettings
    @State private var status = ""

    private let client = CaptureClient()

    var body: some View {
        Form {
            TextField("Hypher API origin", text: $settings.apiOrigin)
            SecureField("API key", text: $settings.apiKey)

            HStack {
                Button("Test Connection") {
                    Task { await testConnection() }
                }
                Text(status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Text("Shortcut: Command Shift H")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(width: 420)
    }

    private func testConnection() async {
        do {
            _ = try await client.fetchProjects(settings: settings)
            status = "Connected"
        } catch {
            status = error.localizedDescription
        }
    }
}
```

- [ ] **Step 3: Wire app state, menu bar, settings, and hotkey**

Modify `HypherApp.swift` so it owns capture state:

```swift
import SwiftUI
import SwiftData

@main
struct HypherApp: App {
    @State private var engine = ConnectionEngine()
    @State private var settings = CaptureSettings()
    @State private var hotkeyService = HotkeyService()
    @State private var latestDraft = CaptureDraft(appName: "", windowTitle: "", source: "", selectedText: "", thought: "", projectId: nil)

    private let contextService = ActiveContextService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(engine)
        }
        .modelContainer(for: [
            Project.self,
            Note.self,
            Artifact.self,
            Connection.self
        ])

        MenuBarExtra("Hypher", systemImage: "bolt.fill") {
            Button("Open Capture") {
                openCapture()
            }
            SettingsLink {
                Text("Settings")
            }
            Divider()
            Button("Quit") {
                NSApplication.shared.terminate(nil)
            }
        }

        Window("Capture to Hypher", id: "capture") {
            QuickCaptureView(settings: settings, draft: latestDraft)
        }
        .defaultSize(width: 420, height: 420)

        Settings {
            CaptureSettingsView(settings: settings)
        }
    }

    private func openCapture() {
        latestDraft = contextService.read().draft()
        NSApplication.shared.activate(ignoringOtherApps: true)
        for window in NSApplication.shared.windows where window.identifier?.rawValue == "capture" {
            window.makeKeyAndOrderFront(nil)
        }
    }
}
```

Then register the hotkey at launch. If SwiftUI `App` cannot reliably call setup inside the struct body, add a lightweight `.onAppear` host view that calls:

```swift
hotkeyService.register {
    openCapture()
}
```

- [ ] **Step 4: Add capture view files to Xcode target**

Add both capture view files to a new `Capture` group under `Views` and to the target sources.

## Task 5: Verify, Commit, and Push

**Files:**
- Modify as needed based on compiler errors only.

- [ ] **Step 1: Build the app**

Run:

```bash
xcodebuild -project Hypher/Hypher.xcodeproj -scheme Hypher -configuration Debug -destination "platform=macOS" build
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 2: Run the build script**

Run:

```bash
./script/build_and_run.sh --verify
```

Expected: app builds, opens, and `pgrep -x Hypher` succeeds.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only files related to the Mac capture companion, run script, spec, and plan are staged for this feature. Existing unrelated dirty files stay unstaged.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/plans/2026-05-26-macos-hotkey-capture.md Hypher script .codex
git commit -m "feat: add macos hotkey capture companion"
```

- [ ] **Step 5: Push main**

Run:

```bash
git push origin main
```

Expected: commit is pushed to `main`.

## Self-Review Checklist

- Spec coverage: hotkey, menu bar, active app context, clipboard fallback, project picker, settings, `/api/capture`, and build verification are covered.
- Scope control: screenshots, OCR, double-command, Clerk native login, and Convex Swift are not included.
- Type consistency: `CaptureDraft`, `CaptureSettings`, `CaptureClient`, `ActiveContextService`, and `HotkeyService` are named consistently across tasks.
- Backend fit: v1 uses existing `/api/projects` and `/api/capture`; no schema changes.
