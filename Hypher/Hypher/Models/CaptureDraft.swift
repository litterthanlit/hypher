import Foundation

struct CaptureDraft: Equatable, Hashable {
    var appName: String
    var windowTitle: String
    var source: String
    var selectedText: String
    var thought: String
    var projectId: String?

    var hasContent: Bool {
        !source.trimmed.isEmpty || !selectedText.trimmed.isEmpty || !thought.trimmed.isEmpty
    }

    var formattedContent: String {
        var sections: [String] = []
        if !appName.trimmed.isEmpty {
            sections.append("Captured from: \(appName.trimmed)")
        }
        if !windowTitle.trimmed.isEmpty {
            sections.append("Window: \(windowTitle.trimmed)")
        }
        if !source.trimmed.isEmpty {
            sections.append("Source: \(source.trimmed)")
        }
        if !selectedText.trimmed.isEmpty {
            sections.append("Selected text:\n\(selectedText.trimmed)")
        }
        if !thought.trimmed.isEmpty {
            sections.append("Thought:\n\(thought.trimmed)")
        }
        return sections.joined(separator: "\n\n")
    }
}

extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
