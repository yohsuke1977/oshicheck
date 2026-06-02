// GET /api/status?youtube=UCxxx,UCyyy&twitch=user1,user2&twitcasting=user1,user2&showroom=key1,key2&whowatch=path1,path2
// Returns live status for each channel. Cached 60s on CDN.

let twitchTokenCache = null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { youtube, twitch, twitcasting, showroom, whowatch } = req.query;
  const result = {};

  try {
    if (youtube)      result.youtube      = await checkYouTube(youtube.split(',').filter(Boolean));
    if (twitch)       result.twitch       = await checkTwitch(twitch.split(',').filter(Boolean));
    if (twitcasting)  result.twitcasting  = await checkTwitcasting(twitcasting.split(',').filter(Boolean));
    if (showroom)     result.showroom     = await checkShowroom(showroom.split(',').filter(Boolean));
    if (whowatch)     result.whowatch     = await checkWhowatch(whowatch.split(',').filter(Boolean));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  res.json(result);
};

async function checkYouTube(channelIds) {
  const key = process.env.YOUTUBE_API_KEY;
  const result = {};

  for (const channelId of channelIds) {
    try {
      const playlistId = 'UU' + channelId.slice(2);
      const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=5&key=${key}`
      );
      const items = await itemsRes.json();

      if (!items.items?.length) {
        result[channelId] = { isLive: false, videoId: null };
        continue;
      }

      const videoIds = items.items.map(i => i.contentDetails.videoId).join(',');
      const videosRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoIds}&key=${key}`
      );
      const videos = await videosRes.json();

      let isLive = false;
      let videoId = null;
      for (const v of videos.items || []) {
        if (v.snippet.liveBroadcastContent === 'live') {
          isLive = true;
          videoId = v.id;
          break;
        }
      }
      result[channelId] = { isLive, videoId };
    } catch (e) {
      result[channelId] = { isLive: false, videoId: null };
    }
  }

  return result;
}

async function checkTwitch(logins) {
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

async function checkWhowatch(userPaths) {
  // URLが混入している場合に備えてパスだけ抽出
  const cleanPaths = userPaths.map(p =>
    p.replace(/^https?:\/\/(?:www\.)?whowatch\.tv\/(?:user|profile)\//, '').replace(/\/$/, '')
  );
  const result = Object.fromEntries(userPaths.map((p, i) => [p, { isLive: false, liveId: null }]));
  try {
    const res = await fetch('https://api.whowatch.tv/lives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    // user_path → live entry のマップ（名前・サムネ・liveId取得用）
    const liveInfoMap = new Map();
    for (const cat of data) {
      for (const key of ['new', 'popular']) {
        for (const live of cat[key] || []) {
          if (live.user?.user_path) {
            liveInfoMap.set(live.user.user_path, {
              liveId: live.id,
              name: live.user.name,
              thumbnail: live.user.icon_url || ''
            });
          }
        }
      }
    }

    for (let i = 0; i < userPaths.length; i++) {
      const info = liveInfoMap.get(cleanPaths[i]);
      if (info) {
        result[userPaths[i]] = { isLive: true, ...info };
      }
    }
  } catch (e) {}
  return result;
}

async function checkShowroom(roomUrlKeys) {
  const result = Object.fromEntries(roomUrlKeys.map(k => [k, { isLive: false }]));
  try {
    const res = await fetch('https://www.showroom-live.com/api/live/onlives', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await res.json();

    const liveSet = new Set();
    for (const genre of data.onlives || []) {
      for (const live of genre.lives || []) {
        if (live.room_url_key) liveSet.add(live.room_url_key);
      }
    }

    for (const key of roomUrlKeys) {
      result[key] = { isLive: liveSet.has(key) };
    }
  } catch (e) {
    // Return all offline on error
  }
  return result;
}

async function checkTwitcasting(userIds) {
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
