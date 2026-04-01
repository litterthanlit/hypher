import SwiftUI
import SwiftData

struct SuggestionCard: View {
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
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: kindIcon)
                    .foregroundStyle(.secondary)

                Text(otherName)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Spacer()

                ConfidenceBadge(confidence: connection.confidence)
            }

            if !connection.reason.isEmpty {
                Text(connection.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Spacer()

                Button {
                    engine.dismiss(connection, context: modelContext)
                } label: {
                    Label("Dismiss", systemImage: "xmark")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)

                Button {
                    engine.confirm(connection, context: modelContext)
                } label: {
                    Label("Confirm", systemImage: "checkmark")
                        .font(.caption)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}
