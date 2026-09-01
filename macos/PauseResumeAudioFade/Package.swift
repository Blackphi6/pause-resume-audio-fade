// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "PauseResumeAudioFade",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "PauseResumeAudioFade",
            path: "Sources/PauseResumeAudioFade"
        )
    ]
)
