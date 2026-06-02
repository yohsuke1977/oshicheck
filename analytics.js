// GA4 Measurement Protocol helper（全コンテキスト共通）
// background.js: importScripts('analytics.js')
// popup/options: <script src="analytics.js"> で読み込む

const _GA_API = 'https://oshicheck.vercel.app/api/analytics';

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
