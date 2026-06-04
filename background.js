importScripts('analytics.js');

const API_BASE = 'https://oshicheck.vercel.app';
const ALARM_NAME = 'oshicheck-poll';
const POLL_MINUTES = 2;

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  await checkAllChannels();
  if (details.reason === 'install') sendEvent('extension_install');
});

chrome.runtime.onStartup.addListener(async () => {
  await checkAllChannels();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) await checkAllChannels();
});

chrome.notifications.onButtonClicked.addListener(async (notifId, btnIdx) => {
  if (btnIdx !== 0) return;
  const { channels = [] } = await chrome.storage.local.get('channels');
  const channelId = notifId.replace(/^live-/, '').replace(/-\d+$/, '');
  const channel = channels.find(ch => ch.id === channelId);
  if (channel) chrome.tabs.create({ url: getStreamUrl(channel) });
});

async function checkAllChannels() {
  const { channels = [] } = await chrome.storage.local.get('channels');
  if (!channels.length) return;

  const prev = Object.fromEntries(channels.map(ch => [ch.id, ch.isLive]));
  const updated = JSON.parse(JSON.stringify(channels));

  const youtubeIds      = channels.filter(ch => ch.platform === 'youtube').map(ch => ch.channelId);
  const twitchLogins    = channels.filter(ch => ch.platform === 'twitch').map(ch => ch.channelId);
  const twitcastingIds  = channels.filter(ch => ch.platform === 'twitcasting').map(ch => ch.channelId);
  const showroomKeys    = channels.filter(ch => ch.platform === 'showroom').map(ch => ch.channelId);
  const whowatchPaths   = channels.filter(ch => ch.platform === 'whowatch').map(ch => ch.channelId);

  try {
    const params = new URLSearchParams();
    if (youtubeIds.length)     params.set('youtube', youtubeIds.join(','));
    if (twitchLogins.length)   params.set('twitch', twitchLogins.join(','));
    if (twitcastingIds.length) params.set('twitcasting', twitcastingIds.join(','));
    if (showroomKeys.length)   params.set('showroom', showroomKeys.join(','));
    if (whowatchPaths.length)  params.set('whowatch', whowatchPaths.join(','));

    const res = await fetch(`${API_BASE}/api/status?${params}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    for (const ch of updated) {
      if (ch.platform === 'youtube') {
        const s = data.youtube?.[ch.channelId];
        if (s) { ch.isLive = s.isLive; ch.liveVideoId = s.videoId; ch.lastChecked = Date.now(); }
      } else if (ch.platform === 'twitch') {
        const s = data.twitch?.[ch.channelId];
        if (s) { ch.isLive = s.isLive; ch.lastChecked = Date.now(); }
      } else if (ch.platform === 'twitcasting') {
        const s = data.twitcasting?.[ch.channelId];
        if (s) { ch.isLive = s.isLive; ch.movieId = s.movieId; ch.lastChecked = Date.now(); }
      } else if (ch.platform === 'showroom') {
        const s = data.showroom?.[ch.channelId];
        if (s) { ch.isLive = s.isLive; ch.lastChecked = Date.now(); }
      } else if (ch.platform === 'whowatch') {
        const s = data.whowatch?.[ch.channelId];
        if (s) {
          ch.isLive = s.isLive;
          ch.liveId = s.liveId;
          ch.lastChecked = Date.now();
          if (s.name && s.name !== ch.channelId) ch.name = s.name;
          if (s.thumbnail) ch.thumbnail = s.thumbnail;
        }
      }
    }
  } catch (e) {
    console.error('Status check failed:', e);
    return;
  }

  for (const ch of updated) {
    if (ch.isLive && !prev[ch.id]) await sendNotification(ch);
  }

  // バッジでライブ中件数を表示
  const liveCount = updated.filter(ch => ch.isLive).length;
  if (liveCount > 0) {
    chrome.action.setBadgeText({ text: String(liveCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#eb0400' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }

  await chrome.storage.local.set({ channels: updated, lastChecked: Date.now() });
}

async function sendNotification(channel) {
  sendEvent('live_notify', { platform: channel.platform });
  const platform = { youtube: 'YouTube', twitch: 'Twitch', twitcasting: 'ツイキャス', showroom: 'SHOWROOM' }[channel.platform] ?? channel.platform;
  const url = getStreamUrl(channel);
  chrome.notifications.create(`live-${channel.id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `${channel.name} が配信中！`,
    message: `${platform} でライブ配信が始まりました`,
    buttons: url ? [{ title: '視聴する' }] : []
  }, (id) => {
    if (chrome.runtime.lastError) console.error('通知エラー:', chrome.runtime.lastError.message);
  });
}

function getStreamUrl(channel) {
  if (channel.platform === 'youtube' && channel.liveVideoId) {
    return `https://www.youtube.com/watch?v=${channel.liveVideoId}`;
  }
  if (channel.platform === 'twitch') {
    return `https://www.twitch.tv/${channel.channelId}`;
  }
  if (channel.platform === 'twitcasting') {
    if (channel.movieId) return `https://twitcasting.tv/${channel.channelId}/movie/${channel.movieId}`;
    return `https://twitcasting.tv/${channel.channelId}`;
  }
  if (channel.platform === 'showroom') {
    return `https://www.showroom-live.com/${channel.channelId}`;
  }
  if (channel.platform === 'whowatch') {
    if (channel.liveId) return `https://whowatch.tv/viewer/${channel.liveId}`;
    return `https://whowatch.tv/user/${channel.channelId}`;
  }
  return null;
}
