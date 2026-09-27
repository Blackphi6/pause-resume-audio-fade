import AudioToolbox
import CoreAudio
import FadeCore
import Foundation

/// システム全体の音声を Core Audio のプロセスタップで受け取り、FadeProcessor を通して
/// 既定の出力デバイスへ流し直す。元の音声はタップ中だけミュートされるので二重にならない。
/// このプロセスを終了・タップを破棄すれば、元の音声経路にすぐ戻る。
@available(macOS 14.2, *)
final class AudioTapEngine {
    struct RunningInfo {
        let deviceName: String
        let sampleRate: Double
        let channels: Int
        let effectiveFadeOutMs: Double
        let latencyMs: Double
    }

    enum EngineError: Error, CustomStringConvertible {
        case noOutputDevice
        case unsupportedFormat(String)
        case core(CoreAudioError)

        var description: String {
            switch self {
            case .noOutputDevice: return "出力デバイスが見つかりません"
            case .unsupportedFormat(let s): return "未対応の音声フォーマット: \(s)"
            case .core(let e): return e.description
            }
        }
    }

    private var tapID = AudioObjectID(kAudioObjectUnknown)
    private var aggregateID = AudioObjectID(kAudioObjectUnknown)
    private var procID: AudioDeviceIOProcID?
    private var processor: FadeProcessor?
    private let ioQueue = DispatchQueue(label: "pauseresume.io", qos: .userInteractive)

    private(set) var info: RunningInfo?
    var isRunning: Bool { info != nil }

    // オーディオスレッドが更新し、メインスレッドが表示用に読む。ずれても実害がないので同期しない
    private(set) var inputPeak: Float = 0
    private(set) var outputPeak: Float = 0
    private(set) var callbackCount = 0

    private static let maxFrames = 16_384
    private let tapChannels = 2
    private let inScratch = UnsafeMutablePointer<Float>.allocate(capacity: AudioTapEngine.maxFrames * 2)
    private let outScratch = UnsafeMutablePointer<Float>.allocate(capacity: AudioTapEngine.maxFrames * 2)
    private var tapIsPlanar = false

    // 検証用: コールバックごとの入出力ピークを記録する（有効時のみ確保し、オーディオスレッドでは書き込むだけ）
    private var envelope: UnsafeMutablePointer<Float>?
    private var envelopeCapacity = 0
    private(set) var envelopeCount = 0

    func enableEnvelopeRecording(capacity: Int) {
        envelope = UnsafeMutablePointer<Float>.allocate(capacity: capacity * 3)
        envelopeCapacity = capacity
        envelopeCount = 0
    }

    func envelopeRow(_ i: Int) -> (frames: Int, input: Float, output: Float) {
        guard let envelope, i < envelopeCount else { return (0, 0, 0) }
        return (Int(envelope[i * 3]), envelope[i * 3 + 1], envelope[i * 3 + 2])
    }

    deinit {
        stop()
        inScratch.deallocate()
        outScratch.deallocate()
    }

    func start(settings: FadeSettings) throws {
        stop()
        do {
            try startInternal(settings: settings)
        } catch {
            stop()
            throw error
        }
    }

    private func startInternal(settings: FadeSettings) throws {
        let outDevice = try CoreAudioUtil.defaultOutputDevice()
        guard outDevice != kAudioObjectUnknown else { throw EngineError.noOutputDevice }
        let outUID = try wrap { try CoreAudioUtil.deviceUID(outDevice) }

        // 自分の出力を再度タップしてしまうと無音になるので、自プロセスを除外する
        let selfObject = try ensureOwnProcessObject()

        let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [selfObject])
        description.name = "PauseResumeAudioFade"
        description.uuid = UUID()
        description.muteBehavior = .mutedWhenTapped
        description.isPrivate = true

        var status = AudioHardwareCreateProcessTap(description, &tapID)
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "プロセスタップ作成", status: status)) }

        let format = try wrap {
            try CoreAudioUtil.get(self.tapID, kAudioTapPropertyFormat, default: AudioStreamBasicDescription())
        }
        guard format.mFormatID == kAudioFormatLinearPCM, format.mBitsPerChannel == 32,
              (format.mFormatFlags & kAudioFormatFlagIsFloat) != 0,
              Int(format.mChannelsPerFrame) == tapChannels else {
            throw EngineError.unsupportedFormat("ch=\(format.mChannelsPerFrame) bits=\(format.mBitsPerChannel)")
        }
        tapIsPlanar = (format.mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0

        let aggregate: [String: Any] = [
            kAudioAggregateDeviceNameKey: "PauseResumeAudioFade tap",
            kAudioAggregateDeviceUIDKey: UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceIsStackedKey: false,
            kAudioAggregateDeviceTapAutoStartKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outUID]],
            kAudioAggregateDeviceTapListKey: [[
                kAudioSubTapDriftCompensationKey: true,
                kAudioSubTapUIDKey: description.uuid.uuidString,
            ]],
        ]
        status = AudioHardwareCreateAggregateDevice(aggregate as CFDictionary, &aggregateID)
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "集約デバイス作成", status: status)) }

        let sampleRate = CoreAudioUtil.nominalSampleRate(aggregateID)
        let processor = FadeProcessor(sampleRate: sampleRate, channels: tapChannels, settings: settings)
        self.processor = processor

        status = AudioDeviceCreateIOProcIDWithBlock(&procID, aggregateID, ioQueue) { [unowned self] _, inData, _, outData, _ in
            self.render(inData: inData, outData: outData)
        }
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "IOProc作成", status: status)) }

        status = AudioDeviceStart(aggregateID, procID)
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "デバイス開始", status: status)) }

        info = RunningInfo(
            deviceName: CoreAudioUtil.deviceName(outDevice),
            sampleRate: sampleRate,
            channels: tapChannels,
            effectiveFadeOutMs: processor.effectiveFadeOutMs,
            latencyMs: Double(processor.latencyFrames) / sampleRate * 1000)
    }

    func stop() {
        if aggregateID != kAudioObjectUnknown {
            if let procID {
                AudioDeviceStop(aggregateID, procID)
                AudioDeviceDestroyIOProcID(aggregateID, procID)
            }
            AudioHardwareDestroyAggregateDevice(aggregateID)
        }
        if tapID != kAudioObjectUnknown {
            AudioHardwareDestroyProcessTap(tapID)
        }
        procID = nil
        aggregateID = AudioObjectID(kAudioObjectUnknown)
        tapID = AudioObjectID(kAudioObjectUnknown)
        processor = nil
        info = nil
        inputPeak = 0
        outputPeak = 0
    }

    /// 自プロセスが Core Audio に認識されるまでは除外指定ができない。
    /// 認識されていなければ、何も鳴らさない一時タップを開いて自分を登録させる
    private func ensureOwnProcessObject() throws -> AudioObjectID {
        let pid = getpid()
        var object = CoreAudioUtil.processObject(pid: pid)
        if object != kAudioObjectUnknown { return object }

        let bootstrap = CATapDescription(stereoGlobalTapButExcludeProcesses: [AudioObjectID]())
        bootstrap.name = "PauseResumeAudioFade bootstrap"
        bootstrap.uuid = UUID()
        bootstrap.muteBehavior = .unmuted
        bootstrap.isPrivate = true
        var tap = AudioObjectID(kAudioObjectUnknown)
        var status = AudioHardwareCreateProcessTap(bootstrap, &tap)
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "初期化タップ作成", status: status)) }
        defer { AudioHardwareDestroyProcessTap(tap) }

        let outUID = try wrap { try CoreAudioUtil.deviceUID(try CoreAudioUtil.defaultOutputDevice()) }
        var agg = AudioObjectID(kAudioObjectUnknown)
        let dict: [String: Any] = [
            kAudioAggregateDeviceNameKey: "PauseResumeAudioFade bootstrap",
            kAudioAggregateDeviceUIDKey: UUID().uuidString,
            kAudioAggregateDeviceMainSubDeviceKey: outUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: outUID]],
            kAudioAggregateDeviceTapListKey: [[
                kAudioSubTapDriftCompensationKey: true,
                kAudioSubTapUIDKey: bootstrap.uuid.uuidString,
            ]],
        ]
        status = AudioHardwareCreateAggregateDevice(dict as CFDictionary, &agg)
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "初期化集約デバイス作成", status: status)) }
        defer { AudioHardwareDestroyAggregateDevice(agg) }

        var proc: AudioDeviceIOProcID?
        status = AudioDeviceCreateIOProcIDWithBlock(&proc, agg, ioQueue) { _, _, _, _, _ in }
        guard status == noErr else { throw EngineError.core(CoreAudioError(operation: "初期化IOProc作成", status: status)) }
        AudioDeviceStart(agg, proc)
        defer {
            if let proc { AudioDeviceStop(agg, proc); AudioDeviceDestroyIOProcID(agg, proc) }
        }

        for _ in 0..<50 {
            object = CoreAudioUtil.processObject(pid: pid)
            if object != kAudioObjectUnknown { return object }
            Thread.sleep(forTimeInterval: 0.02)
        }
        throw EngineError.core(CoreAudioError(operation: "自プロセスの登録待ち", status: kAudioHardwareBadObjectError))
    }

    private func wrap<T>(_ body: () throws -> T) throws -> T {
        do { return try body() } catch let e as CoreAudioError { throw EngineError.core(e) }
    }

    /// オーディオスレッドで呼ばれる。ここではメモリ確保・ロック・ログを行わない
    private func render(inData: UnsafePointer<AudioBufferList>, outData: UnsafeMutablePointer<AudioBufferList>) {
        callbackCount &+= 1
        let input = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: inData))
        let output = UnsafeMutableAudioBufferListPointer(outData)
        guard let processor else {
            for b in output where b.mData != nil { memset(b.mData, 0, Int(b.mDataByteSize)) }
            return
        }

        let frames = min(gatherInput(input), AudioTapEngine.maxFrames)
        var peakIn: Float = 0
        for i in 0..<(frames * tapChannels) { peakIn = max(peakIn, abs(inScratch[i])) }
        inputPeak = peakIn

        processor.process(input: inScratch, output: outScratch, frameCount: frames)
        var peakOut: Float = 0
        for i in 0..<(frames * tapChannels) { peakOut = max(peakOut, abs(outScratch[i])) }
        outputPeak = peakOut
        if let envelope, envelopeCount < envelopeCapacity {
            envelope[envelopeCount * 3] = Float(frames)
            envelope[envelopeCount * 3 + 1] = peakIn
            envelope[envelopeCount * 3 + 2] = peakOut
            envelopeCount += 1
        }

        scatterOutput(output, frames: frames)
    }

    /// タップの入力（インターリーブ or プレーナ）を inScratch にインターリーブして詰め、フレーム数を返す
    private func gatherInput(_ input: UnsafeMutableAudioBufferListPointer) -> Int {
        if tapIsPlanar {
            guard input.count >= tapChannels, let first = input[0].mData else { return 0 }
            let frames = Int(input[0].mDataByteSize) / MemoryLayout<Float>.size
            let n = min(frames, AudioTapEngine.maxFrames)
            for c in 0..<tapChannels {
                guard let data = input[c].mData else { continue }
                let src = data.assumingMemoryBound(to: Float.self)
                for f in 0..<n { inScratch[f * tapChannels + c] = src[f] }
            }
            _ = first
            return n
        }
        guard input.count >= 1, let data = input[0].mData else { return 0 }
        let channels = max(1, Int(input[0].mNumberChannels))
        let frames = Int(input[0].mDataByteSize) / (MemoryLayout<Float>.size * channels)
        let n = min(frames, AudioTapEngine.maxFrames)
        let src = data.assumingMemoryBound(to: Float.self)
        for f in 0..<n {
            for c in 0..<tapChannels { inScratch[f * tapChannels + c] = src[f * channels + min(c, channels - 1)] }
        }
        return n
    }

    /// 処理済みのステレオを出力バッファ構成に合わせて書き出す。余ったチャンネルは無音
    private func scatterOutput(_ output: UnsafeMutableAudioBufferListPointer, frames: Int) {
        var channelOffset = 0
        for buffer in output {
            guard let raw = buffer.mData else { continue }
            let dst = raw.assumingMemoryBound(to: Float.self)
            let chs = max(1, Int(buffer.mNumberChannels))
            let capacity = Int(buffer.mDataByteSize) / (MemoryLayout<Float>.size * chs)
            let n = min(frames, capacity)
            for f in 0..<n {
                for c in 0..<chs {
                    let global = channelOffset + c
                    dst[f * chs + c] = global < tapChannels ? outScratch[f * tapChannels + global] : 0
                }
            }
            if n < capacity {
                for f in n..<capacity { for c in 0..<chs { dst[f * chs + c] = 0 } }
            }
            channelOffset += chs
        }
    }
}
