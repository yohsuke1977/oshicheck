// GA4 Measurement Protocol helper（全コンテキスト共通）
// background.js: importScripts('analytics.js')
// popup/options: <script src="analytics.js"> で読み込む

const _GA_API = 'https://oshicheck.vercel.app/api/analytics';

// 拡張機能 → API 間の簡易共有キー（オープンプロキシ悪用の抑止）。
// Vercel環境変数 EXT_SHARED_KEY に同じ値を設定すると status/channel-info が
// このヘッダを要求するようになる（未設定なら従来通り誰でも通る）。
const EXT_SHARED_KEY = 'oshi_ext_2f9c1a7be34d48f0a1c6b5d7e9';

async function _getClientId() {
  const { gaClientId } = await chrome.storage.local.get('gaClientId');
  if (gaClientId) return gaClientId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ gaClientId: id });
  return id;
}

async function sendEvent(name, params = {}) {
  try {
    const client_id = await _getClientId();
    await fetch(_GA_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, name, params })
    });
  } catch (e) {
    // Silently fail — analytics must never break the app
  }
}
