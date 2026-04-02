import SwiftUI
import SwiftData

struct ProjectDetailView: View {
    @Bindable var project: Project
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    var body: some View {
        Form {
            Section("Details") {
                TextField("Name", text: $project.name)
                    .textFieldStyle(.plain)
                    .font(.title2.bold())

                TextField("Description", text: $project.desc, axis: .vertical)
                    .lineLimit(3...6)

                Picker("Status", selection: $project.status) {
                    ForEach(ProjectStatus.allCases) { status in
                        Text(status.label).tag(status)
                    }
                }
            }

            Section("Connections") {
                let conns = engine.connections(for: project.id, context: modelContext)
                if conns.isEmpty {
                    Text("No connections yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(conns, id: \.id) { connection in
                        ConnectionRow(connection: connection, currentObjectID: project.id)
                    }
                }
            }

            Section {
                HStack {
                    Text("Created")
                    Spacer()
                    Text(project.createdAt, style: .date)
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text("Modified")
                    Spacer()
                    Text(project.modifiedAt, style: .relative)
                        .foregroundStyle(.secondary)
                }
                if project.embedding != nil {
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
        .navigationTitle(project.name)
        .onChange(of: project.name) { updateEmbedding() }
        .onChange(of: project.desc) { updateEmbedding() }
    }

    private func updateEmbedding() {
        project.modifiedAt = Date()
        engine.generateEmbedding(for: project)
        engine.computeSuggestions(context: modelContext)
    }
}
