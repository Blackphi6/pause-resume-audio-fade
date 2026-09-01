import Foundation

/// Observes system-wide "is anything playing" state -- the same signal
/// Control Center's Now Playing widget uses -- via the private
/// MediaRemote.framework. This is undocumented API: symbol names and
/// behavior can change between macOS versions, so every lookup is optional
/// and the whole bridge degrades to "unavailable" (never fires) rather than
/// crashing if Apple changes something.
///
/// Distributed notifications from MediaRemote are not fully reliable on
/// every app/macOS combination, so a periodic poll is layered on top as a
/// safety net; both paths call the same `refresh()`.
final class MediaRemoteBridge {
    private typealias RegisterFn = @convention(c) (DispatchQueue) -> Void
    private typealias GetIsPlayingFn = @convention(c) (DispatchQueue, @escaping (Bool) -> Void) -> Void
    private typealias GetNowPlayingInfoFn = @convention(c) (DispatchQueue, @escaping ([String: Any]?) -> Void) -> Void

    private var getIsPlayingFn: GetIsPlayingFn?
    private var getNowPlayingInfoFn: GetNowPlayingInfoFn?
    private var pollTimer: DispatchSourceTimer?

    private(set) var isAvailable = false
    private(set) var isPlaying = false

    /// Called on the main queue whenever the observed playing state changes.
    var onPlayingStateChanged: ((Bool) -> Void)?

    private static let observedNotifications = [
        "kMRMediaRemoteNowPlayingApplicationIsPlayingDidChangeNotification",
        "kMRMediaRemoteNowPlayingInfoDidChangeNotification",
        "kMRNowPlayingPlaybackQueueChangedNotification",
    ]

    init() {
        guard let handle = dlopen(
            "/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote",
            RTLD_NOW
        ) else { return }

        func load<T>(_ name: String, as type: T.Type) -> T? {
            guard let sym = dlsym(handle, name) else { return nil }
            return unsafeBitCast(sym, to: type)
        }

        let registerFn = load("MRMediaRemoteRegisterForNowPlayingNotifications", as: RegisterFn.self)
        getIsPlayingFn = load("MRMediaRemoteGetNowPlayingApplicationIsPlaying", as: GetIsPlayingFn.self)
        getNowPlayingInfoFn = load("MRMediaRemoteGetNowPlayingInfo", as: GetNowPlayingInfoFn.self)

        isAvailable = registerFn != nil && (getIsPlayingFn != nil || getNowPlayingInfoFn != nil)
        guard isAvailable, let registerFn else { return }

        registerFn(DispatchQueue.main)

        for name in Self.observedNotifications {
            DistributedNotificationCenter.default().addObserver(
                self,
                selector: #selector(handleNotification),
                name: Notification.Name(name),
                object: nil
            )
        }

        startPolling()
        refresh()
    }

    deinit {
        DistributedNotificationCenter.default().removeObserver(self)
        pollTimer?.cancel()
    }

    /// Undocumented notifications are the fast path when they fire; this
    /// timer is the guaranteed path so a missed notification never leaves
    /// the fader stuck in the wrong state for more than a beat.
    private func startPolling() {
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + 0.7, repeating: 0.7)
        timer.setEventHandler { [weak self] in self?.refresh() }
        timer.resume()
        pollTimer = timer
    }

    @objc private func handleNotification() {
        refresh()
    }

    func refresh() {
        if let getIsPlayingFn {
            getIsPlayingFn(DispatchQueue.main) { [weak self] playing in
                self?.report(playing)
            }
            return
        }
        if let getNowPlayingInfoFn {
            getNowPlayingInfoFn(DispatchQueue.main) { [weak self] info in
                let rate = (info?["kMRMediaRemoteNowPlayingInfoPlaybackRate"] as? NSNumber)?.doubleValue ?? 0
                self?.report(rate > 0.01)
            }
        }
    }

    private func report(_ playing: Bool) {
        guard playing != isPlaying else { return }
        isPlaying = playing
        onPlayingStateChanged?(playing)
    }
}
