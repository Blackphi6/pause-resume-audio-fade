#!/usr/bin/env python3
"""Render localized 1280x800 Chrome Web Store screenshots from the real popup UI."""

from __future__ import annotations

import base64
import html
import json
import os
import re
import signal
import struct
import subprocess
import tempfile
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
OUT = ROOT / "assets" / "store" / "screenshots"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB`\x82"

LOCALES = {
    "en": {
        "eyebrow": "PAUSE RESUME AUDIO FADE",
        "badge": "ACTUAL UI",
        "slides": [
            ("Softer pauses.\nGentler resumes.", "Smooth sudden audio changes while watching YouTube."),
            ("Three fades.\nOne simple control.", "Pause, resume, and seek — together or independently."),
            ("Set the timing\nthat feels right.", "Adjust fade-out and fade-in from 100 to 3,000 ms."),
        ],
    },
    "ja": {
        "eyebrow": "PAUSE RESUME AUDIO FADE",
        "badge": "実際のUI",
        "slides": [
            ("やさしく止まり、\nやさしく戻る。", "YouTube視聴中の急な音量変化をなめらかに。"),
            ("3つのフェードを、\nシンプルに操作。", "一時停止・再開・シークを一括でも個別でも。"),
            ("心地よい長さに、\n自分で調整。", "フェードアウトとフェードインを100〜3,000msで設定。"),
        ],
    },
    "zh_CN": {
        "eyebrow": "暂停恢复音频淡入淡出",
        "badge": "实际界面",
        "slides": [
            ("柔和暂停，\n平稳恢复。", "缓和 YouTube 播放时突然的音量变化。"),
            ("三种淡变，\n一个简单控制。", "暂停、恢复与跳转，可统一或单独开关。"),
            ("设置适合你的\n淡变时长。", "淡出与淡入均可在 100 至 3,000 毫秒之间调节。"),
        ],
    },
    "zh_TW": {
        "eyebrow": "暫停恢復音訊淡入淡出",
        "badge": "實際介面",
        "slides": [
            ("柔和暫停，\n平順恢復。", "緩和 YouTube 播放時突然的音量變化。"),
            ("三種淡變，\n一個簡單控制。", "暫停、恢復與跳轉，可統一或個別開關。"),
            ("設定適合你的\n淡變時長。", "淡出與淡入皆可在 100 至 3,000 毫秒之間調整。"),
        ],
    },
}


def data_uri(path: Path) -> str:
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{payload}"


def localized_popup(locale: str, slide: int) -> str:
    messages = json.loads(
        (EXT / "_locales" / locale / "messages.json").read_text(encoding="utf-8")
    )
    markup = (EXT / "popup.html").read_text(encoding="utf-8")
    css = (EXT / "popup.css").read_text(encoding="utf-8")

    markup = markup.replace('<link rel="stylesheet" href="popup.css" />', f"<style>{css}</style>")
    markup = markup.replace('<script src="popup.js"></script>', "")
    markup = markup.replace("<html>", f'<html lang="{locale}">')
    for key, entry in messages.items():
        value = html.escape(entry["message"])
        # Replace element contents while preserving the actual popup structure.
        pattern = rf'(<(?P<tag>[a-z0-9]+)[^>]*data-i18n="{re.escape(key)}"[^>]*>).*?(</(?P=tag)>)'
        markup = re.sub(pattern, rf"\1{value}\3", markup, flags=re.DOTALL | re.IGNORECASE)

    unit = messages["unitMs"]["message"]
    markup = markup.replace("350 ms", f"350 {html.escape(unit)}")
    markup = markup.replace("300 ms", f"300 {html.escape(unit)}")

    if slide == 2:
        markup = markup.replace('value="350"', 'value="900"')
        markup = markup.replace('value="300"', 'value="700"')
        markup = markup.replace(f"350 {html.escape(unit)}", f"900 {html.escape(unit)}")
        markup = markup.replace(f"300 {html.escape(unit)}", f"700 {html.escape(unit)}")
    return markup


def page_html(locale: str, slide: int) -> str:
    meta = LOCALES[locale]
    title, subtitle = meta["slides"][slide]
    popup = html.escape(localized_popup(locale, slide), quote=True)
    icon = data_uri(EXT / "icons" / "icon128.png")
    bars = "".join(
        f'<i style="height:{h}px;animation-delay:-{i * 0.09:.2f}s"></i>'
        for i, h in enumerate([24, 42, 67, 91, 58, 108, 77, 47, 85, 118, 68, 38, 73, 101, 61, 32])
    )
    chips = {
        "en": ("PAUSE", "RESUME", "SEEK"),
        "ja": ("一時停止", "再開", "シーク"),
        "zh_CN": ("暂停", "恢复", "跳转"),
        "zh_TW": ("暫停", "恢復", "跳轉"),
    }[locale]
    return f"""<!doctype html>
<html lang="{locale}">
<head>
<meta charset="utf-8">
<style>
* {{ box-sizing:border-box }}
html,body {{ margin:0; width:1280px; height:800px; overflow:hidden; font-family:Inter,"Segoe UI","Noto Sans CJK JP","Hiragino Sans",sans-serif; }}
body {{ color:#f7f7f8; background:#090b0e; }}
.canvas {{ position:relative; width:100%; height:100%; overflow:hidden; background:
  radial-gradient(780px 620px at 80% 30%, rgba(255,61,61,.16), transparent 62%),
  radial-gradient(640px 420px at 4% 100%, rgba(255,255,255,.055), transparent 68%), #0b0d11; }}
.topbar {{ position:absolute; inset:0 0 auto; height:72px; display:flex; align-items:center; padding:0 54px; border-bottom:1px solid rgba(255,255,255,.08); }}
.brand {{ display:flex; align-items:center; gap:12px; font-size:14px; font-weight:700; letter-spacing:.08em; }}
.brand img {{ width:32px; height:32px; border-radius:8px; }}
.dots {{ margin-left:auto; display:flex; gap:8px; }} .dots b {{ width:7px; height:7px; border-radius:50%; background:#454a52; }}
.copy {{ position:absolute; left:76px; top:166px; width:630px; z-index:3; }}
.eyebrow {{ color:#ff5454; font-size:14px; font-weight:800; letter-spacing:.18em; margin-bottom:24px; }}
h1 {{ margin:0; white-space:pre-line; font-size:64px; line-height:1.06; letter-spacing:-.045em; font-weight:760; }}
.sub {{ margin:25px 0 0; max-width:560px; color:#aeb3bc; font-size:20px; line-height:1.55; }}
.chips {{ display:flex; gap:10px; margin-top:32px; }}
.chips span {{ border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.045); color:#c9cdd4; padding:8px 13px; border-radius:99px; font-size:12px; font-weight:700; letter-spacing:.06em; }}
.player {{ position:absolute; left:57px; right:57px; bottom:-143px; height:322px; border:1px solid rgba(255,255,255,.08); border-radius:24px 24px 0 0; background:linear-gradient(135deg,#171a20,#101216); box-shadow:0 -30px 80px rgba(0,0,0,.25); }}
.progress {{ position:absolute; left:32px; right:32px; top:38px; height:4px; background:#373b42; border-radius:4px; }}
.progress::before {{ content:""; display:block; width:43%; height:100%; background:#ff3b3b; border-radius:4px; }}
.wave {{ position:absolute; left:62px; top:92px; display:flex; gap:9px; height:120px; align-items:center; opacity:.5; }}
.wave i {{ display:block; width:7px; border-radius:9px; background:linear-gradient(#ff6565,#8d2828); }}
.popup-card {{ position:absolute; right:112px; top:104px; width:332px; padding:15px; border-radius:23px; background:rgba(34,38,45,.8); border:1px solid rgba(255,255,255,.12); box-shadow:0 30px 90px rgba(0,0,0,.58); backdrop-filter:blur(24px); z-index:5; }}
.popup-card iframe {{ display:block; width:300px; height:594px; border:0; border-radius:13px; background:#121417; }}
.badge {{ position:absolute; right:91px; top:80px; z-index:6; background:#ff4545; color:#fff; border-radius:99px; padding:8px 13px; font-size:11px; font-weight:800; letter-spacing:.08em; box-shadow:0 8px 24px rgba(255,40,40,.3); }}
</style>
</head>
<body>
<main class="canvas">
  <div class="topbar"><div class="brand"><img src="{icon}">{html.escape(meta["eyebrow"])}</div><div class="dots"><b></b><b></b><b></b></div></div>
  <section class="copy">
    <div class="eyebrow">{html.escape(meta["eyebrow"])}</div>
    <h1>{html.escape(title)}</h1>
    <p class="sub">{html.escape(subtitle)}</p>
    <div class="chips"><span>{chips[0]}</span><span>{chips[1]}</span><span>{chips[2]}</span></div>
  </section>
  <div class="player"><div class="progress"></div><div class="wave">{bars}</div></div>
  <div class="badge">{html.escape(meta["badge"])}</div>
  <div class="popup-card"><iframe srcdoc="{popup}"></iframe></div>
</main>
</body>
</html>"""


def png_dimensions(path: Path) -> tuple[int, int] | None:
    """Return dimensions only after Chrome has fully written a valid PNG."""
    try:
        payload = path.read_bytes()
    except FileNotFoundError:
        return None
    if len(payload) < 33 or not payload.startswith(PNG_SIGNATURE) or not payload.endswith(PNG_END):
        return None
    return struct.unpack(">II", payload[16:24])


def stop_process_group(process: subprocess.Popen[bytes]) -> None:
    """Terminate Chrome and all helper processes without leaving orphans."""
    if process.poll() is not None:
        return
    os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def main() -> int:
    if not CHROME.exists():
        raise SystemExit(f"Google Chrome not found: {CHROME}")

    with tempfile.TemporaryDirectory(prefix="prf-screenshots-") as tmp:
        tmp_path = Path(tmp)
        for locale in LOCALES:
            locale_out = OUT / locale
            locale_out.mkdir(parents=True, exist_ok=True)
            for slide in range(3):
                source = tmp_path / f"{locale}-{slide + 1}.html"
                target = locale_out / f"screenshot-{slide + 1}-1280x800.png"
                profile = tmp_path / f"profile-{locale}-{slide + 1}"
                source.write_text(page_html(locale, slide), encoding="utf-8")
                target.unlink(missing_ok=True)
                process = subprocess.Popen(
                    [
                        str(CHROME),
                        "--headless",
                        "--disable-gpu",
                        "--disable-extensions",
                        "--hide-scrollbars",
                        "--no-first-run",
                        "--no-default-browser-check",
                        f"--user-data-dir={profile}",
                        "--force-device-scale-factor=1",
                        "--window-size=1280,800",
                        f"--screenshot={target}",
                        source.as_uri(),
                    ],
                    start_new_session=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                deadline = time.monotonic() + 20
                dimensions = None
                while time.monotonic() < deadline:
                    dimensions = png_dimensions(target)
                    if dimensions is not None:
                        break
                    if process.poll() is not None:
                        break
                    time.sleep(0.1)
                if dimensions != (1280, 800):
                    stop_process_group(process)
                    raise RuntimeError(
                        f"Chrome did not render a complete 1280x800 PNG: {target} ({dimensions})"
                    )
                # Chrome on macOS can keep a helper alive after writing the image.
                stop_process_group(process)
                print(f"OK {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
