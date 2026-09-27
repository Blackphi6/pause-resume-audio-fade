import FadeCore
import Foundation

/// フェードアウトの強さ。一時停止は横取りできないので、出力を先読み分だけ遅らせて
/// 停止の直前をさかのぼってフェードする。長くするほど滑らかだが、映像との音ズレが増える
enum FadeOutMode: Int, CaseIterable {
    case off = 0
    case short = 50
    case standard = 100
    case long = 200
    case music = 350

    var lookaheadMs: Double { Double(rawValue) }

    /// 実際に掛かるフェードアウト長（先読み - 確定待ち15ms - 余白）。FadeProcessor の計算に合わせた表示用
    var fadeMs: Int { self == .off ? 0 : rawValue - 16 }

    var title: String {
        switch self {
        case .off: return "オフ（遅延なし）"
        case .short: return "短い（約\(fadeMs)ms・遅延\(rawValue)ms）"
        case .standard: return "標準（約\(fadeMs)ms・遅延\(rawValue)ms）"
        case .long: return "ゆっくり（約\(fadeMs)ms・遅延\(rawValue)ms）"
        case .music: return "音楽向け（約\(fadeMs)ms・遅延\(rawValue)ms）"
        }
    }
}

/// 設定の保存。UserDefaults はアプリの Bundle ID ごとに分かれるので、Cursor 版とは干渉しない
final class Preferences {
    static let fadeInChoicesMs = [150, 300, 600, 1000, 2000]

    private let defaults: UserDefaults

    private enum Key {
        static let enabled = "enabled"
        static let fadeOutMode = "fadeOutMode"
        static let fadeInEnabled = "fadeInEnabled"
        static let seekFadeInEnabled = "seekFadeInEnabled"
        static let fadeInMs = "fadeInDurationMs"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        defaults.register(defaults: [
            Key.enabled: true,
            Key.fadeOutMode: FadeOutMode.standard.rawValue,
            Key.fadeInEnabled: true,
            Key.seekFadeInEnabled: true,
            Key.fadeInMs: 300,
        ])
    }

    var enabled: Bool {
        get { defaults.bool(forKey: Key.enabled) }
        set { defaults.set(newValue, forKey: Key.enabled) }
    }

    var fadeOutMode: FadeOutMode {
        get { FadeOutMode(rawValue: defaults.integer(forKey: Key.fadeOutMode)) ?? .standard }
        set { defaults.set(newValue.rawValue, forKey: Key.fadeOutMode) }
    }

    var fadeInEnabled: Bool {
        get { defaults.bool(forKey: Key.fadeInEnabled) }
        set { defaults.set(newValue, forKey: Key.fadeInEnabled) }
    }

    var seekFadeInEnabled: Bool {
        get { defaults.bool(forKey: Key.seekFadeInEnabled) }
        set { defaults.set(newValue, forKey: Key.seekFadeInEnabled) }
    }

    var fadeInMs: Int {
        get { min(3000, max(100, defaults.integer(forKey: Key.fadeInMs))) }
        set { defaults.set(newValue, forKey: Key.fadeInMs) }
    }

    var fadeSettings: FadeSettings {
        var s = FadeSettings()
        s.fadeOutEnabled = fadeOutMode != .off
        s.lookaheadMs = fadeOutMode.lookaheadMs
        s.fadeOutMs = Double(fadeOutMode.fadeMs)
        s.fadeInEnabled = fadeInEnabled
        s.seekFadeInEnabled = seekFadeInEnabled
        s.fadeInMs = Double(fadeInMs)
        return s
    }
}
