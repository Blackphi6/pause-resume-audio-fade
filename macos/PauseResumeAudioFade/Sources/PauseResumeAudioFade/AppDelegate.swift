import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
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

        if !mediaRemote.isAvailable {
            NSLog(
                "PauseResumeAudioFade: MediaRemote is unavailable on this macOS version; "
                    + "play/pause detection is disabled."
            )
        }

        mediaRemote.onPlayingStateChanged = { [weak self] isPlaying in
            guard let self, self.preferences.enabled else { return }
            if isPlaying {
                self.fader.fadeIn(durationMs: self.preferences.fadeInMs)
            } else {
                self.fader.fadeOut(durationMs: self.preferences.fadeOutMs)
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        fader.restoreImmediately()
    }
}
