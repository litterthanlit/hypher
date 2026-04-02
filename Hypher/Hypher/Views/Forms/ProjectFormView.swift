import SwiftUI
import SwiftData

struct ProjectFormView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    @State private var name = ""
    @State private var desc = ""
    @State private var status: ProjectStatus = .seed

    var body: some View {
        VStack(spacing: 0) {
            Form {
                TextField("Project Name", text: $name)
                    .textFieldStyle(.roundedBorder)

                TextField("Description", text: $desc, axis: .vertical)
                    .lineLimit(3...6)

                Picker("Status", selection: $status) {
                    ForEach(ProjectStatus.allCases) { s in
                        Text(s.label).tag(s)
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
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()
        }
        .frame(width: 400)
    }

    private func save() {
        let project = Project(
            name: name.trimmingCharacters(in: .whitespaces),
            desc: desc,
            status: status
        )
        modelContext.insert(project)
        engine.generateEmbedding(for: project)
        try? modelContext.save()
        engine.computeSuggestions(context: modelContext)
        dismiss()
    }
}
