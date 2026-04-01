import SwiftUI
import SwiftData

struct NoteDetailView: View {
    @Bindable var note: Note
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    var body: some View {
        Form {
            Section("Content") {
                TextEditor(text: $note.content)
                    .font(.body)
                    .frame(minHeight: 150)

                Picker("Maturity", selection: $note.maturity) {
                    ForEach(NoteMaturity.allCases) { maturity in
                        Text(maturity.label).tag(maturity)
                    }
                }
            }

            Section("Connections") {
                let conns = engine.connections(for: note.id, context: modelContext)
                if conns.isEmpty {
                    Text("No connections yet")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(conns, id: \.id) { connection in
                        ConnectionRow(connection: connection, currentObjectID: note.id)
                    }
                }
            }

            Section {
                HStack {
                    Text("Created")
                    Spacer()
                    Text(note.createdAt, style: .date)
                        .foregroundStyle(.secondary)
                }
                if note.embedding != nil {
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
        .navigationTitle("Note")
        .onChange(of: note.content) { updateEmbedding() }
    }

    private func updateEmbedding() {
        note.modifiedAt = Date()
        engine.generateEmbedding(for: note)
        engine.computeSuggestions(context: modelContext)
    }
}
