importScripts('analytics.js');

const API_BASE = 'https://oshicheck.vercel.app';
const ALARM_NAME = 'oshicheck-poll';
// サーバーコスト（Vercel Fluid Active CPU）削減のため 2分→10分（v0.1.5）。
// PC操作中なら10分以内に通知される。離席中はさらに間引く（下のisPollSkippable参照）。
const POLL_MINUTES = 10;
// 離席（idle）判定のしきい値と、離席中の実効ポーリング間隔
const IDLE_THRESHOLD_SEC = 600;
const IDLE_POLL_MINUTES = 30;

chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLL_MINUTES });
  await checkAllChannels();
  if (details.reason === 'install') sendEvent('extension_install');
});

chrome.runtime.onStartup.addListener(async () => {
  await checkAllChannels();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  if (await isPollSkippable()) return;
  await checkAllChannels();
});

// 画面ロック中はポーリングしない。離席中（入力なしが続く）は間隔をIDLE_POLL_MINUTESまで延ばす。
// どちらも「通知を見る人がいない時間帯のサーバーコスト」を削る目的。判定に失敗したら通常通り実行。
async function isPollSkippable() {
  try {
    const state = await chrome.idle.queryState(IDLE_THRESHOLD_SEC);
    if (state === 'locked') return true;
    if (state === 'idle') {
      const { lastChecked = 0 } = await chrome.storage.local.get('lastChecked');
      return Date.now() - lastChecked < IDLE_POLL_MINUTES * 60_000;
    }
  } catch (e) {
    // idle APIが使えない環境では常にポーリングする
  }
  return false;
}

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

  // ソートしておくと、同じチャンネル集合なら並び順に関わらずクエリが一致し
  // CDNキャッシュ（s-maxage）が共有されやすくなる
  const idsFor = (platform) =>
    channels.filter(ch => ch.platform === platform).map(ch => ch.channelId).sort();

  const youtubeIds      = idsFor('youtube');
  const twitchLogins    = idsFor('twitch');
  const twitcastingIds  = idsFor('twitcasting');
  const showroomKeys    = idsFor('showroom');
  const whowatchPaths   = idsFor('whowatch');
  const niconicoIds     = idsFor('niconico');
  const seventeenRooms  = idsFor('17live');

  try {
    const params = new URLSearchParams();
    if (youtubeIds.length)     params.set('youtube', youtubeIds.join(','));
    if (twitchLogins.length)   params.set('twitch', twitchLogins.join(','));
    if (twitcastingIds.length) params.set('twitcasting', twitcastingIds.join(','));
    if (showroomKeys.length)   params.set('showroom', showroomKeys.join(','));
    if (whowatchPaths.length)  params.set('whowatch', whowatchPaths.join(','));
    if (niconicoIds.length)    params.set('niconico', niconicoIds.join(','));
    if (seventeenRooms.length) params.set('17live', seventeenRooms.join(','));

    const res = await fetch(`${API_BASE}/api/status?${params}`, {
      headers: { 'x-oshi-key': EXT_SHARED_KEY }
    });
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
      } else if (ch.platform === 'niconico') {
        const s = data.niconico?.[ch.channelId];
        if (s) {
          ch.isLive = s.isLive;
          ch.liveId = s.liveId;
          ch.lastChecked = Date.now();
          if (s.name && s.name !== ch.channelId) ch.name = s.name;
          if (s.thumbnail) ch.thumbnail = s.thumbnail;
        }
      } else if (ch.platform === '17live') {
        const s = data['17live']?.[ch.channelId];
        if (s) {
          ch.isLive = s.isLive;
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
  const platform = {
    youtube: 'YouTube', twitch: 'Twitch', showroom: 'SHOWROOM',
    twitcasting: chrome.i18n.getMessage('platformTwitcasting'),
    whowatch: chrome.i18n.getMessage('platformWhowatch'),
    niconico: chrome.i18n.getMessage('platformNiconico'),
    '17live': '17LIVE'
  }[channel.platform] ?? channel.platform;
  const url = getStreamUrl(channel);
  chrome.notifications.create(`live-${channel.id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: chrome.i18n.getMessage('notifLiveTitle', [channel.name]),
    message: chrome.i18n.getMessage('notifLiveBody', [platform]),
    buttons: url ? [{ title: chrome.i18n.getMessage('notifWatch') }] : []
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
  if (channel.platform === 'niconico') {
    if (channel.liveId) return `https://live.nicovideo.jp/watch/${channel.liveId}`;
    return `https://www.nicovideo.jp/user/${channel.channelId}`;
  }
  if (channel.platform === '17live') {
    return `https://17.live/ja/live/${channel.channelId}`;
  }
  return null;
}
