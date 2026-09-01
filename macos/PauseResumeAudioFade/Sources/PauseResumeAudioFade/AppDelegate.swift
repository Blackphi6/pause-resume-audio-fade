import AppKit
import os.log

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let log = OSLog(subsystem: "io.github.blackphi6.PauseResumeAudioFade", category: "app")
    private let preferences = Preferences.shared
    private let mediaRemote = MediaRemoteBridge()
    private let fader = SystemVolumeFader()
    private var statusBar: StatusBarController!

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory) // menu-bar-only, no Dock icon

        statusBar = StatusBarController(volumeControlSupported: fader.isSupported)
        statusBar.onEnabledChanged = { [weak self] enabled in
            self?.preferences.enabled = enabled
            if !enabled {
                self?.fader.restoreImmediately()
            }
        }
        statusBar.onFadeOutMsChanged = { [weak self] ms in self?.preferences.fadeOutMs = ms }
        statusBar.onFadeInMsChanged = { [weak self] ms in self?.preferences.fadeInMs = ms }

        os_log("mediaRemote.isAvailable=%{public}@ fader.isSupported=%{public}@ device=%{public}@",
               log: log, type: .info,
               String(mediaRemote.isAvailable), String(fader.isSupported), fader.deviceName)

        refreshDiagnostics()

        mediaRemote.onPlayingStateChanged = { [weak self] isPlaying in
            guard let self else { return }
            os_log("playing state changed: %{public}@ (enabled=%{public}@)",
                   log: self.log, type: .info,
                   String(isPlaying), String(self.preferences.enabled))
            self.refreshDiagnostics()
            guard self.preferences.enabled else { return }
            if isPlaying {
                self.fader.fadeIn(durationMs: self.preferences.fadeInMs)
            } else {
                self.fader.fadeOut(durationMs: self.preferences.fadeOutMs)
            }
        }
    }

    private func refreshDiagnostics() {
        statusBar.updateDiagnostics(
            mediaRemoteAvailable: mediaRemote.isAvailable,
            deviceName: fader.deviceName,
            deviceSupported: fader.isSupported,
            isPlaying: mediaRemote.isAvailable ? mediaRemote.isPlaying : nil
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        fader.restoreImmediately()
    }
}
