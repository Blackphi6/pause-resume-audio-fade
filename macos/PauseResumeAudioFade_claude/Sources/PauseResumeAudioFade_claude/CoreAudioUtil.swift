import CoreAudio
import Foundation

/// Core Audio の Property 取得を薄くまとめたもの。失敗は OSStatus を保持して投げる
struct CoreAudioError: Error, CustomStringConvertible {
    let operation: String
    let status: OSStatus
    var description: String { "\(operation) 失敗 (OSStatus \(status))" }
}

enum CoreAudioUtil {
    static func address(
        _ selector: AudioObjectPropertySelector,
        scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal,
        element: AudioObjectPropertyElement = kAudioObjectPropertyElementMain
    ) -> AudioObjectPropertyAddress {
        AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: element)
    }

    static func get<T>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector,
                       scope: AudioObjectPropertyScope = kAudioObjectPropertyScopeGlobal, default value: T) throws -> T {
        var addr = address(selector, scope: scope)
        var size = UInt32(MemoryLayout<T>.size)
        var result = value
        let status = AudioObjectGetPropertyData(object, &addr, 0, nil, &size, &result)
        guard status == noErr else { throw CoreAudioError(operation: "GetProperty \(selector)", status: status) }
        return result
    }

    static func getString(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector) throws -> String {
        var addr = address(selector)
        var size = UInt32(MemoryLayout<CFString?>.size)
        var result: Unmanaged<CFString>?
        let status = withUnsafeMutablePointer(to: &result) {
            AudioObjectGetPropertyData(object, &addr, 0, nil, &size, $0)
        }
        guard status == noErr, let cf = result else {
            throw CoreAudioError(operation: "GetString \(selector)", status: status)
        }
        return cf.takeRetainedValue() as String
    }

    static func defaultOutputDevice() throws -> AudioObjectID {
        try get(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultOutputDevice,
                default: AudioObjectID(kAudioObjectUnknown))
    }

    static func deviceUID(_ device: AudioObjectID) throws -> String {
        try getString(device, kAudioDevicePropertyDeviceUID)
    }

    static func deviceName(_ device: AudioObjectID) -> String {
        (try? getString(device, kAudioObjectPropertyName)) ?? "不明なデバイス"
    }

    static func nominalSampleRate(_ device: AudioObjectID) -> Double {
        (try? get(device, kAudioDevicePropertyNominalSampleRate, default: Float64(48_000))) ?? 48_000
    }

    /// PID に対応する Core Audio のプロセスオブジェクト。まだ音声 API を使っていないプロセスでは unknown
    static func processObject(pid: pid_t) -> AudioObjectID {
        var addr = address(kAudioHardwarePropertyTranslatePIDToProcessObject)
        var qualifier = pid
        var result = AudioObjectID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioObjectID>.size)
        let status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject), &addr,
            UInt32(MemoryLayout<pid_t>.size), &qualifier, &size, &result)
        return status == noErr ? result : AudioObjectID(kAudioObjectUnknown)
    }

    /// Core Audio が把握しているプロセスオブジェクトの一覧
    static func processObjects() -> [AudioObjectID] {
        var addr = address(kAudioHardwarePropertyProcessObjectList)
        var size: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size) == noErr, size > 0 else { return [] }
        var list = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
        guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &list) == noErr else { return [] }
        return list
    }

    static func processPID(_ object: AudioObjectID) -> pid_t {
        (try? get(object, kAudioProcessPropertyPID, default: pid_t(0))) ?? 0
    }

    static func processBundleID(_ object: AudioObjectID) -> String {
        (try? getString(object, kAudioProcessPropertyBundleID)) ?? ""
    }
}
