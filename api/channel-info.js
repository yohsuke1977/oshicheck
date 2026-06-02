// GET /api/channel-info?platform=youtube&q=@handle
// GET /api/channel-info?platform=twitch&q=username
// GET /api/channel-info?platform=twitcasting&q=username
// GET /api/channel-info?platform=showroom&q=room_url_key or URL
// Returns: { channelId, name, thumbnail }

let twitchTokenCache = null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { platform, q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    let info;
    if (platform === 'youtube')           info = await lookupYouTube(q);
    else if (platform === 'twitch')       info = await lookupTwitch(q);
    else if (platform === 'twitcasting')  info = await lookupTwitcasting(q);
    else if (platform === 'showroom')     info = await lookupShowroom(q);
    else if (platform === 'whowatch')     info = await lookupWhowatch(q);
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
  // /user/xxx または /profile/xxx 両方に対応
  const userPath = input
    .replace(/^https?:\/\/(?:www\.)?whowatch\.tv\/(?:user|profile)\//, '')
    .replace(/\/$/, '');

  // ライブ中なら詳細情報を取得
  try {
    const res = await fetch('https://api.whowatch.tv/lives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    for (const cat of data) {
      for (const key of ['new', 'popular']) {
        for (const live of cat[key] || []) {
          if (live.user?.user_path === userPath) {
            return {
              channelId: userPath,
              name: live.user.name,
              thumbnail: live.user.icon_url || ''
            };
          }
        }
      }
    }
  } catch (e) {}

  // オフライン時はuser_pathのみで登録（名前は配信開始時に更新）
  if (!userPath) throw new Error('URLが正しくありません');
  return { channelId: userPath, name: userPath, thumbnail: '' };
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
