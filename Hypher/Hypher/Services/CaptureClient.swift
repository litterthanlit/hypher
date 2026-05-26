import Foundation

enum CaptureClientError: LocalizedError {
    case missingOrigin
    case missingApiKey
    case invalidResponse
    case server(String)

    var errorDescription: String? {
        switch self {
        case .missingOrigin:
            return "Set a valid Hypher API origin."
        case .missingApiKey:
            return "Add a Hypher API key in Settings."
        case .invalidResponse:
            return "Hypher returned an unexpected response."
        case .server(let message):
            return message
        }
    }
}

struct CaptureClient {
    var session: URLSession = .shared

    func fetchProjects(settings: CaptureSettings) async throws -> [CaptureProject] {
        let origin = try origin(from: settings)
        var request = URLRequest(url: origin.appending(path: "/api/projects"))
        request.setValue("Bearer \(settings.apiKey.trimmed)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try JSONDecoder().decode(CaptureProjectsResponse.self, from: data).projects
    }

    func save(draft: CaptureDraft, settings: CaptureSettings) async throws {
        let origin = try origin(from: settings)
        var request = URLRequest(url: origin.appending(path: "/api/capture"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(settings.apiKey.trimmed)", forHTTPHeaderField: "Authorization")

        var payload: [String: Any] = [
            "kind": "note",
            "content": draft.formattedContent,
            "tags": ["from-macos", "hotkey-capture"]
        ]
        if let projectId = draft.projectId {
            payload["projectId"] = projectId
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
    }

    private func origin(from settings: CaptureSettings) throws -> URL {
        guard let origin = settings.normalizedOrigin else { throw CaptureClientError.missingOrigin }
        guard settings.hasApiKey else { throw CaptureClientError.missingApiKey }
        return origin
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw CaptureClientError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode([String: String].self, from: data)["error"]) ?? "Hypher request failed."
            throw CaptureClientError.server(message)
        }
    }
}
