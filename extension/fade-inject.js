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

  const DEFAULTS = Object.freeze({
    enabled: true,
    fadeOutEnabled: true,
    fadeInEnabled: true,
    seekFadeInEnabled: true,
    fadeOutMs: 350,
    fadeInMs: 300,
  });

  const BOOL_KEYS = ["enabled", "fadeOutEnabled", "fadeInEnabled", "seekFadeInEnabled"];
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

  /**
   * @typedef {{
   *   fading: boolean,
   *   direction: "out" | "in" | "seek" | null,
   *   pauseIntent: boolean,
   *   userCancelPause: boolean,
   *   userVolume: number,
   *   userPlayerVolume: number,
   *   gain: GainNode | null,
   *   ctx: AudioContext | null,
   *   gainOk: boolean,
   *   triedGain: boolean,
   *   timer: number,
   *   watchdog: number,
   *   lastTime: number,
   *   seekFrom: number,
   *   seekHooked: boolean,
   *   seeking: boolean,
   *   seekGuardUntil: number,
   *   pendingSeekFade: boolean,
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
      document.querySelector(".html5-video-player");
    if (el && typeof el.getVolume === "function") return el;
    return null;
  }

  /** @param {HTMLVideoElement} video */
  function getState(video) {
    let s = states.get(video);
    if (!s) {
      s = {
        fading: false,
        direction: null,
        pauseIntent: false,
        userCancelPause: false,
        userVolume: video.muted ? 1 : video.volume || 1,
        userPlayerVolume: 100,
        gain: null,
        ctx: null,
        gainOk: false,
        triedGain: false,
        timer: 0,
        watchdog: 0,
        lastTime: video.currentTime || 0,
        seekFrom: 0,
        seekHooked: false,
        seeking: false,
        seekGuardUntil: 0,
        pendingSeekFade: false,
      };
      states.set(video, s);
      hookSeek(video, s);
    }
    return s;
  }

  /** @param {HTMLVideoElement} video */
  function isMainVideo(video) {
    if (video.classList.contains("html5-main-video")) return true;
    if (video.closest("#movie_player, .html5-video-player")) return true;
    return false;
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   */
  function ensureGain(video, s) {
    if (s.gainOk && s.gain && s.ctx) return true;
    if (!isMainVideo(video)) return false;
    if (s.triedGain && !s.gainOk) return false;
    s.triedGain = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      s.ctx = ctx;
      s.gain = gain;
      s.gainOk = true;
      return true;
    } catch {
      s.gain = null;
      s.ctx = null;
      s.gainOk = false;
      return false;
    }
  }

  /** @param {AudioContext | null} ctx */
  function resumeCtx(ctx) {
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {number} level01
   */
  function applyLevel(video, s, level01) {
    const amp = clamp01(level01);

    if (s.gainOk && s.gain && s.ctx) {
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

    if (s.gainOk && s.gain && s.ctx && durationMs > 0) {
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
    if (s.gainOk && s.gain && s.ctx) {
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

  /** @param {HTMLVideoElement} video @param {FadeState} s */
  function rememberVolumes(video, s) {
    if (s.fading || s.pauseIntent) return;
    const player = getPlayer();
    if (player && typeof player.getVolume === "function") {
      const v = player.getVolume();
      if (typeof v === "number" && v >= 5) s.userPlayerVolume = v;
    }
    if (!video.muted && video.volume > 0.05) s.userVolume = video.volume;
  }

  function currentAmp(s) {
    if (s.gainOk && s.gain) return s.gain.gain.value;
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
    if (!s.pauseIntent && !(s.fading && s.direction === "out")) return;
    clearWatchdog(s);
    clearFadeTimer(s);
    s.pauseIntent = false;
    s.userCancelPause = false;
    s.fading = false;
    s.direction = null;
    applyLevel(video, s, 1);
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
   * Finalize a requested pause: stop media and restore volume metadata.
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
    s.pauseIntent = false;
    s.userCancelPause = false;
    try {
      finishNative();
    } catch {
      /* ignore */
    }
    // Hard guarantee with the real native pause (not our patched one)
    if (!video.paused) {
      try {
        nativePause.call(video);
      } catch {
        /* ignore */
      }
    }
    if (!s.gainOk) {
      const player = getPlayer();
      if (player && typeof player.setVolume === "function") {
        player.setVolume(clamp100(s.userPlayerVolume));
      }
      try {
        video.volume = s.userVolume;
      } catch {
        /* ignore */
      }
    } else {
      applyLevel(video, s, 0);
    }
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {FadeState} s
   * @param {"in" | "seek"} kind
   */
  function runFadeIn(video, s, kind) {
    ensureGain(video, s);
    resumeCtx(s.ctx);
    clearFadeTimer(s);
    clearWatchdog(s);
    s.pauseIntent = false;
    s.userCancelPause = false;
    s.fading = true;
    s.direction = kind;
    applyLevel(video, s, 0);
    fade(video, s, 0, 1, settings.fadeInMs, () => {
      applyLevel(video, s, 1);
      s.fading = false;
      s.direction = null;
    });
  }

  const nativePause = HTMLMediaElement.prototype.pause;
  const nativePlay = HTMLMediaElement.prototype.play;

  /**
   * @param {HTMLVideoElement} video
   * @param {() => void} finishNative
   */
  function startFadeOut(video, finishNative) {
    if (!fadeOutOn()) {
      finishNative();
      return;
    }

    if (video.paused) {
      finishNative();
      return;
    }

    const s = getState(video);
    ensureGain(video, s);
    resumeCtx(s.ctx);
    rememberVolumes(video, s);

    // Already near silence (low volume / muted) — pause immediately
    const from = video.muted ? 0 : currentAmp(s);
    if (video.muted || from <= 0.04) {
      s.pauseIntent = true;
      finishPause(video, s, finishNative);
      return;
    }

    clearFadeTimer(s);
    clearWatchdog(s);
    s.fading = true;
    s.direction = "out";
    s.pauseIntent = true;
    s.userCancelPause = false;

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
    const s = states.get(video);
    if (s && s.pauseIntent) s.userCancelPause = true;
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

  document.addEventListener(
    "click",
    (event) => {
      const t = event.target;
      if (!(t instanceof Element)) return;
      if (!t.closest(".ytp-play-button, .ytp-large-play-button")) return;
      const host = t.closest("#movie_player, .html5-video-player");
      const video =
        (host && host.querySelector("video")) ||
        document.querySelector("video.html5-main-video");
      markUserCancelPause(video);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (isEditableTarget(event)) return;
      if (event.key !== "k" && event.key !== "K" && event.code !== "Space") return;
      const video = document.querySelector("video.html5-main-video");
      if (!(video instanceof HTMLVideoElement)) return;
      if (!video.paused) markUserCancelPause(video);
    },
    true
  );

  // Progress-bar / keyboard seeks: YouTube pauses briefly then plays again.
  const SEEK_UI =
    ".ytp-progress-bar, .ytp-progress-bar-container, .ytp-scrubber-button, .ytp-chapter-hover-container, .ytp-timed-markers-container";

  function mainVideoFromEvent(event) {
    const t = event.target;
    if (!(t instanceof Element)) return null;
    const host = t.closest("#movie_player, .html5-video-player");
    const video =
      (host && host.querySelector("video")) ||
      document.querySelector("video.html5-main-video");
    return video instanceof HTMLVideoElement ? video : null;
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      const t = event.target;
      if (!(t instanceof Element) || !t.closest(SEEK_UI)) return;
      const video = mainVideoFromEvent(event);
      if (!video) return;
      armSeekGuard(video, getState(video), 1500);
    },
    true
  );

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
      const video = document.querySelector("video.html5-main-video");
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

  HTMLMediaElement.prototype.pause = function patchedPause(...args) {
    if (!(this instanceof HTMLVideoElement) || this.paused) {
      return nativePause.apply(this, args);
    }
    // Never fade non-player / preview clips
    if (!isMainVideo(this) || !fadeOutOn()) {
      return nativePause.apply(this, args);
    }
    const s = getState(this);

    if (inSeekGuard(s)) {
      abortPauseFade(this, s);
      return nativePause.apply(this, args);
    }

    if (s.pauseIntent || (s.fading && s.direction === "out")) return;

    startFadeOut(this, () => nativePause.apply(this, args));
  };

  HTMLMediaElement.prototype.play = function patchedPlay(...args) {
    if (!(this instanceof HTMLVideoElement)) {
      return nativePlay.apply(this, args);
    }
    if (!isMainVideo(this)) {
      return nativePlay.apply(this, args);
    }

    const s = getState(this);

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

    if (s.pauseIntent && !this.paused) {
      if (s.userCancelPause && fadeInOn()) {
        clearWatchdog(s);
        const from = currentAmp(s);
        clearFadeTimer(s);
        s.pauseIntent = false;
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
        clearFadeTimer(s);
        applyLevel(this, s, 1);
        s.fading = false;
        s.direction = null;
        s.pauseIntent = false;
        s.userCancelPause = false;
        return nativePlay.apply(this, args);
      }
      return Promise.resolve();
    }

    if (!this.paused) return nativePlay.apply(this, args);
    if (!fadeInOn()) return nativePlay.apply(this, args);
    if (s.fading && (s.direction === "in" || s.direction === "seek")) {
      return nativePlay.apply(this, args);
    }

    ensureGain(this, s);
    resumeCtx(s.ctx);
    rememberVolumes(this, s);
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
  };

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
        player.querySelector?.("video") || document.querySelector("video.html5-main-video");
      if (!(video instanceof HTMLVideoElement) || video.paused) return origPause();
      if (!fadeOutOn()) return origPause();

      const s = getState(video);
      if (inSeekGuard(s)) {
        abortPauseFade(video, s);
        return origPause();
      }
      if (s.pauseIntent || (s.fading && s.direction === "out")) return;

      startFadeOut(video, () => origPause());
    };

    player.playVideo = function () {
      const video =
        player.querySelector?.("video") || document.querySelector("video.html5-main-video");
      if (!(video instanceof HTMLVideoElement)) return origPlay();

      const s = getState(video);

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

      if (s.pauseIntent && !video.paused) {
        if (s.userCancelPause && fadeInOn()) {
          clearWatchdog(s);
          const from = currentAmp(s);
          clearFadeTimer(s);
          s.pauseIntent = false;
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
          clearFadeTimer(s);
          applyLevel(video, s, 1);
          s.fading = false;
          s.direction = null;
          s.pauseIntent = false;
          s.userCancelPause = false;
          return origPlay();
        }
        return;
      }

      if (!video.paused) return origPlay();
      if (!fadeInOn()) return origPlay();

      ensureGain(video, s);
      resumeCtx(s.ctx);
      rememberVolumes(video, s);
      applyLevel(video, s, 0);
      const ret = origPlay();
      runFadeIn(video, s, "in");
      return ret;
    };
  }

  function scan() {
    const player = getPlayer();
    if (player) hookPlayer(player);

    document.querySelectorAll("video.html5-main-video, #movie_player video, .html5-video-player video").forEach((el) => {
      if (!(el instanceof HTMLVideoElement)) return;
      if (!isMainVideo(el)) return;
      const s = getState(el);
      if (!s.gainOk) ensureGain(el, s);
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
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });

  window.addEventListener("yt-navigate-finish", scan);
  window.addEventListener("yt-page-data-updated", scan);
  window.addEventListener("yt-player-updated", scan);
})();
