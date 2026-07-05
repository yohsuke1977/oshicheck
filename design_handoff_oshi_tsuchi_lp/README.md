# Handoff: 推し通知 ランディングページ

## Overview
Chrome拡張「推し通知」（YouTube・Twitch・SHOWROOM・ツイキャス・ふわっちの配信開始をまとめて通知する拡張）の1ページ完結LP。単一ゴールは **Chrome Web Storeでのインストール**。CTAは全て「無料でインストール」で統一。

## About the Design Files
このバンドル内のファイルは **HTMLで作成されたデザインリファレンス** です。意図した見た目と挙動を示すプロトタイプであり、そのまま本番投入するコードではありません。タスクは、このデザインを対象コードベースの既存環境（React / Vue / Astro / 静的HTML等）の慣習とライブラリで **再実装** することです。環境が未定の場合、SEO重視の静的LPなので Astro / Next.js（SSG）/ 素のHTML+CSS など軽量な静的出力を推奨します。

`推し通知LP.dc.html` は独自のコンポーネント形式（テンプレート + ロジッククラス）ですが、マークアップ・インラインスタイル・コピーは全てそのまま読めます。`{{ hole }}` はロジッククラス（ファイル末尾の `Component` クラス）の `renderVals()` が返すデータです。

## Fidelity
**High-fidelity（hifi）**。色・タイポグラフィ・余白・コピーは最終版。ピクセル単位で忠実に再現してください。

## Page Structure（上から順）

### 0. ヘッダー（sticky）
- 高さ: padding 16px / 横 `clamp(20px, 5vw, 64px)`。`position: sticky; top: 0`、背景 `rgba(14,14,16,0.9)` + `backdrop-filter: blur(12px)`、下ボーダー `1px solid #26262c`、z-index 50。
- 左: アイコン画像 32×32（radius 8px）+「推し通知」（900 / 18px）。
- 右: CTAピルボタン（後述のCTA仕様、小サイズ: 14px / padding 10px 20px / radius 999px）。

### 1. ヒーロー（H1）
- padding: `clamp(56px,9vw,120px)` 上 / `clamp(48px,7vw,96px)` 下。
- 背景に紫のradial glow: 中央上 `radial-gradient(ellipse, rgba(145,71,255,0.22), transparent 70%)` 900×500px、`pointer-events: none`。
- 2カラム flex（`flex-wrap: wrap`、gap `clamp(32px,5vw,64px)`）。左テキスト `flex: 1 1 420px; max-width: 560px`、右画像 `flex: 1 1 380px; max-width: 520px`。
- バッジピル:「日本発の配信通知Chrome拡張」— border `#26262c`、bg `#18181b`、13px `#adadb8`、赤い点滅ドット付き。
- **H1**: 「推しの配信、もう見逃さない。」 — `clamp(34px, 5.5vw, 56px)` / 900 / line-height 1.3。「見逃さない」のみ `#bf94ff`。改行位置: 「推しの配信、<br>もう見逃さない。」
- サブ: 「YouTube・Twitch・SHOWROOM・ツイキャス・ふわっち。推しの配信開始を、まとめてお知らせするChrome拡張。」 — `clamp(15px,1.6vw,18px)` / `#adadb8`。
- CTA大ボタン + 隣に「Chrome Web Storeで公開中」（13px `#adadb8`）。
- 右: `ss.png`（拡張ポップアップのスクショ）。radius 16px、border `1px #26262c`、shadow `0 24px 64px rgba(0,0,0,0.6), 0 0 80px rgba(145,71,255,0.12)`、`floatUp` アニメ（6s、translateY 0→-10px→0）。右上に赤LIVEバッジ（bg `#eb0400`、白文字 900/13px、radius 8px、白点滅ドット、位置 top:-14px right:-8px）。
- alt: 「推し通知の拡張ポップアップ画面。配信中の推しにLIVEバッジが表示されている」

### 2. 課題提起（H2: こんな「見逃し」、ありませんか？）
- 帯背景 `#18181b`、上下ボーダー `1px #26262c`。セクションpadding: `clamp(48px,7vw,96px)` / 横 `clamp(20px,5vw,64px)`（以降全セクション共通）。
- リード文: 「配信通知がバラバラだと、推し活はこうなりがち。」（中央 / 15px / `#adadb8`）
- カード3枚: `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`, gap 20px。カード: bg `#0e0e10`、border `#26262c`、radius 16px、padding 28px 24px。上に44×44アイコンチップ（radius 12px、bg `rgba(145,71,255,0.12)`、stroke色 `#bf94ff` の線画SVG）。テキスト15px/500。
  1. 「YouTubeの通知が来なくて、気づいたら配信が終わってた」（ベルに斜線アイコン）
  2. 「SHOWROOMもツイキャスも、毎回サイトを開いて確認するのが面倒」（モニターアイコン）
  3. 「推しが増えるほど、どこで配信してるか分からなくなる」（時計アイコン）

### 3. 機能紹介（H2: 推し通知が、ぜんぶまとめて見張ります。）
- 通常背景 `#0e0e10`。リード: 「配信通知に必要な機能を、ひとつの拡張に。」
- カード4枚: `repeat(auto-fit, minmax(240px, 1fr))`, gap 20px。bg `#18181b`、border `#26262c`、radius 16px。hoverで `border-color: #9147ff`。h3 17px/700、本文 14px `#adadb8`。
  - **横断通知**: 複数プラットフォームの配信開始をデスクトップ通知でお知らせ。（ベル）
  - **件数バッジ**: 今ライブ中の推しの人数がアイコンに表示されます。（バッジ/画面）
  - **ワンクリック視聴**: 通知やポップアップから直接視聴ページへ移動できます。（再生▶）
  - **クラウド同期**: ログインすれば別のPCでも同じ推しリストが使えます。（クラウド）

### 4. 対応プラットフォーム（H2: 日本の“推し文化”に、ちゃんと対応。）
- 帯背景 `#18181b` + 上下ボーダー。中央揃え、max-width 900px。
- ピルバッジ横並び（flex-wrap, gap 12px）: bg `#0e0e10`、border `#26262c`、radius 999px、padding 12px 22px、700/15px。各ピル左に10pxのカラードット:
  - YouTube Live `#ff0000` / Twitch `#9147ff` / SHOWROOM `#00d4e8` / ツイキャス `#00a0dc` / ふわっち `#ff8c00`
- 補足文: 「海外製の通知ツールはYouTube・Twitchだけ。推し通知は SHOWROOM・ツイキャス・ふわっち にも対応した、数少ない日本発の配信通知ツールです。」（「SHOWROOM・ツイキャス・ふわっち」は `<strong>` + `#bf94ff`）

### 5. 使い方3ステップ（H2: 登録は30秒。）
- リード: 「むずかしい設定は一切ありません。」
- カード3枚（機能カードと同スタイル）。大きなステップ番号: 40px / 900 / `rgba(145,71,255,0.4)`。
  1. **推しのチャンネルURLを貼る** — YouTubeやSHOWROOMなどのチャンネルURLを登録するだけ。
  2. **配信が始まると自動で通知** — 拡張がバックグラウンドで見張り、開始と同時にお知らせ。
  3. **クリックしてすぐ視聴** — 通知をクリックすれば、そのまま視聴ページへ。
- 末尾中央にCTAボタン再掲（17px / padding 14px 30px）。

### 6. 料金（H2: まずは無料で。）
- 帯背景 `#18181b`、max-width 800px、2カラム `repeat(auto-fit, minmax(260px, 1fr))`。
- **無料カード**: bg `#0e0e10`、border `#26262c`、radius 20px、padding 32px 28px。ラベル「無料」14px/700/`#adadb8`。価格「¥0 /ずっと」36px/900。チェックリスト（✓は `#bf94ff`）: 5チャンネルまで登録 / 全プラットフォーム対応 / デスクトップ通知。
- **Proカード**: bg `linear-gradient(160deg, rgba(145,71,255,0.16), rgba(145,71,255,0.04))`、border `1px solid #9147ff`。右上に「おすすめ」バッジ（bg `#9147ff`、radius 999px、12px/700、位置 top:-12px right:20px）。ラベル「Pro」`#bf94ff`。「月額プラン」36px/900。リスト: **無制限**に登録・追跡 / 全プラットフォーム対応 / クラウド同期。

### 7. FAQ（H2: よくある質問）— アコーディオン
- max-width 720px、縦stack gap 12px。各項目: bg `#18181b`、border `#26262c`、radius 14px。
- 質問行はbutton全幅（15px/700、padding 18px 20px）、右端に `+` / `−`（`#bf94ff` 18px）。回答は開いた時のみ表示（14px `#adadb8`、padding 0 20px 18px）。
- 初期状態: 1問目が開いている。開けるのは同時に1つ（他を開くと閉じる。同じ質問をクリックで全閉可）。
- Q&A:
  1. 無料で使えますか？ → はい、5チャンネルまで無料です。
  2. APIキーの設定は必要？ → 不要です。URLを登録するだけで使えます。
  3. スマホで使える？ → 現在はPCのChrome向けです。
  4. どのサイトに対応？ → YouTube Live・Twitch・SHOWROOM・ツイキャス・ふわっちです。

### 8. フッターCTA + フッター
- padding `clamp(64px,9vw,128px)`、中央揃え、上ボーダー。下部に紫glow（ヒーローと同じgradient、bottom:-240px）。
- H2: 「推しの“配信開始”を、いちばん早く。」 `clamp(28px,4.4vw,44px)` / 900。改行: 「推しの“配信開始”を、<br>いちばん早く。」
- 特大CTA: `clamp(18px,2.2vw,22px)` / 900 / padding 20px 44px / radius 16px / shadow `0 12px 48px rgba(145,71,255,0.45)`。
- フッター: 上ボーダー、padding 28px、flex space-between（wrap）。左: アイコン20×20 + 「© 推し通知」。右nav: プライバシーポリシー(`/privacy`)・お問い合わせ(`/contact`)・ブログ(`/blog`)。13px `#adadb8`、hoverで `#efeff1`。

## CTA仕様（全ボタン共通）
- 文言: 「無料でインストール」で統一。左に赤ドット（`#eb0400`、`pulseLive` で点滅）。
- リンク先: `https://chromewebstore.google.com/detail/cplmjepdmjcnojabbcniodaffdoemghg`（`target="_blank" rel="noopener"`）
- bg `#9147ff`、白文字、hoverで `#a86bff` + shadow強め。ヒーロー大: 18px/700/padding 16px 32px/radius 14px/shadow `0 8px 32px rgba(145,71,255,0.35)`。
- 配置箇所: ヘッダー / ヒーロー / 使い方末尾 / フッターCTA の計4箇所。

## Interactions & Behavior
- **FAQアコーディオン**: state `openFaq: number`（-1で全閉、初期値0）。クリックでトグル、排他的に1つだけ開く。
- **pulseLive** keyframes: `0%,100% {opacity:1} 50% {opacity:0.35}`、1.6s ease-in-out infinite。全CTAの赤ドットとLIVEバッジに適用。
- **floatUp** keyframes: `0%,100% {translateY(0)} 50% {translateY(-10px)}`、6s ease-in-out infinite。ヒーロー画像に適用。
- ホバー: CTA明るく、機能カードのborderが紫に、フッターリンク文字色が明るく。
- レスポンシブ: メディアクエリなし。`clamp()` + `flex-wrap` + `grid auto-fit` のみで完結。横スクロール禁止（`overflow-x: hidden` をhtml/bodyに）。

## SEO要件
- `<title>`: 推し通知｜YouTube・SHOWROOM・ツイキャス・ふわっちの配信をまとめて通知
- meta description: 推しの配信開始を複数プラットフォーム横断でお知らせする無料のChrome拡張。SHOWROOM・ツイキャス・ふわっちにも対応。
- H1はヒーロー見出しのみ。各セクション見出しはH2、カード見出しはH3。
- 全画像に `alt`。軽量・画像最適化を優先（ss.pngは3.3MBあるので **WebP変換 + 幅1040px程度にリサイズ推奨**）。

## Design Tokens
- 背景ベース `#0e0e10` / サーフェス `#18181b` / ボーダー `#26262c`
- 本文 `#efeff1` / 補助テキスト `#adadb8`
- アクセント紫 `#9147ff`（hover `#a86bff`）/ 明るめ紫 `#bf94ff` / ライブ赤 `#eb0400`
- フォント: **Noto Sans JP**（Google Fonts、weights 400/500/700/900）。line-height 1.7（見出しは1.3前後）。
- radius: カード16px、料金カード20px、FAQ 14px、CTA 14–16px、ピル999px
- セクションpadding: 縦 `clamp(48px, 7vw, 96px)`、横 `clamp(20px, 5vw, 64px)`
- 帯セクション（課題・プラットフォーム・料金）は `#18181b` + 上下ボーダーで交互のリズム。

## Assets
- `assets/icon128.png` — 拡張アイコン（ヘッダー・フッター・favicon）
- `assets/ss.png` — 拡張ポップアップのスクショ（ヒーロー用、1992×1658）
- `assets/screenshot1.png` — 予備スクショ（現デザインでは未使用。機能紹介での使用も可）
- アイコン類は 24×24 viewBox / stroke-width 2 のインライン線画SVG（lucide風）。任意のアイコンライブラリで代替可。

## Files
- `推し通知LP.dc.html` — デザイン本体（テンプレート + データ/FAQロジック）
- `assets/` — 上記画像
