#!/usr/bin/env python3
"""Validate extension package structure, JSON, and privacy red flags."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"

REQUIRED = [
    "manifest.json",
    "page-bridge.js",
    "fade-inject.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "hud.css",
    "icons/icon16.png",
    "icons/icon48.png",
    "icons/icon128.png",
]

FORBIDDEN = [
    (re.compile(r"\bfetch\s*\("), "fetch()"),
    (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest"),
    (re.compile(r"\bWebSocket\b"), "WebSocket"),
    (re.compile(r"\beval\s*\("), "eval()"),
    (re.compile(r"\bnew\s+Function\s*\("), "new Function()"),
    (re.compile(r"\binnerHTML\s*="), "innerHTML assignment"),
    (re.compile(r"chrome\.identity\b"), "chrome.identity"),
    (re.compile(r"chrome\.cookies\b"), "chrome.cookies"),
    (re.compile(r"chrome\.history\b"), "chrome.history"),
    (re.compile(r"chrome\.webRequest\b"), "chrome.webRequest"),
    (re.compile(r"chrome\.debugger\b"), "chrome.debugger"),
    (re.compile(r"chrome\.tabs\b"), "chrome.tabs"),
    (re.compile(r"google-analytics|gtag\(|mixpanel|sentry\.io|amplitude", re.I), "analytics"),
    (re.compile(r"postMessage\([^)]*,\s*['\"]\*['\"]"), "postMessage(*, *)"),
    (re.compile(r"https?://"), "external URL"),
]

ALLOWED_HOST_MARKERS = (
    "youtube.com",
    "youtube-nocookie.com",
    "netflix.com",
    "primevideo.com",
    "amazon.",
    "tver.jp",
    "abema.tv",
    "abema-tv.com",
    "hulu.jp",
    "hulu.com",
    "disneyplus.com",
    "unext.jp",
    "dazn.com",
    "fujitv.co.jp",
    "plus.nhk.jp",
    "nhk-ondemand.jp",
    "lemino.docomo.ne.jp",
    "telasa.jp",
    "wowow.co.jp",
    "animestore.docomo.ne.jp",
    "nicovideo.jp",
    "twitch.tv",
    "bilibili.com",
    "bilibili.tv",
    "crunchyroll.com",
)

REQUIRED_HOST_MARKERS = (
    "youtube.com",
    "netflix.com",
    "primevideo.com",
    "tver.jp",
    "abema.tv",
)


def main() -> int:
    missing = [p for p in REQUIRED if not (EXT / p).exists()]
    if missing:
        print("MISSING:", ", ".join(missing))
        return 1

    manifest = json.loads((EXT / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["manifest_version"] == 3
    assert manifest.get("permissions") == ["storage"], manifest.get("permissions")
    assert manifest.get("incognito") == "split"
    assert "host_permissions" not in manifest
    assert "externally_connectable" not in manifest
    assert "web_accessible_resources" not in manifest
    assert "background" not in manifest
    assert "content_security_policy" in manifest

    # Localization: manifest must reference message keys + declare default locale
    default_locale = manifest.get("default_locale")
    assert default_locale, "default_locale is required for localization"
    assert manifest.get("name") == "__MSG_extName__"
    assert manifest.get("description") == "__MSG_extDescription__"

    locales_dir = EXT / "_locales"
    assert locales_dir.is_dir(), "_locales directory missing"
    locale_codes = sorted(p.name for p in locales_dir.iterdir() if p.is_dir())
    expected_locales = {"en", "ja", "zh_CN", "zh_TW"}
    assert expected_locales.issubset(set(locale_codes)), locale_codes
    assert default_locale in locale_codes, default_locale

    # Every locale must define the same key set (default locale is the source of truth)
    def load_keys(code):
        data = json.loads((locales_dir / code / "messages.json").read_text(encoding="utf-8"))
        for key, entry in data.items():
            assert isinstance(entry, dict) and entry.get("message"), f"{code}:{key} empty"
        return set(data.keys())

    base_keys = load_keys(default_locale)
    required_keys = {
        "extName",
        "extDescription",
        "popupHeading",
        "popupSubtitle",
        "sitesNote",
        "masterToggle",
        "fadeOutTitle",
        "fadeInTitle",
        "seekTitle",
        "durationLabel",
        "seekNote",
        "reloadHint",
        "debugHudTitle",
        "debugHudNote",
        "unitMs",
    }
    assert required_keys.issubset(base_keys), required_keys - base_keys
    for code in locale_codes:
        keys = load_keys(code)
        assert keys == base_keys, f"{code} key mismatch: {base_keys ^ keys}"
        desc = json.loads((locales_dir / code / "messages.json").read_text(encoding="utf-8"))
        assert len(desc["extDescription"]["message"]) <= 132, f"{code} extDescription too long"

    match_lists = []
    for script in manifest["content_scripts"]:
        assert script.get("all_frames") is True
        matches = script["matches"]
        assert matches, "content_scripts.matches empty"
        assert "<all_urls>" not in matches
        for m in matches:
            assert m.startswith("https://") and m.endswith("/*"), m
            assert any(h in m for h in ALLOWED_HOST_MARKERS), m
        joined = " ".join(matches)
        for host in REQUIRED_HOST_MARKERS:
            assert host in joined, f"missing host {host}"
        match_lists.append(matches)
    assert match_lists and all(m == match_lists[0] for m in match_lists)

    worlds = {tuple(s["js"]): s.get("world", "ISOLATED") for s in manifest["content_scripts"]}
    assert ("fade-inject.js",) in worlds and worlds[("fade-inject.js",)] == "MAIN"
    assert ("page-bridge.js",) in worlds

    for path in EXT.glob("*.js"):
        text = path.read_text(encoding="utf-8")
        for pat, label in FORBIDDEN:
            if pat.search(text):
                print(f"PRIVACY FAIL {path.name}: found {label}")
                return 1
        if "storage.sync.get(null" in text or "storage.sync.get( null" in text:
            print(f"PRIVACY FAIL {path.name}: sync.get(null) not allowed")
            return 1
        if path.name == "fade-inject.js":
            assert "isEditableTarget" in text
            assert "isMainVideo" in text
            assert "findMainVideo" in text
            assert "isMobileSite" in text
            assert "isEmeLikely" in text
            assert "Math.abs(video.volume - next) < 0.05" in text
            assert "Math.abs(video.volume - next) >" not in text
            assert "player-container" in text
            assert "atvwebplayersdk-player-container" in text
            assert "CustomEvent" in text or "__prf_settings_" in text
            assert "data-prf-k" in text
            assert "touchstart" in text
        if path.name == "page-bridge.js":
            assert "chrome.runtime.id" in text
            assert "CustomEvent" in text
            assert "storage.sync.clear" in text
            assert "prf_mobile_chip" in text
            assert "mobile-topbar-header" in text
            assert "youtube" in text
        if path.name == "popup.js":
            assert "chrome.storage.local" in text
            assert "storage.sync.clear" in text
            assert "chrome.i18n" in text

    # popup.html should drive text via data-i18n, not hardcoded-only strings
    popup_html = (EXT / "popup.html").read_text(encoding="utf-8")
    assert "data-i18n" in popup_html

    assert (ROOT / "PRIVACY.md").exists()
    assert (ROOT / "SECURITY_PRIVACY_AUDIT.md").exists()

    print("OK: 120-point package checks passed")
    print(f"Localized: {', '.join(locale_codes)} (default={default_locale})")
    print(f"Load folder: {EXT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
