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
