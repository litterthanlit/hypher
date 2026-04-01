import SwiftUI
import SwiftData

struct SidebarView: View {
    @Query(sort: \Project.modifiedAt, order: .reverse) private var projects: [Project]
    @Query(sort: \Note.modifiedAt, order: .reverse) private var notes: [Note]
    @Query(sort: \Artifact.modifiedAt, order: .reverse) private var artifacts: [Artifact]

    @Binding var selection: SidebarSelection?

    @State private var showProjectForm = false
    @State private var showNoteForm = false
    @State private var showArtifactForm = false

    var body: some View {
        List(selection: $selection) {
            Section("Projects") {
                ForEach(projects) { project in
                    SidebarRow(
                        icon: "folder.fill",
                        title: project.displayName,
                        subtitle: project.status.label
                    )
                    .tag(SidebarSelection.project(project.id))
                }
            }

            Section("Notes") {
                ForEach(notes) { note in
                    SidebarRow(
                        icon: "note.text",
                        title: note.displayName,
                        subtitle: note.maturity.label
                    )
                    .tag(SidebarSelection.note(note.id))
                }
            }

            Section("Artifacts") {
                ForEach(artifacts) { artifact in
                    SidebarRow(
                        icon: "doc.fill",
                        title: artifact.displayName,
                        subtitle: artifact.type.label
                    )
                    .tag(SidebarSelection.artifact(artifact.id))
                }
            }
        }
        .navigationTitle("Hypher")
        .toolbar {
            ToolbarItem {
                Menu {
                    Button("New Project…") { showProjectForm = true }
                    Button("New Note…") { showNoteForm = true }
                    Button("New Artifact…") { showArtifactForm = true }
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $showProjectForm) {
            ProjectFormView()
        }
        .sheet(isPresented: $showNoteForm) {
            NoteFormView()
        }
        .sheet(isPresented: $showArtifactForm) {
            ArtifactFormView()
        }
    }
}
