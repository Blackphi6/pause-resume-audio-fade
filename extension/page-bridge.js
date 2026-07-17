(() => {
  "use strict";

  /**
   * Isolated world ↔ MAIN world bridge.
   * Token = chrome.runtime.id (not guessable by normal page JS).
   * Push-only CustomEvents — page cannot request a settings dump.
   */
  const TOKEN = chrome.runtime.id;
  const EVENT_SETTINGS = `__prf_settings_${TOKEN}`;
  const ATTR = "data-prf-k";

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
})();
