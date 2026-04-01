import Foundation
import SwiftData

@Model
final class Note: Embeddable {
    var id: UUID
    var content: String
    var maturity: NoteMaturity
    var createdAt: Date
    var modifiedAt: Date
    var embedding: [Double]?
    var embeddingText: String?

    static var objectKind: ObjectKind { .note }

    var displayName: String {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 40 { return trimmed }
        return String(trimmed.prefix(40)) + "…"
    }

    init(content: String, maturity: NoteMaturity = .fleeting) {
        self.id = UUID()
        self.content = content
        self.maturity = maturity
        self.createdAt = Date()
        self.modifiedAt = Date()
    }

    func textForEmbedding() -> String {
        content
    }
}
