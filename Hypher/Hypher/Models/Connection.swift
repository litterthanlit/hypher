import Foundation
import SwiftData

@Model
final class Connection {
    var id: UUID
    var sourceID: UUID
    var targetID: UUID
    var sourceKind: ObjectKind
    var targetKind: ObjectKind
    var type: ConnectionType
    var confidence: Double
    var reason: String
    var createdAt: Date

    init(
        sourceID: UUID,
        targetID: UUID,
        sourceKind: ObjectKind,
        targetKind: ObjectKind,
        type: ConnectionType = .aiSuggested,
        confidence: Double = 0,
        reason: String = ""
    ) {
        self.id = UUID()
        self.sourceID = sourceID
        self.targetID = targetID
        self.sourceKind = sourceKind
        self.targetKind = targetKind
        self.type = type
        self.confidence = confidence
        self.reason = reason
        self.createdAt = Date()
    }
}
