# Chrome ウェブストア提出情報

対象バージョン: **1.4.1**

**ストアの掲載情報（概要・説明）の貼り付け専用は [`STORE_PASTE.md`](STORE_PASTE.md) です。** こちらの長い原稿は、プライバシーやテスト手順など、それ以外用です。

グレーの枠（` ```text ` の中）だけをコピーします。` ```text ` という文字そのものは貼らないでください。

## 今回の更新で貼る場所

すでにストアに出ている拡張の **更新** です。ダッシュボードで「新しいパッケージをアップロード」したあと、次だけ直します。

**「新着情報 / What's new」という別欄はありません。** Google の公式案内でも、更新内容は「ストアの掲載情報」の **説明（Description）** の中に書く、とされています。いま開いている画面（パッケージのタイトル／概要／説明）で合っています。

貼る文章は全部 [`STORE_PASTE.md`](STORE_PASTE.md) にあります。言語を切り替えて、概要と説明を枠ごとコピーしてください。

**1.4.1 却下（キーワード スパム）:** 説明に配信サービス名を長く並べないでください。`STORE_PASTE.md` は修正済みです。再提出前に English を含め4言語すべて差し替えてください。

| ダッシュボードの欄 | このファイルの場所 | 貼る内容 |
|--------------------|--------------------|----------|
| パッケージ（左メニュー） | （ファイル） | リポジトリ直下の `youtube-pause-resume-fade-1.4.1.zip` |
| パッケージの概要 | [`STORE_PASTE.md`](STORE_PASTE.md) | その言語の「概要」 |
| 説明（詳細） | [`STORE_PASTE.md`](STORE_PASTE.md) | その言語の「説明」 |
| English / 简体中文 / 繁體中文 | [`STORE_PASTE.md`](STORE_PASTE.md) | 言語を切り替えて同じファイルから貼る |
| スクリーンショット | （画像ファイル） | `assets/store/screenshots/` の各言語3枚 |
| 単一目的・サイトアクセスの理由 | **「3. Privacy Practices」** | 対応サイトを増やしたので、ここも更新 |
| テスト手順（左メニュー「テスト手順」） | **「6. Test Instructions」** | 審査担当者向け。利用者向けではない |

左メニューの「パッケージ」で ZIP を上げたあと、「審査のため送信」を押すと確認画面が出ます。そこに審査担当向けのメモ欄が出ることがありますが、それはストアの利用者には見えません。利用者に見せる更新内容は、いまの画面の **説明** に書きます。

1.4.0 と 1.0.0 の枠は過去のメモなので、ストアには貼らないでください。

以下は Chrome Web Store Developer Dashboard へコピーして使う提出原稿です。

## 1. Store Listing / ストアの掲載情報

### 商品名

```text
Pause Resume Audio Fade
```

### 主言語

```text
English（既定）
```

ポップアップUIは Chrome の i18n（`_locales`）で **English / 日本語 / 简体中文 / 繁體中文** に自動対応します。ブラウザの表示言語に合わせて切り替わり、該当がなければ既定の English になります。

Developer Dashboard では主言語を **English** に設定し、追加言語として **日本語・简体中文・繁體中文** を登録して、各言語の掲載テキスト（後述「8. 各言語の掲載テキスト」）を入力します。

### カテゴリ

```text
ユーザー補助（Accessibility）
```

選定理由: 急な音量変化を緩和し、聴覚過敏を含むユーザーの視聴時の負担を軽減する機能だからです。管理画面上で「ユーザー補助」が選べない場合の次点は「ツール（Tools）」です。

### 概要／短い説明

```text
ブラウザの動画プレイヤーで、一時停止・再開・シーク時に音量を短くフェードし、急な音の切れや立ち上がりをやわらげます。
```

### 詳細な説明（16,000文字以内）

[`STORE_PASTE.md`](STORE_PASTE.md) の日本語「説明」と同一です。サイト名の長い一覧は入れません。

```text
ブラウザの動画プレイヤーで、一時停止・再開・シーク時に音量を短くフェードさせるChrome拡張機能です。

動画を一時停止すると音が突然途切れ、再開時には音が急に大きくなったように感じることがあります。Pause Resume Audio Fadeは、こうした急な音量変化を短いフェードでやわらげ、より穏やかな視聴体験を提供します。

【今回の更新】

ブラウザで見る動画の対応範囲を広げました。一部のサイトでうまく動かないことがあったので直しています。

使い始めるときは、いま見ているタブをいちど再読み込みしてください。

【主な機能】

・一時停止時のフェードアウト
　一時停止操作の直後に音量を徐々に下げてから停止します。

・再生再開時のフェードイン
　再生を再開した際、音量を無音付近から元の音量へ徐々に戻します。

・シーク時のフェードイン
　動画の再生中にタイムライン上の別の位置へ移動した際、移動先の音を徐々に立ち上げます。

・機能ごとのオン／オフ
　フェードアウト、再開時フェードイン、シーク時フェードインを個別に切り替えられます。

・一括オン／オフ
　すべての機能を1つのスイッチでまとめて無効化・有効化できます。

・フェード時間の調整
　フェードアウトとフェードインの時間をそれぞれ100〜3,000ミリ秒の範囲で調整できます。

【初期設定】

・フェードアウト: 350ミリ秒
・フェードイン: 300ミリ秒
・シーク時フェードイン: オン

初期値は、操作への反応を遅く感じにくく、急な音量変化もやわらげられる短い時間に設定しています。

【動作について】

ブラウザ上の動画プレイヤーが対象です。買い物ページなど、動画視聴以外のページでは動作しません。インストール後や更新後は、視聴中のタブを再読み込みしてください。DRM で保護された配信では、サイト側が音量変更を受け付けない場合、フェードが効かないことがあります。

【プライバシー】

本拡張機能は、個人情報、各サービスのアカウント情報、視聴履歴、動画タイトル、動画URL、Cookie、音声・映像コンテンツを収集しません。

外部サーバーへの通信、アクセス解析、広告SDK、クラッシュレポート送信はありません。保存するのは、機能のオン／オフとフェード時間のみです。これらの設定は端末内のChromeストレージに保存されます。

【権限について】

・storage
　機能のオン／オフとフェード時間を端末内に保存するために使用します。

・対応サイトへのアクセス
　各サイトのメインプレイヤーに音量フェードを適用するために必要です。指定した視聴ページ以外では動作しません。

【使い方】

1. 拡張機能をインストールします。
2. 視聴中のタブを再読み込みします。
3. 通常どおり動画を再生・一時停止・シークします。
4. 必要に応じて、ツールバーの拡張機能アイコンから各機能とフェード時間を調整します。

本拡張機能は各配信サービスの公式製品ではありません。
```

### バージョン1.4.1の更新内容（説明の先頭に入れる）

別欄はありません。上の「詳細な説明」の【今回の更新】に、すでに同じ文章が入っています。説明欄を枠ごと貼り直せば足ります。

### バージョン1.4.0のリリースノート

```text
主要配信サイトに対応。

・Netflix / Prime Video / TVer / ABEMA ほか、ブラウザで見られる主要サービスへフェードを適用
・プレイヤーが iframe 内にあるサイトでも動作するようフレーム内へ注入
・DRM 再生では GainNode を使わず video.volume でフェード
```

### バージョン1.0.0のリリースノート

```text
初回リリース。

・一時停止時のフェードアウト
・再開時のフェードイン
・再生中のシーク時フェードイン
・各機能の個別オン／オフ
・全機能の一括オン／オフ
・フェード時間の調整
```

## 2. Graphic Assets / 画像素材

### ストアアイコン

```text
extension/icons/icon128.png
```

サイズ: 128×128 PNG

### スクリーンショット

最低1枚、推奨3枚。すべて **1280×800 PNG/JPEG** で作成します。

作成済みファイル:

```text
assets/store/screenshots/en/screenshot-1-1280x800.png
assets/store/screenshots/en/screenshot-2-1280x800.png
assets/store/screenshots/en/screenshot-3-1280x800.png
assets/store/screenshots/ja/screenshot-1-1280x800.png
assets/store/screenshots/ja/screenshot-2-1280x800.png
assets/store/screenshots/ja/screenshot-3-1280x800.png
assets/store/screenshots/zh_CN/screenshot-1-1280x800.png
assets/store/screenshots/zh_CN/screenshot-2-1280x800.png
assets/store/screenshots/zh_CN/screenshot-3-1280x800.png
assets/store/screenshots/zh_TW/screenshot-1-1280x800.png
assets/store/screenshots/zh_TW/screenshot-2-1280x800.png
assets/store/screenshots/zh_TW/screenshot-3-1280x800.png
```

Developer Dashboard の各言語へ、対応するフォルダの3枚を登録します。画像は実際の拡張ポップアップUIを組み込んで生成しており、再生成は `.venv/bin/python scripts/generate_store_screenshots.py` で行えます。

#### スクリーンショット1

```text
YouTube / Netflix / TVer / ABEMA などの再生画面と、拡張機能のポップアップを同時に表示。
ポップアップ内の「すべて有効」「フェードアウト」「フェードイン」と対応サイトの一文が読める状態。
キャプション: YouTube、TVer、ABEMA などの急な音量変化をやわらげます
```

#### スクリーンショット2

```text
ポップアップを大きく見せ、3つの個別スイッチを表示。
キャプション: 3つのフェード機能を個別または一括でオン・オフ
```

#### スクリーンショット3

```text
フェード時間スライダーを表示。
キャプション: フェードアウトとフェードインの時間を100〜3,000msで調整
```

実際のUIを使用し、未実装機能や誇張した効果を画像に入れません。

### 小型プロモーションタイル

```text
サイズ: 440×280 PNG/JPEG
表示文字: Pause Resume Audio Fade
補助文字: Smooth pause. Gentle resume.
意匠: 拡張アイコン、音量波形、フェードを表すグラデーション
```

### マーキープロモーションタイル（任意）

```text
サイズ: 1400×560 PNG/JPEG
表示文字: Pause Resume Audio Fade
補助文字: 動画の音を、やさしく止めて、やさしく戻す。
```

### プロモーション動画

初回公開では未設定で構いません。作成する場合は、YouTubeへ30秒程度の紹介動画をアップロードし、そのURLを入力します。

## 3. Privacy Practices / プライバシー

### 単一目的

```text
対応する配信サイトのメインプレイヤーで、一時停止・再生再開・シーク時の音量を短時間フェードさせ、急な音量変化を緩和すること。
```

### storage 権限の理由

```text
ユーザーが選択した全体オン／オフ、機能ごとのオン／オフ、およびフェード時間（ミリ秒）を端末内に保存し、ブラウザを再起動しても設定を維持するために使用します。個人情報、閲覧履歴、動画情報は保存しません。
```

### ホスト権限が必要な理由（ダッシュボードはこの1枠だけ）

プライバシー画面の「ホスト権限が必要な理由」は **1つだけ** です。サイトごとに枠は出ません。次の枠を、いま入っている途中の文章と入れ替えて全部貼ります。

```text
YouTube、Netflix、Prime Video、TVer、ABEMA ほか、対応する配信サイトのメインプレイヤーで、一時停止・再生再開・シークを検知し、音量フェードを適用するために必要です。プレイヤーがサブドメインやフレームにある場合も含みます。Amazonは買い物ページ全体ではなく動画視聴ページのみです。ページ内容・視聴履歴・アカウント情報の収集には使用しません。指定した視聴ホスト以外では動作しません。
```

下のサイト別の枠は、もし審査画面でホストが1つずつ出たとき用の控えです。いまの画面では使いません。

各パターン共通の締め: ページ内容・視聴履歴・アカウント情報の収集には使用しません。

#### YouTube（`www.youtube.com` / `m.youtube.com` / `music.youtube.com` / `www.youtube-nocookie.com`）

```text
YouTube系のメイン動画プレイヤーの一時停止・再生再開・シークを検知し、音量フェードを適用するために必要です。埋め込みプレーヤー（youtube-nocookie）も含みます。
```

#### Netflix（`www.netflix.com` / `*.netflix.com`）

```text
Netflixのメインプレイヤーへ同じ音量フェードを適用するために必要です。サブドメイン上の再生フレームも含みます。
```

#### Amazon Prime Video（`www.primevideo.com` / `*.primevideo.com` / `amazon.*/gp/video/*` / `amazon.*/Amazon-Video/*`）

```text
Prime Videoの視聴ページのメインプレイヤーへ音量フェードを適用するために必要です。Amazonの買い物ページ全体には注入しません。
```

#### TVer（`tver.jp` / `*.tver.jp`）

```text
TVerの本編プレイヤーへ音量フェードを適用するために必要です。プレイヤーがサブドメイン／フレームにある場合に備えます。
```

#### ABEMA（`abema.tv` / `*.abema.tv` / `abema-tv.com` / `*.abema-tv.com`）

```text
ABEMAの本編・生配信プレイヤーへ音量フェードを適用するために必要です。
```

#### その他の対応配信（Hulu / Disney+ / U-NEXT / DAZN / FOD / NHK / Lemino / TELASA / WOWOW / dアニメストア / ニコニコ / Twitch / Bilibili / Crunchyroll）

```text
各サービスのブラウザ向けプレイヤーへ、同じ一時停止／再開／シーク時の音量フェードを適用するために必要です。指定した視聴ホスト以外では動作しません。
```

### リモートコード

選択:

```text
いいえ、リモートコードを使用していません。
```

説明欄がある場合:

```text
すべてのJavaScriptとCSSは拡張パッケージ内に含まれています。外部スクリプト、CDN、eval、動的コード取得・実行は使用していません。
```

### ユーザーデータの申告

データ種別のチェックボックス:

```text
すべて未選択（ユーザーデータを収集しない）
```

補足:

```text
端末内に保存するのは、機能のオン／オフとフェード時間だけです。個人を特定できる情報、認証情報、位置情報、閲覧履歴、ユーザー活動、Webサイトコンテンツ、音声・映像は収集・送信しません。
```

Limited Use の認証:

```text
表示されるすべての認証項目に、実装内容と一致することを確認してチェックします。
```

### プライバシーポリシーURL

```text
https://github.com/Blackphi6/pause-resume-audio-fade/blob/main/PRIVACY.md
```

Chrome Web Store はログイン不要で開ける公開 URL が必要です。公開リポジトリの `PRIVACY.md` をそのまま使います。後で GitHub Pages に移す場合は、その URL に差し替えてください。

## 4. Distribution / 配布

### 公開範囲

```text
公開（Public）
```

### 料金

```text
無料
```

### 地域

```text
すべての対応地域
```

特定国だけに制限する理由がないため、全地域で公開します。

### 成人向けコンテンツ

```text
いいえ
```

## 5. Additional Fields / 追加項目

### 公式URL

所有権を確認済みの公式サイトがなければ、初回は未設定にします。

```text
未設定
```

### ホームページURL

GitHubリポジトリを公開する場合:

```text
https://github.com/Blackphi6/pause-resume-audio-fade
```

### サポートURL

GitHub Issuesを使用する場合:

```text
https://github.com/Blackphi6/pause-resume-audio-fade/issues
```

公開しない場合は、ChromeウェブストアのSupport Hubを使用します。

### 連絡先メール

```text
＜Chromeウェブストアで公開してよいサポート用メールアドレス＞
```

個人用メールを公開したくない場合は、拡張専用のメールアドレスを用意します。

## 6. Test Instructions / 審査担当者向けテスト手順

ログインやテストアカウント:

```text
不要
```

テスト手順:

```text
1. 拡張機能をインストールします。
2. https://www.youtube.com/ で任意の動画を開き、タブを再読み込みします。ログインは不要です。
3. 動画を再生し、一時停止します。既定では約350msかけて音量が下がった後に停止します。
4. 再生を再開します。既定では約300msかけて元の音量へ戻ります。
5. 再生中にタイムライン上の別の位置へ移動します。移動先で約300msのフェードインが適用されます。
6. ツールバーの拡張機能アイコンを開き、3機能の個別オン／オフ、全体オン／オフ、フェード時間の変更を確認します。
7. 無料で確認する場合は https://tver.jp/ または https://abema.tv/ の再生ページでも、同じ一時停止・再開を確認できます。

音声を確認できる環境が必要です。YouTube / TVer / ABEMA へのログインは不要です。
```

審査メモ:

```text
本拡張は、対応サイトのメインプレイヤーの音量遷移だけを変更します。ネットワーク通信、外部コード、広告、解析、アカウント情報・視聴履歴・動画情報の収集はありません。storage権限は、オン／オフとフェード時間の端末内保存にのみ使用します。
```

## 7. 提出前チェック

- [ ] `youtube-pause-resume-fade-1.4.1.zip` のルート直下に `manifest.json` がある
- [ ] `python scripts/validate_extension.py` が成功する
- [ ] プライバシーポリシーURLがログアウト状態でも開く
- [ ] 128×128アイコンを登録
- [ ] 1280×800スクリーンショットを最低1枚登録
- [ ] 小型プロモーションタイル 440×280 を登録
- [ ] 主言語を English に設定（追加言語: 日本語・简体中文・繁體中文）
- [ ] カテゴリをユーザー補助に設定
- [ ] 単一目的・storage・各ホストアクセス理由を入力
- [ ] リモートコード「いいえ」
- [ ] データ収集項目をすべて未選択
- [ ] Limited Use の認証内容を確認
- [ ] 公開範囲をPublic、料金を無料、地域を全地域に設定
- [ ] 成人向けコンテンツ「いいえ」
- [ ] テスト手順を入力
- [ ] 追加言語（日本語・简体中文・繁體中文）の掲載テキストを入力
- [ ] パッケージアップロード後、警告内容をすべて確認

## 8. 各言語の掲載テキスト / Localized listings

**貼り付けは [`STORE_PASTE.md`](STORE_PASTE.md) だけ使ってください。** 以下は参照用の控えです（サイト名の長い一覧はキーワード スパムになるため入れていません）。

### English (default)

商品名 / Product name:

```text
Pause Resume Audio Fade
```

概要 / Summary:

```text
Softly fade audio on pause, resume, and seek on YouTube, Netflix, Prime Video, TVer, Abema, and other streaming sites.
```

詳細な説明 / Detailed description:

```text
A Chrome extension that briefly fades audio when you pause, resume, or seek in the browser.

Pausing a video can cut the sound off abruptly, and resuming can feel like the volume jumps back suddenly. Pause Resume Audio Fade smooths these sudden volume changes with short fades for a gentler listening experience.

[What's new]

The fade now works on more videos you watch in the browser, including YouTube, Netflix, Prime Video, TVer, and ABEMA. Pausing, resuming, and seeking should sound a little gentler.

TVer and ABEMA did not fade reliably before. That is fixed.

After this update, reload the tab you are watching.

[Features]

- Fade out on pause
  Gradually lowers the volume right after you pause, then stops.

- Fade in on resume
  Brings the volume back from near-silence to its previous level when you resume.

- Fade in on seek
  When you jump to another position on the timeline during playback, the audio ramps up from the new position.

- Per-feature on/off
  Toggle fade-out, resume fade-in, and seek fade-in independently.

- Master on/off
  Disable or enable every feature with a single switch.

- Adjustable fade duration
  Set the fade-out and fade-in durations anywhere from 100 to 3,000 milliseconds.

[Defaults]

- Fade out: 350 ms
- Fade in: 300 ms
- Fade in on seek: On

The defaults are short enough to stay responsive while still softening abrupt volume changes.

[Supported sites]

- YouTube / YouTube Music / YouTube mobile web
- Netflix
- Amazon Prime Video
- TVer / ABEMA
- Hulu / Disney+ / U-NEXT / DAZN / FOD / NHK Plus / Lemino / TELASA / WOWOW / d Anime Store
- Niconico / Twitch / Bilibili / Crunchyroll

It does not run on Amazon shopping pages — only video watch pages.

YouTube, TVer, and ABEMA have been verified. On some DRM services the fade may not apply if the site ignores JavaScript volume changes. After updating, reload the tab you are watching.

[Privacy]

This extension does not collect personal information, account data, watch history, video titles, video URLs, cookies, or audio/video content.

There is no communication with external servers, no analytics, no ad SDK, and no crash reporting. It only stores your feature on/off choices and fade durations, saved locally in Chrome storage on your device.

[Permissions]

- storage
  Used to save your feature toggles and fade durations locally on your device.

- Access to supported streaming sites
  Required to apply the audio fade to each site's main player. It does not run outside the listed watch hosts.

[How to use]

1. Install the extension.
2. Reload the tab you are watching.
3. Play, pause, and seek videos as usual.
4. Adjust each feature and the fade durations from the toolbar icon if you like.

This extension is an independent project and is not an official product of any streaming service.
```

更新内容は上の説明の [What's new] に入っています。別欄はありません。

### 日本語

商品名:

```text
Pause Resume Audio Fade
```

概要:

```text
YouTube、Netflix、Prime Video、TVer、ABEMA などの一時停止・再開・シーク時に音量を短くフェードし、急な音の切れや立ち上がりをやわらげます。
```

詳細な説明:「1. Store Listing」の日本語版本文をそのまま使用します（【今回の更新】込み）。別欄はありません。

### 简体中文

商品名 / 名称:

```text
暂停恢复音频淡入淡出
```

概要 / 摘要:

```text
在 YouTube、Netflix、Prime Video、TVer、Abema 等网站暂停、恢复或跳转时对音量做短暂淡入淡出，让听感更柔和。
```

详细说明:

```text
这是一款 Chrome 扩展，在浏览器视频播放器暂停、恢复或跳转时对音量进行短暂的淡入淡出。

暂停视频时声音可能会突然中断，恢复播放时又会感觉音量骤然变大。暂停恢复音频淡入淡出通过短暂的淡变来缓和这些突然的音量变化，带来更柔和的收听体验。

【本次更新】

现在不只 YouTube，Netflix、Prime Video、TVer、ABEMA 等浏览器里看的视频也能用了。暂停、恢复、跳转时，声音不容易突然断开或突然变大。

TVer 和 ABEMA 以前有时不太好用，这次已经修好。

更新后，请把正在看的标签页重新加载一次。

【主要功能】

- 暂停时淡出
  暂停后先让音量逐渐降低，然后再停止。

- 恢复时淡入
  恢复播放时，将音量从接近静音逐渐回到原来的水平。

- 跳转时淡入
  播放过程中跳到时间轴上的其他位置后，声音会从到达的位置逐渐增强。

- 单项开关
  可分别开启或关闭淡出、恢复淡入、跳转淡入。

- 总开关
  用一个开关即可统一启用或停用所有功能。

- 可调节淡变时长
  淡出与淡入的时长均可在 100 至 3,000 毫秒之间调节。

【默认设置】

- 淡出:350 毫秒
- 淡入:300 毫秒
- 跳转时淡入:开启

默认值足够短，既能保持响应灵敏，又能缓和突然的音量变化。

【支持的网站】

- YouTube / YouTube Music / YouTube 移动网页版
- Netflix
- Amazon Prime Video
- TVer / ABEMA
- Hulu / Disney+ / U-NEXT / DAZN / FOD / NHK+ / Lemino / TELASA / WOWOW / d动画商店
- ニコニコ / Twitch / Bilibili / Crunchyroll

不会在 Amazon 购物页面运行，仅在视频观看页生效。

已在 YouTube、TVer、ABEMA 上确认可用。部分 DRM 服务如果忽略 JavaScript 音量更改，淡变可能无效。更新后请重新加载正在观看的标签页。

【隐私】

本扩展不收集个人信息、账号信息、观看记录、视频标题、视频网址、Cookie，或音视频内容。

不与任何外部服务器通信,没有数据分析、广告 SDK 或崩溃上报。仅保存功能开关与淡变时长,这些设置保存在您设备本地的 Chrome 存储中。

【权限说明】

- storage
  用于在您的设备本地保存功能开关与淡变时长。

- 访问受支持的流媒体网站
  用于对各站点的主播放器应用音量淡变。仅在清单列出的观看主机上运行。

【使用方法】

1. 安装扩展。
2. 重新加载正在观看的标签页。
3. 像平常一样播放、暂停和跳转视频。
4. 如需调整,可从工具栏图标中设置各项功能与淡变时长。

本扩展为独立项目,并非各流媒体服务的官方产品。
```

更新内容已写在上方说明的【本次更新】里。没有单独的栏。

### 繁體中文

商品名 / 名稱:

```text
暫停恢復音訊淡入淡出
```

概要 / 摘要:

```text
在 YouTube、Netflix、Prime Video、TVer、Abema 等網站暫停、恢復或跳轉時對音量做短暫淡入淡出，讓聽感更柔和。
```

詳細說明:

```text
這是一款 Chrome 擴充功能，在瀏覽器影片播放器暫停、恢復或跳轉時對音量進行短暫的淡入淡出。

暫停影片時聲音可能會突然中斷，恢復播放時又會覺得音量驟然變大。暫停恢復音訊淡入淡出透過短暫的淡變來緩和這些突然的音量變化，帶來更柔和的聆聽體驗。

【本次更新】

現在不只 YouTube，Netflix、Prime Video、TVer、ABEMA 等瀏覽器裡看的影片也能用了。暫停、恢復、跳轉時，聲音比較不容易突然中斷或突然變大。

TVer 和 ABEMA 以前有時不太好用，這次已經修好。

更新後，請把正在看的分頁重新載入一次。

【主要功能】

- 暫停時淡出
  暫停後先讓音量逐漸降低，然後再停止。

- 恢復時淡入
  恢復播放時，將音量從接近靜音逐漸回到原本的水準。

- 跳轉時淡入
  播放過程中跳到時間軸上的其他位置後，聲音會從到達的位置逐漸增強。

- 個別開關
  可分別開啟或關閉淡出、恢復淡入、跳轉淡入。

- 總開關
  用一個開關即可統一啟用或停用所有功能。

- 可調整淡變時長
  淡出與淡入的時長皆可在 100 至 3,000 毫秒之間調整。

【預設設定】

- 淡出:350 毫秒
- 淡入:300 毫秒
- 跳轉時淡入:開啟

預設值夠短,既能保持反應靈敏,又能緩和突然的音量變化。

【支援的網站】

- YouTube / YouTube Music / YouTube 行動網頁版
- Netflix
- Amazon Prime Video
- TVer / ABEMA
- Hulu / Disney+ / U-NEXT / DAZN / FOD / NHK+ / Lemino / TELASA / WOWOW / d動畫商店
- ニコニコ / Twitch / Bilibili / Crunchyroll

不會在 Amazon 購物頁面執行，僅在影片觀看頁生效。

已在 YouTube、TVer、ABEMA 上確認可用。部分 DRM 服務若忽略 JavaScript 音量變更，淡變可能無效。更新後請重新載入正在觀看的分頁。

【隱私】

本擴充功能不會收集個人資訊、帳號資訊、觀看紀錄、影片標題、影片網址、Cookie,或音訊/影片內容。

不會與任何外部伺服器通訊,沒有數據分析、廣告 SDK 或當機回報。僅儲存功能開關與淡變時長,這些設定會儲存在您裝置本機的 Chrome 儲存空間中。

【權限說明】

- storage
  用於在您的裝置本機儲存功能開關與淡變時長。

- 存取支援的串流網站
  用於對各站台的主播放器套用音量淡變。僅在清單列出的觀看主機上執行。

【使用方法】

1. 安裝擴充功能。
2. 重新載入正在觀看的分頁。
3. 像平常一樣播放、暫停和跳轉影片。
4. 如需調整,可從工具列圖示中設定各項功能與淡變時長。

本擴充功能為獨立專案,並非各串流服務的官方產品。
```

更新內容已寫在上方說明的【本次更新】裡。沒有單獨的欄。

