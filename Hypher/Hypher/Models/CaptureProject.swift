import Foundation

struct CaptureProject: Identifiable, Hashable, Decodable {
    let id: String
    let name: String
    let status: String?
    let priority: Double?
}

struct CaptureProjectsResponse: Decodable {
    let projects: [CaptureProject]
}
