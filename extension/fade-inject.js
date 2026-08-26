(() => {
  "use strict";

  const ATTR = "data-prf-k";
  const TOKEN = document.documentElement.getAttribute(ATTR) || "";
  try {
    document.documentElement.removeAttribute(ATTR);
  } catch {
    /* ignore */
  }

  const EVENT_SETTINGS = TOKEN ? `__prf_settings_${TOKEN}` : "";
  const EVENT_HELLO = TOKEN ? `__prf_hello_${TOKEN}` : "";
  const EVENT_HUD = TOKEN ? `__prf_hud_${TOKEN}` : "";

  const DEFAULTS = Object.freeze({
    enabled: true,
    fadeOutEnabled: true,
    fadeInEnabled: true,
    seekFadeInEnabled: true,
    debugHud: false,
    fadeOutMs: 350,
    fadeInMs: 300,
  });

  const BOOL_KEYS = [
    "enabled",
    "fadeOutEnabled",
    "fadeInEnabled",
    "seekFadeInEnabled",
    "debugHud",
  ];
  const MS_KEYS = ["fadeOutMs", "fadeInMs"];

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function sanitizeSettings(raw) {
    const out = {
      enabled: DEFAULTS.enabled,
      fadeOutEnabled: DEFAULTS.fadeOutEnabled,
      fadeInEnabled: DEFAULTS.fadeInEnabled,
      seekFadeInEnabled: DEFAULTS.seekFadeInEnabled,
      debugHud: DEFAULTS.debugHud,
      fadeOutMs: DEFAULTS.fadeOutMs,
      fadeInMs: DEFAULTS.fadeInMs,
    };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return Object.freeze(out);
    for (const key of BOOL_KEYS) {
      if (hasOwn(raw, key) && typeof raw[key] === "boolean") out[key] = raw[key];
    }
    for (const key of MS_KEYS) {
      if (hasOwn(raw, key) && typeof raw[key] === "number" && Number.isFinite(raw[key])) {
        out[key] = Math.min(3000, Math.max(100, Math.round(raw[key])));
      }
    }
    return Object.freeze(out);
  }

  /** @type {typeof DEFAULTS} */
  let settings = sanitizeSettings(DEFAULTS);

  if (EVENT_SETTINGS) {
    window.addEventListener(EVENT_SETTINGS, (event) => {
      const detail = event && event.detail;
      if (!detail || detail.v !== 1) return;
      settings = sanitizeSettings(detail.settings);
      syncDebugCorner();
    });
    // Ask isolated bridge to push current prefs (token-bound; page cannot spoof easily)
    try {
      window.dispatchEvent(new CustomEvent(EVENT_HELLO));
    } catch {
      /* ignore */
    }
  }

  const fadeOutOn = () => settings.enabled && settings.fadeOutEnabled;
  const fadeInOn = () => settings.enabled && settings.fadeInEnabled;
  const seekFadeOn = () => settings.enabled && settings.seekFadeInEnabled;
  const debugHudOn = () => Boolean(settings.debugHud);

  /** @type {HTMLDivElement | null} */
  let hudRoot = null;
  /** @type {number} */
  let hudHideTimer = 0;

  function ensureHud() {
    if (hudRoot && document.documentElement.contains(hudRoot)) return hudRoot;
    const root = document.createElement("div");
    root.id = "prf-debug-hud";
    root.setAttribute("data-prf", "1");
    Object.assign(root.style, {
      position: "fixed",
      left: "8px",
      right: "8px",
      top: "8px",
      zIndex: "2147483646",
      pointerEvents: "none",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: "12px",
      lineHeight: "1.35",
      display: "none",
    });
    const badge = document.createElement("div");
    badge.className = "prf-debug-badge";
    Object.assign(badge.style, {
      display: "inline-block",
      maxWidth: "100%",
      padding: "8px 10px",
      borderRadius: "8px",
      background: "rgba(10,12,16,0.88)",
      color: "#f2f4f7",
      border: "1px solid rgba(255,77,77,0.65)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });
    root.appendChild(badge);
    (document.documentElement || document.body).appendChild(root);
    hudRoot = root;
    return root;
  }

  function syncDebugCorner() {
    let corner = document.getElementById("prf-debug-corner");
    if (!debugHudOn()) {
      if (corner) corner.remove();
      if (hudRoot) hudRoot.style.display = "none";
      return;
    }
    if (!corner) {
      corner = document.createElement("div");
      corner.id = "prf-debug-corner";
      corner.textContent = "PRF DBG";
      Object.assign(corner.style, {
        position: "fixed",
        right: "8px",
        bottom: "8px",
        zIndex: "2147483646",
        pointerEvents: "none",
        padding: "4px 8px",
        borderRadius: "999px",
        background: "rgba(255,61,61,0.9)",
        color: "#fff",
        font: "700 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace",
        letterSpacing: "0.04em",
      });
      (document.documentElement || document.body).appendChild(corner);
    }
  }

  /**
   * On-screen debug toast for mobile / Orion (no DevTools needed).
   * @param {string} title
   * @param {string} [detail]
   */
  function showHud(title, detail) {
    if (!debugHudOn()) return;
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_HUD, {
          detail: Object.freeze({ v: 1, title: String(title || ""), note: String(detail || "") }),
        })
      );
    } catch {
      /* ignore */
    }
    syncDebugCorner();
    const root = ensureHud();
    const badge = root.firstElementChild;
    if (!(badge instanceof HTMLElement)) return;
    badge.textContent = detail ? `${title}\n${detail}` : title;
    root.style.display = "block";
    if (hudHideTimer) window.clearTimeout(hudHideTimer);
    hudHideTimer = window.setTimeout(() => {
      root.style.display = "none";
      hudHideTimer = 0;
    }, 2200);
  }

  /**
   * @typedef {{
   *   fading: boolean,
   *   direction: "out" | "in" | "seek" | null,
   *   pauseIntent: boolean,
   *   pauseHold: boolean,
   *   userCancelPause: boolean,
   *   hardPausing: boolean,
   *   userVolume: number,
   *   userPlayerVolume: number,
   *   gain: GainNode | null,
   *   ctx: AudioContext | null,
   *   gainOk: boolean,
   *   triedGain: boolean,
   *   gainBlocked: boolean,
   *   tapMode: "gain" | "volume" | "locked" | "unknown",
   *   timer: number,
   *   watchdog: number,
   *   enforceTimer: number,
   *   lastTime: number,
   *   seekFrom: number,
   *   seekHooked: boolean,
   *   seeking: boolean,
   *   seekGuardUntil: number,
   *   pendingSeekFade: boolean,
   *   elementHooked: boolean,
   * }} FadeState
   */

  /** @type {WeakMap<HTMLVideoElement, FadeState>} */
  const states = new WeakMap();

  /** @type {WeakSet<object>} */
  const hookedPlayers = new WeakSet();

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function clamp100(v) {
    return Math.min(100, Math.max(0, Math.round(v)));
  }

  /** @returns {any | null} */
  function getPlayer() {
    const el =
      document.getElementById("movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector(".player-container .html5-video-player") ||
      document.querySelector("ytm-player") ||
      document.querySelector("#player");
    if (el && typeof el.getVolume === "function") return el;
    // Mobile sometimes exposes API on #movie_player after a delay.
    const movie = document.getElementById("movie_player");
    if (movie && typeof movie.getVolume === "function") return movie;
    return null;
  }

  const PLAYER_HOST = [
    "#movie_player",
    ".html5-video-player",
    ".player-container",
    "#player-container",
    "ytm-player",
    "#player",
    ".player-api",
    "ytd-player",
    "#ytd-player",
    ".watch-video",
    "[data-uia='player']",
    "[data-uia='video-canvas']",
    ".nfp",
    ".atvwebplayersdk-player-container",
    "#dv-web-player",
    ".webPlayerSDKContainer",
    ".webPlayerElement",
    "[data-testid='player']",
    ".tver-player",
    "#tver-player",
    ".vjs-tech",
    ".video-js",
    "[class*='EpisodePlayer']",
    "[class*='VODScreen']",
    "#fluffy-video-view",
    "[class*='VODPlayer']",
    "[class*='vod-player']",
  ].join(", ");

  function isYouTubeHost() {
    return /(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname || "");
  }

  function isMobileSite() {
    const host = location.hostname || "";
    if (host === "m.youtube.com") return true;
    if (!isYouTubeHost()) return false;
    if (document.querySelector("ytm-app")) return true;
    if (document.documentElement.getAttribute("data-app") === "mobile") return true;
    // DevTools device mode / narrow window on www.youtube.com
    try {
      if (window.matchMedia("(max-width: 700px), (pointer: coarse)").matches) return true;
    } catch {
      /* ignore */
    }
    return Boolean(document.querySelector("ytd-app[is-mobile-device], ytd-browse[page-subtype]"));
  }

  /**
   * Widevine 等の EME では createMediaElementSource が無音化することがある。
   * 該当サイトは video.volume だけを使う。
   */
  function isEmeLikely(video) {
    if (video instanceof HTMLVideoElement && video.mediaKeys) return true;
    const h = location.hostname || "";
    return /(?:^|\.)(?:netflix|primevideo|disneyplus|hulu|dazn|max|paramountplus|crunchyroll)\.com$/i.test(
      h
    )
      || /(?:^|\.)primevideo\./i.test(h)
      || /(?:^|\.)amazon\./i.test(h)
      || /(?:^|\.)(?:hulu|disneyplus)\./i.test(h)
      || /(?:^|\.)unext\.jp$/i.test(h);
  }

  function videoArea(video) {
    return Math.max(0, video.clientWidth || 0) * Math.max(0, video.clientHeight || 0);
  }

  function isPreviewVideo(video) {
    if (!(video instanceof HTMLVideoElement)) return true;
    // Anything inside the real player chrome is the main video — never a preview.
    if (video.closest(PLAYER_HOST)) return false;
    if (
      video.closest(
        "ytd-thumbnail, ytm-media-item, .video-thumbnail-container, ytm-shorts-lockup-view-model, ytd-reel-video-renderer"
      )
    ) {
      return true;
    }
    // ミュートループはフィードの自動再生プレビューが多い
    if (video.muted && video.loop) return true;
    // Tiny inline previews on home/search feeds (outside the player host).
    if (video.clientWidth > 0 && video.clientWidth < 160) return true;
    if (video.clientHeight > 0 && video.clientHeight < 90) return true;
    return false;
  }

  /** @returns {HTMLVideoElement | null} */
  function findMainVideo() {
    const selectors = [
      "video.html5-main-video",
      "#movie_player video",
      ".html5-video-player video",
      ".player-container video",
      "ytm-player video",
      "#player video",
      ".player-api video",
      "ytd-player video",
      "#ytd-player video",
      ".watch-video video",
      "[data-uia='player'] video",
      ".atvwebplayersdk-player-container video",
      "#dv-web-player video",
      "video.vjs-tech",
      ".video-js video",
      "[class*='EpisodePlayer'] video",
      "[class*='VODScreen'] video",
    ];
    /** @type {HTMLVideoElement[]} */
    const found = [];
    const seen = new Set();
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        if (!(el instanceof HTMLVideoElement) || seen.has(el)) return;
        if (isPreviewVideo(el)) return;
        seen.add(el);
        found.push(el);
      });
    }
    if (!found.length) {
      document.querySelectorAll("video").forEach((el) => {
        if (!(el instanceof HTMLVideoElement) || seen.has(el)) return;
        if (isPreviewVideo(el)) return;
        seen.add(el);
        found.push(el);
      });
    }
    if (!found.length) return null;

    const preferred =
      found.find((v) => v.classList.contains("html5-main-video")) ||
      found.find((v) => v.closest("#movie_player, .html5-video-player, ytd-player")) ||
      found.find((v) => v.closest(".player-container, ytm-player, #player, .watch-video, .atvwebplayersdk-player-container, #dv-web-player"));
    if (preferred) return preferred;

    const playing = found.filter((v) => !v.paused && !v.muted);
    const pool = playing.length ? playing : found;
    return pool.slice().sort((a, b) => videoArea(b) - videoArea(a))[0];
  }

  /** @param {HTMLVideoElement} video */
  function getState(video) {
    let s = states.get(video);
    if (!s) {
      s = {
        fading: false,
        direction: null,
        pauseIntent: false,
        pauseHold: false,
        userCancelPause: false,
        hardPausing: false,
        userVolume: video.muted ? 1 : video.volume || 1,
        userPlayerVolume: 100,
        gain: null,
        ctx: null,
        gainOk: false,
        triedGain: false,
        gainBlocked: false,
        tapMode: "unknown",
        timer: 0,
        watchdog: 0,
        enforceTimer: 0,
        lastTime: video.currentTime || 0,
        seekFrom: 0,
        seekHooked: false,
        seeking: false,
        seekGuardUntil: 0,
        pendingSeekFade: false,
        elementHooked: false,
      };
      states.set(video, s);
      hookSeek(video, s);
    }
    return s;
  }

  function isWebKitLike() {
    const ua = navigator.userAgent || "";
    if (/Orion/i.test(ua)) return true;
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
    return /AppleWebKit/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua);
  }

  /** iOS/WebKit often ignores HTMLMediaElement.volume (always 1). */
  function probeVolumeWritable(video) {
    if (!(video instanceof HTMLVideoElement)) return false;
    const prev = video.volume;
    try {
      const next = prev > 0.5 ? 0.37 : 0.63;
      video.volume = next;
      // 代入が残っていれば書き込み可。差が大きい＝無視されている。
      const ok = Math.abs(video.volume - next) < 0.05;
      video.volume = prev;
      return ok;
    } catch {
      try {
        video.volume = prev;
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  function probePlayerVolumeWritable() {
    const player = getPlayer();
    if (!player || typeof player.setVolume !== "function" || typeof player.getVolume !== "function") {
      return false;
    }
    try {
      const prev = player.getVolume();
      const next = prev === 50 ? 51 : 50;
      player.setVolume(next);
      const now = player.getVolume();
      player.setVolume(prev);
      return typeof now === "number" && now !== prev;
    } catch {
      return false;
    }
  }

  /**
   * WebKit/Orion: GainNode often "connects" but YouTube audio stays on a native
   * path, so fades are silent no-ops. Prefer setVolume when it actually sticks.
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function resolveTapMode(video, s) {
    if (s.tapMode === "gain" || s.tapMode === "volume" || s.tapMode === "locked") return s.tapMode;
    if (isWebKitLike() || isEmeLikely(video)) {
      s.gainBlocked = true;
      if (probePlayerVolumeWritable() || probeVolumeWritable(video)) {
        s.tapMode = "volume";
      } else {
        s.tapMode = "locked";
      }
      return s.tapMode;
    }
    if (ensureGain(video, s)) {
      s.tapMode = "gain";
      return s.tapMode;
    }
    if (probePlayerVolumeWritable() || probeVolumeWritable(video)) {
      s.tapMode = "volume";
      return s.tapMode;
    }
    s.tapMode = "locked";
    return s.tapMode;
  }

  /** @param {HTMLVideoElement} video */
  function isMainVideo(video) {
    if (!(video instanceof HTMLVideoElement) || isPreviewVideo(video)) return false;
    if (video.classList.contains("html5-main-video")) return true;
    if (video.closest(PLAYER_HOST)) return true;
    if (video.closest("ytd-player, #ytd-player")) return true;
    const main = findMainVideo();
    if (main && main === video) return true;
    // On m.youtube / mobile web, accept a sizable watch-page video.
    if (isMobileSite()) {
      if (/\/watch/.test(location.pathname) && (video.clientWidth >= 160 || video.videoWidth >= 160)) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function restoreFullVolume(video, s) {
    const base = s.userPlayerVolume > 0 ? s.userPlayerVolume : 100;
    const player = getPlayer();
    if (player && typeof player.setVolume === "function") {
      try {
        player.setVolume(clamp100(base));
      } catch {
        /* ignore */
      }
    }
    try {
      video.muted = false;
      video.volume = s.userVolume > 0 ? clamp01(s.userVolume) : 1;
    } catch {
      /* ignore */
    }
    if (s.gainOk && s.gain && s.ctx) {
      resumeCtx(s.ctx);
      const g = s.gain.gain;
      const t = s.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(1, t);
    }
  }

  function ensureGain(video, s) {
    // Orion / iOS WebKit: createMediaElementSource steals the native audio
    // path and later pause/play cycles go silent. Never attach Gain there.
    // DRM 再生も GainNode が無音化することがあるので volume 経路へ。
    if (isWebKitLike() || isEmeLikely(video)) {
      s.gainBlocked = true;
      return false;
    }
    if (s.gainOk && s.gain && s.ctx) {
      resumeCtx(s.ctx);
      return true;
    }
    if (!isMainVideo(video)) return false;
    // Permanent failure only when the element is already wired to another source node.
    if (s.gainBlocked) return false;

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        s.gainBlocked = true;
        return false;
      }
      const ctx = s.ctx || new Ctx();
      resumeCtx(ctx);
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      s.ctx = ctx;
      s.gain = gain;
      s.gainOk = true;
      s.triedGain = true;
      return true;
    } catch (err) {
      const msg = String((err && err.message) || err || "");
      // Already connected → do not keep retrying createMediaElementSource.
      if (/already\s+connected|InvalidStateError/i.test(msg)) {
        s.gainBlocked = true;
      }
      s.gain = null;
      // Keep ctx if we created one; still allow later volume fallback.
      s.gainOk = false;
      s.triedGain = true;
      return false;
    }
  }

  /** @param {AudioContext | null} ctx */
  function resumeCtx(ctx) {
    if (!ctx || ctx.state !== "suspended") return;
    // Calling resume() without real user activation (e.g. an embedded preview
    // iframe on a search results page) can't succeed and only logs Chrome's
    // "AudioContext was not allowed to start" warning. Skip it; a later real
    // gesture will retry via warmAudioFromGesture/startFadeOut/runFadeIn.
    try {
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
    } catch {
      /* ignore */
    }
    ctx.resume().catch(() => {});
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {number} level01
   */
  function applyLevel(video, s, level01) {
    const amp = clamp01(level01);

    if (s.tapMode !== "volume" && s.tapMode !== "locked" && s.gainOk && s.gain && s.ctx) {
      const g = s.gain.gain;
      const t = s.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(amp, t);
      return;
    }

    const player = getPlayer();
    if (player && typeof player.setVolume === "function") {
      const base =
        s.userPlayerVolume > 0
          ? s.userPlayerVolume
          : typeof player.getVolume === "function"
            ? player.getVolume()
            : 100;
      player.setVolume(clamp100(base * amp));
    }

    try {
      video.volume = clamp01(s.userVolume * amp);
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {number} from
   * @param {number} to
   * @param {number} durationMs
   * @param {() => void} onDone
   */
  function fade(video, s, from, to, durationMs, onDone) {
    clearFadeTimer(s);
    resumeCtx(s.ctx);

    from = clamp01(from);
    to = clamp01(to);

    if (s.tapMode !== "volume" && s.tapMode !== "locked" && s.gainOk && s.gain && s.ctx && durationMs > 0) {
      const g = s.gain.gain;
      const t0 = s.ctx.currentTime;
      const dur = Math.max(0.05, durationMs / 1000);
      g.cancelScheduledValues(t0);
      g.setValueAtTime(from, t0);
      g.linearRampToValueAtTime(to, t0 + dur);
      s.timer = window.setTimeout(() => {
        s.timer = 0;
        applyLevel(video, s, to);
        onDone();
      }, durationMs + 30);
      return;
    }

    if (durationMs <= 0 || from === to) {
      applyLevel(video, s, to);
      onDone();
      return;
    }

    const start = performance.now();
    s.timer = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      applyLevel(video, s, from + (to - from) * eased);
      if (t >= 1) {
        clearFadeTimer(s);
        applyLevel(video, s, to);
        onDone();
      }
    }, 16);
  }

  /** @param {FadeState} s */
  function clearFadeTimer(s) {
    if (s.timer) {
      window.clearTimeout(s.timer);
      window.clearInterval(s.timer);
      s.timer = 0;
    }
    if (s.tapMode !== "volume" && s.tapMode !== "locked" && s.gainOk && s.gain && s.ctx) {
      const g = s.gain.gain;
      const t = s.ctx.currentTime;
      const current = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(current, t);
    }
  }

  /** @param {FadeState} s */
  function clearWatchdog(s) {
    if (s.watchdog) {
      window.clearTimeout(s.watchdog);
      s.watchdog = 0;
    }
  }

  /** @param {FadeState} s */
  function clearEnforce(s) {
    if (s.enforceTimer) {
      window.clearInterval(s.enforceTimer);
      s.enforceTimer = 0;
    }
  }

  /** True while we must keep the video paused (fade-out or post-pause lock). */
  function shouldBlockPlay(s) {
    return (s.pauseHold || s.pauseIntent) && !s.userCancelPause;
  }

  /** @param {HTMLVideoElement} video */
  function forceNativePause(video) {
    try {
      nativePause.call(video);
    } catch {
      /* ignore */
    }
  }

  /**
   * Keep forcing native pause until the element stays paused.
   * YouTube often calls play() again right after we pause.
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function enforcePaused(video, s) {
    clearEnforce(s);
    let stable = 0;
    let ticks = 0;
    const maxTicks = 24; // ~1.2s at 50ms

    const tick = () => {
      ticks += 1;
      if (!video.paused) applyLevel(video, s, 0);

      if (!video.paused) {
        stable = 0;
        s.hardPausing = true;
        try {
          forceNativePause(video);
          const player = getPlayer();
          if (player && typeof player.pauseVideo === "function" && hookedPlayers.has(player)) {
            // Prefer native media pause; player API may re-enter our hook.
          }
        } finally {
          s.hardPausing = false;
        }
      } else {
        stable += 1;
      }

      if (stable >= 3 || ticks >= maxTicks) {
        clearEnforce(s);
        s.pauseIntent = false;
        s.hardPausing = false;
        // Keep pauseHold until the user explicitly resumes.
        if (!s.userCancelPause) s.pauseHold = true;
        restoreFullVolume(video, s);
      }
    };

    tick();
    s.enforceTimer = window.setInterval(tick, 50);
  }

  /** @param {HTMLVideoElement} video @param {FadeState} s */
  function rememberVolumes(video, s) {
    if (s.fading || s.pauseIntent || s.pauseHold) return;
    const player = getPlayer();
    if (player && typeof player.getVolume === "function") {
      const v = player.getVolume();
      // Ignore ducked levels left over from a fade ramp.
      if (typeof v === "number" && v >= 20) s.userPlayerVolume = v;
    }
    if (!video.muted && video.volume > 0.2) s.userVolume = video.volume;
  }

  function currentAmp(s) {
    if (s.tapMode !== "volume" && s.tapMode !== "locked" && s.gainOk && s.gain) {
      return s.gain.gain.value;
    }
    if (s.fading) return s.direction === "out" ? 0.5 : 0;
    return 1;
  }

  /** @param {FadeState} s */
  function inSeekGuard(s) {
    return s.seeking || performance.now() < s.seekGuardUntil;
  }

  /**
   * Cancel an in-progress pause fade without forcing pause.
   * Used when YouTube pauses only as part of a seek/scrub.
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function abortPauseFade(video, s) {
    if (!s.pauseIntent && !(s.fading && s.direction === "out") && !s.pauseHold) return;
    clearWatchdog(s);
    clearEnforce(s);
    clearFadeTimer(s);
    s.pauseIntent = false;
    s.pauseHold = false;
    s.userCancelPause = false;
    s.hardPausing = false;
    s.fading = false;
    s.direction = null;
    restoreFullVolume(video, s);
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {number} [ms]
   */
  function armSeekGuard(video, s, ms = 800) {
    s.seeking = true;
    s.seekGuardUntil = performance.now() + ms;
    abortPauseFade(video, s);
  }

  /**
   * Finalize a requested pause: stop media and keep it stopped.
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {() => void} finishNative
   */
  function finishPause(video, s, finishNative) {
    clearWatchdog(s);
    clearFadeTimer(s);
    applyLevel(video, s, 0);
    s.fading = false;
    s.direction = null;
    s.pauseHold = true;
    s.userCancelPause = false;
    // Keep pauseIntent true until enforce confirms pause — blocks play() races.

    s.hardPausing = true;
    try {
      forceNativePause(video);
      try {
        finishNative();
      } catch {
        /* ignore */
      }
      if (!video.paused) forceNativePause(video);
    } finally {
      s.hardPausing = false;
    }

    enforcePaused(video, s);
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {"in" | "seek"} kind
   */
  function runFadeIn(video, s, kind) {
    resolveTapMode(video, s);
    if (s.tapMode === "gain") {
      ensureGain(video, s);
      resumeCtx(s.ctx);
    }
    if (s.tapMode === "locked") {
      showHud("NO FADE", "tap=locked — WebKit/iOS blocks JS volume");
      s.pauseIntent = false;
      s.pauseHold = false;
      restoreFullVolume(video, s);
      return;
    }
    clearFadeTimer(s);
    clearWatchdog(s);
    clearEnforce(s);
    s.pauseIntent = false;
    s.pauseHold = false;
    s.userCancelPause = false;
    s.hardPausing = false;
    s.fading = true;
    s.direction = kind;
    applyLevel(video, s, 0);
    showHud(
      kind === "seek" ? "FADE IN (seek)" : "FADE IN",
      `ms=${settings.fadeInMs} tap=${s.tapMode || "?"} gain=${s.gainOk ? "ok" : "no"}`
    );
    fade(video, s, 0, 1, settings.fadeInMs, () => {
      restoreFullVolume(video, s);
      s.fading = false;
      s.direction = null;
    });
  }

  const nativePause = HTMLMediaElement.prototype.pause;
  const nativePlay = HTMLMediaElement.prototype.play;

  /** @type {WeakMap<HTMLVideoElement, number>} */
  const pauseGestureAt = new WeakMap();

  /**
   * @param {HTMLVideoElement} video
   * @param {() => void} finishNative
   */
  function startFadeOut(video, finishNative) {
    pauseGestureAt.set(video, performance.now());

    if (!fadeOutOn()) {
      const s = getState(video);
      s.pauseHold = true;
      s.pauseIntent = true;
      showHud("SKIP fade-out", "fadeOut disabled");
      finishPause(video, s, finishNative);
      return;
    }

    if (video.paused) {
      const s = getState(video);
      s.pauseHold = true;
      showHud("SKIP fade-out", "already paused");
      finishNative();
      return;
    }

    const s = getState(video);
    resolveTapMode(video, s);
    if (s.tapMode === "gain") {
      ensureGain(video, s);
      resumeCtx(s.ctx);
    }
    rememberVolumes(video, s);

    if (s.tapMode === "locked") {
      s.pauseIntent = true;
      s.pauseHold = true;
      showHud("NO FADE", "tap=locked — WebKit/iOS blocks JS volume");
      finishPause(video, s, finishNative);
      return;
    }

    // Already near silence (low volume / muted) — pause immediately
    const from = video.muted ? 0 : currentAmp(s);
    if (video.muted || from <= 0.04) {
      s.pauseIntent = true;
      s.pauseHold = true;
      showHud("PAUSE immediate", `muted/low amp=${from.toFixed(2)}`);
      finishPause(video, s, finishNative);
      return;
    }

    clearFadeTimer(s);
    clearWatchdog(s);
    clearEnforce(s);
    s.fading = true;
    s.direction = "out";
    s.pauseIntent = true;
    s.pauseHold = true;
    s.userCancelPause = false;

    showHud(
      "FADE OUT",
      `ms=${settings.fadeOutMs} from=${from.toFixed(2)} tap=${s.tapMode || "?"} gain=${s.gainOk ? "ok" : "no"} host=${location.hostname}`
    );

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      finishPause(video, s, finishNative);
    };

    // Failsafe: always stop even if fade callback is cancelled/lost
    s.watchdog = window.setTimeout(done, settings.fadeOutMs + 120);

    fade(video, s, from, 0, settings.fadeOutMs, done);
  }

  /** Mark explicit user desire to resume (cancels pending pause fade). */
  function markUserCancelPause(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    const s = states.get(video) || getState(video);
    if (s.pauseIntent || s.pauseHold || (s.fading && s.direction === "out")) {
      s.userCancelPause = true;
    }
  }

  /** Mark that the user asked to pause (Space / click while playing). */
  function markUserPauseHold(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    const s = getState(video);
    // Second deliberate press during fade-out → resume. Ignore leftover
    // synthetic clicks from the same tap that started the pause (mobile).
    if (s.pauseIntent || (s.fading && s.direction === "out")) {
      const started = pauseGestureAt.get(video) || 0;
      if (performance.now() - started < 450) return;
      s.userCancelPause = true;
      return;
    }
    s.pauseHold = true;
    s.userCancelPause = false;
  }

  /** Decide pause vs resume from a user play/pause control gesture. */
  function notePlayPauseGesture(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    const s = getState(video);
    if (video.paused) {
      markUserCancelPause(video);
      return;
    }
    if (s.pauseIntent || (s.fading && s.direction === "out")) {
      const started = pauseGestureAt.get(video) || 0;
      // Same tap: YouTube already called pause(); the trailing click must not cancel.
      if (performance.now() - started < 450) return;
      markUserCancelPause(video);
      return;
    }
    markUserPauseHold(video);
  }

  /** True when the user is typing in a field — do not treat as player hotkeys. */
  function isEditableTarget(event) {
    const t = event.target;
    if (!(t instanceof Element)) return false;
    if (t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) {
      return true;
    }
    if (t.closest("#contenteditable-root, .yt-formatted-string[contenteditable]")) return true;
    const ae = document.activeElement;
    if (ae instanceof HTMLElement) {
      const tag = ae.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (ae.isContentEditable) return true;
    }
    return false;
  }

  const PLAY_TOGGLE_UI = [
    ".ytp-play-button",
    ".ytp-large-play-button",
    ".ytp-center-controls",
    ".ytp-center-button",
    ".ytp-bezel",
    ".ytp-button[aria-label*='Play' i]",
    ".ytp-button[aria-label*='Pause' i]",
    "button[aria-label*='Play' i]",
    "button[aria-label*='Pause' i]",
    "button[aria-label*='再生' i]",
    "button[aria-label*='一時停止' i]",
    "button[aria-label*='停止' i]",
    "[aria-label*='Pause' i]",
    "[aria-label*='Play' i]",
    "[aria-label*='一時停止' i]",
    "[aria-label*='再生' i]",
    "[data-uia*='play-pause']",
    ".atvwebplayersdk-playpause-button",
    "video",
  ].join(", ");

  function videoFromUiEvent(event) {
    const t = event.target;
    if (!(t instanceof Element)) return null;
    const host = t.closest(PLAYER_HOST);
    const fromHost = host && host.querySelector && host.querySelector("video");
    const fromSelf = t.closest("video");
    const video = fromHost || fromSelf || findMainVideo();
    return video instanceof HTMLVideoElement && isMainVideo(video) ? video : null;
  }

  document.addEventListener(
    "click",
    (event) => {
      const t = event.target;
      if (!(t instanceof Element) || !t.closest(PLAY_TOGGLE_UI)) return;
      const video = videoFromUiEvent(event);
      if (!video) return;
      notePlayPauseGesture(video);
    },
    true
  );

  // Mobile: prefer touch/pointer over mouse-only (Qiita: Orion/iOS may not synthesize click).
  function onPlayTogglePointer(event) {
    const t = event.target;
    if (!(t instanceof Element) || !t.closest(PLAY_TOGGLE_UI)) return;
    const video = videoFromUiEvent(event);
    if (!video) return;
    notePlayPauseGesture(video);
  }
  document.addEventListener("pointerup", onPlayTogglePointer, true);
  document.addEventListener("touchend", onPlayTogglePointer, { capture: true, passive: true });

  document.addEventListener(
    "keydown",
    (event) => {
      if (isEditableTarget(event)) return;
      if (event.key !== "k" && event.key !== "K" && event.code !== "Space") return;
      const video = findMainVideo();
      if (!(video instanceof HTMLVideoElement)) return;
      notePlayPauseGesture(video);
    },
    true
  );

  // Progress-bar / keyboard / touch seeks: YouTube pauses briefly then plays again.
  // Keep this narrow — broad selectors (e.g. player-controls-content) falsely arm
  // seek-guard on play/pause taps and skip the fade on m.youtube.com.
  const SEEK_UI = [
    ".ytp-progress-bar",
    ".ytp-progress-bar-container",
    ".ytp-scrubber-button",
    ".ytp-scrubber-container",
    ".ytp-chapter-hover-container",
    ".ytp-timed-markers-container",
    ".ytm-progress-bar",
    ".progress-bar",
    ".scrubber",
    "[class*='progress-bar-']",
    "[class*='scrubber-']",
    "[data-uia='timeline']",
    ".atvwebplayersdk-seekbar-container",
    "[class*='seekbar']",
    "[class*='SeekBar']",
    "[class*='seek-bar']",
  ].join(", ");

  function mainVideoFromEvent(event) {
    const video = videoFromUiEvent(event);
    if (video) return video;
    const fallback = findMainVideo();
    return fallback instanceof HTMLVideoElement && isMainVideo(fallback) ? fallback : null;
  }

  function armSeekFromUi(event) {
    const t = event.target;
    if (!(t instanceof Element) || !t.closest(SEEK_UI)) return;
    const video = mainVideoFromEvent(event);
    if (!video) return;
    armSeekGuard(video, getState(video), 1500);
  }

  // Desktop: unlock AudioContext on first gesture. Orion/iOS: never attach GainNode.
  function warmAudioFromGesture() {
    const video = findMainVideo();
    if (!(video instanceof HTMLVideoElement)) return;
    const s = getState(video);
    resolveTapMode(video, s);
    if (s.tapMode === "gain") {
      ensureGain(video, s);
      resumeCtx(s.ctx);
    }
  }
  document.addEventListener("pointerdown", warmAudioFromGesture, true);
  document.addEventListener("touchstart", warmAudioFromGesture, { capture: true, passive: true });
  document.addEventListener("touchend", warmAudioFromGesture, { capture: true, passive: true });
  document.addEventListener("keydown", warmAudioFromGesture, true);
  document.addEventListener("pointerdown", armSeekFromUi, true);
  document.addEventListener("touchstart", armSeekFromUi, { capture: true, passive: true });

  document.addEventListener(
    "keydown",
    (event) => {
      if (isEditableTarget(event)) return;
      const seekKeys = new Set([
        "ArrowLeft",
        "ArrowRight",
        "j",
        "J",
        "l",
        "L",
        ",",
        ".",
        "Home",
        "End",
      ]);
      if (!seekKeys.has(event.key)) return;
      const video = findMainVideo();
      if (!(video instanceof HTMLVideoElement)) return;
      armSeekGuard(video, getState(video), 1000);
    },
    true
  );

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function hookSeek(video, s) {
    if (s.seekHooked) return;
    s.seekHooked = true;

    video.addEventListener("encrypted", () => {
      s.gainBlocked = true;
      if (s.tapMode === "gain") s.tapMode = "volume";
    });

    video.addEventListener("timeupdate", () => {
      if (!s.fading) s.lastTime = video.currentTime;
    });

    video.addEventListener("seeking", () => {
      s.seekFrom = s.lastTime;
      armSeekGuard(video, s, 1000);
    });

    video.addEventListener("seeked", () => {
      s.seeking = false;
      s.seekGuardUntil = performance.now() + 700;
      abortPauseFade(video, s);

      const delta = Math.abs(video.currentTime - (s.seekFrom || 0));
      s.lastTime = video.currentTime;
      s.pendingSeekFade =
        seekFadeOn() && isMainVideo(video) && !video.muted && delta >= 0.35;

      if (!s.pendingSeekFade) return;
      if (video.paused) return; // play() after seek will pick this up

      rememberVolumes(video, s);
      s.pendingSeekFade = false;
      runFadeIn(video, s, "seek");
    });
  }

  function shouldFadeMedia(video) {
    if (!(video instanceof HTMLVideoElement)) return false;
    if (!fadeOutOn() && !fadeInOn() && !seekFadeOn()) return false;
    if (isMainVideo(video)) return true;
    // m.youtube sometimes omits classic player classes; still fade non-preview videos.
    if (isMobileSite() && !isPreviewVideo(video)) return true;
    return false;
  }

  function patchedPause(...args) {
    if (!(this instanceof HTMLVideoElement)) {
      return nativePause.apply(this, args);
    }

    const s = getState(this);

    // Re-entrant path from finishPause / enforce — always native pause.
    if (s.hardPausing) {
      return nativePause.apply(this, args);
    }

    if (this.paused) {
      return nativePause.apply(this, args);
    }

    // Never fade non-player / preview clips
    if (!shouldFadeMedia(this) || !fadeOutOn()) {
      const reason = !fadeOutOn()
        ? "fadeOut off"
        : isPreviewVideo(this)
          ? "preview"
          : "not main";
      showHud("SKIP fade-out", `${reason} class=${String(this.className || "").slice(0, 60)}`);
      try {
        console.debug("[PRF] skip fade-out", {
          isMain: isMainVideo(this),
          preview: isPreviewVideo(this),
          fadeOutOn: fadeOutOn(),
          className: this.className,
        });
      } catch {
        /* ignore */
      }
      s.pauseHold = true;
      return nativePause.apply(this, args);
    }

    if (inSeekGuard(s)) {
      showHud("SKIP fade-out", "seek-guard");
      abortPauseFade(this, s);
      return nativePause.apply(this, args);
    }

    // Already fading out / holding pause — do not start another fade;
    // still ensure native pause if enforce is mid-flight.
    if (s.pauseIntent || (s.fading && s.direction === "out")) {
      return;
    }

    startFadeOut(this, () => nativePause.apply(this, args));
  }

  function patchedPlay(...args) {
    if (!(this instanceof HTMLVideoElement)) {
      return nativePlay.apply(this, args);
    }
    if (!shouldFadeMedia(this)) {
      return nativePlay.apply(this, args);
    }

    const s = getState(this);

    if (s.hardPausing) {
      return Promise.resolve();
    }

    // After/during seek: always allow resume (do not swallow play)
    if (inSeekGuard(s)) {
      abortPauseFade(this, s);
      const result = nativePlay.apply(this, args);
      if (s.pendingSeekFade && seekFadeOn() && !this.muted) {
        s.pendingSeekFade = false;
        rememberVolumes(this, s);
        const start = () => runFadeIn(this, s, "seek");
        if (result && typeof result.then === "function") {
          result.then(start, () => {
            applyLevel(this, s, 1);
          });
        } else {
          start();
        }
      }
      return result;
    }

    // User requested pause — block YouTube's spurious play() until they cancel.
    if (shouldBlockPlay(s) && !this.paused) {
      if (s.userCancelPause && fadeInOn()) {
        clearWatchdog(s);
        clearEnforce(s);
        const from = currentAmp(s);
        clearFadeTimer(s);
        s.pauseIntent = false;
        s.pauseHold = false;
        s.userCancelPause = false;
        s.fading = true;
        s.direction = "in";
        fade(this, s, from, 1, settings.fadeInMs, () => {
          applyLevel(this, s, 1);
          s.fading = false;
          s.direction = null;
        });
        return Promise.resolve();
      }
      if (s.userCancelPause && !fadeInOn()) {
        clearWatchdog(s);
        clearEnforce(s);
        clearFadeTimer(s);
        applyLevel(this, s, 1);
        s.fading = false;
        s.direction = null;
        s.pauseIntent = false;
        s.pauseHold = false;
        s.userCancelPause = false;
        return nativePlay.apply(this, args);
      }
      // Keep forcing pause; do not let play win the race.
      applyLevel(this, s, 0);
      forceNativePause(this);
      return Promise.resolve();
    }

    if (shouldBlockPlay(s) && this.paused && !s.userCancelPause) {
      // YouTube tried to resume after we paused — stay paused.
      applyLevel(this, s, 0);
      return Promise.resolve();
    }

    if (!this.paused) return nativePlay.apply(this, args);
    if (!fadeInOn()) {
      s.pauseHold = false;
      s.pauseIntent = false;
      restoreFullVolume(this, s);
      return nativePlay.apply(this, args);
    }
    if (s.fading && (s.direction === "in" || s.direction === "seek")) {
      return nativePlay.apply(this, args);
    }

    resolveTapMode(this, s);
    if (s.tapMode === "gain") {
      ensureGain(this, s);
      resumeCtx(s.ctx);
    }
    rememberVolumes(this, s);
    s.pauseHold = false;
    s.pauseIntent = false;
    applyLevel(this, s, 0);

    const result = nativePlay.apply(this, args);
    const runIn = () => runFadeIn(this, s, "in");

    if (result && typeof result.then === "function") {
      return result.then(
        (v) => {
          runIn();
          return v;
        },
        (err) => {
          applyLevel(this, s, 1);
          s.fading = false;
          s.direction = null;
          throw err;
        }
      );
    }
    runIn();
    return result;
  }

  function installMediaPatches() {
    HTMLMediaElement.prototype.pause = patchedPause;
    HTMLMediaElement.prototype.play = patchedPlay;
  }

  /** Bind pause/play on the element itself — m.youtube sometimes bypasses the prototype. */
  function hookVideoElement(video) {
    if (!(video instanceof HTMLVideoElement)) return;
    if (!shouldFadeMedia(video) && !isMainVideo(video)) return;
    const s = getState(video);
    try {
      video.pause = function (...args) {
        return patchedPause.apply(this, args);
      };
      video.play = function (...args) {
        return patchedPlay.apply(this, args);
      };
      s.elementHooked = true;
    } catch {
      /* ignore non-configurable */
    }
    resolveTapMode(video, s);
    if (s.tapMode === "gain" && !s.gainOk) ensureGain(video, s);
  }

  installMediaPatches();

  function hookPlayer(player) {
    if (!player || hookedPlayers.has(player)) return;
    if (typeof player.pauseVideo !== "function" || typeof player.playVideo !== "function") {
      return;
    }
    hookedPlayers.add(player);

    const origPause = player.pauseVideo.bind(player);
    const origPlay = player.playVideo.bind(player);

    player.pauseVideo = function () {
      const video =
        player.querySelector?.("video") || findMainVideo();
      if (!(video instanceof HTMLVideoElement)) return origPause();

      const s = getState(video);
      if (s.hardPausing) return origPause();
      if (video.paused) return origPause();
      if (!shouldFadeMedia(video) || !fadeOutOn()) {
        s.pauseHold = true;
        return origPause();
      }

      if (inSeekGuard(s)) {
        abortPauseFade(video, s);
        return origPause();
      }
      if (s.pauseIntent || (s.fading && s.direction === "out")) return;

      startFadeOut(video, () => {
        s.hardPausing = true;
        try {
          origPause();
        } finally {
          s.hardPausing = false;
        }
      });
    };

    player.playVideo = function () {
      const video =
        player.querySelector?.("video") || findMainVideo();
      if (!(video instanceof HTMLVideoElement)) return origPlay();
      if (!shouldFadeMedia(video)) return origPlay();

      const s = getState(video);
      if (s.hardPausing) return;

      if (inSeekGuard(s)) {
        abortPauseFade(video, s);
        const ret = origPlay();
        if (s.pendingSeekFade && seekFadeOn() && !video.muted) {
          s.pendingSeekFade = false;
          rememberVolumes(video, s);
          runFadeIn(video, s, "seek");
        }
        return ret;
      }

      if (shouldBlockPlay(s)) {
        if (s.userCancelPause && fadeInOn()) {
          clearWatchdog(s);
          clearEnforce(s);
          const from = currentAmp(s);
          clearFadeTimer(s);
          s.pauseIntent = false;
          s.pauseHold = false;
          s.userCancelPause = false;
          s.fading = true;
          s.direction = "in";
          fade(video, s, from, 1, settings.fadeInMs, () => {
            applyLevel(video, s, 1);
            s.fading = false;
            s.direction = null;
          });
          return;
        }
        if (s.userCancelPause && !fadeInOn()) {
          clearWatchdog(s);
          clearEnforce(s);
          clearFadeTimer(s);
          applyLevel(video, s, 1);
          s.fading = false;
          s.direction = null;
          s.pauseIntent = false;
          s.pauseHold = false;
          s.userCancelPause = false;
          return origPlay();
        }
        applyLevel(video, s, 0);
        forceNativePause(video);
        return;
      }

      if (!video.paused) return origPlay();
      if (!fadeInOn()) {
        s.pauseHold = false;
        s.pauseIntent = false;
        restoreFullVolume(video, s);
        return origPlay();
      }

      resolveTapMode(video, s);
      if (s.tapMode === "gain") {
        ensureGain(video, s);
        resumeCtx(s.ctx);
      }
      rememberVolumes(video, s);
      s.pauseHold = false;
      s.pauseIntent = false;
      applyLevel(video, s, 0);
      const ret = origPlay();
      runFadeIn(video, s, "in");
      return ret;
    };
  }

  let announcedReady = false;

  function announceReady(video) {
    if (!debugHudOn() || announcedReady || !(video instanceof HTMLVideoElement)) return;
    const s = getState(video);
    resolveTapMode(video, s);
    announcedReady = true;
    showHud(
      "READY",
      `host=${location.hostname} tap=${s.tapMode} fade=${shouldFadeMedia(video) ? "yes" : "no"}`
    );
  }

  function scan() {
    installMediaPatches();
    const player = getPlayer();
    if (player) hookPlayer(player);

    const main = findMainVideo();
    if (main) {
      hookVideoElement(main);
      announceReady(main);
    }

    document
      .querySelectorAll(
        "video.html5-main-video, #movie_player video, .html5-video-player video, .player-container video, ytm-player video, #player video, ytd-player video, video"
      )
      .forEach((el) => {
        if (!(el instanceof HTMLVideoElement)) return;
        if (!isMainVideo(el)) return;
        hookVideoElement(el);
      });
  }

  /** New navigation / video load should not inherit a previous pause hold. */
  function clearPauseLocks() {
    announcedReady = false;
    document
      .querySelectorAll(
        "video.html5-main-video, #movie_player video, .html5-video-player video, .player-container video, ytm-player video, #player video, ytd-player video, video"
      )
      .forEach((el) => {
        if (!(el instanceof HTMLVideoElement)) return;
        const s = states.get(el);
        if (!s) return;
        clearWatchdog(s);
        clearEnforce(s);
        s.pauseHold = false;
        s.pauseIntent = false;
        s.userCancelPause = false;
        s.hardPausing = false;
      });
  }

  let scanTimer = 0;
  const mo = new MutationObserver(() => {
    if (scanTimer) return;
    scanTimer = window.setTimeout(() => {
      scanTimer = 0;
      scan();
    }, 200);
  });

  function start() {
    scan();
    syncDebugCorner();
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // YouTube mobile may overwrite prototype methods after load — reassert periodically.
    window.setInterval(installMediaPatches, 1500);
    window.setInterval(() => {
      const main = findMainVideo();
      if (main) hookVideoElement(main);
      syncDebugCorner();
    }, 2000);
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  window.addEventListener("yt-navigate-start", clearPauseLocks);
  window.addEventListener("yt-navigate-finish", () => {
    clearPauseLocks();
    scan();
  });
  window.addEventListener("yt-page-data-updated", scan);
  window.addEventListener("yt-player-updated", scan);
  window.addEventListener("popstate", () => {
    clearPauseLocks();
    scan();
  });

  // Console helper: run `__PRF__()` on m.youtube.com to diagnose.
  try {
    window.__PRF__ = function prfDebug() {
      const video = findMainVideo();
      const s = video ? states.get(video) : null;
      const pauseStr = Function.prototype.toString.call(HTMLMediaElement.prototype.pause);
      return {
        version: "1.4.1",
        href: location.href,
        settings,
        fadeOutOn: fadeOutOn(),
        fadeInOn: fadeInOn(),
        debugHud: debugHudOn(),
        isMobileSite: isMobileSite(),
        eme: video ? isEmeLikely(video) : isEmeLikely(null),
        webkit: isWebKitLike(),
        tapMode: s && s.tapMode,
        shouldFade: video ? shouldFadeMedia(video) : false,
        video: video && {
          className: video.className,
          paused: video.paused,
          width: video.clientWidth,
          isMain: isMainVideo(video),
          elementPauseName: video.pause && video.pause.name,
        },
        state: s && {
          gainOk: s.gainOk,
          gainBlocked: s.gainBlocked,
          pauseHold: s.pauseHold,
          pauseIntent: s.pauseIntent,
          fading: s.fading,
          direction: s.direction,
          elementHooked: s.elementHooked,
        },
        protoPausePatched: HTMLMediaElement.prototype.pause === patchedPause,
        pauseLooksPatched: /startFadeOut|pauseHold|patchedPause/i.test(pauseStr),
      };
    };
    /** Session-only: turn on-screen debug without popup (does not persist). */
    window.__PRF__.setDebug = function setDebug(on) {
      settings = sanitizeSettings({ ...settings, debugHud: Boolean(on) });
      syncDebugCorner();
      if (on) showHud("DEBUG ON", "session only — use popup to persist");
      return window.__PRF__();
    };
  } catch {
    /* ignore */
  }
})();
