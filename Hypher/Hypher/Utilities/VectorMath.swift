import Foundation
import Accelerate

enum VectorMath {
    static func cosineSimilarity(_ a: [Double], _ b: [Double]) -> Double {
        guard a.count == b.count, !a.isEmpty else { return 0 }

        var dot: Double = 0
        var magA: Double = 0
        var magB: Double = 0

        vDSP_dotprD(a, 1, b, 1, &dot, vDSP_Length(a.count))
        vDSP_dotprD(a, 1, a, 1, &magA, vDSP_Length(a.count))
        vDSP_dotprD(b, 1, b, 1, &magB, vDSP_Length(b.count))

        let denom = sqrt(magA) * sqrt(magB)
        guard denom > 0 else { return 0 }
        return dot / denom
    }
}
