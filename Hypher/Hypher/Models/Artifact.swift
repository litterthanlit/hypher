import Foundation
import SwiftData

@Model
final class Artifact: Embeddable {
    var id: UUID
    var name: String
    var type: ArtifactType
    var fileReference: String?
    var createdAt: Date
    var modifiedAt: Date
    var embedding: [Double]?
    var embeddingText: String?

    static var objectKind: ObjectKind { .artifact }
    var displayName: String { name }

    init(name: String, type: ArtifactType = .other, fileReference: String? = nil) {
        self.id = UUID()
        self.name = name
        self.type = type
        self.fileReference = fileReference
        self.createdAt = Date()
        self.modifiedAt = Date()
    }

    func textForEmbedding() -> String {
        [name, type.rawValue].joined(separator: " — ")
    }
}
