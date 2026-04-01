import Foundation

protocol Embeddable: AnyObject {
    var id: UUID { get }
    var embedding: [Double]? { get set }
    var embeddingText: String? { get set }
    var createdAt: Date { get }
    var modifiedAt: Date { get set }
    func textForEmbedding() -> String
    static var objectKind: ObjectKind { get }
    var displayName: String { get }
}
