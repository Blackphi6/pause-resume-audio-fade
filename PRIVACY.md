# プライバシーポリシー — Pause Resume Audio Fade

**最終更新:** 2026-08-19（v1.4.1）

## 要約

本拡張機能は、**個人情報・視聴履歴・アカウント情報・動画 ID・Cookie・音声／映像コンテンツを収集しません。**  
開発者や第三者のサーバーへデータを送信する通信処理も**ありません。**

## 目的（単一目的）

対応する動画配信サイト上で、一時停止・再生再開・シーク時の音量を短時間フェードし、急な音の切れ／立ち上がりを緩和します。

対象はコンテンツスクリプトで指定した HTTPS の視聴ページに限ります（YouTube、Netflix、Prime Video、TVer、ABEMA ほか。一覧は README を参照）。Amazon の買い物ページ全体には注入しません。

## 端末内に保存するデータ

`chrome.storage.local`（端末内のみ）に、次の設定値だけを保存します。

| キー | 内容 |
|------|------|
| `enabled` | 一括オン／オフ |
| `fadeOutEnabled` / `fadeInEnabled` / `seekFadeInEnabled` | 機能ごとのオン／オフ |
| `fadeOutMs` / `fadeInMs` | フェード時間（ミリ秒） |
| `debugHud` | デバッグ表示のオン／オフ |
| `_prefsMigrated` | 旧版からの移行完了フラグ（内部） |

シークレットモードでは `incognito: split` により、通常ウィンドウとは**別の保存領域**を使います。

旧版の `chrome.storage.sync` からは、既知キーのみを一度読み取って local へ移し、**sync は消去**します。

## 収集・アクセスしないもの

- 氏名、メール、各サービスのアカウント
- Cookie、認証トークン
- 動画タイトル、URL、視聴履歴の永続保存
- マイク・カメラ・位置情報
- 広告・解析 SDK、クラッシュ送信
- コメント／検索への入力内容の保存

## ページ上での動作（外部送信なし）

1. **音量制御** — メインプレイヤー映像に限り再生／一時停止経路をフックし、必要時のみ Web Audio の GainNode、または `video.volume` で音量を変更します。録音・解析・アップロードはしません。
2. **ショートカット** — プレイヤー操作キーのみ対象。入力欄・コメント編集中は無視します。
3. **設定ブリッジ** — 拡張の隔離ワールドから、拡張 ID 由来のトークン付き `CustomEvent` で設定（オン／オフとミリ秒）だけをページ側へ渡します。固定名の `postMessage` は使いません。
4. **フレーム** — 一部サービスはプレイヤーを iframe に置くため、指定ホストに限ってフレーム内へも注入します。広告枠の小さいプレビューは対象外です。

## ネットワーク

`fetch` / XHR / WebSocket / ビーコン / リモートスクリプト読込は含みません。

## 権限

| 権限 | 理由 |
|------|------|
| `storage` | 設定値の端末内保存 |
| 対応サイトの HTTPS コンテンツスクリプト | 当該サイトでのフェード適用。ページ内容の収集には使いません |

## 第三者

サードパーティライブラリ・CDN・広告／解析 SDK は含みません。

## 連絡先

Chrome ウェブストアの本拡張の掲載者情報宛にお問い合わせください。

---

# Privacy Policy (English)

**Last updated:** 2026-08-19 (v1.4.1)

No personal data, watch history, account data, or AV content is collected or transmitted. Only on-device preference booleans and fade durations are stored in `chrome.storage.local` (`incognito: split`). Legacy sync keys are migrated once then cleared. Volume fades run only on the main player of supported streaming sites via optional GainNode or `video.volume` (no capture). Injection is limited to the HTTPS watch hosts listed in the manifest (Amazon shopping pages are not included). Settings cross the isolated→page boundary via a `chrome.runtime.id`-tokenized `CustomEvent`, not a public `postMessage` channel.
