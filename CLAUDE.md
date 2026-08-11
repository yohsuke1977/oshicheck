# 推し通知 - ライバー配信アラート（旧称: oshicheck）

## コンセプト
推しのライバーがどのプラットフォームで配信開始しても、まとめて通知を受け取れるChrome拡張。
YouTube Live・Twitch・ツイキャス・SHOWROOMなどを横断して一元管理する。

**差別化**: 既存競合はTwitch単体か欧米プラットフォームのみ。日本のライバーカルチャー（SHOWROOM・17Live・ツイキャス）に特化したものは存在しない。

---

## 技術構成

```
Chrome拡張:  Vanilla JS（ビルド不要）
バックエンド: Vercel Functions（APIプロキシ）
DB・認証:    未実装（将来: Supabase）
```

- APIキーはVercel環境変数で管理。ユーザーはAPIキー不要。
- 拡張機能 → https://oshicheck.vercel.app/api/ → YouTube/Twitch API
- ポーリング: chrome.alarmsで2分おきにバックグラウンド実行

### 環境変数（Vercel）
- `YOUTUBE_API_KEY` — Google Cloud Console で取得
- `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — dev.twitch.tv で取得

---

## 競合調査（2026年5月）

### Notilive（iOS/macOS）
- App Store: https://apps.apple.com/jp/app/live-notifications-notilive/id6743936073
- **Twitch専用**（他プラットフォーム非対応）
- 対象: 洋ゲー系ストリーマーのファン
- 料金: 無料 + Pro月$2.99 / 年$19.90
- レビュー少なく新参。日本市場は無視。

### Stream Live（Chrome拡張）
- Chrome Web Store: doepggdkcpgpoahobdnbppmbcfeplijh
- 対応: Twitch・YouTube・Kick・GoodGame・VK Video（**日本プラットフォームなし**）
- 評価: 4.0/5
- 料金: 無料（50チャンネルまで）+ Premium月$2.80 / 年$28（500チャンネルまで）
- 差別化ポイント: チャンネル数のみ。機能差なし。

### 共通の弱点
- SHOWROOM・17Live・ツイキャス・ニコニコ生放送が**全滅**
- 日本語対応なし
- → 「推し通知」の参入余地あり

---

## 対応プラットフォーム（優先度順）

| # | プラットフォーム | API種別 | 実装状況 |
|---|---|---|---|
| 1 | YouTube Live | 公式（Data API v3） | ✅ MVP実装済み |
| 2 | Twitch | 公式（Helix API） | ✅ MVP実装済み |
| 3 | ツイキャス | 公式あり | ✅ 実装済み |
| 4 | SHOWROOM | 非公式・安定 | ✅ 実装済み |
| 5 | ニコニコ生放送 | 非公式・認証不要 | ✅ 実装済み（ユーザー生放送のみ） |
| 5.5 | Kick | **公式API** | ✅ 実装済み |
| 6 | 17Live | 非公式・認証不要 | ✅ 実装済み |
| 7 | Pococha | 非公式 | ✗ **実装不可**（2026-07-25に実測で確認・Issue #12）|
| 8 | ふわっち | 非公式 | ✅ 実装済み |

**対象外（当面）**: TikTok Live・Instagram Live → 公式APIなし・ブロック積極的

### ニコニコ生放送の実装メモ（2026-07-25・v0.2.0で提供）
- 状態取得: `GET https://live.nicovideo.jp/front/api/v2/user-broadcast-history?providerId=<userId>&providerType=user&isIncludeNonPublic=false&offset=0&limit=5&withTotalCount=false`（**認証不要**）。`programsList[].program.schedule.status === 'ON_AIR'` で判定し、その番組の `id.value`（lvID）を視聴URLに使う。予約番組が先頭に来て配信中を隠すことがあるため先頭1件ではなく数件見る。
- lv → 配信者の逆引き: `GET https://api.cas.nicovideo.jp/v1/services/live/programs/<lvID>`（認証不要・`providerType` / `providerId` / `liveCycle` が返る）。
- 追跡単位は **ユーザーID（providerId）**。ニコ生はコミュニティ紐付けを廃止済みで `socialGroupId` は `co0` 固定のため、コミュニティIDは使えない。
- **チャンネル生放送（`ch` 始まり）は非対応**。配信履歴APIが `providerType=official` で引けるものの ON_AIR を返さず常に `RELEASED` になり、配信中を判定できない（cas API では `on_air` と出るので齟齬がある）。`api/channel-info.js` の追加時点で明示的に弾いている。
- 旧 `https://live2.nicovideo.jp/watch/<lv>/programinfo` は 401。「API認証必須」はここだけの話で、上記の経路なら認証不要（かつてCLAUDE.mdに「実装不可」と書いていたのは誤り）。

### 17LIVEの実装メモ（2026-07-25・v0.2.0で提供）
- 状態取得: `GET https://api-dsa.17app.co/api/v1/lives/<roomID>`（**認証不要**）。`status` は実測で **2=配信中 / 0=オフライン**（検索APIの配信中一覧30件と非配信ユーザーを突き合わせて検証）。存在しない roomID は HTTP 520 + `{"errorMessage":"stream not found"}`。
- このAPI1本で状態・配信者名（`userInfo.displayName` / `openID`）・アイコン（`userInfo.picture` → `https://cdn.17app.co/<picture>`）が全部取れるので、status と channel-info の両方で使っている。
- 追跡単位は **roomID**（数値・ユーザーごとに固定。配信中は `liveStreamID` と一致）。`userID` はUUIDで別物。
- URL形式: `/live/:roomID` `/profile/r/:roomID` `/profile/u/:userID(UUID)`。UUID形式だけ `GET /api/v1/users/<uuid>/info` の `roomID` で解決してから使う。
- 配信中ライバーの探索（デバッグ用）: `GET /api/v1/search?q=<2文字以上>&region=JP&count=30` が `lives`（配信中）と `accounts` を返す。パラメータ名は `q`（`query`ではない）で `region` 必須。
- APIホストは `api-dsa` / `wap-api` / `api.17app.co` のいずれでも同じレスポンス。

### Kickの実装メモ（2026-07-25・v0.2.1で提供）
- **公式APIがある**。`GET https://api.kick.com/public/v1/channels?slug=<slug>` で `stream.is_live` / `viewer_count` / `stream_title`。表示名とアイコンは無いので `GET /public/v1/users?id=<broadcaster_user_id>` を併用。
- 認証は **client_credentials の App Access Token**（`https://id.kick.com/oauth/token`）。**ユーザーのKickログインは不要**でTwitchと同じ形。scopeは空で通る。トークンの `expires_in` は約60日と長い。env: `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET`。
- **1リクエストで最大50 slug**まとめられるので、追跡数が増えてもリクエスト数がほぼ増えない（対応PFの中で最も安い）。
- **落とし穴**: slugは英数字と`-_`で**最大25文字**。25文字超が1つでも混ざると**リクエスト全体が400になり、同じバッチの他チャンネルまでオフライン判定に巻き込まれる**。`fetchKick` は事前に `KICK_SLUG_RE` で弾いて隔離している（実装時に踏んだ）。存在しないslugは200で単に応答から省かれるだけなので無害。
- 非公式の `kick.com/api/v2/channels/<slug>` はCloudflareで403（`Request blocked by security policy`）。**公式APIの方を使うこと**。

### Pocochaが実装不可な理由（2026-07-25に実測・再調査不要）
ニコ生・17LIVEと同じ手法で再検証したが、**Pocochaだけは本当に閉じている**。根拠4点:
1. **Web版に視聴機能が無い**。`www.pococha.com` はNext.js製のマーケティングサイト（ライバーインタビューとLPのみ）で、配信データを一切持たない。ブラウザ用クライアントが存在しない＝匿名で叩けるWeb APIも存在しない。
2. `api.pococha.com` は**全パスが `401 Unauthorized`（code 20002）**。17パス試して16が401。通常は公開されている `v1/version` `v1/config` すら401＝ルーティング手前のゲートウェイで全面認証。エンドポイント個別の権限設定ではない。
3. 唯一401でなかった `v1/users/<id>` は、**IDに何を入れても（`abc`でも）同一の500**を返すだけで情報を返さない。
4. 共有リンク（`pococha.page.link`）は中身が空のFirebase Dynamic Linksシェルで、OGPも配信状態も持たない。
- 補強材料: 日本の18PFを集約している live-ranking.com が**Pocochaだけ対象外**にしている。
- 唯一の突破口はアプリのトークン取得だが、端末/アカウント登録とアプリのなりすましが必要でToS違反。トークンローテーションや端末アテステーションで壊れやすくもあり、**やらない**。

---

## マネタイズ

**① フリーミアム（メイン）**
- 無料: 追跡5チャンネルまで
- Pro ¥300〜500/月: 追跡無制限・配信履歴

**② ライバー事務所へのB2B**
- 所属ライバーの露出アップ枠を事務所に販売

---

## ステータス
2026年8月 Chrome Web Store **v0.2.3 公開中**（2026-08-06審査通過・対応PF8）

### 審査で落ちた履歴（同じ轍を踏まないため）
| 日付 | 版 | 違反 | 原因と対処 |
|---|---|---|---|
| 07-26 | v0.2.0 | キーワードスパム(Yellow Argon) | PF名を3箇所に列挙していた（24回）→ 1箇所に集約（11回）。**これは的外れだった** |
| 07-27 | v0.2.1 | キーワードスパム(同上・引用箇所も同一) | 真因は回数ではなく**箇条書きの構造**。ブランド名だけが並ぶ行を羅列と判定される → **各PF名に機能説明を付けた文**に書き換え。これで解消 |
| 07-28 | v0.2.1 | 権限の使用(Purple Potassium) | `tabs` 権限が不要と指摘。実際 `chrome.tabs.create({url})` しか使っておらず、これは権限不要（`url`/`title`等の特権プロパティを読む時だけ必要）→ **manifestから `tabs` を削除**（v0.2.2） |
| 07-30 | v0.2.2 | — | **審査通過・公開**。4回目の提出で通った |
| 07-31 | v0.2.3 | ユーザーデータのプライバシー(Purple Nickel) | ポリシー記載不足。LP側(oshialert.com/privacy)を12セクションに拡充 → **これは対象違いだった** |
| 08-03 | v0.2.3 | 同上（文面完全同一） | **真因**: ストア登録URLは `yohsuke1977.github.io/oshicheck/privacy-policy.html`（本repoのGitHub Pages）で、2026-06-02版のまま事実と異なる記載を含んでいた → 同内容に差し替え |
| 08-06 | v0.2.3 | — | **審査通過・公開**。登録URLも `oshialert.com/privacy` に変更済み |
| 08-11 | （掲載情報のみ） | — | スクリーンショットを8PF対応版に差し替え・**審査通過**。パッケージ変更なし |

**ポリシー/URL系で却下されたら、まず「ストアに登録されているURLはどれか」を確認する。** 直す対象を間違えると何度出しても通らない。プライバシーポリシーの原本は **`privacy-policy.html`（本repo・GitHub Pages・ストア登録先）** と `oshi-lp/privacy/`（LP用・日英）の2系統があり、両方を揃える必要がある。

**教訓**: 却下が続いても違反IDと引用箇所を見比べること。引用が前回と同一なら診断が間違っている。違反が変われば前の問題は解消している。

**完成済み機能**
- YouTube / Twitch / ツイキャス / SHOWROOM / ふわっち / ニコニコ生放送 / 17LIVE / Kick 対応
- Firebase認証・Firestoreチャンネル同期
- フリーミアム（無料5チャンネル・Pro ¥480/月）
- Stripe決済（本番モード稼働中）
- GA4解析（Measurement Protocol）
- アイコンバッジ表示

**GitHubリポジトリ**: https://github.com/yohsuke1977/oshicheck
**Vercel**: https://oshicheck.vercel.app
