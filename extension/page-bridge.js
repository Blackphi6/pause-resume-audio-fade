(() => {
  "use strict";

  /**
   * Isolated world ↔ MAIN world bridge.
   * Token = chrome.runtime.id (not guessable by normal page JS).
   * Push-only CustomEvents — page cannot request a settings dump.
   */
  const TOKEN = chrome.runtime.id;
  const EVENT_SETTINGS = `__prf_settings_${TOKEN}`;
  const EVENT_HUD = `__prf_hud_${TOKEN}`;
  const ATTR = "data-prf-k";
  const CHIP_ID = "prf_mobile_chip";
  const TOAST_ID = "prf_mobile_toast";

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
  const PREF_KEYS = [...BOOL_KEYS, ...MS_KEYS];
  const LEGACY_DURATION = Object.freeze({ fadeOutMs: 800, fadeInMs: 1000 });

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

  // Hand token to MAIN world before page scripts run, then MAIN deletes it.
  try {
    document.documentElement.setAttribute(ATTR, TOKEN);
  } catch {
    /* ignore */
  }

  function publish(settings) {
    const clean = sanitizeSettings(settings);
    try {
      window.dispatchEvent(
        new CustomEvent(EVENT_SETTINGS, {
          detail: Object.freeze({ v: 1, settings: clean }),
        })
      );
    } catch {
      /* ignore */
    }
  }

  function resolveSettings(stored) {
    const next = { ...sanitizeSettings(stored) };

    if (!hasOwn(stored, "fadeOutEnabled") && typeof stored.enabled === "boolean") {
      next.fadeOutEnabled = stored.enabled;
      next.fadeInEnabled = stored.enabled;
      next.seekFadeInEnabled = stored.enabled;
      chrome.storage.local.set({
        fadeOutEnabled: next.fadeOutEnabled,
        fadeInEnabled: next.fadeInEnabled,
        seekFadeInEnabled: next.seekFadeInEnabled,
      });
    }

    if (
      stored.fadeOutMs === LEGACY_DURATION.fadeOutMs &&
      stored.fadeInMs === LEGACY_DURATION.fadeInMs
    ) {
      next.fadeOutMs = DEFAULTS.fadeOutMs;
      next.fadeInMs = DEFAULTS.fadeInMs;
      chrome.storage.local.set({
        fadeOutMs: DEFAULTS.fadeOutMs,
        fadeInMs: DEFAULTS.fadeInMs,
      });
    }

    return sanitizeSettings(next);
  }

  let lastPublishJson = "";
  function publishFromLocal() {
    chrome.storage.local.get(DEFAULTS, (stored) => {
      const clean = resolveSettings(stored);
      const json = JSON.stringify(clean);
      if (json === lastPublishJson) return; // avoid noisy re-broadcasts
      lastPublishJson = json;
      publish(clean);
    });
  }

  function migrateFromSyncOnce() {
    chrome.storage.local.get({ _prefsMigrated: false }, (meta) => {
      if (meta._prefsMigrated) {
        publishFromLocal();
        return;
      }

      chrome.storage.sync.get(PREF_KEYS, (synced) => {
        const finish = () => {
          chrome.storage.sync.clear(() => {
            chrome.storage.local.set({ _prefsMigrated: true }, publishFromLocal);
          });
        };

        if (chrome.runtime.lastError) {
          chrome.storage.local.set({ _prefsMigrated: true }, publishFromLocal);
          return;
        }

        const hasAny = PREF_KEYS.some((k) => hasOwn(synced, k));
        if (!hasAny) {
          finish();
          return;
        }
        chrome.storage.local.set(sanitizeSettings(synced), finish);
      });
    });
  }

  migrateFromSyncOnce();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    publishFromLocal();
  });

  // Re-push when MAIN asks via a token-bound event (not a public postMessage).
  window.addEventListener(`__prf_hello_${TOKEN}`, () => {
    lastPublishJson = "";
    publishFromLocal();
  });

  /**
   * Orion-safe HUD: isolated world injects into YouTube's mobile topbar
   * (same approach as Music Mode for YouTube), not a MAIN-world overlay.
   */
  let hudEnabled = false;
  let toastTimer = 0;
  let chipPoll = 0;

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast) return toast;
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    (document.documentElement || document.body).appendChild(toast);
    return toast;
  }

  function showIsolatedToast(title, detail) {
    if (!hudEnabled) return;
    const toast = ensureToast();
    toast.textContent = detail ? `${title}\n${detail}` : title;
    toast.style.display = "block";
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.style.display = "none";
      toastTimer = 0;
    }, 2400);
    const chip = document.getElementById(CHIP_ID);
    if (chip) {
      const state = /skip/i.test(title) ? "skip" : /in/i.test(title) ? "in" : "out";
      chip.setAttribute("data-state", state);
      chip.textContent = /skip/i.test(title) ? "SKIP" : /in/i.test(title) ? "IN" : "OUT";
    }
  }

  function placeChip() {
    if (!hudEnabled) {
      document.getElementById(CHIP_ID)?.remove();
      document.getElementById(TOAST_ID)?.remove();
      return true;
    }
    if (document.getElementById(CHIP_ID)) return true;

    const hosts = [
      ".mobile-topbar-header div.mobile-topbar-header-content",
      ".mobile-topbar-header",
      "ytm-mobile-topbar-renderer",
      "ytd-masthead #end",
      "#masthead-container #end",
    ];
    let host = null;
    for (const sel of hosts) {
      host = document.querySelector(sel);
      if (host) break;
    }
    // YouTube はトップバー待ち。他サイトは body へ固定配置。
    if (!host) {
      if (/(?:^|\.)youtube(?:-nocookie)?\.com$/i.test(location.hostname || "")) return false;
      host = document.body || document.documentElement;
    }
    if (!host) return false;

    const chip = document.createElement("div");
    chip.id = CHIP_ID;
    chip.className = "icon-button topbar-menu-button-avatar-button";
    chip.textContent = "PRF";
    chip.title = "Pause Resume Audio Fade debug";
    host.insertBefore(chip, host.lastElementChild || null);

    new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.removedNodes.forEach((n) => {
          if (n && n.id === CHIP_ID) placeChip();
        });
      }
    }).observe(host, { childList: true, subtree: true });
    return true;
  }

  function startChipLoop() {
    if (chipPoll) return;
    let n = 0;
    chipPoll = window.setInterval(() => {
      n += 1;
      if (placeChip() || n >= 80) {
        window.clearInterval(chipPoll);
        chipPoll = 0;
      }
    }, 500);
  }

  function setHudEnabled(on) {
    hudEnabled = Boolean(on);
    if (hudEnabled) {
      startChipLoop();
      placeChip();
      showIsolatedToast("PRF debug", "isolated HUD ready");
    } else {
      if (chipPoll) {
        window.clearInterval(chipPoll);
        chipPoll = 0;
      }
      document.getElementById(CHIP_ID)?.remove();
      document.getElementById(TOAST_ID)?.remove();
    }
  }

  chrome.storage.local.get({ debugHud: false }, (stored) => {
    setHudEnabled(stored.debugHud);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.debugHud) return;
    setHudEnabled(changes.debugHud.newValue);
  });

  window.addEventListener(EVENT_HUD, (event) => {
    const detail = event && event.detail;
    if (!detail || detail.v !== 1) return;
    showIsolatedToast(String(detail.title || "PRF"), detail.note || "");
  });
})();
