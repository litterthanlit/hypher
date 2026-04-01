import SwiftUI
import SwiftData

struct SuggestionsPanel: View {
    let selection: SidebarSelection?

    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    var body: some View {
        Group {
            if let selection {
                let suggestions = engine.suggestions(for: selection.objectID, context: modelContext)
                if suggestions.isEmpty {
                    EmptyStateView(
                        icon: "sparkle",
                        title: "No suggestions",
                        message: "Add more objects to discover connections."
                    )
                } else {
                    List {
                        Section("AI Suggestions (\(suggestions.count))") {
                            ForEach(suggestions, id: \.id) { suggestion in
                                SuggestionCard(
                                    connection: suggestion,
                                    currentObjectID: selection.objectID
                                )
                            }
                        }
                    }
                }
            } else {
                EmptyStateView(
                    icon: "wand.and.stars",
                    title: "Suggestions",
                    message: "Select an object to see AI-suggested connections."
                )
            }
        }
        .frame(minWidth: 240)
    }
}
