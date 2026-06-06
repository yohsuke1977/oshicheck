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
| 5 | ニコニコ生放送 | 公式(一部) | ✗ API認証必須で実装不可 |
| 6 | 17Live | 非公式 | ✗ API認証必須（Issue #11）|
| 7 | Pococha | 非公式 | ✗ API認証必須（Issue #12）|
| 8 | ふわっち | 非公式 | ✅ 実装済み |

**対象外（当面）**: TikTok Live・Instagram Live → 公式APIなし・ブロック積極的

---

## マネタイズ

**① フリーミアム（メイン）**
- 無料: 追跡5チャンネルまで
- Pro ¥300〜500/月: 追跡無制限・配信履歴

**② ライバー事務所へのB2B**
- 所属ライバーの露出アップ枠を事務所に販売

---

## ステータス
2026年6月 Chrome Web Store公開中（v0.1.2）

**完成済み機能**
- YouTube / Twitch / ツイキャス / SHOWROOM / ふわっち 対応
- Firebase認証・Firestoreチャンネル同期
- フリーミアム（無料5チャンネル・Pro ¥480/月）
- Stripe決済（本番モード稼働中）
- GA4解析（Measurement Protocol）
- アイコンバッジ表示

**GitHubリポジトリ**: https://github.com/yohsuke1977/oshicheck
**Vercel**: https://oshicheck.vercel.app
