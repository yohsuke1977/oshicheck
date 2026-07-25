# Chrome Web Store 掲載文言（v0.2.0 / 2026-07-25）

ストア掲載情報の原本。過去に何度も作り直しているので、ここを唯一の原本にして差分で管理する。

**文字数上限**: 名前 75字 / 短い説明 132字 / 詳細な説明 16,000字
**短い説明と名前は `_locales/*/messages.json` の `extName`・`extDesc` が原本**（manifestから引かれるのでダッシュボードでは編集しない）。
**詳細な説明はパッケージ(zip)のアップロード後に出るフォームに入力する**（コード側には無い。だからここに原本を置く）。

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

## 3. 詳細な説明（日本語）— パッケージのアップロード後にフォームで入力

**この文章はストアに実際に入っているものをベースにしている**（構成・語り口を変えない方針。
今のインストールを取れている文章なので、PF追加時は列挙への追記だけに留める）。

v0.2.0での変更は3か所のみ:
1. 「こんな人におすすめ」のPF列挙に `ニコ生・17LIVE` を追加
2. 「対応プラットフォーム」に2行追加（ニコ生は**ユーザー生放送のみ対応**なので注記を入れる。
   チャンネル生放送を登録しようとした人が「動かない」と低評価を付けるのを防ぐため）
3. 差別化の段落の列挙に `ニコニコ生放送・17LIVE` を追加

```
「推し通知」は、あなたの推し（VTuber・配信者・ライバー）が配信を始めたら、
プラットフォームを横断してまとめて通知してくれるChrome拡張機能です。

■ こんな人におすすめ
・複数の配信サイトを毎回チェックするのが面倒
・YouTubeの通知が来なくて配信を見逃してしまう
・SHOWROOM・ツイキャス・ふわっち・ニコ生・17LIVEの推しの配信開始を逃したくない
・VTuberも顔出しストリーマーも、まとめて追いたい

■ 対応プラットフォーム
・YouTube Live
・Twitch
・SHOWROOM
・ツイキャス（TwitCasting）
・ふわっち
・ニコニコ生放送（ユーザー生放送）
・17LIVE（イチナナ）

海外製の配信通知ツールは YouTube と Twitch にしか対応していないものがほとんど。
「推し通知」は SHOWROOM・ツイキャス・ふわっち・ニコニコ生放送・17LIVE といった
日本の配信・ライバー文化に対応しているのが特徴です。

■ 使い方はかんたん
1. 推しのチャンネルURLを登録するだけ
2. 配信が始まると自動で通知＆アイコンに件数バッジ
3. 通知やポップアップからワンクリックで視聴ページへ

■ 料金
・無料で5チャンネルまで登録可能
・Proプラン（¥480/月）で無制限に登録・追跡

推しの配信を、もう二度と見逃さない。
「推し通知」で、あなたの“好き”をまとめて追いかけましょう。
```

## 4. 詳細な説明（英語）

⚠️ **現在ストアに入っている英語の詳細説明を未取得**（v0.1.6で登録済みのはずだが原文が手元にない）。
下記は日本語版と同じ構成で書いた案。実際に入っている英文を確認したうえで、
日本語と同様に「列挙への追記だけ」の最小差分に切り替えるのが望ましい。

```
Oshi Alert notifies you the moment your favorite streamer (VTuber, liver,
or streamer) goes live - across multiple platforms, all in one place.

■ WHO IT'S FOR
- Tired of checking several streaming sites over and over
- YouTube notifications never arrive and you miss the stream
- You don't want to miss streams on SHOWROOM, TwitCasting, WhoWatch, Niconico or 17LIVE
- You follow both VTubers and IRL streamers

■ SUPPORTED PLATFORMS
- YouTube Live
- Twitch
- SHOWROOM
- TwitCasting
- WhoWatch
- Niconico Live (user broadcasts)
- 17LIVE

Most live-notification tools only support YouTube and Twitch.
Oshi Alert covers SHOWROOM, TwitCasting, WhoWatch, Niconico Live and 17LIVE -
the platforms at the heart of Japan's streaming and liver culture.

■ HOW IT WORKS
1. Just register your favorite streamer's channel URL
2. Get a desktop notification and a badge count when they go live
3. One click from the notification or popup takes you to the stream

■ PRICING
- Free: up to 5 channels
- Pro (JPY 480/month): unlimited channels

Never miss your favorite streamer again.
```

## 5. 今後の検討（未実施）

- **名前へのPFキーワード追加**: CWS内検索がインストールの主経路（LP経由のインストールは14日で1件・GSC/GA4実測）なので、名前に `ニコ生` `17LIVE` を入れると流入が増える可能性がある。案:
  - A: `推し通知 - VTuber・ライバーの配信通知（ニコ生・ツイキャス・SHOWROOM対応）`（45字）
  - B: `推し通知 - ライバー・VTuberの配信通知｜ニコ生/17LIVE/ツイキャス対応`（42字）
  - ただし検索結果での表示は先頭30〜40字程度で切れる。既存ユーザーの認知を変えるコストもあるので、変えるなら審査通過後に単独で試して効果を測ること（同時に変えると何が効いたか分からなくなる）。
- **Proの英語表記**: 現在は円建て（¥480）のみ。US比率が高いのでドル表記の併記は要検討（Stripe側の通貨設定と整合させる必要あり）。
- **スクリーンショット**: ニコ生・17LIVEを含む登録画面に差し替えるとPF数の訴求が伝わる。現行は5PF時代のもの。
