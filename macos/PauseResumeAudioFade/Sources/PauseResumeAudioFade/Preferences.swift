import Foundation

/// Persisted settings, mirroring the browser extension's model (master
/// on/off + independent fade-out/fade-in durations) via UserDefaults.
final class Preferences {
    static let shared = Preferences()

    static let defaultFadeOutMs = 350
    static let defaultFadeInMs = 300

    private let defaults = UserDefaults.standard

    private enum Keys {
        static let enabled = "enabled"
        static let fadeOutMs = "fadeOutMs"
        static let fadeInMs = "fadeInMs"
    }

    private init() {}

    var enabled: Bool {
        get { defaults.object(forKey: Keys.enabled) as? Bool ?? true }
        set { defaults.set(newValue, forKey: Keys.enabled) }
    }

    var fadeOutMs: Int {
        get { Self.clampMs(defaults.object(forKey: Keys.fadeOutMs) as? Int ?? Self.defaultFadeOutMs) }
        set { defaults.set(Self.clampMs(newValue), forKey: Keys.fadeOutMs) }
    }

    var fadeInMs: Int {
        get { Self.clampMs(defaults.object(forKey: Keys.fadeInMs) as? Int ?? Self.defaultFadeInMs) }
        set { defaults.set(Self.clampMs(newValue), forKey: Keys.fadeInMs) }
    }

    private static func clampMs(_ value: Int) -> Int {
        min(3000, max(100, value))
    }
}
