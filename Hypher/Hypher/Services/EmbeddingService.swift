import Foundation
import NaturalLanguage

final class EmbeddingService {
    private let sentenceEmbedding: NLEmbedding?

    init() {
        sentenceEmbedding = NLEmbedding.sentenceEmbedding(for: .english)
    }

    var isAvailable: Bool {
        sentenceEmbedding != nil
    }

    func embed(_ text: String) -> [Double]? {
        guard let model = sentenceEmbedding else { return nil }
        return model.vector(for: text)
    }

    func distance(_ a: String, _ b: String) -> Double? {
        guard let model = sentenceEmbedding else { return nil }
        return model.distance(between: a, and: b)
    }
}
