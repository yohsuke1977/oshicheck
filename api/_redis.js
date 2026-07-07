// Upstash Redis クライアント（REST版・サーバーレス向け）。
// Vercel Marketplace の Upstash 連携が UPSTASH_REDIS_REST_URL/TOKEN を自動注入する
// （旧Vercel KV命名の KV_REST_API_URL/TOKEN もサポート）。
// 環境変数が未設定なら null を返す＝呼び出し側は従来の直接フェッチにフォールバック（フェイルオープン）。

const { Redis } = require('@upstash/redis');

let client;
let resolved = false;

function getRedis() {
  if (resolved) return client;
  resolved = true;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

module.exports = { getRedis };
