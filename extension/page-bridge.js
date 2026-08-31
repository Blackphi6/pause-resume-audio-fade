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
  const PANEL_ID = "prf_quick_panel";

  const DEFAULTS = Object.freeze({
    enabled: true,
    fadeOutEnabled: true,
    fadeInEnabled: true,
    seekFadeInEnabled: true,
    quickMenuEnabled: true,
    debugHud: false,
    fadeOutMs: 350,
    fadeInMs: 300,
  });

  const BOOL_KEYS = [
    "enabled",
    "fadeOutEnabled",
    "fadeInEnabled",
    "seekFadeInEnabled",
    "quickMenuEnabled",
    "debugHud",
  ];
  const MS_KEYS = ["fadeOutMs", "fadeInMs"];
  const PREF_KEYS = [...BOOL_KEYS, ...MS_KEYS];
  const LEGACY_DURATION = Object.freeze({ fadeOutMs: 800, fadeInMs: 1000 });

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function t(key, fallback) {
    try {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    } catch {
      /* ignore */
    }
    return fallback || "";
  }

  function sanitizeSettings(raw) {
    const out = {
      enabled: DEFAULTS.enabled,
      fadeOutEnabled: DEFAULTS.fadeOutEnabled,
      fadeInEnabled: DEFAULTS.fadeInEnabled,
      seekFadeInEnabled: DEFAULTS.seekFadeInEnabled,
      quickMenuEnabled: DEFAULTS.quickMenuEnabled,
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
   * Orion-safe HUD + quick-settings chip: isolated world injects into
   * YouTube's mobile topbar (same approach as Music Mode for YouTube), or a
   * fixed corner button on other sites, instead of a MAIN-world overlay that
   * WebKit can hide. The chip doubles as a tap target for the quick-settings
   * panel below, since a toolbar popup can be hard to reach on some mobile
   * browsers (e.g. Orion).
   */
  let hudEnabled = false; // debugHud: gates the fade-state color/text + toast
  let quickMenuEnabled = true; // gates chip existence + tap-to-open panel
  let toastTimer = 0;
  let chipPoll = 0;
  let panelEl = null;

  function chipShouldExist() {
    return hudEnabled || quickMenuEnabled;
  }

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

  function onChipActivate(event) {
    event.preventDefault();
    event.stopPropagation();
    togglePanel();
  }

  function placeChip() {
    if (!chipShouldExist()) {
      document.getElementById(CHIP_ID)?.remove();
      document.getElementById(TOAST_ID)?.remove();
      closePanel();
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
    chip.title = t("quickMenuChipTitle", "Open fade settings");
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.addEventListener("click", onChipActivate);
    chip.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") onChipActivate(event);
    });
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

  function refreshChip() {
    if (chipShouldExist()) {
      startChipLoop();
      placeChip();
    } else {
      if (chipPoll) {
        window.clearInterval(chipPoll);
        chipPoll = 0;
      }
      document.getElementById(CHIP_ID)?.remove();
      document.getElementById(TOAST_ID)?.remove();
      closePanel();
    }
  }

  chrome.storage.local.get({ debugHud: false, quickMenuEnabled: true }, (stored) => {
    hudEnabled = Boolean(stored.debugHud);
    quickMenuEnabled = stored.quickMenuEnabled !== false;
    refreshChip();
    if (hudEnabled) showIsolatedToast("PRF debug", "isolated HUD ready");
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let chipChanged = false;
    if (changes.debugHud) {
      hudEnabled = Boolean(changes.debugHud.newValue);
      chipChanged = true;
    }
    if (changes.quickMenuEnabled) {
      quickMenuEnabled = changes.quickMenuEnabled.newValue !== false;
      chipChanged = true;
    }
    if (chipChanged) refreshChip();
    if (panelEl) syncPanelFromStorage();
  });

  window.addEventListener(EVENT_HUD, (event) => {
    const detail = event && event.detail;
    if (!detail || detail.v !== 1) return;
    showIsolatedToast(String(detail.title || "PRF"), detail.note || "");
  });

  /**
   * On-page quick-settings panel: full parity with the toolbar popup, built
   * with plain DOM calls (no innerHTML) and backed by the same
   * chrome.storage.local keys, so it stays in sync with the popup for free.
   */

  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else node.setAttribute(k, v);
      }
    }
    for (const child of children) {
      if (child) node.appendChild(child);
    }
    return node;
  }

  function clampMs(n) {
    return Math.min(3000, Math.max(100, Math.round(Number(n) || 0)));
  }

  function formatMs(ms) {
    return `${ms} ${t("unitMs", "ms")}`;
  }

  function toggleRow(labelKey, labelFallback, key) {
    const input = el("input", { type: "checkbox" });
    input.dataset.k = key;
    const row = el(
      "label",
      { class: "prf-qp-row prf-qp-toggle" },
      el("span", { text: t(labelKey, labelFallback) }),
      input
    );
    return { row, input };
  }

  function sliderField(titleKey, titleFallback, enabledKey, msKey) {
    const toggle = toggleRow(titleKey, titleFallback, enabledKey);
    const valueLabel = el("strong", { text: "" });
    const labelRow = el(
      "div",
      { class: "prf-qp-labelrow" },
      el("span", { text: t("durationLabel", "Duration") }),
      valueLabel
    );
    const slider = el("input", { type: "range", min: "100", max: "3000", step: "50" });
    slider.dataset.k = msKey;
    const field = el("div", { class: "prf-qp-field" }, toggle.row, labelRow, slider);
    return { field, toggleInput: toggle.input, slider, valueLabel };
  }

  function syncPanelLabels(panel) {
    panel._labels.fadeOutMs.textContent = formatMs(clampMs(panel._inputs.fadeOutMs.value));
    panel._labels.fadeInMs.textContent = formatMs(clampMs(panel._inputs.fadeInMs.value));
  }

  function syncPanelDisabled(panel) {
    const master = panel._inputs.enabled.checked;
    for (const field of panel._dimmable) field.classList.toggle("is-dimmed", !master);
    panel._inputs.fadeOutEnabled.disabled = !master;
    panel._inputs.fadeInEnabled.disabled = !master;
    panel._inputs.seekFadeInEnabled.disabled = !master;
    panel._inputs.fadeOutMs.disabled = !master || !panel._inputs.fadeOutEnabled.checked;
    panel._inputs.fadeInMs.disabled = !master || !panel._inputs.fadeInEnabled.checked;
  }

  function savePanelSettings(panel) {
    chrome.storage.local.set({
      enabled: Boolean(panel._inputs.enabled.checked),
      fadeOutEnabled: Boolean(panel._inputs.fadeOutEnabled.checked),
      fadeInEnabled: Boolean(panel._inputs.fadeInEnabled.checked),
      seekFadeInEnabled: Boolean(panel._inputs.seekFadeInEnabled.checked),
      debugHud: Boolean(panel._inputs.debugHud.checked),
      fadeOutMs: clampMs(panel._inputs.fadeOutMs.value),
      fadeInMs: clampMs(panel._inputs.fadeInMs.value),
    });
  }

  function buildPanel() {
    const panel = el("div", { id: PANEL_ID });

    const closeBtn = el("button", {
      type: "button",
      class: "prf-qp-close",
      "aria-label": t("closeLabel", "Close"),
      text: "×",
    });
    closeBtn.addEventListener("click", closePanel);

    const head = el(
      "div",
      { class: "prf-qp-head" },
      el("span", { class: "prf-qp-title", text: t("popupHeading", "Pause / Resume Fade") }),
      closeBtn
    );

    const master = toggleRow("masterToggle", "Enable all", "enabled");
    master.row.classList.add("prf-qp-master");

    const fadeOut = sliderField("fadeOutTitle", "Fade out (pause)", "fadeOutEnabled", "fadeOutMs");
    const fadeIn = sliderField("fadeInTitle", "Fade in (resume)", "fadeInEnabled", "fadeInMs");
    const seek = toggleRow("seekTitle", "Fade in on seek", "seekFadeInEnabled");
    const debug = toggleRow("debugHudTitle", "Debug overlay", "debugHud");
    const seekField = el("div", { class: "prf-qp-field" }, seek.row);
    const debugField = el("div", { class: "prf-qp-field" }, debug.row);

    panel.appendChild(head);
    panel.appendChild(master.row);
    panel.appendChild(fadeOut.field);
    panel.appendChild(fadeIn.field);
    panel.appendChild(seekField);
    panel.appendChild(debugField);

    panel._inputs = {
      enabled: master.input,
      fadeOutEnabled: fadeOut.toggleInput,
      fadeInEnabled: fadeIn.toggleInput,
      seekFadeInEnabled: seek.input,
      debugHud: debug.input,
      fadeOutMs: fadeOut.slider,
      fadeInMs: fadeIn.slider,
    };
    panel._labels = { fadeOutMs: fadeOut.valueLabel, fadeInMs: fadeIn.valueLabel };
    panel._dimmable = [fadeOut.field, fadeIn.field, seekField];

    for (const input of Object.values(panel._inputs)) {
      const isRange = input.type === "range";
      input.addEventListener(isRange ? "input" : "change", () => {
        if (isRange) syncPanelLabels(panel);
        savePanelSettings(panel);
        syncPanelDisabled(panel);
      });
    }

    return panel;
  }

  function syncPanelFromStorage() {
    if (!panelEl) return;
    chrome.storage.local.get(DEFAULTS, (stored) => {
      if (!panelEl) return;
      const clean = sanitizeSettings(stored);
      panelEl._inputs.enabled.checked = clean.enabled;
      panelEl._inputs.fadeOutEnabled.checked = clean.fadeOutEnabled;
      panelEl._inputs.fadeInEnabled.checked = clean.fadeInEnabled;
      panelEl._inputs.seekFadeInEnabled.checked = clean.seekFadeInEnabled;
      panelEl._inputs.debugHud.checked = clean.debugHud;
      panelEl._inputs.fadeOutMs.value = String(clean.fadeOutMs);
      panelEl._inputs.fadeInMs.value = String(clean.fadeInMs);
      syncPanelLabels(panelEl);
      syncPanelDisabled(panelEl);
    });
  }

  function openPanel() {
    if (!panelEl) {
      panelEl = buildPanel();
      (document.documentElement || document.body).appendChild(panelEl);
    }
    syncPanelFromStorage();
    panelEl.classList.add("prf-qp-open");
  }

  function closePanel() {
    if (panelEl) panelEl.classList.remove("prf-qp-open");
  }

  function togglePanel() {
    if (panelEl && panelEl.classList.contains("prf-qp-open")) closePanel();
    else openPanel();
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!panelEl || !panelEl.classList.contains("prf-qp-open")) return;
      const target = event.target;
      const chip = document.getElementById(CHIP_ID);
      if (panelEl.contains(target) || (chip && chip.contains(target))) return;
      closePanel();
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape" && panelEl && panelEl.classList.contains("prf-qp-open")) {
        closePanel();
      }
    },
    true
  );
})();
