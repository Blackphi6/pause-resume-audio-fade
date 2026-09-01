#!/bin/bash
# Builds the release binary and assembles it into a double-clickable
# PauseResumeAudioFade.app (arm64, ad-hoc signed -- no paid Apple Developer
# account is required to build and run it locally).
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="Pause Resume Audio Fade"
BIN_NAME="PauseResumeAudioFade"
OUT_DIR="dist"
APP_DIR="$OUT_DIR/$APP_NAME.app"

swift build -c release --arch arm64

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
cp ".build/arm64-apple-macosx/release/$BIN_NAME" "$APP_DIR/Contents/MacOS/$BIN_NAME"
cp "Info.plist" "$APP_DIR/Contents/Info.plist"

codesign --force --deep --sign - "$APP_DIR"

echo "Built: $APP_DIR"
echo "First launch: right-click the app -> Open, since it isn't notarized by Apple."
