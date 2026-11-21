// GET /api/status?youtube=UCxxx,UCyyy&twitch=user1,user2&twitcasting=user1,user2&showroom=key1,key2&whowatch=path1,path2&niconico=userId1,userId2&17live=roomId1,roomId2&kick=slug1,slug2
// 各チャンネルのライブ状態を返す。
//
// B1第3層（コスト脱ユーザー数依存）: Upstashが設定されていれば、生存状態をRedisに
// TTLキャッシュする。同じチャンネルを何人が追っていてもTTL窓内の上流フェッチは1回だけ
// → YouTube等のAPIコストがユーザー数と無関係になる。
// Upstash未設定、または落ちているときは毎回直接フェッチ（フェイルオープン）。
//
// 取得に失敗したチャンネルは「オフライン」ではなく結果から外す（#19）。
// 拡張・Discordボットとも、結果に無いチャンネルは前回の状態を保つ（`if (s)`）。
// オフラインで返すと「配信中 → 失敗でオフライン → 次の巡回で配信中」となり、
// 同じ配信の開始通知が2回鳴る。オフラインで返すのは「配信していない／存在しない」と
// 分かったときだけ。
// ただし失敗が長く続くと拡張は配信中のまま固まるので、最後に取得できてから HOLD 秒を
// 超えたら（＝Redisに記録が無ければ）オフラインで返す（2026-11 のツイキャスは2週間失敗し続けた）。

const { getRedis } = require('./_redis');

// 秒。この間はRedisの値をそのまま返す（上流を叩かない）。
// ミス時の上流フェッチ＆JSONパース（=Active CPUの主因）を減らすため180に設定。
// 拡張のポーリングは10分（v0.1.5〜）なので、通知遅延への影響は小さい。
const TTL = Number(process.env.STATUS_CACHE_TTL) || 180;
// 秒。Redisのキー自体の寿命。最後に取得できてからこの時間内の失敗は「分からない」
// （結果から外す）、超えたら記録が消えているのでオフラインで返す。
const HOLD = Number(process.env.STATUS_HOLD_SEC) || 1800;

const OFFLINE = {
  youtube:     { isLive: false, videoId: null },
  twitch:      { isLive: false },
  twitcasting: { isLive: false, movieId: null },
  niconico:    { isLive: false, liveId: null },
  '17live':    { isLive: false },
  kick:        { isLive: false },
};

let twitchTokenCache = null;
let kickTokenCache = null;

// 上流の取得失敗はログに残す。でないとAPIキーの失効や上流の障害に誰も気づけない
// （2026-10-28〜、ツイキャスの全面停止と認証情報リセットはこのログで分かった）。
// 401/403/429 は例外にならずに応答が返るので、res.ok も見ること。
// ログはプラットフォームごと1リクエスト1行にまとめる。
function warnFetch(platform, failed, total, detail) {
  if (failed) console.warn(`[status] ${platform} 取得失敗 ${failed}/${total}: ${detail}`);
}
function warnRedis(op, e) {
  console.warn(`[status] redis ${op} 失敗（直接取得に切り替え）: ${describe(e)}`);
}
const describe = (e) => (e && (e.cause?.code || e.message)) || String(e);
const httpError = (res, msg) => new Error(`HTTP ${res.status} ${msg || ''}`.trim());

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-oshi-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 共有キー検証（EXT_SHARED_KEY未設定なら従来通り誰でも通る＝フェイルオープン）
  const requiredKey = process.env.EXT_SHARED_KEY;
  if (requiredKey && req.headers['x-oshi-key'] !== requiredKey) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const { youtube, twitch, twitcasting, showroom, whowatch, niconico } = req.query;
  const ids = {
    youtube:     split(youtube),
    twitch:      split(twitch),
    twitcasting: split(twitcasting),
    showroom:    split(showroom),
    whowatch:    split(whowatch),
    niconico:    split(niconico),
    // 先頭が数字のためプロパティ名として分割代入できない
    '17live':    split(req.query['17live']),
    kick:        split(req.query.kick),
  };
  const redis = getRedis();

  // チャンネル単位で取得するPF（Redisキーの接頭辞と取得関数）
  const perChannel = [
    ['youtube',     'yt', fetchYouTube],
    ['twitch',      'tw', fetchTwitch],
    ['twitcasting', 'tc', fetchTwitcasting],
    ['niconico',    'nc', fetchNiconico],
    ['17live',      'sl', fetch17Live],
    ['kick',        'kc', fetchKick],
  ];
  // SHOWROOM/ふわっちは1フェッチで全ライブ一覧が返る → 一覧を丸ごと1キーにキャッシュ（定数コスト）
  const shared = [
    ['showroom', 'sr:onlives', fetchShowroomLiveSet, [], buildShowroom],
    ['whowatch', 'ww:onlives', fetchWhowatchLiveMap, {}, buildWhowatch],
  ];

  // PFごとに独立して実行し、1つの失敗がほかのPFの結果を巻き込まないようにする（#19）
  const tasks = [
    ...perChannel.filter(([p]) => ids[p].length).map(([p, prefix, fn]) => [p, () =>
      redis
        ? cachedPerChannel(redis, p, prefix, ids[p], fn)
        : fetchSafe(p, fn, ids[p]),
    ]),
    ...shared.filter(([p]) => ids[p].length).map(([p, key, fn, empty, build]) => [p, async () => {
      const raw = redis ? await cachedShared(redis, key, fn, empty) : await fn();
      return raw == null ? undefined : build(raw, ids[p]);
    }]),
  ];

  const result = {};
  const settled = await Promise.allSettled(tasks.map(([, run]) => run()));
  settled.forEach((s, i) => {
    const platform = tasks[i][0];
    if (s.status === 'fulfilled') {
      if (s.value) result[platform] = s.value;
    } else {
      // ここに来るのは想定外の例外だけ（取得失敗は各層で吸収している）。このPFだけ外す
      console.error(`[status] ${platform} 予期しないエラー:`, s.reason);
    }
  });

  // CDNにも載せる。同一ユーザーのポーリングはクエリが毎回同じなので、CDNヒット時は
  // 関数の起動自体が発生しない（Fluid Active CPUゼロ）。CDN=ユーザー内の重複排除、
  // Redis=ユーザー間の重複排除で相補的。旧バージョン(2分ポーリング)の呼び出し削減に特に効く。
  res.setHeader('Cache-Control', 's-maxage=240, stale-while-revalidate=120');
  res.json(result);
};

function split(v) {
  return v ? v.split(',').filter(Boolean) : [];
}

// 取得関数は「分かったチャンネルだけ」を返す。例外は全チャンネル不明として扱う。
async function fetchSafe(platform, fetchFn, ids) {
  try {
    return (await fetchFn(ids)) || {};
  } catch (e) {
    warnFetch(platform, ids.length, ids.length, describe(e));
    return {};
  }
}

// ---------------------------------------------------------------------------
// キャッシュ層
// 値は { s: 状態, t: 取得時刻(ms) }。t から TTL 秒以内なら新鮮、キーは HOLD 秒で消える。
// （旧形式＝状態オブジェクトそのものは t が無いので記録なし扱い→取り直して上書きされる）
// ---------------------------------------------------------------------------

const hasRecord = (c) => c != null && typeof c === 'object' && typeof c.t === 'number';

// チャンネル単位でキャッシュ。新鮮なものは即返し、それ以外だけ fetchFn でまとめて取得しキャッシュ。
async function cachedPerChannel(redis, platform, prefix, ids, fetchFn) {
  const keys = ids.map(id => `${prefix}:${id}`);
  let cached;
  try {
    cached = await redis.mget(...keys);
  } catch (e) {
    warnRedis('mget', e);
    return fetchSafe(platform, fetchFn, ids);
  }

  const now = Date.now();
  const result = {};
  const missing = [];
  const held = new Set();   // 期限切れだが最近まで取れていた＝失敗しても「分からない」で済ませる
  ids.forEach((id, i) => {
    const c = cached[i];
    if (hasRecord(c)) {
      if (now - c.t < TTL * 1000) { result[id] = c.s; return; }
      held.add(id);
    }
    missing.push(id);
  });
  if (!missing.length) return result;

  const fresh = await fetchSafe(platform, fetchFn, missing);
  const pipe = redis.pipeline();
  let writes = 0;
  for (const id of missing) {
    const state = fresh[id];
    if (state) {
      result[id] = state;
      pipe.set(`${prefix}:${id}`, { s: state, t: now }, { ex: HOLD });
      writes++;
    } else if (!held.has(id)) {
      // HOLD 秒以上取れていない（または初めて）→ 配信中のまま固まらないようオフラインで返す。
      // Redisには書かない（書くと記録が延命され、次も「分からない」になってしまう）
      result[id] = OFFLINE[platform];
    }
    // held の失敗は結果から外す → 拡張は前回の状態を保つ
  }
  if (writes) {
    try { await pipe.exec(); } catch (e) { warnRedis('set', e); }
  }
  return result;
}

// 全ライブ一覧を丸ごと1キーにキャッシュ（SHOWROOM/ふわっち）。新鮮でなければ上流を1回叩く。
// 戻り値 null は「分からない」（呼び出し側でそのPFを結果から外す）。
async function cachedShared(redis, cacheKey, fetchRaw, empty) {
  let c;
  try {
    c = await redis.get(cacheKey);
  } catch (e) {
    warnRedis('get', e);
    return fetchRaw();
  }
  const now = Date.now();
  if (hasRecord(c) && now - c.t < TTL * 1000) return c.raw;

  const raw = await fetchRaw();
  if (raw == null) return hasRecord(c) ? null : empty;
  try {
    await redis.set(cacheKey, { raw, t: now }, { ex: HOLD });
  } catch (e) {
    warnRedis('set', e);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// 上流フェッチ（プラットフォーム別）
// 返すのは状態が分かったチャンネルだけ。失敗したチャンネルは入れない。
// ---------------------------------------------------------------------------

async function fetchYouTube(channelIds) {
  const key = process.env.YOUTUBE_API_KEY;

  // 1) 各チャンネルの最近の動画IDを取得（playlistItems: 1ユニット/ch）。並列化。
  const perChannelVideoIds = {};
  const unknownChannels = new Set();
  let failed = 0, detail = '';
  await Promise.all(channelIds.map(async (channelId) => {
    try {
      const playlistId = 'UU' + channelId.slice(2);
      const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=5&key=${key}`
      );
      // 404 = アップロード再生リストが無い（チャンネルが存在しない）→ 配信していないと分かる
      if (itemsRes.status === 404) { perChannelVideoIds[channelId] = []; return; }
      const items = await itemsRes.json();
      if (!itemsRes.ok) throw httpError(itemsRes, items?.error?.errors?.[0]?.reason);
      perChannelVideoIds[channelId] = (items.items || []).map(i => i.contentDetails.videoId);
    } catch (e) {
      failed++; detail ||= describe(e);
      unknownChannels.add(channelId);
    }
  }));
  warnFetch('youtube', failed, channelIds.length, detail);

  // 2) 全チャンネルの動画IDをまとめて videos.list で問い合わせ（50件/呼び出し・1ユニット/呼び出し）。
  //    以前はチャンネルごとに呼んでいた分をバッチ化しquota消費を約半減。
  const allIds = [...new Set(Object.values(perChannelVideoIds).flat())];
  const liveContentById = {};
  const unknownVideos = new Set();
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    try {
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${key}`
      );
      const videos = await videosRes.json();
      if (!videosRes.ok) throw httpError(videosRes, videos?.error?.errors?.[0]?.reason);
      for (const v of videos.items || []) {
        liveContentById[v.id] = v.snippet.liveBroadcastContent;
      }
    } catch (e) {
      // このバッチは判定不能 → 該当動画を持つチャンネルは（ほかに配信中の動画が無ければ）不明
      warnFetch('youtube(videos)', batch.length, allIds.length, describe(e));
      batch.forEach(v => unknownVideos.add(v));
    }
  }

  // 3) チャンネルごとに、最近の動画のいずれかが live か判定（playlist順で最初のものを採用）
  const result = {};
  for (const channelId of channelIds) {
    if (unknownChannels.has(channelId)) continue;
    const vids = perChannelVideoIds[channelId];
    const liveVid = vids.find(v => liveContentById[v] === 'live');
    if (liveVid) result[channelId] = { isLive: true, videoId: liveVid };
    else if (!vids.some(v => unknownVideos.has(v))) result[channelId] = { isLive: false, videoId: null };
  }
  return result;
}

async function fetchTwitch(logins) {
  const token = await getTwitchToken();   // 失敗は例外 → fetchSafe で全チャンネル不明
  const result = {};
  let failed = 0, detail = '';
  // helix/streams は user_login 最大100件/リクエスト
  for (let i = 0; i < logins.length; i += 100) {
    const chunk = logins.slice(i, i + 100);
    try {
      const query = chunk.map(l => `user_login=${encodeURIComponent(l)}`).join('&');
      const res = await fetch(`https://api.twitch.tv/helix/streams?${query}`, {
        headers: {
          'Client-Id': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw httpError(res, data?.message);
      const liveSet = new Set((data.data || []).map(s => s.user_login.toLowerCase()));
      for (const l of chunk) result[l] = { isLive: liveSet.has(l.toLowerCase()) };
    } catch (e) {
      failed += chunk.length; detail ||= describe(e);
    }
  }
  warnFetch('twitch', failed, logins.length, detail);
  return result;
}

async function fetchTwitcasting(userIds) {
  const auth = Buffer.from(
    `${process.env.TWITCASTING_CLIENT_ID}:${process.env.TWITCASTING_CLIENT_SECRET}`
  ).toString('base64');

  const result = {};
  let failed = 0, detail = '';
  for (const userId of userIds) {
    try {
      const res = await fetch(`https://apiv2.twitcasting.tv/users/${encodeURIComponent(userId)}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Api-Version': '2.0',
          'Accept': 'application/json'
        }
      });
      // 404 = ユーザーが存在しない → 配信していないと分かる
      if (res.status === 404) { result[userId] = { isLive: false, movieId: null }; continue; }
      const data = await res.json();
      if (!res.ok || !data.user) throw httpError(res, data?.error?.message);
      result[userId] = {
        isLive: data.user.is_live === true,
        movieId: data.user.last_movie_id ?? null
      };
    } catch (e) {
      failed++; detail ||= describe(e);
    }
  }
  warnFetch('twitcasting', failed, userIds.length, detail);
  return result;
}

// ニコニコ生放送（ユーザー生放送のみ）: ユーザーの配信履歴APIの直近数件を見る。
// 公式のwatchページ用フロントAPIで、認証なしで叩ける（旧 live2 の programinfo は401）。
// ニコ生はコミュニティ紐付けを廃止済みで socialGroupId は co0 固定 → 配信者の実体は
// providerId（ユーザーID）。よってチャンネル単位キャッシュ（'nc:'）に載せる。
//
// 対象外: チャンネル生放送（providerId が ch 始まり）。このAPIは ON_AIR を返さず
// 常に RELEASED を返すため配信中を判定できない。channel-info 側で追加を弾いている。
async function fetchNiconico(userIds) {
  const result = {};
  let failed = 0, detail = '';
  for (const userId of userIds) {
    try {
      const params = new URLSearchParams({
        providerId: userId,
        providerType: 'user',
        isIncludeNonPublic: 'false',
        offset: '0',
        // 予約番組が先頭に来て配信中を隠すことがあるので数件見る
        limit: '5',
        withTotalCount: 'false',
      });
      const res = await fetch(
        `https://live.nicovideo.jp/front/api/v2/user-broadcast-history?${params}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.data?.programsList)) throw httpError(res);
      const list = data.data.programsList;
      // 配信履歴が空（一度も放送していない・存在しないユーザー）＝オフライン
      if (!list.length) { result[userId] = { isLive: false, liveId: null }; continue; }

      const onAir = list.find(p => p.program?.schedule?.status === 'ON_AIR');
      const provider = (onAir ?? list[0]).programProvider;
      result[userId] = {
        isLive: Boolean(onAir),
        liveId: onAir?.id?.value ?? null,
        name: provider?.name || undefined,
        thumbnail: provider?.icons?.uri50x50 || undefined,
      };
    } catch (e) {
      failed++; detail ||= describe(e);
    }
  }
  warnFetch('niconico', failed, userIds.length, detail);
  return result;
}

// 17Live: 追跡単位は roomID（ユーザーごとに固定の数値。配信中は liveStreamID と一致）。
// api-dsa.17app.co は認証不要で叩ける。status は実測で 2=配信中 / 0=オフライン
// （配信中30件と非配信ユーザーの突き合わせで検証済み・2026-07-25）。
// 存在しない roomID は HTTP 520 + {"errorMessage":"stream not found"} を返す。
async function fetch17Live(roomIds) {
  const result = {};
  let failed = 0, detail = '';
  for (const roomId of roomIds) {
    try {
      const res = await fetch(`https://api-dsa.17app.co/api/v1/lives/${encodeURIComponent(roomId)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await res.json();
      // 存在しない roomID → 配信していないと分かる
      if (data?.errorMessage === 'stream not found') { result[roomId] = { isLive: false }; continue; }
      if (!res.ok || data?.errorMessage) throw httpError(res, data?.errorMessage);

      const u = data.userInfo || {};
      result[roomId] = {
        isLive: data.status === 2,
        name: u.displayName || u.openID || undefined,
        thumbnail: u.picture ? `https://cdn.17app.co/${u.picture}` : undefined,
      };
    } catch (e) {
      failed++; detail ||= describe(e);
    }
  }
  warnFetch('17live', failed, roomIds.length, detail);
  return result;
}

// Kick: 公式API（api.kick.com/public/v1）。client_credentials の App Access Token で叩ける
// ＝ユーザーのKickログインは不要。1リクエストで最大50 slug まとめて問い合わせられるので、
// 追跡チャンネルが増えてもリクエスト数はほぼ増えない（YouTubeのような従量課金もない）。
// 非公式の kick.com/api/v2/... はCloudflareで403になるが、公式APIはこの経路で通る。
// Kickのslug仕様: 英数字とハイフン/アンダースコア、最大25文字
const KICK_SLUG_RE = /^[A-Za-z0-9_-]{1,25}$/;

async function fetchKick(slugs) {
  const result = {};
  // 不正な形式のslugが1つでも混ざるとリクエスト全体が400になり、同じバッチの
  // 他チャンネルまで巻き込まれる。事前に弾いて隔離する（存在し得ない＝オフライン）。
  const valid = [];
  for (const s of slugs) {
    if (KICK_SLUG_RE.test(s)) valid.push(s);
    else result[s] = { isLive: false };
  }
  if (!valid.length) return result;

  let token;
  try {
    token = await getKickToken();
  } catch (e) {
    warnFetch('kick', valid.length, slugs.length, describe(e));
    return result;
  }

  // 50件ずつに分割（API上限）
  for (let i = 0; i < valid.length; i += 50) {
    const chunk = valid.slice(i, i + 50);
    try {
      const qs = chunk.map(s => `slug=${encodeURIComponent(s)}`).join('&');
      const res = await fetch(`https://api.kick.com/public/v1/channels?${qs}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw httpError(res, data?.message);
      const bySlug = new Map((data?.data || []).filter(ch => ch.slug).map(ch => [ch.slug.toLowerCase(), ch]));
      for (const s of chunk) {
        const ch = bySlug.get(s.toLowerCase());
        // 応答に含まれなかった slug（存在しない）はオフライン
        result[s] = ch
          ? { isLive: ch.stream?.is_live === true, title: ch.stream_title || undefined }
          : { isLive: false };
      }
    } catch (e) {
      warnFetch('kick', chunk.length, slugs.length, describe(e));
    }
  }
  return result;
}

// Kickのトークンは expires_in が約60日と長いので、関数インスタンス内でキャッシュする
async function getKickToken() {
  if (kickTokenCache?.expiresAt > Date.now() + 60_000) return kickTokenCache.access_token;

  const res = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KICK_CLIENT_ID,
      client_secret: process.env.KICK_CLIENT_SECRET
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Kick token failed');
  kickTokenCache = { access_token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// SHOWROOM: 全ライブ一覧を1回取得し、配信中の room_url_key 配列を返す。失敗は null。
async function fetchShowroomLiveSet() {
  try {
    const res = await fetch('https://www.showroom-live.com/api/live/onlives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw httpError(res);
    const data = await res.json();
    if (!Array.isArray(data?.onlives)) throw new Error('onlives is not an array');
    const liveKeys = [];
    for (const genre of data.onlives) {
      for (const live of genre.lives || []) {
        if (live.room_url_key) liveKeys.push(live.room_url_key);
      }
    }
    return liveKeys;
  } catch (e) {
    warnFetch('showroom', 1, 1, describe(e));
    return null;
  }
}

function buildShowroom(liveKeys, roomUrlKeys) {
  const liveSet = new Set(liveKeys);
  return Object.fromEntries(roomUrlKeys.map(k => [k, { isLive: liveSet.has(k) }]));
}

// ふわっち: 全ライブ一覧を1回取得し、user_path → {liveId,name,thumbnail} のマップを返す。失敗は null。
async function fetchWhowatchLiveMap() {
  try {
    const res = await fetch('https://api.whowatch.tv/lives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw httpError(res);
    const data = await res.json();
    // 2026-11-13 に配列でない応答が返った（data is not iterable）
    if (!Array.isArray(data)) throw new Error('data is not an array');

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
    warnFetch('whowatch', 1, 1, describe(e));
    return null;
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
  if (!data.access_token) throw httpError(res, data?.message || 'Twitch token failed');
  twitchTokenCache = { access_token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
