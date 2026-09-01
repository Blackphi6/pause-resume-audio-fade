import CoreAudio
import Foundation

/// Fades the default output device's volume in/out, the system-wide analog
/// of what the browser extension does to a single <video> element's volume.
/// Ducking is scoped to the current default output device's own volume
/// property -- the same value the volume keys and Control Center's slider
/// control -- so it is not a mix/duck of one specific app.
final class SystemVolumeFader {
    private var deviceID = AudioDeviceID(kAudioObjectUnknown)
    private var elements: [AudioObjectPropertyElement] = []

    /// The last known "un-ducked" level, restored to on fade-in.
    private var baseline: Float32 = 1.0
    private var isDucked = false
    private var fadeTimer: DispatchSourceTimer?
    private var lastSetValue: Float32?
    private var listenerBlock: AudioObjectPropertyListenerBlock?

    var isSupported: Bool { !elements.isEmpty }

    var deviceName: String {
        guard deviceID != AudioDeviceID(kAudioObjectUnknown) else { return "(不明)" }
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioObjectPropertyName,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var name: CFString = "" as CFString
        var size = UInt32(MemoryLayout<CFString>.size)
        let status = withUnsafeMutablePointer(to: &name) { pointer in
            AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, pointer)
        }
        return status == noErr ? (name as String) : "(名前不明)"
    }

    init() {
        refreshDevice()
    }

    deinit {
        removeVolumeListener()
    }

    private func refreshDevice() {
        removeVolumeListener()
        deviceID = Self.defaultOutputDevice() ?? AudioDeviceID(kAudioObjectUnknown)
        elements = Self.settableVolumeElements(deviceID: deviceID)
        if let current = currentVolume() {
            baseline = current
        }
        installVolumeListener()
    }

    // MARK: - Fading

    /// Remember the current volume as the fade-in target, then ramp to 0.
    func fadeOut(durationMs: Int) {
        guard isSupported else { return }
        if !isDucked, let current = currentVolume() {
            baseline = current
        }
        isDucked = true
        runFade(to: 0, durationMs: durationMs)
    }

    /// Ramp back up to the level remembered before the last fade-out.
    func fadeIn(durationMs: Int) {
        guard isSupported else { return }
        let from = currentVolume() ?? 0
        isDucked = false
        runFade(from: from, to: baseline, durationMs: durationMs)
    }

    /// Cancel any in-flight fade and jump straight to the remembered level.
    func restoreImmediately() {
        guard isSupported else { return }
        cancelFade()
        isDucked = false
        setVolume(baseline)
    }

    private func runFade(from: Float32? = nil, to target: Float32, durationMs: Int) {
        cancelFade()
        let start = from ?? currentVolume() ?? target
        let clampedTarget = min(1, max(0, target))
        let steps = max(1, durationMs / 16)
        var step = 0

        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(16))
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            step += 1
            let progress = Float32(step) / Float32(steps)
            if progress >= 1 {
                self.setVolume(clampedTarget)
                self.cancelFade()
                return
            }
            self.setVolume(start + (clampedTarget - start) * progress)
        }
        fadeTimer = timer
        timer.resume()
    }

    private func cancelFade() {
        fadeTimer?.cancel()
        fadeTimer = nil
    }

    // MARK: - External-change detection

    /// If the volume moves on its own by more than this while we are not
    /// actively fading it, treat it as the user (or another app) adjusting
    /// the volume directly, and adopt it as the new baseline.
    private static let externalChangeEpsilon: Float32 = 0.02

    private func installVolumeListener() {
        guard isSupported else { return }
        let block: AudioObjectPropertyListenerBlock = { [weak self] _, _ in
            DispatchQueue.main.async { self?.handleExternalVolumeChange() }
        }
        listenerBlock = block
        for element in elements {
            var address = AudioObjectPropertyAddress(
                mSelector: kAudioDevicePropertyVolumeScalar,
                mScope: kAudioDevicePropertyScopeOutput,
                mElement: element
            )
            AudioObjectAddPropertyListenerBlock(deviceID, &address, DispatchQueue.main, block)
        }
    }

    private func removeVolumeListener() {
        guard let block = listenerBlock, deviceID != AudioDeviceID(kAudioObjectUnknown) else { return }
        for element in elements {
            var address = AudioObjectPropertyAddress(
                mSelector: kAudioDevicePropertyVolumeScalar,
                mScope: kAudioDevicePropertyScopeOutput,
                mElement: element
            )
            AudioObjectRemovePropertyListenerBlock(deviceID, &address, DispatchQueue.main, block)
        }
        listenerBlock = nil
    }

    private func handleExternalVolumeChange() {
        guard let current = currentVolume() else { return }
        // Our own setVolume() calls also trigger this listener; ignore those.
        if let last = lastSetValue, abs(last - current) < 0.005 { return }

        if fadeTimer != nil {
            // A real external change mid-fade wins over our own ramp.
            cancelFade()
            isDucked = false
            baseline = current
        } else if abs(current - baseline) > Self.externalChangeEpsilon {
            baseline = current
        }
    }

    // MARK: - CoreAudio plumbing

    private func currentVolume() -> Float32? {
        let values = elements.compactMap { Self.volume(deviceID: deviceID, element: $0) }
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / Float32(values.count)
    }

    private func setVolume(_ value: Float32) {
        let clamped = min(1, max(0, value))
        lastSetValue = clamped
        for element in elements {
            Self.setVolume(deviceID: deviceID, element: element, value: clamped)
        }
    }

    private static func defaultOutputDevice() -> AudioDeviceID? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioHardwarePropertyDefaultOutputDevice,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )
        var deviceID = AudioDeviceID(kAudioObjectUnknown)
        var size = UInt32(MemoryLayout<AudioDeviceID>.size)
        let status = AudioObjectGetPropertyData(
            AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &deviceID
        )
        return status == noErr ? deviceID : nil
    }

    /// Prefer a single master (main) volume element; fall back to
    /// controlling channels 1 and 2 together on devices that only expose
    /// per-channel volume (common on multi-channel/aggregate devices).
    private static func settableVolumeElements(deviceID: AudioDeviceID) -> [AudioObjectPropertyElement] {
        if isSettable(deviceID: deviceID, element: kAudioObjectPropertyElementMain) {
            return [kAudioObjectPropertyElementMain]
        }
        let stereo: [AudioObjectPropertyElement] = [1, 2]
        let settableStereo = stereo.filter { isSettable(deviceID: deviceID, element: $0) }
        return settableStereo.isEmpty ? [] : settableStereo
    }

    private static func isSettable(deviceID: AudioDeviceID, element: AudioObjectPropertyElement) -> Bool {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyVolumeScalar,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: element
        )
        guard AudioObjectHasProperty(deviceID, &address) else { return false }
        var settable: DarwinBoolean = false
        let status = AudioObjectIsPropertySettable(deviceID, &address, &settable)
        return status == noErr && settable.boolValue
    }

    private static func volume(deviceID: AudioDeviceID, element: AudioObjectPropertyElement) -> Float32? {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyVolumeScalar,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: element
        )
        var value: Float32 = 0
        var size = UInt32(MemoryLayout<Float32>.size)
        let status = AudioObjectGetPropertyData(deviceID, &address, 0, nil, &size, &value)
        return status == noErr ? value : nil
    }

    private static func setVolume(deviceID: AudioDeviceID, element: AudioObjectPropertyElement, value: Float32) {
        var address = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyVolumeScalar,
            mScope: kAudioDevicePropertyScopeOutput,
            mElement: element
        )
        var v = value
        let size = UInt32(MemoryLayout<Float32>.size)
        AudioObjectSetPropertyData(deviceID, &address, 0, nil, size, &v)
    }
}
