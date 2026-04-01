import SwiftUI
import SwiftData

@main
struct HypherApp: App {
    @State private var engine = ConnectionEngine()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(engine)
        }
        .modelContainer(for: [
            Project.self,
            Note.self,
            Artifact.self,
            Connection.self
        ])
    }
}
