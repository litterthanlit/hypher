import SwiftUI

struct ConfidenceBadge: View {
    let confidence: Double

    private var color: Color {
        if confidence >= 0.9 { return .green }
        if confidence >= 0.8 { return .yellow }
        return .orange
    }

    var body: some View {
        Text("\(Int(confidence * 100))%")
            .font(.caption2.monospacedDigit().bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}
