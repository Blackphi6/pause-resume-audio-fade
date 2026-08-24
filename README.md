# Pause Resume Audio Fade

ブラウザの動画プレイヤーで、一時停止・再開・シークの音量を短くフェードする Chrome 拡張機能です。

リポジトリ: https://github.com/Blackphi6/pause-resume-audio-fade

現在のバージョン: **1.4.1**

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」
4. このリポジトリの `extension` フォルダを選択

## 使い方

1. 対応サイトで動画を再生する
2. 一時停止 → フェードアウト（オンのとき）
3. 再生 → フェードイン（オンのとき）
4. 再生中にシーク → シーク時フェードイン（オンのとき）
5. ツールバーのアイコンから、機能ごと・時間を変更できる

## 対応サイト

ブラウザで再生できる主要サービス:

- YouTube / YouTube Music / YouTube モバイルWeb
- Netflix
- Amazon Prime Video（`primevideo.com` と Amazon の動画ページ）
- TVer
- ABEMA
- Hulu / Disney+ / U-NEXT / DAZN / FOD / NHKプラス / Lemino / TELASA / WOWOW / dアニメストア
- ニコニコ動画 / Twitch / Bilibili / Crunchyroll

Amazon の買い物ページ全体には注入しません。動画パス（`/gp/video/` など）だけです。

DRM（Netflix や Prime Video など）では Web Audio の GainNode を使わず、`video.volume` でフェードします。サイト側が JS の音量変更を無視する場合は効きません。

※ 動作環境の目安:
- PC: Chrome / Edge など Chromium 系
- Android: 拡張に対応した Chromium 系ブラウザ
- iOS Safari / Chrome for iOS: 拡張非対応

## デフォルト

| 項目 | 値 |
|------|-----|
| すべて有効 | オン |
| フェードアウト | オン / 350 ms |
| フェードイン | オン / 300 ms |
| シーク時フェードイン | オン（時間はフェードインと同じ） |

YouTube、TVer、ABEMA では動作を確認しています。一部の DRM 配信では、サイト側が音量変更を受け付けない場合、フェードが効かないことがあります。

更新後は視聴中のタブを **リロード** してください。

## 多言語対応（i18n）

ポップアップUIと拡張名・説明は Chrome の `_locales` で自動的に言語切替します。

| ロケール | 言語 |
|----------|------|
| `en` | English（既定 / フォールバック）|
| `ja` | 日本語 |
| `zh_CN` | 简体中文 |
| `zh_TW` | 繁體中文 |

- ブラウザの表示言語に合わせて切り替わり、該当しない場合は `en` を表示します。
- 文言は `extension/_locales/<locale>/messages.json` にまとまっています。追加言語はフォルダを増やすだけです。
- ストア掲載テキスト（各言語）は [STORE_LISTING.md](./STORE_LISTING.md) の「8. 各言語の掲載テキスト」にあります。
- 各言語3枚のストア画像は `assets/store/screenshots/<locale>/` にあります。
- 画像の再生成: `.venv/bin/python scripts/generate_store_screenshots.py`

## Privacy

- [PRIVACY.md](./PRIVACY.md)
- [SECURITY_PRIVACY_AUDIT.md](./SECURITY_PRIVACY_AUDIT.md)（A/B 120点監査ログ）
- [STORE_LISTING.md](./STORE_LISTING.md)（ストア掲載文・審査回答一式）

### Chrome Web Store

1. `extension` フォルダを ZIP 化してアップロード（ルートに `manifest.json`）
2. Privacy policy: https://github.com/Blackphi6/pause-resume-audio-fade/blob/main/PRIVACY.md
3. `storage` の理由: フェード設定の端末内保存
4. 単一目的: 対応サイトでの一時停止／再開／シーク音量フェード
5. ストア掲載文・審査回答: [STORE_LISTING.md](./STORE_LISTING.md)

## 技術メモ

- Manifest V3 / `incognito: split`
- メインプレイヤーのみフェード（小さいプレビューやミュートループは除外）
- プレイヤーが iframe 内にあるサイト向けに `all_frames: true`
- 設定は `storage.local` → 隔離ワールド → `runtime.id` トークン付き CustomEvent

## 変更履歴

### 1.4.1

- YouTube に加えて Netflix / Prime Video / TVer / ABEMA など主要配信へ対応
- TVer / ABEMA でフェードが効かない不具合を修正
- ポップアップとストア説明に対応サイトを明記

