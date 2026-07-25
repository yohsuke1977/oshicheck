# Chrome Web Store 掲載文言（v0.2.0 / 2026-07-25）

ストア掲載情報の原本。過去に何度も作り直しているので、ここを唯一の原本にして差分で管理する。

**文字数上限**: 名前 75字 / 短い説明 132字 / 詳細な説明 16,000字
**短い説明と名前は `_locales/*/messages.json` の `extName`・`extDesc` が原本**（manifestから引かれるのでダッシュボードでは編集しない）。詳細な説明だけダッシュボードに直接貼る。

CTAリンクはID直リンクを使う（名前変更に強い）:
https://chromewebstore.google.com/detail/cplmjepdmjcnojabbcniodaffdoemghg

---

## 1. 名前（`extName`）

| | 文言 | 字数 |
|---|---|---|
| ja（現行・変更なし） | `推し通知 - VTuber/ライバーの配信をまとめて通知` | 28 |
| en（現行・変更なし） | `Oshi Alert - Live Notifications for VTubers & JP Streamers` | 58 |

v0.2.0では名前を変えていない。CWS内検索がインストールの主経路なので、ここに `ニコ生` `17LIVE` を入れる案は検討価値がある（下記「今後の検討」参照）。

## 2. 短い説明（`extDesc`）

| | 文言 | 字数 |
|---|---|---|
| ja | `YouTube・Twitch・ツイキャス・SHOWROOM・ふわっち・ニコニコ生放送・17LIVEの配信開始をまとめてデスクトップ通知。VTuberもライバーも見逃さない無料の配信通知拡張。` | 95 |
| en | `Desktop alerts the moment your favorite streamers go live on YouTube, Twitch, TwitCasting, SHOWROOM, WhoWatch, Niconico or 17LIVE.` | 130 |

英語は上限132字に対して130字でほぼ限界。PFを増やす際は言い回しから削ること。

---

## 3. 詳細な説明（日本語）— ダッシュボードに貼る

```
推しの配信、もう見逃さない。

「気づいたら配信が終わっていた」「通知アプリを何個も入れている」
——複数のサイトで活動する推しを追いかけていると、通知はどうしても取りこぼします。

「推し通知」は、7つの配信サイトを横断して配信開始を監視し、
PCのデスクトップ通知でまとめてお知らせするChrome拡張です。


▼ 対応プラットフォーム（7サイト）

・YouTube Live
・Twitch
・ツイキャス（TwitCasting）
・SHOWROOM
・ふわっち（WhoWatch）
・ニコニコ生放送（※ユーザー生放送）
・17LIVE（イチナナ）

日本のライブ配信サイトにまとめて対応しているのが最大の特徴です。
海外製の配信通知ツールはTwitchや欧米系サイトのみの対応がほとんどで、
SHOWROOM・ツイキャス・ニコ生・17LIVEは対象外でした。


▼ できること

・配信が始まった瞬間にデスクトップ通知が届く
・通知をクリックすればそのまま視聴ページへ
・拡張アイコンのバッジで「今何人が配信中か」がひと目でわかる
・ポップアップで推しの配信状況を一覧表示（配信中が上に並びます）
・ログインすればチャンネル設定を複数のPCで同期
・日本語／英語に対応


▼ 使い方（3ステップ）

1. Chromeに「推し通知」を追加する
2. 設定画面で推しのチャンネルURLを貼り付ける
3. 配信が始まると自動でデスクトップ通知

スマホアプリの通知設定に悩まされることなく、
PC作業中でも配信開始に気づけます。


▼ 料金

・無料プラン：5チャンネルまで登録できます
・Proプラン（月額480円）：チャンネル数無制限

まずは無料でお試しください。


▼ プライバシーについて

・配信状態の確認は当拡張のサーバー経由で行うため、APIキーの設定は不要です
・視聴履歴の収集は行いません
・機能の改善のため、匿名の利用状況（起動回数・登録操作の回数など）を収集します
・詳細はプライバシーポリシーをご確認ください


▼ 対応サイトのリクエスト

「このサイトにも対応してほしい」というご要望は、
設定画面のフィードバックフォームからお送りください。


こんな方に使われています：
VTuberの配信を追いかけている方／複数のライバーを応援している箱推しの方／
ゲリラ配信を見逃したくない方／PC作業中に配信開始に気づきたい方
```

---

## 4. 詳細な説明（英語）— ダッシュボードに貼る

```
Never miss your favorite streamer going live again.

"I only noticed after the stream ended." "I have too many notification apps."
When the streamers you follow broadcast across several platforms,
notifications inevitably slip through.

Oshi Alert watches 7 live streaming platforms at once and sends you
a single desktop notification the moment a stream starts.


▼ SUPPORTED PLATFORMS (7)

- YouTube Live
- Twitch
- TwitCasting
- SHOWROOM
- WhoWatch
- Niconico Live (user broadcasts)
- 17LIVE

Broad support for Japanese streaming platforms is what sets Oshi Alert apart.
Most live-notification tools cover only Twitch and Western platforms,
leaving SHOWROOM, TwitCasting, Niconico and 17LIVE unsupported.


▼ FEATURES

- Desktop notification the moment a stream goes live
- Click the notification to jump straight to the stream
- Badge on the toolbar icon shows how many of your streamers are live
- Popup lists all your streamers, with live ones sorted to the top
- Sign in to sync your channel list across multiple computers
- Available in English and Japanese


▼ HOW IT WORKS

1. Add Oshi Alert to Chrome
2. Paste your favorite streamer's channel URL in the settings page
3. Get a desktop notification when they go live

No wrestling with mobile push settings — you'll notice the stream
even while you're working on your PC.


▼ PRICING

- Free: track up to 5 channels
- Pro (JPY 480 / month): unlimited channels

Start free — no API key required.


▼ PRIVACY

- Live status is checked through our own server, so you never need an API key
- We do not collect your viewing history
- We collect anonymous usage counts (launches, add-channel actions) to improve the product
- See our privacy policy for details


▼ REQUEST A PLATFORM

Want another streaming site supported?
Send a request from the feedback form in the settings page.


Made for: VTuber fans - people following multiple streamers -
anyone who hates missing surprise streams - PC users who want to
catch a stream while working.
```

---

## 5. 今後の検討（未実施）

- **名前へのPFキーワード追加**: CWS内検索がインストールの主経路（LP経由のインストールは14日で1件・GSC/GA4実測）なので、名前に `ニコ生` `17LIVE` を入れると流入が増える可能性がある。案:
  - A: `推し通知 - VTuber・ライバーの配信通知（ニコ生・ツイキャス・SHOWROOM対応）`（45字）
  - B: `推し通知 - ライバー・VTuberの配信通知｜ニコ生/17LIVE/ツイキャス対応`（42字）
  - ただし検索結果での表示は先頭30〜40字程度で切れる。既存ユーザーの認知を変えるコストもあるので、変えるなら審査通過後に単独で試して効果を測ること（同時に変えると何が効いたか分からなくなる）。
- **Proの英語表記**: 現在は円建て（¥480）のみ。US比率が高いのでドル表記の併記は要検討（Stripe側の通貨設定と整合させる必要あり）。
- **スクリーンショット**: ニコ生・17LIVEを含む登録画面に差し替えるとPF数の訴求が伝わる。現行は5PF時代のもの。
