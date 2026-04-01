import SwiftUI
import SwiftData

struct NoteFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    @State private var content = ""
    @State private var maturity: NoteMaturity = .fleeting

    var body: some View {
        VStack(spacing: 0) {
            Form {
                TextEditor(text: $content)
                    .font(.body)
                    .frame(minHeight: 100)

                Picker("Maturity", selection: $maturity) {
                    ForEach(NoteMaturity.allCases) { m in
                        Text(m.label).tag(m)
                    }
                }
            }
            .padding()

            Divider()

            HStack {
                Button("Cancel") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Create") { save() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .frame(width: 400, minHeight: 250)
    }

    private func save() {
        let note = Note(
            content: content.trimmingCharacters(in: .whitespacesAndNewlines),
            maturity: maturity
        )
        modelContext.insert(note)
        engine.generateEmbedding(for: note)
        try? modelContext.save()
        engine.computeSuggestions(context: modelContext)
        dismiss()
    }
}
