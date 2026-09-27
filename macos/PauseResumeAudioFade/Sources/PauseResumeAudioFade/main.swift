import AppKit
import FadeCore
import Foundation
import ServiceManagement

// 検証用の CLI モード。通常起動（引数なし）は後でメニューバーアプリになる。
//   --spike <秒>                  エンジンだけ起動して入出力のピークを表示
//   --envelope <秒> <出力CSV>     コールバックごとの入出力ピークを CSV に記録
//   --probe <秒> <出力CSV>        別プロセスで動く本体の実際の出力をタップして CSV に記録
if #available(macOS 14.2, *), CommandLine.arguments.count >= 3,
   ["--spike", "--envelope"].contains(CommandLine.arguments[1]) {
    let mode = CommandLine.arguments[1]
    let seconds = Double(CommandLine.arguments[2]) ?? 10
    let engine = AudioTapEngine()
    if mode == "--envelope" { engine.enableEnvelopeRecording(capacity: Int(seconds * 200) + 1000) }
    do {
        try engine.start(settings: FadeSettings())
        print("開始: \(String(describing: engine.info))")
        fflush(stdout)
    } catch {
        print("開始失敗: \(error)")
        exit(1)
    }
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline {
        if mode == "--spike" {
            print(String(format: "cb=%d in=%.4f out=%.4f", engine.callbackCount, engine.inputPeak, engine.outputPeak))
            fflush(stdout)
        }
        Thread.sleep(forTimeInterval: 0.5)
    }
    engine.stop()
    if mode == "--envelope", CommandLine.arguments.count >= 4 {
        var csv = "frames,input,output\n"
        for i in 0..<engine.envelopeCount {
            let r = engine.envelopeRow(i)
            csv += "\(r.frames),\(r.input),\(r.output)\n"
        }
        try? csv.write(toFile: CommandLine.arguments[3], atomically: true, encoding: .utf8)
        print("記録: \(engine.envelopeCount) 行 → \(CommandLine.arguments[3])")
    }
    exit(0)
}

if #available(macOS 14.2, *), CommandLine.arguments.count >= 4, CommandLine.arguments[1] == "--probe" {
    let seconds = Double(CommandLine.arguments[2]) ?? 10
    let probe = TapProbe(capacity: Int(seconds * 200) + 1000)
    guard let target = probe.waitForTargetProcess(bundleID: "io.github.blackphi6.PauseResumeAudioFade", timeout: 10) else {
        print("本体プロセスが見つかりません")
        exit(1)
    }
    do { try probe.start(target: target) } catch { print("probe 開始失敗: \(error)"); exit(1) }
    Thread.sleep(forTimeInterval: seconds)
    probe.stop()
    var csv = "frames,peak\n"
    for i in 0..<probe.count { let r = probe.row(i); csv += "\(r.frames),\(r.peak)\n" }
    try? csv.write(toFile: CommandLine.arguments[3], atomically: true, encoding: .utf8)
    print("probe 記録: \(probe.count) 行")
    exit(0)
}

if CommandLine.arguments.count >= 2, CommandLine.arguments[1] == "--tcc" {
    print("audio capture permission: \(AudioCapturePermission.current())")
    exit(0)
}

// 検証用: メニュー構成を書き出し、項目の実行で設定と通知が変わるか確認する（実設定は変更しない）
if #available(macOS 14.2, *), CommandLine.arguments.count >= 2, CommandLine.arguments[1] == "--dump-menu" {
    let suite = "dump-menu-\(getpid())"
    let defaults = UserDefaults(suiteName: suite)!
    defer { defaults.removePersistentDomain(forName: suite) }
    let prefs = Preferences(defaults: defaults)
    _ = NSApplication.shared
    let bar = StatusBarController(preferences: prefs)
    var calls: [String] = []
    bar.snapshot = {
        .init(statusLine: "稼働中", detailLine: "出力: テスト（遅延 100 ms）", permissionDenied: false, loginItemEnabled: false, loginItemNote: nil)
    }
    bar.onSelectFadeOutMode = { prefs.fadeOutMode = $0; calls.append("fadeOutMode=\($0.rawValue)") }
    bar.onToggleSeekFadeIn = { prefs.seekFadeInEnabled = $0; calls.append("seekFadeIn=\($0)") }
    bar.onSelectFadeInMs = { prefs.fadeInMs = $0; calls.append("fadeInMs=\($0)") }
    bar.onToggleEnabled = { prefs.enabled = $0; calls.append("enabled=\($0)") }
    func dump(_ menu: NSMenu, _ indent: String = "") {
        for item in menu.items {
            if item.isSeparatorItem { print("\(indent)----"); continue }
            print("\(indent)\(item.state == .on ? "[x]" : "[ ]") \(item.title)\(item.isEnabled ? "" : "  (無効)")")
            if let sub = item.submenu { dump(sub, indent + "    ") }
        }
    }
    func find(_ menu: NSMenu, _ title: String) -> NSMenuItem? {
        for item in menu.items {
            if item.title.hasPrefix(title) { return item }
            if let sub = item.submenu, let hit = find(sub, title) { return hit }
        }
        return nil
    }
    guard let menu = bar.menu else { print("メニューなし"); exit(1) }
    menu.delegate?.menuWillOpen?(menu)
    dump(menu)
    for title in ["短い", "シーク時にフェードイン", "600 ms", "有効にする"] {
        if let item = find(menu, title), let index = Optional(item.menu!.index(of: item)) {
            item.menu!.performActionForItem(at: index)
        } else { print("項目が見つかりません: \(title)") }
    }
    print("呼び出し: \(calls)")
    print("保存値: fadeOutMode=\(prefs.fadeOutMode.rawValue) seek=\(prefs.seekFadeInEnabled) fadeInMs=\(prefs.fadeInMs) enabled=\(prefs.enabled)")
    let s = prefs.fadeSettings
    print("FadeSettings: lookahead=\(s.lookaheadMs) fadeOut=\(s.fadeOutMs) fadeIn=\(s.fadeInMs) seek=\(s.seekFadeInEnabled)")
    exit(0)
}

// 検証用: ログイン項目の登録・解除が通るか確認して元に戻す
if CommandLine.arguments.count >= 2, CommandLine.arguments[1] == "--login-item-check" {
    checkLoginItem()
    exit(0)
}

// 通常起動: Dock に出ないメニューバー常駐アプリとして動かす
if #available(macOS 14.2, *) {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.accessory)
    app.run()
} else {
    print("macOS 14.2 以降が必要です")
    exit(1)
}


func checkLoginItem() {
    let service = SMAppService.mainApp
    print("初期状態: \(service.status.rawValue)")
    do { try service.register(); print("register 後: \(service.status.rawValue)") } catch { print("register 失敗: \(error)") }
    do { try service.unregister(); print("unregister 後: \(service.status.rawValue)") } catch { print("unregister 失敗: \(error)") }
}
