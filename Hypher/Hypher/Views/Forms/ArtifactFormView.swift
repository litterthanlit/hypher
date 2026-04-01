import SwiftUI
import SwiftData

struct ArtifactFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    @State private var name = ""
    @State private var type: ArtifactType = .other
    @State private var fileReference = ""

    var body: some View {
        VStack(spacing: 0) {
            Form {
                TextField("Artifact Name", text: $name)
                    .textFieldStyle(.roundedBorder)

                Picker("Type", selection: $type) {
                    ForEach(ArtifactType.allCases) { t in
                        Text(t.label).tag(t)
                    }
                }

                TextField("File Path (optional)", text: $fileReference)
                    .textFieldStyle(.roundedBorder)
            }
            .padding()

            Divider()

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Create") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
        }
        .frame(width: 400)
    }

    private func save() {
        let artifact = Artifact(
            name: name.trimmingCharacters(in: .whitespaces),
            type: type,
            fileReference: fileReference.isEmpty ? nil : fileReference
        )
        modelContext.insert(artifact)
        engine.generateEmbedding(for: artifact)
        try? modelContext.save()
        engine.computeSuggestions(context: modelContext)
        dismiss()
    }
}
