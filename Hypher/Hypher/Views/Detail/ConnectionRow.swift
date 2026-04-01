import SwiftUI
import SwiftData

struct ConnectionRow: View {
    let connection: Connection
    let currentObjectID: UUID

    @Environment(\.modelContext) private var modelContext
    @Environment(ConnectionEngine.self) private var engine

    private var otherID: UUID {
        connection.sourceID == currentObjectID ? connection.targetID : connection.sourceID
    }

    private var otherKind: ObjectKind {
        connection.sourceID == currentObjectID ? connection.targetKind : connection.sourceKind
    }

    private var otherName: String {
        if let obj = engine.resolveObject(id: otherID, kind: otherKind, context: modelContext) {
            return obj.displayName
        }
        return "Unknown"
    }

    private var kindIcon: String {
        switch otherKind {
        case .project: return "folder.fill"
        case .note: return "note.text"
        case .artifact: return "doc.fill"
        }
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: kindIcon)
                .foregroundStyle(.secondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(otherName)
                    .lineLimit(1)
                Text(otherKind.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }

            Spacer()

            ConfidenceBadge(confidence: connection.confidence)
        }
    }
}
