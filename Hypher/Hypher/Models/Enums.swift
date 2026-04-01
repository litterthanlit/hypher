import Foundation

enum ProjectStatus: String, Codable, CaseIterable, Identifiable {
    case seed, growing, active, shipped, dormant, archived
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum NoteMaturity: String, Codable, CaseIterable, Identifiable {
    case fleeting, developing, structured, reference
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum ArtifactType: String, Codable, CaseIterable, Identifiable {
    case image, video, code, document, font, audio, other
    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum ConnectionType: String, Codable, CaseIterable {
    case manual, aiSuggested, aiConfirmed, dismissed
}

enum ObjectKind: String, Codable {
    case project, note, artifact
}
