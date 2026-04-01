import Foundation
import SwiftData
import Observation

@Observable
final class ConnectionEngine {
    let embeddingService: EmbeddingService
    private(set) var isProcessing = false

    var similarityThreshold: Double = 0.75

    init(embeddingService: EmbeddingService = EmbeddingService()) {
        self.embeddingService = embeddingService
    }

    // MARK: - Embedding Generation

    func generateEmbedding(for object: any Embeddable) {
        let text = object.textForEmbedding()
        guard !text.isEmpty else { return }

        if object.embeddingText == text, object.embedding != nil { return }

        if let vector = embeddingService.embed(text) {
            object.embedding = vector
            object.embeddingText = text
            object.modifiedAt = Date()
        }
    }

    // MARK: - Suggestion Computation

    func computeSuggestions(context: ModelContext) {
        isProcessing = true
        defer { isProcessing = false }

        var allObjects: [(id: UUID, kind: ObjectKind, embedding: [Double], name: String)] = []

        if let projects = try? context.fetch(FetchDescriptor<Project>()) {
            for p in projects where p.embedding != nil {
                allObjects.append((p.id, .project, p.embedding!, p.displayName))
            }
        }
        if let notes = try? context.fetch(FetchDescriptor<Note>()) {
            for n in notes where n.embedding != nil {
                allObjects.append((n.id, .note, n.embedding!, n.displayName))
            }
        }
        if let artifacts = try? context.fetch(FetchDescriptor<Artifact>()) {
            for a in artifacts where a.embedding != nil {
                allObjects.append((a.id, .artifact, a.embedding!, a.displayName))
            }
        }

        let existingConnections = (try? context.fetch(FetchDescriptor<Connection>())) ?? []
        let existingPairs: Set<String> = Set(existingConnections.map { pairKey($0.sourceID, $0.targetID) })

        for i in 0..<allObjects.count {
            for j in (i + 1)..<allObjects.count {
                let a = allObjects[i]
                let b = allObjects[j]

                let key = pairKey(a.id, b.id)
                if existingPairs.contains(key) { continue }

                let similarity = VectorMath.cosineSimilarity(a.embedding, b.embedding)
                if similarity >= similarityThreshold {
                    let connection = Connection(
                        sourceID: a.id,
                        targetID: b.id,
                        sourceKind: a.kind,
                        targetKind: b.kind,
                        type: .aiSuggested,
                        confidence: similarity,
                        reason: "Similarity: \(String(format: "%.0f%%", similarity * 100)) — related themes between \"\(a.name)\" and \"\(b.name)\""
                    )
                    context.insert(connection)
                }
            }
        }

        try? context.save()
    }

    // MARK: - Connection Lifecycle

    func confirm(_ connection: Connection, context: ModelContext) {
        connection.type = .aiConfirmed
        try? context.save()
    }

    func dismiss(_ connection: Connection, context: ModelContext) {
        connection.type = .dismissed
        try? context.save()
    }

    // MARK: - Queries

    func suggestions(for objectID: UUID, context: ModelContext) -> [Connection] {
        let all = (try? context.fetch(FetchDescriptor<Connection>())) ?? []
        return all.filter { conn in
            conn.type == .aiSuggested &&
            (conn.sourceID == objectID || conn.targetID == objectID)
        }.sorted { $0.confidence > $1.confidence }
    }

    func connections(for objectID: UUID, context: ModelContext) -> [Connection] {
        let all = (try? context.fetch(FetchDescriptor<Connection>())) ?? []
        return all.filter { conn in
            (conn.type == .aiConfirmed || conn.type == .manual) &&
            (conn.sourceID == objectID || conn.targetID == objectID)
        }.sorted { $0.confidence > $1.confidence }
    }

    func pendingSuggestionCount(context: ModelContext) -> Int {
        let all = (try? context.fetch(FetchDescriptor<Connection>())) ?? []
        return all.filter { $0.type == .aiSuggested }.count
    }

    // MARK: - Object Resolution

    func resolveObject(id: UUID, kind: ObjectKind, context: ModelContext) -> (any Embeddable)? {
        switch kind {
        case .project:
            let descriptor = FetchDescriptor<Project>(predicate: #Predicate { $0.id == id })
            return try? context.fetch(descriptor).first
        case .note:
            let descriptor = FetchDescriptor<Note>(predicate: #Predicate { $0.id == id })
            return try? context.fetch(descriptor).first
        case .artifact:
            let descriptor = FetchDescriptor<Artifact>(predicate: #Predicate { $0.id == id })
            return try? context.fetch(descriptor).first
        }
    }

    private func pairKey(_ a: UUID, _ b: UUID) -> String {
        let sorted = [a.uuidString, b.uuidString].sorted()
        return "\(sorted[0])|\(sorted[1])"
    }
}
