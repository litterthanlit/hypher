import SwiftUI
import SwiftData

enum SidebarSelection: Hashable {
    case project(UUID)
    case note(UUID)
    case artifact(UUID)

    var objectID: UUID {
        switch self {
        case .project(let id), .note(let id), .artifact(let id):
            return id
        }
    }

    var kind: ObjectKind {
        switch self {
        case .project: return .project
        case .note: return .note
        case .artifact: return .artifact
        }
    }
}

struct ContentView: View {
    @State private var selection: SidebarSelection?
    @State private var showInspector = true

    @Environment(ConnectionEngine.self) private var engine
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        NavigationSplitView {
            SidebarView(selection: $selection)
        } detail: {
            DetailView(selection: selection)
                .toolbar {
                    ToolbarItem {
                        let count = engine.pendingSuggestionCount(context: modelContext)
                        Button {
                            showInspector.toggle()
                        } label: {
                            Label(
                                "Suggestions",
                                systemImage: count > 0 ? "sparkles" : "sparkle"
                            )
                        }
                        .badge(count)
                    }

                    ToolbarItem {
                        Button {
                            engine.computeSuggestions(context: modelContext)
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                        .disabled(engine.isProcessing)
                    }
                }
                .inspector(isPresented: $showInspector) {
                    SuggestionsPanel(selection: selection)
                        .inspectorColumnWidth(min: 240, ideal: 280, max: 360)
                }
        }
    }
}
