import AppKit
import SwiftData
import SwiftUI

@main
struct HypherApp: App {
    @Environment(\.openWindow) private var openWindow

    @State private var engine = ConnectionEngine()
    @State private var settings = CaptureSettings()
    @State private var hotkeyService = HotkeyService()
    @State private var didRegisterHotkey = false
    @State private var latestDraft = CaptureDraft(
        appName: "",
        windowTitle: "",
        source: "",
        selectedText: "",
        thought: "",
        projectId: nil
    )

    private let contextService = ActiveContextService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(engine)
                .task {
                    registerHotkeyIfNeeded()
                }
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
                .id(latestDraft)
        }
        .defaultSize(width: 420, height: 420)

        Settings {
            CaptureSettingsView(settings: settings)
        }
    }

    private func registerHotkeyIfNeeded() {
        guard !didRegisterHotkey else { return }
        didRegisterHotkey = true
        hotkeyService.register {
            Task { @MainActor in
                openCapture()
            }
        }
    }

    @MainActor
    private func openCapture() {
        latestDraft = contextService.read().draft()
        openWindow(id: "capture")
        NSApplication.shared.activate(ignoringOtherApps: true)

        DispatchQueue.main.async {
            for window in NSApplication.shared.windows where window.title == "Capture to Hypher" {
                window.makeKeyAndOrderFront(nil)
            }
        }
    }
}
