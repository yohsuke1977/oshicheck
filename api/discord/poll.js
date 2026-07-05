// GET /api/discord/poll?secret=xxx
// GitHub Actions等から定期的に叩かれる。Firestoreの監視リスト(discordWatch)を
// 既存の /api/status で確認し、オフライン→ライブに変わったチャンネルを
// Discord Incoming Webhook に投稿する。状態はFirestoreに保存。

const { initAdmin } = require('../_firebase-admin');

const PLATFORM_LABEL = {
  youtube: 'YouTube', twitch: 'Twitch', twitcasting: 'ツイキャス',
  showroom: 'SHOWROOM', whowatch: 'ふわっち'
};

module.exports = async function handler(req, res) {
  // 呼び出し元の認証（外部cronだけが実行できるように）
  const secret = process.env.DISCORD_POLL_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return res.status(500).json({ error: 'DISCORD_WEBHOOK_URL未設定' });

  const admin = initAdmin();
  const db = admin.firestore();

  // 1) 監視リスト取得
  const snap = await db.collection('discordWatch').get();
  const items = snap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));
  if (!items.length) return res.json({ ok: true, watched: 0, posted: 0 });

  // 2) プラットフォーム別にまとめて /api/status へ
  const paramKey = { youtube: 'youtube', twitch: 'twitch', twitcasting: 'twitcasting', showroom: 'showroom', whowatch: 'whowatch' };
  const params = new URLSearchParams();
  for (const platform of Object.keys(paramKey)) {
    const ids = items.filter(i => i.platform === platform).map(i => i.channelId);
    if (ids.length) params.set(paramKey[platform], [...new Set(ids)].join(','));
  }

  const statusHeaders = {};
  if (process.env.EXT_SHARED_KEY) statusHeaders['x-oshi-key'] = process.env.EXT_SHARED_KEY;
  const statusRes = await fetch(`${process.env.BASE_URL}/api/status?${params}`, { headers: statusHeaders });
  if (!statusRes.ok) return res.status(502).json({ error: `status API ${statusRes.status}` });
  const data = await statusRes.json();

  // 3) 遷移検知＆投稿
  let posted = 0;
  for (const item of items) {
    const s = data[item.platform]?.[item.channelId];
    if (!s) continue;
    const nowLive = !!s.isLive;
    const wasLive = !!item.isLive;

    if (nowLive && !wasLive) {
      const url = streamUrl(item, s);
      await postToDiscord(webhookUrl, item, url);
      posted++;
    }

    if (nowLive !== wasLive) {
      await item.ref.set({ isLive: nowLive, lastChecked: Date.now() }, { merge: true });
    }
  }

  res.json({ ok: true, watched: items.length, posted });
};

function streamUrl(item, s) {
  const { platform, channelId } = item;
  if (platform === 'youtube') return s.videoId ? `https://www.youtube.com/watch?v=${s.videoId}` : `https://www.youtube.com/channel/${channelId}`;
  if (platform === 'twitch') return `https://www.twitch.tv/${channelId}`;
  if (platform === 'twitcasting') return s.movieId ? `https://twitcasting.tv/${channelId}/movie/${s.movieId}` : `https://twitcasting.tv/${channelId}`;
  if (platform === 'showroom') return `https://www.showroom-live.com/${channelId}`;
  if (platform === 'whowatch') return s.liveId ? `https://whowatch.tv/viewer/${s.liveId}` : `https://whowatch.tv/user/${channelId}`;
  return null;
}

async function postToDiscord(webhookUrl, item, url) {
  const label = PLATFORM_LABEL[item.platform] ?? item.platform;
  const mention = process.env.DISCORD_MENTION ? `${process.env.DISCORD_MENTION} ` : '';
  const body = {
    content: `${mention}🔴 **${item.name}** が${label}で配信を開始しました！`,
    embeds: [{
      title: `${item.name} のライブを見る`,
      url: url || undefined,
      description: `${label}`,
      color: 0xeb0400,
      thumbnail: item.thumbnail ? { url: item.thumbnail } : undefined
    }],
    // メンションの暴発防止（roleメンションのみ許可）
    allowed_mentions: { parse: ['roles', 'everyone'] }
  };
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Discord post failed:', e.message);
  }
}
