# Pause Resume Audio Fade for Mac

A menu bar utility for Apple Silicon Macs that softens the abrupt volume jump
when you pause and resume media — system-wide, not tied to one browser or
site. It's the same idea as the [Chrome extension](../../extension) in this
repo, generalized: instead of fading one `<video>` element's volume, it fades
your Mac's actual output volume whenever *anything* on the system starts or
stops playing (Music, Safari, Chrome, VLC, QuickTime, Spotify, ...).

## How it works

- **Play/pause detection**: uses the same system-wide "Now Playing" signal
  that Control Center's Now Playing widget reads, via the private
  `MediaRemote.framework`. This is undocumented API — see [Limitations](#limitations).
- **Fading**: ramps the current default output device's volume
  (`kAudioDevicePropertyVolumeScalar` via CoreAudio) down to 0 on pause and
  back up to whatever it was before on resume. This is the exact same value
  the volume keys and the Control Center slider control.
- If you (or another app) change the volume manually while a fade is
  running, the fade cancels and adopts your new level as the new baseline —
  it never fights you for control of the volume.

## Requirements

- Apple Silicon Mac (arm64), macOS 13 (Ventura) or later.
- No paid Apple Developer account needed to build or run it yourself.

## Build

```bash
cd macos/PauseResumeAudioFade
./build.sh
```

This produces `dist/Pause Resume Audio Fade.app`. It's ad-hoc signed (not
notarized by Apple), so the first time you open it, **right-click the app →
Open** instead of double-clicking, to get past Gatekeeper's "unidentified
developer" warning. After that first run, it opens normally.

## Use

There's no window — it lives entirely in the menu bar (a waveform icon).
Click it for:

- **有効にする** (Enable) — master on/off
- **フェードアウト（一時停止）** / **フェードイン（再開）** — pick a fade
  duration (150 ms – 2000 ms) for pause and resume independently
- **終了** (Quit)

Settings persist across launches (`UserDefaults`).

## Troubleshooting

Click the menu bar icon and read the three status lines at the top of the
menu -- they tell you exactly which part isn't working:

- **検知: 利用不可** -- play/pause detection itself isn't available on this
  macOS version (see [Limitations](#limitations) about the private API).
- **出力デバイス: ...（非対応）** -- your current output device doesn't
  expose a settable system volume to apps; fading can't work regardless of
  the other settings.
- **現在の再生状態** -- reflects what the app currently thinks is
  playing/paused. If this doesn't change when you pause/resume something,
  detection isn't picking up that particular app/content (some apps only
  publish "Now Playing" info when driven from their own UI, not when
  controlled via automation/scripting).

**Can't find the icon at all?** If you have many menu bar apps installed,
macOS can push new, low-priority status items off the visible edge of a
crowded menu bar (there's no "..." overflow indicator on every macOS
version). Try quitting a few other menu bar apps, or use a menu bar
manager (e.g. Ice, Bartender) to check the hidden/overflow section.

No extra system permission (Accessibility, Automation, Screen Recording,
etc.) was needed in testing -- if a permission prompt *does* appear for you,
it's worth reporting as an issue, since that would be new/unexpected
behavior for the APIs this app uses.

## Limitations

- **Affects the whole system's output volume**, not just the app you
  paused. If something else is making sound when you pause your video (a
  notification, a call), it gets ducked too. There's no per-app audio
  routing here — doing that properly needs a virtual audio driver, which is
  out of scope for this tool.
- **`MediaRemote.framework` is a private, undocumented Apple framework.**
  Symbol names and behavior are not guaranteed across macOS versions; this
  app loads every symbol defensively at runtime (via `dlopen`/`dlsym`) and
  simply disables play/pause detection if something is missing, rather than
  crashing. If a future macOS release breaks it, that's the first place to
  look (`Sources/PauseResumeAudioFade/MediaRemoteBridge.swift`).
- **Some output devices don't expose a settable volume** (e.g. certain
  digital/HDMI outputs) — on those, the app detects this at launch and the
  menu shows a notice instead of silently doing nothing.
- Not notarized/signed with a paid Apple Developer ID, so Gatekeeper will
  warn on first launch (see [Build](#build) above for the one-time bypass).

## Project layout

Plain Swift Package Manager, no Xcode project file needed (though you can
`open Package.swift` in Xcode if you prefer):

```
Sources/PauseResumeAudioFade/
  main.swift               entry point
  AppDelegate.swift         wires everything together
  MediaRemoteBridge.swift   system-wide play/pause detection (private API)
  SystemVolumeFader.swift   CoreAudio volume fade + external-change detection
  Preferences.swift         UserDefaults-backed settings
  StatusBarController.swift menu bar UI
Info.plist                  app metadata (LSUIElement = menu-bar-only)
build.sh                    builds + assembles + ad-hoc signs the .app
```
