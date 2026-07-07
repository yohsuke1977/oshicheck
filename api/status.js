// GET /api/status?youtube=UCxxx,UCyyy&twitch=user1,user2&twitcasting=user1,user2&showroom=key1,key2&whowatch=path1,path2
// 各チャンネルのライブ状態を返す。
//
// B1第3層（コスト脱ユーザー数依存）: Upstashが設定されていれば、生存状態をRedisに
// TTLキャッシュする。同じチャンネルを何人が追っていてもTTL窓内の上流フェッチは1回だけ
// → YouTube等のAPIコストがユーザー数と無関係になる。
// Upstash未設定なら従来通り毎回直接フェッチ（フェイルオープン）。

const { getRedis } = require('./_redis');

const TTL = Number(process.env.STATUS_CACHE_TTL) || 100; // 秒。ポーリング間隔(120s)より少し短く。

const OFFLINE = {
  youtube:     { isLive: false, videoId: null },
  twitch:      { isLive: false },
  twitcasting: { isLive: false, movieId: null },
};

let twitchTokenCache = null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-oshi-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 共有キー検証（EXT_SHARED_KEY未設定なら従来通り誰でも通る＝フェイルオープン）
  const requiredKey = process.env.EXT_SHARED_KEY;
  if (requiredKey && req.headers['x-oshi-key'] !== requiredKey) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { youtube, twitch, twitcasting, showroom, whowatch } = req.query;
  const ids = {
    youtube:     split(youtube),
    twitch:      split(twitch),
    twitcasting: split(twitcasting),
    showroom:    split(showroom),
    whowatch:    split(whowatch),
  };
  const result = {};
  const redis = getRedis();

  try {
    if (redis) {
      // --- キャッシュ経路（コスト脱ユーザー数依存）---
      if (ids.youtube.length)     result.youtube     = await cachedPerChannel(redis, 'yt', ids.youtube, fetchYouTube, OFFLINE.youtube);
      if (ids.twitch.length)      result.twitch      = await cachedPerChannel(redis, 'tw', ids.twitch, fetchTwitch, OFFLINE.twitch);
      if (ids.twitcasting.length) result.twitcasting = await cachedPerChannel(redis, 'tc', ids.twitcasting, fetchTwitcasting, OFFLINE.twitcasting);
      // SHOWROOM/ふわっちは1フェッチで全ライブ一覧が返る → 一覧を丸ごと1キーにキャッシュ（定数コスト）
      if (ids.showroom.length)    result.showroom    = buildShowroom(await cachedShared(redis, 'sr:onlives', fetchShowroomLiveSet), ids.showroom);
      if (ids.whowatch.length)    result.whowatch    = buildWhowatch(await cachedShared(redis, 'ww:onlives', fetchWhowatchLiveMap), ids.whowatch);
      // CDNには載せない（Redis側で集約済み。CDNキャッシュするとRedisの共有効果を素通りする）
      res.setHeader('Cache-Control', 'no-store');
    } else {
      // --- 直接フェッチ経路（従来動作・Upstash未設定時のフォールバック）---
      if (ids.youtube.length)     result.youtube     = await fetchYouTube(ids.youtube);
      if (ids.twitch.length)      result.twitch      = await fetchTwitch(ids.twitch);
      if (ids.twitcasting.length) result.twitcasting = await fetchTwitcasting(ids.twitcasting);
      if (ids.showroom.length)    result.showroom    = buildShowroom(await fetchShowroomLiveSet(), ids.showroom);
      if (ids.whowatch.length)    result.whowatch    = buildWhowatch(await fetchWhowatchLiveMap(), ids.whowatch);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }

  res.json(result);
};

function split(v) {
  return v ? v.split(',').filter(Boolean) : [];
}

// ---------------------------------------------------------------------------
// キャッシュ層
// ---------------------------------------------------------------------------

// チャンネル単位でキャッシュ。ヒットは即返し、ミス分だけ fetchFn でまとめて取得しキャッシュ。
async function cachedPerChannel(redis, prefix, ids, fetchFn, offline) {
  const result = {};
  const keys = ids.map(id => `${prefix}:${id}`);
  const cached = keys.length ? await redis.mget(...keys) : [];

  const missing = [];
  ids.forEach((id, i) => {
    if (cached[i] != null) result[id] = cached[i];
    else missing.push(id);
  });

  if (missing.length) {
    const fresh = await fetchFn(missing);
    const pipe = redis.pipeline();
    for (const id of missing) {
      const state = fresh[id] ?? offline;
      result[id] = state;
      pipe.set(`${prefix}:${id}`, state, { ex: TTL });
    }
    await pipe.exec();
  }
  return result;
}

// 全ライブ一覧を丸ごと1キーにキャッシュ（SHOWROOM/ふわっち）。ミス時のみ上流を1回叩く。
async function cachedShared(redis, cacheKey, fetchRaw) {
  let raw = await redis.get(cacheKey);
  if (raw == null) {
    raw = await fetchRaw();
    await redis.set(cacheKey, raw, { ex: TTL });
  }
  return raw;
}

// ---------------------------------------------------------------------------
// 上流フェッチ（プラットフォーム別）
// ---------------------------------------------------------------------------

async function fetchYouTube(channelIds) {
  const key = process.env.YOUTUBE_API_KEY;
  const result = Object.fromEntries(channelIds.map(id => [id, { isLive: false, videoId: null }]));

  // 1) 各チャンネルの最近の動画IDを取得（playlistItems: 1ユニット/ch）。並列化。
  const perChannelVideoIds = {};
  await Promise.all(channelIds.map(async (channelId) => {
    try {
      const playlistId = 'UU' + channelId.slice(2);
      const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=5&key=${key}`
      );
      const items = await itemsRes.json();
      perChannelVideoIds[channelId] = (items.items || []).map(i => i.contentDetails.videoId);
    } catch (e) {
      perChannelVideoIds[channelId] = [];
    }
  }));

  // 2) 全チャンネルの動画IDをまとめて videos.list で問い合わせ（50件/呼び出し・1ユニット/呼び出し）。
  //    以前はチャンネルごとに呼んでいた分をバッチ化しquota消費を約半減。
  const allIds = [...new Set(Object.values(perChannelVideoIds).flat())];
  const liveContentById = {};
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    try {
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${key}`
      );
      const videos = await videosRes.json();
      for (const v of videos.items || []) {
        liveContentById[v.id] = v.snippet.liveBroadcastContent;
      }
    } catch (e) {
      // このバッチは判定不能 → 該当動画はオフライン扱い
    }
  }

  // 3) チャンネルごとに、最近の動画のいずれかが live か判定（playlist順で最初のものを採用）
  for (const channelId of channelIds) {
    for (const vid of perChannelVideoIds[channelId] || []) {
      if (liveContentById[vid] === 'live') {
        result[channelId] = { isLive: true, videoId: vid };
        break;
      }
    }
  }

  return result;
}

async function fetchTwitch(logins) {
  const token = await getTwitchToken();
  const query = logins.map(l => `user_login=${encodeURIComponent(l)}`).join('&');

  const res = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
    headers: {
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();

  const liveSet = new Set((data.data || []).map(s => s.user_login.toLowerCase()));
  return Object.fromEntries(logins.map(l => [l, { isLive: liveSet.has(l.toLowerCase()) }]));
}

async function fetchTwitcasting(userIds) {
  const auth = Buffer.from(
    `${process.env.TWITCASTING_CLIENT_ID}:${process.env.TWITCASTING_CLIENT_SECRET}`
  ).toString('base64');

  const result = {};
  for (const userId of userIds) {
    try {
      const res = await fetch(`https://apiv2.twitcasting.tv/users/${encodeURIComponent(userId)}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Api-Version': '2.0',
          'Accept': 'application/json'
        }
      });
      const data = await res.json();
      result[userId] = {
        isLive: data.user?.is_live ?? false,
        movieId: data.user?.last_movie_id ?? null
      };
    } catch (e) {
      result[userId] = { isLive: false, movieId: null };
    }
  }
  return result;
}

// SHOWROOM: 全ライブ一覧を1回取得し、配信中の room_url_key 配列を返す。
async function fetchShowroomLiveSet() {
  try {
    const res = await fetch('https://www.showroom-live.com/api/live/onlives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    const liveKeys = [];
    for (const genre of data.onlives || []) {
      for (const live of genre.lives || []) {
        if (live.room_url_key) liveKeys.push(live.room_url_key);
      }
    }
    return liveKeys;
  } catch (e) {
    return [];
  }
}

function buildShowroom(liveKeys, roomUrlKeys) {
  const liveSet = new Set(liveKeys);
  return Object.fromEntries(roomUrlKeys.map(k => [k, { isLive: liveSet.has(k) }]));
}

// ふわっち: 全ライブ一覧を1回取得し、user_path → {liveId,name,thumbnail} のマップを返す。
async function fetchWhowatchLiveMap() {
  try {
    const res = await fetch('https://api.whowatch.tv/lives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    const liveInfoMap = {};
    for (const cat of data) {
      for (const key of ['new', 'popular']) {
        for (const live of cat[key] || []) {
          if (live.user?.user_path) {
            liveInfoMap[live.user.user_path] = {
              liveId: live.id,
              name: live.user.name,
              thumbnail: live.user.icon_url || ''
            };
          }
        }
      }
    }
    return liveInfoMap;
  } catch (e) {
    return {};
  }
}

function buildWhowatch(liveMap, userPaths) {
  // URLが混入している場合に備えてパスだけ抽出
  const cleanPaths = userPaths.map(p =>
    p.replace(/^https?:\/\/(?:www\.)?whowatch\.tv\/(?:user|profile)\//, '').replace(/\/$/, '')
  );
  return Object.fromEntries(userPaths.map((p, i) => {
    const info = liveMap[cleanPaths[i]];
    return [p, info ? { isLive: true, ...info } : { isLive: false, liveId: null }];
  }));
}

async function getTwitchToken() {
  if (twitchTokenCache?.expiresAt > Date.now() + 60_000) return twitchTokenCache.access_token;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  twitchTokenCache = { access_token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
