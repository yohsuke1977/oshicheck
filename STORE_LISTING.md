# Chrome Web Store 掲載文言（v0.2.1 / 2026-07-26 改訂）

ストア掲載情報の原本。過去に何度も作り直しているので、ここを唯一の原本にして差分で管理する。

**文字数上限**: 名前 75字 / 短い説明 132字 / 詳細な説明 16,000字
**短い説明と名前は `_locales/*/messages.json` の `extName`・`extDesc` が原本**（manifestから引かれるのでダッシュボードでは編集しない）。
**詳細な説明はパッケージ(zip)のアップロード後に出るフォームに入力する**（コード側には無い。だからここに原本を置く）。

CTAリンクはID直リンクを使う（名前変更に強い）:
https://chromewebstore.google.com/detail/cplmjepdmjcnojabbcniodaffdoemghg

> ## ⚠️ 2026-07-26: キーワードスパムで却下された（必読）
> v0.2.0 が **キーワードスパム**（参照ID `Yellow Argon` / ルーティングID `FZSL`）で不承認。
> 指摘箇所は日本語詳細説明の「■ 対応プラットフォーム」リスト周辺（機械翻訳された状態で引用された）。
> **原因**: PF名を「こんな人におすすめ」「対応プラットフォーム」「差別化段落」の**3箇所すべてに列挙**しており、
> そこへニコ生・17LIVEを足したことで出現回数が **11回→24回** に増え閾値を超えた。
> **1回目の対処（失敗）**: PF名の出現回数を24→11回に削減。→ **2026-07-27に再び却下**。
> 引用された違反箇所が**前回と1文字も変わらなかった**ことから、問題は「重複」ではなく
> **箇条書きリストの構造そのもの**だと判明。ブランド名だけが連続して並ぶ形を、
> 分類器がキーワードの羅列と見なしている。ポリシー文言の「**説明的でない**メタデータ」がこれ。
>
> **2回目の対処（本命）**: PF名を**箇条書きから外し、1つずつ機能説明を伴う文**に書き換えた。
> 例:「YouTube Live では、ベル通知に気づけなかった配信もPC側で検知してお知らせします。」
> 短い説明もブランド名5個→2個に減らし「8つの配信サイト」という表現に寄せた。
>
> **今後PFを追加するときの鉄則**:
> 1. **ブランド名だけの行を作らない**。必ずそのPFで何ができるかの説明とセットにする。
> 2. 出現回数より**構造**を見る。名前が連続して並んでいたら危険。
> 3. 短い説明でもブランド名の羅列を避け、2〜3個+「◯サイト」に留める。
> 実績値: 却下24回 / 修正後10回(7PF) / **Kick追加後11回(8PF)＝5PF時代に通っていた版と同水準**。

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
| ja | `推しの配信開始をデスクトップ通知でお知らせする無料のChrome拡張。YouTube・Twitchから日本のライバー系サイトまで、8つの配信サイトを横断して見逃しを防ぎます。` | 87 |
| en | `Desktop alerts the moment your favorite streamers go live. Covers 8 services, from Twitch and YouTube to Japan's liver platforms.` | 129 |

英語は上限132字に対して130字でほぼ限界。PFを増やす際は言い回しから削ること。
**2026-07-26改訂**: キーワードスパム却下を受けて、短い説明も全PF列挙をやめ「◯サイト」表記＋代表数件に変更（日本語はPF名8回→5回）。
短い説明は却下理由に**挙がっていない**が、閾値が不明なため保守側に倒した。検索結果では途中で切れるので、長い羅列より「8サイト」の方が広さが伝わる判断でもある。

---

## 3. 詳細な説明（日本語）— パッケージのアップロード後にフォームで入力

**この文章はストアに実際に入っているものをベースにしている**（構成・語り口を変えない方針。
今のインストールを取れている文章なので、PF追加時は列挙への追記だけに留める）。

v0.2.0での変更は3か所のみだったが、それが却下の原因になった（上部の警告参照）。当時の変更:
1. 「こんな人におすすめ」のPF列挙に `ニコ生・17LIVE` を追加
2. 「対応プラットフォーム」に2行追加（ニコ生は**ユーザー生放送のみ対応**なので注記を入れる。
   チャンネル生放送を登録しようとした人が「動かない」と低評価を付けるのを防ぐため）
3. 差別化の段落の列挙に `ニコニコ生放送・17LIVE` を追加

```
「推し通知」は、あなたの推し（VTuber・配信者・ライバー）が配信を始めたら、
プラットフォームを横断してまとめて通知してくれるChrome拡張機能です。

■ こんな人におすすめ
・複数の配信サイトを毎回チェックするのが面倒
・アプリの通知が来なくて配信を見逃してしまう
・推しがサイトをまたいで配信していて、追いきれない
・VTuberも顔出しストリーマーも、まとめて追いたい

■ 対応している配信サイトと、それぞれでできること

YouTube Live では、ベル通知に気づけなかった配信もPC側で検知してお知らせします。
Twitch では、フォロー中の配信者が始めたタイミングでデスクトップに通知が出ます。
SHOWROOM は、アプリを開いていない時間帯の配信開始もキャッチできます。
ツイキャス（TwitCasting）は、突発的なゲリラ配信の見逃しを減らすのに役立ちます。
ふわっち は、PCで別の作業をしながらでも配信開始に気づけます。
ニコニコ生放送 は、ユーザー生放送に対応しています（チャンネル生放送・公式番組は対象外です）。
17LIVE は、スマホアプリを起動していない時間帯の配信開始も拾えます。
Kick は、日本語配信者が増えてきたことを受けて対応しました。

海外製の通知ツールは大手2サイトのみの対応がほとんどです。
「推し通知」は日本の配信・ライバー文化のサイトに幅広く対応しているのが特徴です。

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

## 4. 詳細な説明（英語）— 同じくアップロード後のフォームで入力

**これもストアに実際に入っている文章がベース**。日本語版とは意図的に構成が違う
（短く刺す・海外の日本系VTuber/ライバーファンを狙い撃ち・✅の3点）。この構成は崩さない。

v0.2.0での変更は3か所のみだったが、それが却下の原因になった（上部の警告参照）。当時の変更:
1. PF列挙に `Niconico Live and 17LIVE` を追加
2. 差別化クレームの列挙に `Niconico Live or 17LIVE` を追加
3. 末尾にニコ生の対応範囲を1行追記（日本語版と同じ理由＝チャンネル生放送での低評価防止。
   英語版は短さが武器なので括弧書きを列挙に混ぜず独立した1文にした）

1行目と ✅ の行は変更なし。

**「the only extension」クレームは維持可能**（2026-07-25の競合調査で確認）:
Chrome拡張の Stream Live は日本PF非対応、live-ranking.com はサイトであって拡張ではなく
通知機能も無い。ニコ生・17LIVE追加で根拠はむしろ強化された。詳細は [[oshicheck-platform-research]]。

```
Oshi Alert – the only extension that covers Japanese streaming platforms.
Get instant desktop notifications when your favorite VTubers, idols and streamers go live, all in one place.

■ What it does on each service

On YouTube Live it catches streams even when the bell notification never reaches you.
On Twitch you get a desktop alert the moment a channel you follow goes live.
SHOWROOM streams are detected without keeping the mobile app open.
TwitCasting is where sudden, unannounced streams are easiest to miss, so we watch it for you.
WhoWatch lets you notice a stream while you keep working on your PC.
Niconico Live is supported for user broadcasts (channel and official programs are not covered).
17LIVE streams are picked up even when the phone app is closed.
Kick was added as more Japanese-speaking streamers moved there.

Perfect for overseas fans of Japanese VTubers and livers: most notifiers cover only the two big Western platforms.

✅ Free for up to 5 channels ✅ One-click to open the stream ✅ Works while you work — never miss a guerrilla stream again.
```

## 5. 今後の検討（未実施）

- **名前へのPFキーワード追加**: CWS内検索がインストールの主経路（LP経由のインストールは14日で1件・GSC/GA4実測）なので、名前に `ニコ生` `17LIVE` を入れると流入が増える可能性がある。案:
  - A: `推し通知 - VTuber・ライバーの配信通知（ニコ生・ツイキャス・SHOWROOM対応）`（45字）
  - B: `推し通知 - ライバー・VTuberの配信通知｜ニコ生/17LIVE/ツイキャス対応`（42字）
  - ただし検索結果での表示は先頭30〜40字程度で切れる。既存ユーザーの認知を変えるコストもあるので、変えるなら審査通過後に単独で試して効果を測ること（同時に変えると何が効いたか分からなくなる）。
- **Proの英語表記**: 現在は円建て（¥480）のみ。US比率が高いのでドル表記の併記は要検討（Stripe側の通貨設定と整合させる必要あり）。
- **スクリーンショット**: ニコ生・17LIVEを含む登録画面に差し替えるとPF数の訴求が伝わる。現行は5PF時代のもの。
