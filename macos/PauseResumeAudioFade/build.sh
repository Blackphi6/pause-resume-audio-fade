#!/bin/bash
# .app を組み立てて ad-hoc 署名する。使い方: ./build.sh [--install]
#   --install : /Applications/PauseResumeAudioFade.app に置く（起動中なら終了してから差し替え）
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="PauseResumeAudioFade"
BUNDLE_ID="io.github.blackphi6.PauseResumeAudioFade"
APP_BUNDLE="Pause Resume Audio Fade"
APP="dist/${APP_BUNDLE}.app"

swift build -c release --arch arm64
BIN="$(swift build -c release --arch arm64 --show-bin-path)/${APP_NAME}"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp "$BIN" "$APP/Contents/MacOS/${APP_NAME}"
cp Info.plist "$APP/Contents/Info.plist"

# ad-hoc 署名。識別子を固定して、再ビルドしても TCC の対象アプリとして同じ名前で扱われるようにする
codesign --force --sign - --identifier "$BUNDLE_ID" "$APP"
codesign --verify --strict "$APP"
echo "built: $APP"

if [[ "${1:-}" == "--install" ]]; then
    DEST="/Applications/${APP_BUNDLE}.app"
    pkill -x "$APP_NAME" 2>/dev/null || true
    sleep 0.5
    rm -rf "$DEST"
    cp -R "$APP" "$DEST"
    echo "installed: $DEST"
fi
