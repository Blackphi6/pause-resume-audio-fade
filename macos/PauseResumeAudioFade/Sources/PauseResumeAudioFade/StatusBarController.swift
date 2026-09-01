import AppKit

/// Menu bar UI: a status item with a dropdown for live diagnostics, the
/// master toggle, and fade-duration presets. No dock icon, no window --
/// this app only exists in the menu bar.
final class StatusBarController: NSObject {
    private let item: NSStatusItem
    private let durationPresetsMs = [150, 350, 600, 1000, 2000]

    private var detectionStatusItem: NSMenuItem!
    private var deviceStatusItem: NSMenuItem!
    private var playbackStatusItem: NSMenuItem!
    private var enabledMenuItem: NSMenuItem!
    private var fadeOutItems: [NSMenuItem] = []
    private var fadeInItems: [NSMenuItem] = []

    var onEnabledChanged: ((Bool) -> Void)?
    var onFadeOutMsChanged: ((Int) -> Void)?
    var onFadeInMsChanged: ((Int) -> Void)?

    init(volumeControlSupported: Bool) {
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()

        if let button = item.button {
            button.image = NSImage(
                systemSymbolName: "waveform",
                accessibilityDescription: "Pause Resume Audio Fade"
            )
            button.image?.isTemplate = true
        }

        item.menu = buildMenu()
        syncFrom(preferences: .shared)
    }

    func syncFrom(preferences: Preferences) {
        enabledMenuItem.state = preferences.enabled ? .on : .off
        updateCheckmarks(items: fadeOutItems, presets: durationPresetsMs, current: preferences.fadeOutMs)
        updateCheckmarks(items: fadeInItems, presets: durationPresetsMs, current: preferences.fadeInMs)
    }

    /// Refreshed at launch and every time detection or device state changes,
    /// so "why isn't this working" is answerable by just opening the menu
    /// instead of needing Console.app.
    func updateDiagnostics(mediaRemoteAvailable: Bool, deviceName: String, deviceSupported: Bool, isPlaying: Bool?) {
        detectionStatusItem.title = mediaRemoteAvailable
            ? "検知: 利用可能"
            : "検知: 利用不可（この macOS では再生検知APIが見つかりません）"

        deviceStatusItem.title = deviceSupported
            ? "出力デバイス: \(deviceName)（音量フェード対応）"
            : "出力デバイス: \(deviceName)（このデバイスは音量フェードに非対応）"

        switch isPlaying {
        case .some(true):
            playbackStatusItem.title = "現在の再生状態: 再生中"
        case .some(false):
            playbackStatusItem.title = "現在の再生状態: 一時停止中 / 何も再生していない"
        case .none:
            playbackStatusItem.title = "現在の再生状態: 不明"
        }
    }

    private func updateCheckmarks(items: [NSMenuItem], presets: [Int], current: Int) {
        for (item, ms) in zip(items, presets) {
            item.state = ms == current ? .on : .off
        }
    }

    private func buildMenu() -> NSMenu {
        let menu = NSMenu()

        let title = NSMenuItem(title: "Pause Resume Audio Fade", action: nil, keyEquivalent: "")
        title.isEnabled = false
        menu.addItem(title)
        menu.addItem(.separator())

        detectionStatusItem = disabledInfoItem()
        deviceStatusItem = disabledInfoItem()
        playbackStatusItem = disabledInfoItem()
        menu.addItem(detectionStatusItem)
        menu.addItem(deviceStatusItem)
        menu.addItem(playbackStatusItem)
        menu.addItem(.separator())

        enabledMenuItem = NSMenuItem(
            title: "有効にする",
            action: #selector(toggleEnabled),
            keyEquivalent: ""
        )
        enabledMenuItem.target = self
        menu.addItem(enabledMenuItem)
        menu.addItem(.separator())

        let fadeOutMenu = NSMenu()
        fadeOutItems = durationPresetsMs.map { ms in
            let item = NSMenuItem(title: "\(ms) ms", action: #selector(selectFadeOut(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = ms
            fadeOutMenu.addItem(item)
            return item
        }
        let fadeOutParent = NSMenuItem(title: "フェードアウト（一時停止）", action: nil, keyEquivalent: "")
        fadeOutParent.submenu = fadeOutMenu
        menu.addItem(fadeOutParent)

        let fadeInMenu = NSMenu()
        fadeInItems = durationPresetsMs.map { ms in
            let item = NSMenuItem(title: "\(ms) ms", action: #selector(selectFadeIn(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = ms
            fadeInMenu.addItem(item)
            return item
        }
        let fadeInParent = NSMenuItem(title: "フェードイン（再開）", action: nil, keyEquivalent: "")
        fadeInParent.submenu = fadeInMenu
        menu.addItem(fadeInParent)

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "終了", action: #selector(quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)

        return menu
    }

    private func disabledInfoItem() -> NSMenuItem {
        let item = NSMenuItem(title: "...", action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    @objc private func toggleEnabled() {
        let newValue = enabledMenuItem.state != .on
        enabledMenuItem.state = newValue ? .on : .off
        onEnabledChanged?(newValue)
    }

    @objc private func selectFadeOut(_ sender: NSMenuItem) {
        guard let ms = sender.representedObject as? Int else { return }
        updateCheckmarks(items: fadeOutItems, presets: durationPresetsMs, current: ms)
        onFadeOutMsChanged?(ms)
    }

    @objc private func selectFadeIn(_ sender: NSMenuItem) {
        guard let ms = sender.representedObject as? Int else { return }
        updateCheckmarks(items: fadeInItems, presets: durationPresetsMs, current: ms)
        onFadeInMsChanged?(ms)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
