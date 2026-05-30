// GET /api/status?youtube=UCxxx,UCyyy&twitch=user1,user2
// Returns live status for each channel. Cached 60s on CDN.

let twitchTokenCache = null;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { youtube, twitch } = req.query;
  const result = {};

  try {
    if (youtube) result.youtube = await checkYouTube(youtube.split(',').filter(Boolean));
    if (twitch)  result.twitch  = await checkTwitch(twitch.split(',').filter(Boolean));
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
