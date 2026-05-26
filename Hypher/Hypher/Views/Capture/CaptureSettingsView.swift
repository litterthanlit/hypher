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
