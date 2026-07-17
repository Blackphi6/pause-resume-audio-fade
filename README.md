# Pause Resume Audio Fade

YouTube 視聴時、一時停止・再開・シークの音量を短くフェードする Chrome 拡張機能です。

リポジトリ: https://github.com/Blackphi6/pause-resume-audio-fade

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」
4. このリポジトリの `extension` フォルダを選択

## 使い方

1. YouTube で動画を再生する
2. 一時停止 → フェードアウト（オンのとき）
3. 再生 → フェードイン（オンのとき）
4. 再生中にシーク → シーク時フェードイン（オンのとき）
5. ツールバーのアイコンから、機能ごと・時間を変更できる

## デフォルト

| 項目 | 値 |
|------|-----|
| すべて有効 | オン |
| フェードアウト | オン / 350 ms |
| フェードイン | オン / 300 ms |
| シーク時フェードイン | オン（時間はフェードインと同じ） |

設定変更後は YouTube タブを **リロード** してください。

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
4. 単一目的: YouTube 視聴時の一時停止／再開／シーク音量フェード
5. ストア掲載文・審査回答: [STORE_LISTING.md](./STORE_LISTING.md)

## 技術メモ

- Manifest V3 / `incognito: split`
- メインプレイヤーのみフェード
- 設定は `storage.local` → 隔離ワールド → `runtime.id` トークン付き CustomEvent
