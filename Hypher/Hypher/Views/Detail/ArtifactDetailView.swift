import SwiftUI
import SwiftData

struct ArtifactDetailView: View {
    @Bindable var artifact: Artifact
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    var body: some View {
        Form {
            Section("Details") {
                TextField("Name", text: $artifact.name)
                    .textFieldStyle(.plain)
                    .font(.title2.bold())

                Picker("Type", selection: $artifact.type) {
                    ForEach(ArtifactType.allCases) { type in
                        Text(type.label).tag(type)
                    }
                }

                TextField("File Path", text: Binding(
                    get: { artifact.fileReference ?? "" },
                    set: { artifact.fileReference = $0.isEmpty ? nil : $0 }
                ))
                .foregroundStyle(.secondary)
            }

            Section("Connections") {
                let conns = engine.connections(for: artifact.id, context: modelContext)
                if conns.isEmpty {
                    Text("No connections yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(conns, id: \.id) { connection in
                        ConnectionRow(connection: connection, currentObjectID: artifact.id)
                    }
                }
            }

            Section {
                HStack {
                    Text("Created")
                    Spacer()
                    Text(artifact.createdAt, style: .date)
                        .foregroundStyle(.secondary)
                }
                if artifact.embedding != nil {
                    HStack {
                        Text("Embedding")
                        Spacer()
                        Text("Generated")
                            .foregroundStyle(.green)
                    }
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle(artifact.name)
        .onChange(of: artifact.name) { updateEmbedding() }
        .onChange(of: artifact.type) { updateEmbedding() }
    }

    private func updateEmbedding() {
        artifact.modifiedAt = Date()
        engine.generateEmbedding(for: artifact)
        engine.computeSuggestions(context: modelContext)
    }
}
