const DEFAULTS = {
  enabled: true,
  fadeOutEnabled: true,
  fadeInEnabled: true,
  seekFadeInEnabled: true,
  fadeOutMs: 350,
  fadeInMs: 300,
};

const LEGACY_DURATION = { fadeOutMs: 800, fadeInMs: 1000 };

function t(key, fallback) {
  try {
    const msg = chrome.i18n.getMessage(key);
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return fallback || "";
}

const MS_UNIT = t("unitMs", "ms");

/** Apply localized strings to [data-i18n] elements and document metadata. */
function applyI18n() {
  const uiLang = (chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || "en";
  document.documentElement.setAttribute("lang", uiLang);
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    const msg = t(key, el.textContent.trim());
    if (!msg) continue;
    if (key === "extName") {
      document.title = msg;
    } else {
      el.textContent = msg;
    }
  }
}

const enabledEl = document.getElementById("enabled");
const fadeOutEnabledEl = document.getElementById("fadeOutEnabled");
const fadeInEnabledEl = document.getElementById("fadeInEnabled");
const seekFadeInEnabledEl = document.getElementById("seekFadeInEnabled");
const fadeOutEl = document.getElementById("fadeOutMs");
const fadeInEl = document.getElementById("fadeInMs");
const fadeOutLabel = document.getElementById("fadeOutLabel");
const fadeInLabel = document.getElementById("fadeInLabel");
const fadeOutSection = document.getElementById("fadeOutSection");
const fadeInSection = document.getElementById("fadeInSection");
const seekSection = document.getElementById("seekSection");

function clampMs(n) {
  return Math.min(3000, Math.max(100, Math.round(Number(n) || 0)));
}

function formatMs(ms) {
  return `${ms} ${MS_UNIT}`;
}

function syncLabels() {
  fadeOutLabel.textContent = formatMs(Number(fadeOutEl.value));
  fadeInLabel.textContent = formatMs(Number(fadeInEl.value));
}

function syncDisabled() {
  const master = enabledEl.checked;
  for (const section of [fadeOutSection, fadeInSection, seekSection]) {
    section.classList.toggle("is-dimmed", !master);
  }
  fadeOutEnabledEl.disabled = !master;
  fadeInEnabledEl.disabled = !master;
  seekFadeInEnabledEl.disabled = !master;
  fadeOutEl.disabled = !master || !fadeOutEnabledEl.checked;
  fadeInEl.disabled = !master || !fadeInEnabledEl.checked;
}

/** Persist only whitelisted preference keys (no PII). */
function save() {
  chrome.storage.local.set({
    enabled: Boolean(enabledEl.checked),
    fadeOutEnabled: Boolean(fadeOutEnabledEl.checked),
    fadeInEnabled: Boolean(fadeInEnabledEl.checked),
    seekFadeInEnabled: Boolean(seekFadeInEnabledEl.checked),
    fadeOutMs: clampMs(fadeOutEl.value),
    fadeInMs: clampMs(fadeInEl.value),
  });
}

function applyStored(stored) {
  let fadeOutMs = clampMs(stored.fadeOutMs ?? DEFAULTS.fadeOutMs);
  let fadeInMs = clampMs(stored.fadeInMs ?? DEFAULTS.fadeInMs);

  if (
    stored.fadeOutMs === LEGACY_DURATION.fadeOutMs &&
    stored.fadeInMs === LEGACY_DURATION.fadeInMs
  ) {
    fadeOutMs = DEFAULTS.fadeOutMs;
    fadeInMs = DEFAULTS.fadeInMs;
    chrome.storage.local.set({ fadeOutMs, fadeInMs });
  }

  let fadeOutEnabled = stored.fadeOutEnabled;
  let fadeInEnabled = stored.fadeInEnabled;
  let seekFadeInEnabled = stored.seekFadeInEnabled;

  if (typeof fadeOutEnabled !== "boolean" && typeof stored.enabled === "boolean") {
    fadeOutEnabled = stored.enabled;
    fadeInEnabled = stored.enabled;
    seekFadeInEnabled = stored.enabled;
  }

  enabledEl.checked = typeof stored.enabled === "boolean" ? stored.enabled : DEFAULTS.enabled;
  fadeOutEnabledEl.checked =
    typeof fadeOutEnabled === "boolean" ? fadeOutEnabled : DEFAULTS.fadeOutEnabled;
  fadeInEnabledEl.checked =
    typeof fadeInEnabled === "boolean" ? fadeInEnabled : DEFAULTS.fadeInEnabled;
  seekFadeInEnabledEl.checked =
    typeof seekFadeInEnabled === "boolean" ? seekFadeInEnabled : DEFAULTS.seekFadeInEnabled;
  fadeOutEl.value = String(fadeOutMs);
  fadeInEl.value = String(fadeInMs);
  syncLabels();
  syncDisabled();
}

function sanitizePrefs(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["enabled", "fadeOutEnabled", "fadeInEnabled", "seekFadeInEnabled"]) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  for (const key of ["fadeOutMs", "fadeInMs"]) {
    if (typeof raw[key] === "number" && Number.isFinite(raw[key])) {
      out[key] = clampMs(raw[key]);
    }
  }
  return out;
}

function loadPrefs() {
  const PREF_KEYS = [
    "enabled",
    "fadeOutEnabled",
    "fadeInEnabled",
    "seekFadeInEnabled",
    "fadeOutMs",
    "fadeInMs",
  ];

  chrome.storage.local.get({ ...DEFAULTS, _prefsMigrated: false }, (stored) => {
    if (stored._prefsMigrated) {
      applyStored(sanitizePrefs(stored));
      return;
    }

    chrome.storage.sync.get(PREF_KEYS, (synced) => {
      const done = (prefs) => {
        chrome.storage.sync.clear(() => {
          chrome.storage.local.set({ ...prefs, _prefsMigrated: true }, () =>
            applyStored(prefs)
          );
        });
      };

      if (chrome.runtime.lastError) {
        done(sanitizePrefs(stored));
        return;
      }

      const hasAny = PREF_KEYS.some((k) => Object.prototype.hasOwnProperty.call(synced, k));
      done(hasAny ? sanitizePrefs(synced) : sanitizePrefs(stored));
    });
  });
}

applyI18n();
loadPrefs();

enabledEl.addEventListener("change", () => {
  syncDisabled();
  save();
});

for (const el of [fadeOutEnabledEl, fadeInEnabledEl, seekFadeInEnabledEl]) {
  el.addEventListener("change", () => {
    syncDisabled();
    save();
  });
}

fadeOutEl.addEventListener("input", () => {
  syncLabels();
  save();
});
fadeInEl.addEventListener("input", () => {
  syncLabels();
  save();
});
