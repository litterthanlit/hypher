import Foundation
import SwiftData

@Model
final class Project: Embeddable {
    var id: UUID
    var name: String
    var desc: String
    var status: ProjectStatus
    var createdAt: Date
    var modifiedAt: Date
    var embedding: [Double]?
    var embeddingText: String?

    static var objectKind: ObjectKind { .project }
    var displayName: String { name }

    init(name: String, desc: String = "", status: ProjectStatus = .seed) {
        self.id = UUID()
        self.name = name
        self.desc = desc
        self.status = status
        self.createdAt = Date()
        self.modifiedAt = Date()
    }

    func textForEmbedding() -> String {
        [name, desc].filter { !$0.isEmpty }.joined(separator: ". ")
    }
}
