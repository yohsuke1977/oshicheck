// GET /api/health
// 配信サイトごとの取得状況（死活）を返す。朝のまとめメール（daily-digest/src/oshi-health.js）が読む。
// 記録は api/status.js の recordHealth が Redis の health:<pf> に書いている。
//
// status:
//   down  … 失敗が続き、最後に取れてから DOWN_MIN 分を超えた（2026-11 のツイキャス 401 の型）
//   quiet … 取れてはいるが、QUIET_H 時間「配信中」を1件も見ていない
//           （エラーにならずに常にオフラインを返す壊れ方。追跡が少ないPFでは本当に誰も配信していないこともある）
//   idle  … IDLE_H 時間取得していない（誰も追っていない／Redis未設定）
//   ok
// 秘密は含まない（失敗理由は HTTP ステータスと上流のエラー文だけ）ので認証は付けない。

const { getRedis } = require('./_redis');

const PLATFORMS = ['youtube', 'twitch', 'twitcasting', 'showroom', 'whowatch', 'niconico', '17live', 'kick'];
const DOWN_MIN = 60;
const QUIET_H = 72;
const IDLE_H = 24;

function judge(h, now) {
  const num = (v) => (v == null || v === '' ? null : Number(v));
  const okAt = num(h?.okAt), failAt = num(h?.failAt), liveAt = num(h?.liveAt), since = num(h?.since);
  const base = { okAt, failAt, failDetail: h?.failDetail || null, liveAt, since };
  const last = Math.max(okAt || 0, failAt || 0);
  if (!last || now - last > IDLE_H * 3600_000) return { status: 'idle', ...base };
  if (failAt && (!okAt || failAt > okAt) && now - (okAt || since || 0) > DOWN_MIN * 60_000) {
    return { status: 'down', ...base };
  }
  if (since && now - since > QUIET_H * 3600_000 && (!liveAt || now - liveAt > QUIET_H * 3600_000)) {
    return { status: 'quiet', ...base };
  }
  return { status: 'ok', ...base };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();
  if (!redis) return res.status(503).json({ error: 'redis not configured' });

  let rows;
  try {
    const pipe = redis.pipeline();
    for (const p of PLATFORMS) pipe.hgetall(`health:${p}`);
    rows = await pipe.exec();
  } catch (e) {
    return res.status(503).json({ error: `redis: ${e.message}` });
  }

  const now = Date.now();
  const platforms = Object.fromEntries(PLATFORMS.map((p, i) => [p, judge(rows[i], now)]));
  res.json({ generatedAt: new Date(now).toISOString(), platforms });
};

module.exports.judge = judge;
