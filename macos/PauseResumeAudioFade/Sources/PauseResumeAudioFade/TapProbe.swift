import AudioToolbox
import CoreAudio
import Foundation

/// 検証用: 同じ Bundle ID を持つ「別プロセス」（= 本体）が実際に出力している音をタップして、
/// コールバックごとのピークを記録する。本体の出力バッファ書き出しまで含めて確認するため。
/// ミュートしない（.unmuted）ので、本体の出力には影響しない。
@available(macOS 14.2, *)
final class TapProbe {
    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private let queue = DispatchQueue(label: "pauseresume.probe", qos: .userInteractive)
    private var rows: UnsafeMutablePointer<Float>
    private let capacity: Int
    private(set) var count = 0

    init(capacity: Int) {
        self.capacity = capacity
        rows = UnsafeMutablePointer<Float>.allocate(capacity: capacity * 2)
    }

    deinit { rows.deallocate() }

    /// 本体プロセスのオブジェクトが現れるまで最大 timeout 秒待つ
    func waitForTargetProcess(bundleID: String, timeout: TimeInterval) -> AudioObjectID? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            for object in CoreAudioUtil.processObjects()
            where CoreAudioUtil.processBundleID(object) == bundleID && CoreAudioUtil.processPID(object) != getpid() {
                return object
            }
            Thread.sleep(forTimeInterval: 0.1)
        } while Date() < deadline
        return nil
    }

    func start(target: AudioObjectID) throws {
        let description = CATapDescription(stereoMixdownOfProcesses: [target])
        description.name = "PauseResumeAudioFade probe"
        description.uuid = UUID()
        description.muteBehavior = .unmuted
        description.isPrivate = true
        var status = AudioHardwareCreateProcessTap(description, &tapID)
        guard status == noErr else { throw CoreAudioError(operation: "probe タップ作成", status: status) }

        let outUID = try CoreAudioUtil.deviceUID(try CoreAudioUtil.defaultOutputDevice())
        let dict: [String: Any] = [
            kAudioAggregateDeviceNameKey: "PauseResumeAudioFade probe",
            kAudioAggregateDeviceUIDKey: UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outUID]],
            kAudioAggregateDeviceTapListKey: [[
                kAudioSubTapDriftCompensationKey: true,
                kAudioSubTapUIDKey: description.uuid.uuidString,
            ]],
        ]
        status = AudioHardwareCreateAggregateDevice(dict as CFDictionary, &aggregateID)
        guard status == noErr else { throw CoreAudioError(operation: "probe 集約デバイス作成", status: status) }

        status = AudioDeviceCreateIOProcIDWithBlock(&procID, aggregateID, queue) { [unowned self] _, inData, _, _, _ in
            let input = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inData))
            guard input.count > 0, let data = input[0].mData, self.count < self.capacity else { return }
            let channels = max(1, Int(input[0].mNumberChannels))
            let frames = Int(input[0].mDataByteSize) / (MemoryLayout<Float>.size * channels)
            let samples = data.assumingMemoryBound(to: Float.self)
            var peak: Float = 0
            for i in 0..<(frames * channels) { peak = max(peak, abs(samples[i])) }
            self.rows[self.count * 2] = Float(frames)
            self.rows[self.count * 2 + 1] = peak
            self.count += 1
        }
        guard status == noErr else { throw CoreAudioError(operation: "probe IOProc作成", status: status) }
        status = AudioDeviceStart(aggregateID, procID)
        guard status == noErr else { throw CoreAudioError(operation: "probe 開始", status: status) }
    }

    func stop() {
        if aggregateID != kAudioObjectUnknown {
            if let procID {
                AudioDeviceStop(aggregateID, procID)
                AudioDeviceDestroyIOProcID(aggregateID, procID)
            }
            AudioHardwareDestroyAggregateDevice(aggregateID)
        }
        if tapID != kAudioObjectUnknown { AudioHardwareDestroyProcessTap(tapID) }
        aggregateID = AudioObjectID(kAudioObjectUnknown)
        tapID = AudioObjectID(kAudioObjectUnknown)
        procID = nil
    }

    func row(_ i: Int) -> (frames: Int, peak: Float) {
        (Int(rows[i * 2]), rows[i * 2 + 1])
    }
}
