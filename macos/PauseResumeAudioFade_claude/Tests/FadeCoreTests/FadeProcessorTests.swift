import XCTest
@testable import FadeCore

private let sr = 48_000.0
private let ch = 2

/// 振幅 amp のステレオ正弦波（440Hz）。cos を使い先頭が 0 にならないようにする
private func tone(frames: Int, from start: Int = 0, amp: Float = 0.5) -> [Float] {
    var out = [Float](repeating: 0, count: frames * ch)
    for i in 0..<frames {
        let v = amp * cosf(2 * .pi * 440 * Float(start + i) / Float(sr))
        for c in 0..<ch { out[i * ch + c] = v }
    }
    return out
}

private func silence(frames: Int) -> [Float] {
    [Float](repeating: 0, count: frames * ch)
}

private func frames(_ ms: Double) -> Int { Int((sr * ms / 1000).rounded()) }

/// block フレームずつ区切って処理する。区切りに結果が依存しないことの検証にも使う
private func render(_ settings: FadeSettings, _ input: [Float], block: Int = 1024) -> [Float] {
    let p = FadeProcessor(sampleRate: sr, channels: ch, settings: settings)
    var output = [Float](repeating: 0, count: input.count)
    let total = input.count / ch
    var pos = 0
    input.withUnsafeBufferPointer { inp in
        output.withUnsafeMutableBufferPointer { out in
            while pos < total {
                let n = min(block, total - pos)
                p.process(input: inp.baseAddress! + pos * ch, output: out.baseAddress! + pos * ch, frameCount: n)
                pos += n
            }
        }
    }
    return output
}

/// 入力フレーム m の出力（latency 遅れ）が元の何倍か。入力が小さいフレームは比が不安定なので nil
private func ratio(out: [Float], input: [Float], inputFrame m: Int, latency: Int) -> Float? {
    let a = input[m * ch]
    guard abs(a) > 0.1 else { return nil }
    return out[(m + latency) * ch] / a
}

final class FadeProcessorTests: XCTestCase {
    private var s = FadeSettings()

    override func setUp() {
        s = FadeSettings()
        s.lookaheadMs = 100
        s.fadeInMs = 300
    }

    func testSteadyToneIsOnlyDelayed() {
        let input = tone(frames: frames(1000))
        let out = render(s, input)
        let L = frames(s.lookaheadMs)
        for m in stride(from: 0, to: frames(1000) - L, by: 97) {
            XCTAssertEqual(out[(m + L) * ch], input[m * ch], accuracy: 0, "frame \(m)")
        }
        for i in 0..<(L * ch) { XCTAssertEqual(out[i], 0) }
    }

    func testFadeInAfterLongSilenceFollowsRaisedCosine() {
        let gap = frames(500)
        let input = silence(frames: gap) + tone(frames: frames(1000), from: gap)
        let out = render(s, input)
        let L = frames(s.lookaheadMs)
        let fi = frames(s.fadeInMs)

        for k in stride(from: 0, to: fi, by: 53) {
            guard let r = ratio(out: out, input: input, inputFrame: gap + k, latency: L) else { continue }
            let expected = 0.5 * (1 - cosf(.pi * Float(k) / Float(fi)))
            XCTAssertEqual(r, expected, accuracy: 0.002, "k=\(k)")
        }
        for k in stride(from: fi, to: fi + 4000, by: 101) {
            guard let r = ratio(out: out, input: input, inputFrame: gap + k, latency: L) else { continue }
            XCTAssertEqual(r, 1, accuracy: 1e-5, "k=\(k)")
        }
    }

    func testFadeOutIsAppliedBeforeThePauseAndLimitedByLookahead() {
        let pause = frames(1000)
        let input = tone(frames: pause) + silence(frames: frames(1000))
        let p = FadeProcessor(sampleRate: sr, channels: ch, settings: s)
        let fo = Int((p.effectiveFadeOutMs * sr / 1000).rounded())
        XCTAssertLessThan(p.effectiveFadeOutMs, s.lookaheadMs)
        XCTAssertGreaterThan(fo, 0)

        let out = render(s, input)
        let L = frames(s.lookaheadMs)

        for m in stride(from: 0, to: pause - fo - 200, by: 211) {
            guard let r = ratio(out: out, input: input, inputFrame: m, latency: L) else { continue }
            XCTAssertEqual(r, 1, accuracy: 1e-5, "before fade m=\(m)")
        }
        var last: Float = 1.001
        for k in stride(from: 0, to: fo, by: 37) {
            guard let r = ratio(out: out, input: input, inputFrame: pause - fo + k, latency: L) else { continue }
            let expected = 0.5 * (1 + cosf(.pi * Float(k) / Float(fo)))
            XCTAssertEqual(r, expected, accuracy: 0.003, "k=\(k)")
            XCTAssertLessThanOrEqual(r, last + 1e-4, "単調に減少する")
            last = r
        }
        // 停止の瞬間には（ほぼ）無音に到達している
        XCTAssertEqual(out[(pause - 1 + L) * ch], 0, accuracy: 0.003)
    }

    func testShortGapGetsNoFadeIn() {
        let a = frames(600)
        let gap = frames(30) // 確定(15ms)には達するが、シーク(60ms)未満
        let input = tone(frames: a) + silence(frames: gap) + tone(frames: frames(600), from: a + gap)
        let out = render(s, input)
        let L = frames(s.lookaheadMs)
        for k in stride(from: 0, to: 3000, by: 89) {
            guard let r = ratio(out: out, input: input, inputFrame: a + gap + k, latency: L) else { continue }
            XCTAssertEqual(r, 1, accuracy: 1e-5, "k=\(k)")
        }
    }

    func testSeekAndResumeFadeInFollowTheirOwnToggles() {
        let a = frames(600)
        func rampedRatio(gapMs: Double, _ settings: FadeSettings) -> Float {
            let gap = frames(gapMs)
            let input = tone(frames: a) + silence(frames: gap) + tone(frames: frames(600), from: a + gap)
            let out = render(settings, input)
            let L = frames(settings.lookaheadMs)
            // 再開の 50ms 後あたりでフェードが掛かっているか
            var k = frames(50)
            while ratio(out: out, input: input, inputFrame: a + gap + k, latency: L) == nil { k += 1 }
            return ratio(out: out, input: input, inputFrame: a + gap + k, latency: L)!
        }
        var seekOff = s; seekOff.seekFadeInEnabled = false
        var resumeOff = s; resumeOff.fadeInEnabled = false

        XCTAssertLessThan(rampedRatio(gapMs: 120, s), 0.3, "シーク相当: 有効ならフェードイン")
        XCTAssertEqual(rampedRatio(gapMs: 120, seekOff), 1, accuracy: 1e-5, "シーク相当: 無効なら素通し")
        XCTAssertLessThan(rampedRatio(gapMs: 600, s), 0.3, "再開相当: 有効ならフェードイン")
        XCTAssertEqual(rampedRatio(gapMs: 600, resumeOff), 1, accuracy: 1e-5, "再開相当: 無効なら素通し")
        XCTAssertLessThan(rampedRatio(gapMs: 600, seekOff), 0.3, "シーク無効でも再開は有効")
    }

    func testZeroLookaheadHasNoDelayAndNoFadeOut() {
        s.lookaheadMs = 0
        let a = frames(600)
        let input = tone(frames: a) + silence(frames: frames(500)) + tone(frames: frames(500), from: a + frames(500))
        let out = render(s, input)
        XCTAssertEqual(FadeProcessor(sampleRate: sr, channels: ch, settings: s).latencyFrames, 0)
        for m in stride(from: 0, to: a, by: 101) {
            XCTAssertEqual(out[m * ch], input[m * ch], accuracy: 0)
        }
        let onset = a + frames(500)
        XCTAssertEqual(out[onset * ch], 0, accuracy: 1e-6, "遅延なしでも再開のフェードインは掛かる")
        XCTAssertLessThan(abs(out[(onset + 2000) * ch]), abs(input[(onset + 2000) * ch]))
    }

    func testResultDoesNotDependOnBlockSize() {
        let a = frames(400), gap = frames(300)
        let input = tone(frames: a) + silence(frames: gap) + tone(frames: frames(700), from: a + gap) + silence(frames: frames(200))
        let reference = render(s, input, block: input.count / ch)
        for block in [1, 7, 64, 480, 513, 4096] {
            XCTAssertEqual(render(s, input, block: block), reference, "block=\(block)")
        }
    }

    func testInPlaceMatchesSeparateBuffers() {
        let a = frames(400)
        let input = tone(frames: a) + silence(frames: frames(300)) + tone(frames: frames(400), from: a + frames(300))
        let reference = render(s, input)
        var buf = input
        let p = FadeProcessor(sampleRate: sr, channels: ch, settings: s)
        buf.withUnsafeMutableBufferPointer { b in
            p.process(input: UnsafePointer(b.baseAddress!), output: b.baseAddress!, frameCount: input.count / ch)
        }
        XCTAssertEqual(buf, reference)
    }

    func testGainNeverAmplifiesEvenWithRapidGaps() {
        var input: [Float] = []
        var pos = 0
        for i in 0..<40 {
            let len = frames(20 + Double(i % 7) * 15)
            input += tone(frames: len, from: pos); pos += len
            let g = frames(10 + Double(i % 5) * 40)
            input += silence(frames: g); pos += g
        }
        let out = render(s, input)
        let L = frames(s.lookaheadMs)
        for m in 0..<(input.count / ch - L) {
            XCTAssertLessThanOrEqual(abs(out[(m + L) * ch]), abs(input[m * ch]) + 1e-6)
            XCTAssertFalse(out[(m + L) * ch].isNaN)
        }
    }

    func testEffectiveFadeOutFollowsLookahead() {
        s.lookaheadMs = 350
        let long = FadeProcessor(sampleRate: sr, channels: ch, settings: s)
        XCTAssertGreaterThan(long.effectiveFadeOutMs, 320)
        XCTAssertLessThanOrEqual(long.effectiveFadeOutMs, 350)
        s.fadeOutEnabled = false
        XCTAssertEqual(FadeProcessor(sampleRate: sr, channels: ch, settings: s).effectiveFadeOutMs, 0)
    }
}
