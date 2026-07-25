// GET /api/channel-info?platform=youtube&q=@handle
// GET /api/channel-info?platform=twitch&q=username
// GET /api/channel-info?platform=twitcasting&q=username
// GET /api/channel-info?platform=showroom&q=room_url_key or URL
// GET /api/channel-info?platform=niconico&q=https://www.nicovideo.jp/user/123 or lv URL or userId
// GET /api/channel-info?platform=17live&q=https://17.live/ja/live/1234567 or profile URL or roomID
// Returns: { channelId, name, thumbnail }

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

  const { platform, q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    let info;
    if (platform === 'youtube')           info = await lookupYouTube(q);
    else if (platform === 'twitch')       info = await lookupTwitch(q);
    else if (platform === 'twitcasting')  info = await lookupTwitcasting(q);
    else if (platform === 'showroom')     info = await lookupShowroom(q);
    else if (platform === 'whowatch')     info = await lookupWhowatch(q);
    else if (platform === 'niconico')     info = await lookupNiconico(q);
    else if (platform === '17live')       info = await lookup17Live(q);
    else return res.status(400).json({ error: 'Invalid platform' });

    res.json(info);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

async function lookupYouTube(input) {
  const key = process.env.YOUTUBE_API_KEY;
  let param;

  const handleMatch = input.match(/@([\w.-]+)/);
  if (handleMatch) {
    param = `forHandle=%40${handleMatch[1]}`;
  } else {
    const idMatch = input.match(/(UC[\w-]{22})/);
    if (idMatch) param = `id=${idMatch[1]}`;
    else throw new Error('YouTubeのURL（@ハンドルまたはチャンネルID）を入力してください');
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet&${param}&key=${key}`
  );
  const data = await res.json();

  if (data.error) throw new Error(`YouTube APIエラー: ${data.error.message}`);
  if (!data.items?.length) throw new Error('チャンネルが見つかりませんでした');

  const ch = data.items[0];
  return {
    channelId: ch.id,
    name: ch.snippet.title,
    thumbnail: ch.snippet.thumbnails.default?.url || ''
  };
}

async function lookupTwitch(input) {
  const login = input.replace(/^https?:\/\/(?:www\.)?twitch\.tv\//, '').replace(/\/$/, '');
  const token = await getTwitchToken();

  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, {
    headers: {
      'Client-Id': process.env.TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();

  if (!data.data?.length) throw new Error('Twitchユーザーが見つかりませんでした');

  const u = data.data[0];
  return {
    channelId: u.login,
    name: u.display_name,
    thumbnail: u.profile_image_url
  };
}

async function lookupShowroom(input) {
  const key = input
    .replace(/^https?:\/\/(?:www\.)?showroom-live\.com\/(?:r\/)?/, '')
    .replace(/\/$/, '');

  // OGPタグからルーム名・画像を取得（未認証でも動作）
  const pageRes = await fetch(`https://www.showroom-live.com/r/${key}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!pageRes.ok) throw new Error('ルームが見つかりませんでした');

  const html = await pageRes.text();

  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

  if (!titleMatch) throw new Error('ルーム情報を取得できませんでした');

  const rawName = titleMatch[1].replace(/｜SHOWROOM.*$/, '').trim();

  return {
    channelId: key,
    name: rawName,
    thumbnail: imageMatch ? imageMatch[1] : ''
  };
}

async function lookupWhowatch(input) {
  let lives = null;
  const fetchLives = async () => {
    if (lives) return lives;
    const res = await fetch('https://api.whowatch.tv/lives', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    lives = await res.json();
    return lives;
  };

  // /viewer/{liveId} 形式: ライブIDからユーザーを逆引き
  const viewerMatch = input.match(/whowatch\.tv\/viewer\/(\d+)/);
  if (viewerMatch) {
    const liveId = Number(viewerMatch[1]);
    try {
      const data = await fetchLives();
      for (const cat of data) {
        for (const key of ['new', 'popular']) {
          for (const live of cat[key] || []) {
            if (live.id === liveId) {
              return { channelId: live.user.user_path, name: live.user.name, thumbnail: live.user.icon_url || '' };
            }
          }
        }
      }
    } catch (e) {}
    throw new Error('ライブが見つかりませんでした。視聴中のURLを使用してください。');
  }

  // /user/xxx または /profile/xxx
  const userPath = input
    .replace(/^https?:\/\/(?:www\.)?whowatch\.tv\/(?:user|profile)\//, '')
    .replace(/\/$/, '');

  if (!userPath || userPath.startsWith('http')) throw new Error('URLが正しくありません');

  try {
    const data = await fetchLives();
    for (const cat of data) {
      for (const key of ['new', 'popular']) {
        for (const live of cat[key] || []) {
          if (live.user?.user_path === userPath) {
            return { channelId: userPath, name: live.user.name, thumbnail: live.user.icon_url || '' };
          }
        }
      }
    }
  } catch (e) {}

  return { channelId: userPath, name: userPath, thumbnail: '' };
}

// ニコニコ生放送: 追跡単位はユーザーID（providerId）。
// 受け付ける入力: ユーザーページURL / 生放送URL(lv) / 生ID。
// 生放送URLの場合は cas API（認証不要）で lv → providerId を逆引きする。
//
// ユーザー生放送のみ対応。チャンネル生放送（providerId が ch 始まり）は配信履歴APIが
// ON_AIR を返さず常に RELEASED になり配信中を判定できないため、追加時点で明示的に弾く。
async function lookupNiconico(input) {
  const s = String(input).trim();
  let userId = null;

  const lvMatch = s.match(/(lv\d+)/);
  if (lvMatch) {
    const res = await fetch(`https://api.cas.nicovideo.jp/v1/services/live/programs/${lvMatch[1]}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    if (data?.data?.providerType !== 'user' || !data?.data?.providerId) {
      throw new Error('チャンネル生放送・公式番組は追跡に対応していません。ユーザー生放送のURLを入力してください');
    }
    userId = String(data.data.providerId);
  } else {
    if (/ch\.nicovideo\.jp|(?:^|\/)ch\d+/.test(s)) {
      throw new Error('チャンネル生放送・公式番組は追跡に対応していません。ユーザー生放送のURLを入力してください');
    }
    const userMatch = s.match(/nicovideo\.jp\/user\/(\d+)/) || s.match(/^(\d+)$/);
    if (!userMatch) {
      throw new Error('ニコニコのユーザーページURL（https://www.nicovideo.jp/user/12345）または生放送URLを入力してください');
    }
    userId = userMatch[1];
  }

  // 名前・アイコンは配信履歴APIから取得（放送実績があれば1リクエストで揃う）
  const params = new URLSearchParams({
    providerId: userId, providerType: 'user',
    isIncludeNonPublic: 'false', offset: '0', limit: '1', withTotalCount: 'false',
  });
  const histRes = await fetch(
    `https://live.nicovideo.jp/front/api/v2/user-broadcast-history?${params}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  const hist = await histRes.json();
  const provider = hist?.data?.programsList?.[0]?.programProvider;
  if (provider?.name) {
    return {
      channelId: userId,
      name: provider.name,
      thumbnail: provider.icons?.uri50x50 || ''
    };
  }

  // 放送履歴が無いユーザーはユーザーページから名前・アイコンを取る
  const pageRes = await fetch(`https://www.nicovideo.jp/user/${userId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!pageRes.ok) throw new Error('ユーザーが見つかりませんでした');
  const html = await pageRes.text();
  const m = html.match(/data-initial-data="([^"]+)"/);
  if (m) {
    try {
      const u = JSON.parse(decodeHtmlEntities(m[1]))?.state?.userDetails?.user;
      if (u?.nickname) {
        return { channelId: userId, name: u.nickname, thumbnail: u.icons?.small || '' };
      }
    } catch (e) {}
  }
  return { channelId: userId, name: `user/${userId}`, thumbnail: '' };
}

// 17Live: 追跡単位は roomID（数値・ユーザーごとに固定）。
// 受け付ける入力: /live/<roomID> ・ /profile/r/<roomID> ・ /profile/u/<userID(UUID)> ・ 生のroomID。
// UUID形式のプロフィールURLだけは users/<uuid>/info で roomID に解決してから使う。
async function lookup17Live(input) {
  const s = String(input).trim();
  let roomId = null;

  const uuidMatch = s.match(/\/profile\/u\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    const res = await fetch(`https://api-dsa.17app.co/api/v1/users/${uuidMatch[1]}/info`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();
    if (!data?.roomID) throw new Error('ユーザーが見つかりませんでした');
    roomId = String(data.roomID);
  } else {
    const m = s.match(/17\.live\/[^/]+\/live\/(\d+)/)
           || s.match(/17\.live\/[^/]+\/profile\/r\/(\d+)/)
           || s.match(/^(\d+)$/);
    if (!m) {
      throw new Error('17LiveのライブURL（https://17.live/ja/live/1234567）またはプロフィールURLを入力してください');
    }
    roomId = m[1];
  }

  // ライブ情報APIから配信者名・アイコンを取得（配信中でなくても部屋があれば返る）
  const res = await fetch(`https://api-dsa.17app.co/api/v1/lives/${roomId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const data = await res.json();
  if (!res.ok || data?.errorMessage || !data?.userInfo) {
    throw new Error('配信者が見つかりませんでした');
  }

  const u = data.userInfo;
  return {
    channelId: roomId,
    name: u.displayName || u.openID || roomId,
    thumbnail: u.picture ? `https://cdn.17app.co/${u.picture}` : ''
  };
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function lookupTwitcasting(input) {
  const userId = input.replace(/^https?:\/\/(?:www\.)?twitcasting\.tv\//, '').replace(/\/$/, '');
  const auth = Buffer.from(
    `${process.env.TWITCASTING_CLIENT_ID}:${process.env.TWITCASTING_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`https://apiv2.twitcasting.tv/users/${encodeURIComponent(userId)}`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'X-Api-Version': '2.0',
      'Accept': 'application/json'
    }
  });
  const data = await res.json();
  if (!data.user) throw new Error('ユーザーが見つかりませんでした');

  return {
    channelId: data.user.screen_id,
    name: data.user.name,
    thumbnail: data.user.image
  };
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
