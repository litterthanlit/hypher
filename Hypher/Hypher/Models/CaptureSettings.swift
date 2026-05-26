import Foundation
import Observation

@Observable
final class CaptureSettings {
    private let defaults: UserDefaults

    var apiOrigin: String {
        didSet { defaults.set(apiOrigin, forKey: Keys.apiOrigin) }
    }

    var apiKey: String {
        didSet { defaults.set(apiKey, forKey: Keys.apiKey) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        self.apiOrigin = defaults.string(forKey: Keys.apiOrigin) ?? "https://hypher.app"
        self.apiKey = defaults.string(forKey: Keys.apiKey) ?? ""
    }

    var normalizedOrigin: URL? {
        let value = apiOrigin.trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: value)
    }

    var hasApiKey: Bool {
        !apiKey.trimmed.isEmpty
    }

    private enum Keys {
        static let apiOrigin = "hypher.capture.apiOrigin"
        static let apiKey = "hypher.capture.apiKey"
    }
}
