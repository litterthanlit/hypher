import SwiftUI
import SwiftData

struct DetailView: View {
    let selection: SidebarSelection?

    @Query private var projects: [Project]
    @Query private var notes: [Note]
    @Query private var artifacts: [Artifact]

    var body: some View {
        Group {
            if let selection {
                switch selection {
                case .project(let id):
                    if let project = projects.first(where: { $0.id == id }) {
                        ProjectDetailView(project: project)
                    }
                case .note(let id):
                    if let note = notes.first(where: { $0.id == id }) {
                        NoteDetailView(note: note)
                    }
                case .artifact(let id):
                    if let artifact = artifacts.first(where: { $0.id == id }) {
                        ArtifactDetailView(artifact: artifact)
                    }
                }
            } else {
                EmptyStateView(
                    icon: "sparkles",
                    title: "Select an object",
                    message: "Choose a project, note, or artifact from the sidebar to view its details and connections."
                )
            }
        }
    }
}
