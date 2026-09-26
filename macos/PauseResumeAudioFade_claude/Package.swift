// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PauseResumeAudioFade_claude",
    // Core Audio のプロセスタップ API は macOS 14.2 以降
    platforms: [.macOS("14.2")],
    products: [
        .executable(name: "PauseResumeAudioFade_claude", targets: ["PauseResumeAudioFade_claude"]),
    ],
    targets: [
        // 音声デバイスに依存しない純粋な DSP（テスト対象）
        .target(name: "FadeCore"),
        .executableTarget(name: "PauseResumeAudioFade_claude", dependencies: ["FadeCore"]),
        .testTarget(name: "FadeCoreTests", dependencies: ["FadeCore"]),
    ]
)
