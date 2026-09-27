import Foundation

/// 「システム音声の録音」権限の状態。公開 API では取得できないため TCC の非公開関数を動的に呼ぶ。
/// 取れなかったとき（OS の変更など）は .unknown を返し、判定に依存した動作はしない
enum AudioCapturePermission {
    case authorized
    case denied
    case undetermined
    case unknown

    static func current() -> AudioCapturePermission {
        guard let handle = dlopen("/System/Library/PrivateFrameworks/TCC.framework/Versions/A/TCC", RTLD_NOW),
              let symbol = dlsym(handle, "TCCAccessPreflight") else { return .unknown }
        typealias Preflight = @convention(c) (CFString, CFDictionary?) -> Int
        let preflight = unsafeBitCast(symbol, to: Preflight.self)
        switch preflight("kTCCServiceAudioCapture" as CFString, nil) {
        case 0: return .authorized
        case 1: return .denied
        case 2: return .undetermined
        default: return .unknown
        }
    }

    static let settingsURL = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture")!
}
