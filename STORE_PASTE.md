# ストア貼り付け専用（1.4.2）

ダッシュボード「ストアの掲載情報」へ、**グレーの枠の中だけ**コピーします。
` ```text ` という文字は貼らないでください。

**パッケージの概要は、ここからは変えられません。** `manifest.json` の `description`（各言語の `extDescription`）から自動で入ります。概要を直すには **1.4.2 の ZIP をアップロード** してください（すでに修正済み）。

**説明（長文）だけ**、下の枠を4言語ぶん貼り直します。サイト名を長く並べないでください（キーワード スパム）。

---

## 日本語

### パッケージの概要

**編集不可。** ZIP 1.4.2 を上げると、次の文に自動で変わります。

```text
ブラウザの動画プレイヤーで、一時停止・再開・シーク時に音量を短くフェードし、急な音の切れや立ち上がりをやわらげます。
```

（English 既定: `Softly fade audio on pause, resume, and seek in browser video players.`）

### 説明（ここだけ手で貼る）

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

---

## English

言語メニューを English にして貼ります。

### Package summary

**Read-only on the dashboard.** Upload ZIP 1.4.2; it becomes:

```text
Softly fade audio on pause, resume, and seek in browser video players.
```

### Description (paste this)

```text
A Chrome extension that briefly fades audio when you pause, resume, or seek in the browser.

Pausing a video can cut the sound off abruptly, and resuming can feel like the volume jumps back suddenly. Pause Resume Audio Fade smooths these sudden volume changes with short fades for a gentler listening experience.

[What's new]

Support for more browser-based video players. Reliability fixes for sites where the fade did not work consistently. Reload the tab you are watching after updating.

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

[How it works]

The extension runs on browser-based video players. It does not run on non-video pages such as shopping flows. After installing or updating, reload the tab you are watching. On some DRM-protected streams, the fade may not apply if the site ignores JavaScript volume changes.

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

---

## 简体中文

言語メニューを 简体中文 にして貼ります。

### 概要

**編集不可。** ZIP 1.4.2 を上げると自動で変わります。

### 说明（ここだけ手で貼る）

```text
这是一款 Chrome 扩展，在浏览器视频播放器暂停、恢复或跳转时对音量进行短暂的淡入淡出。

暂停视频时声音可能会突然中断，恢复播放时又会感觉音量骤然变大。暂停恢复音频淡入淡出通过短暂的淡变来缓和这些突然的音量变化，带来更柔和的收听体验。

【本次更新】

扩大了浏览器视频的适用范围。修复了部分网站效果不稳定的问题。更新后请重新加载正在观看的标签页。

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

【运行说明】

适用于浏览器中的视频播放器，不会在购物等非观看页面运行。安装或更新后请重新加载正在观看的标签页。部分受 DRM 保护的流如果忽略 JavaScript 音量更改，淡变可能无效。

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

---

## 繁體中文

言語メニューを 繁體中文 にして貼ります。

### 概要

**編集不可。** ZIP 1.4.2 を上げると自動で変わります。

### 說明（ここだけ手で貼る）

```text
這是一款 Chrome 擴充功能，在瀏覽器影片播放器暫停、恢復或跳轉時對音量進行短暫的淡入淡出。

暫停影片時聲音可能會突然中斷，恢復播放時又會覺得音量驟然變大。暫停恢復音訊淡入淡出透過短暫的淡變來緩和這些突然的音量變化，帶來更柔和的聆聽體驗。

【本次更新】

擴大了瀏覽器影片的適用範圍。修正了部分網站效果不穩定的問題。更新後請重新載入正在觀看的分頁。

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

【運作說明】

適用於瀏覽器中的影片播放器，不會在購物等非觀看頁面執行。安裝或更新後請重新載入正在觀看的分頁。部分受 DRM 保護的串流若忽略 JavaScript 音量變更，淡變可能無效。

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
