import AppKit

/// メニューバーの UI。状態表示と設定変更だけを担当し、音声処理は AppDelegate 経由で行う
final class StatusBarController: NSObject, NSMenuDelegate {
    /// メニューを開くたびに最新の状態を取りに行く
    struct Snapshot {
        var statusLine: String
        var detailLine: String?
        var permissionDenied: Bool
        var loginItemEnabled: Bool
        var loginItemNote: String?
    }

    var snapshot: () -> Snapshot = {
        Snapshot(statusLine: "", detailLine: nil, permissionDenied: false, loginItemEnabled: false, loginItemNote: nil)
    }
    var onToggleEnabled: (Bool) -> Void = { _ in }
    var onSelectFadeOutMode: (FadeOutMode) -> Void = { _ in }
    var onToggleFadeIn: (Bool) -> Void = { _ in }
    var onToggleSeekFadeIn: (Bool) -> Void = { _ in }
    var onSelectFadeInMs: (Int) -> Void = { _ in }
    var onToggleLoginItem: (Bool) -> Void = { _ in }
    var onOpenPermissionSettings: () -> Void = {}
    var onQuit: () -> Void = {}

    private let preferences: Preferences
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    /// NSMenuItem の target は弱参照なので、メニューを作り直すまで保持しておく
    private var actions: [MenuAction] = []

    /// 検証用（--dump-menu）にメニューを取り出す
    var menu: NSMenu? { statusItem.menu }

    init(preferences: Preferences) {
        self.preferences = preferences
        super.init()
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "waveform", accessibilityDescription: "PauseResumeAudioFade")
            button.image?.isTemplate = true
        }
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu
        rebuild(menu)
    }

    func menuWillOpen(_ menu: NSMenu) {
        rebuild(menu)
    }

    private func rebuild(_ menu: NSMenu) {
        menu.removeAllItems()
        actions.removeAll()
        let state = snapshot()

        menu.addItem(label(state.statusLine))
        if let detail = state.detailLine { menu.addItem(label(detail)) }
        if state.permissionDenied {
            menu.addItem(action("システム音声の録音を許可…", checked: false) { [weak self] in self?.onOpenPermissionSettings() })
        }
        menu.addItem(.separator())

        menu.addItem(action("有効にする", checked: preferences.enabled) { [weak self] in
            guard let self else { return }
            self.onToggleEnabled(!self.preferences.enabled)
        })
        menu.addItem(.separator())

        let fadeOut = NSMenuItem(title: "フェードアウト（一時停止）", action: nil, keyEquivalent: "")
        fadeOut.toolTip = "一時停止は横取りできないため、出力を少し遅らせて停止の直前をさかのぼってフェードします。長いほど滑らかですが、映像との音ズレが増えます。"
        let fadeOutMenu = NSMenu()
        for mode in FadeOutMode.allCases {
            fadeOutMenu.addItem(action(mode.title, checked: preferences.fadeOutMode == mode) { [weak self] in
                self?.onSelectFadeOutMode(mode)
            })
        }
        fadeOut.submenu = fadeOutMenu
        menu.addItem(fadeOut)

        menu.addItem(action("再開時にフェードイン", checked: preferences.fadeInEnabled) { [weak self] in
            guard let self else { return }
            self.onToggleFadeIn(!self.preferences.fadeInEnabled)
        })
        menu.addItem(action("シーク時にフェードイン", checked: preferences.seekFadeInEnabled) { [weak self] in
            guard let self else { return }
            self.onToggleSeekFadeIn(!self.preferences.seekFadeInEnabled)
        })

        let fadeIn = NSMenuItem(title: "フェードインの長さ", action: nil, keyEquivalent: "")
        let fadeInMenu = NSMenu()
        for ms in Preferences.fadeInChoicesMs {
            fadeInMenu.addItem(action("\(ms) ms", checked: preferences.fadeInMs == ms) { [weak self] in
                self?.onSelectFadeInMs(ms)
            })
        }
        fadeIn.submenu = fadeInMenu
        menu.addItem(fadeIn)
        menu.addItem(.separator())

        let login = action("ログイン時に起動", checked: state.loginItemEnabled) { [weak self] in
            self?.onToggleLoginItem(!state.loginItemEnabled)
        }
        if let note = state.loginItemNote { login.toolTip = note }
        menu.addItem(login)
        menu.addItem(.separator())

        menu.addItem(label("バージョン \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?")"))
        menu.addItem(action("終了", checked: false) { [weak self] in self?.onQuit() })
    }

    private func label(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func action(_ title: String, checked: Bool, _ handler: @escaping () -> Void) -> NSMenuItem {
        let wrapper = MenuAction(handler)
        actions.append(wrapper)
        let item = NSMenuItem(title: title, action: #selector(MenuAction.run), keyEquivalent: "")
        item.target = wrapper
        item.state = checked ? .on : .off
        return item
    }
}

private final class MenuAction: NSObject {
    private let handler: () -> Void
    init(_ handler: @escaping () -> Void) { self.handler = handler }
    @objc func run() { handler() }
}
