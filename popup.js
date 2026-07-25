const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch', twitcasting: t('platformTwitcasting'), showroom: 'SHOWROOM', whowatch: t('platformWhowatch'), niconico: t('platformNiconico'), '17live': '17LIVE', kick: 'Kick' };

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('addBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function render() {
  const { channels = [], lastChecked } = await chrome.storage.local.get(['channels', 'lastChecked']);
  const list = document.getElementById('channelList');

  if (!channels.length) {
    list.innerHTML = `<div class="empty-state">
      ${escHtml(t('popupEmptyTitle'))}<br>
      <small>${escHtml(t('popupEmptySub'))}</small>
    </div>`;
    return;
  }

  // Live channels first, then offline
  const sorted = [...channels].sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));

  list.innerHTML = sorted.map(ch => {
    const streamUrl = getStreamUrl(ch);
    const tag = `<span class="platform-tag ${ch.platform}">${PLATFORM_LABEL[ch.platform] ?? ch.platform}</span>`;

    const safeThumb = safeUrl(ch.thumbnail);
    const thumb = safeThumb
      ? `<img class="thumb" src="${safeThumb}" alt="">`
      : `<div class="thumb-placeholder">▶</div>`;

    const status = ch.isLive
      ? `<div class="live-badge"><div class="live-dot"></div>LIVE</div>`
      : `<div class="offline-dot"></div>`;

    if (ch.isLive && streamUrl) {
      return `<a class="channel-item" href="${streamUrl}" target="_blank" rel="noopener" data-id="${ch.id}">
        ${thumb}
        <div class="channel-info">
          <div class="channel-name">${escHtml(ch.name)}</div>
          <div class="channel-meta">${tag}</div>
        </div>
        <div class="status">${status}</div>
      </a>`;
    }

    return `<div class="channel-item offline">
      ${thumb}
      <div class="channel-info">
        <div class="channel-name">${escHtml(ch.name)}</div>
        <div class="channel-meta">${tag}</div>
      </div>
      <div class="status">${status}</div>
    </div>`;
  }).join('');

  // Intercept anchor clicks to open in new tab (Chrome extension context)
  list.querySelectorAll('a.channel-item').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: a.href });
    });
  });

  if (lastChecked) {
    const footer = document.querySelector('.footer');
    const ts = document.createElement('div');
    ts.className = 'last-checked';
    ts.textContent = t('popupLastChecked', [formatTime(lastChecked)]);
    footer.before(ts);
  }
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
  if (channel.platform === 'kick') {
    return `https://kick.com/${channel.channelId}`;
  }
  return null;
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// http(s)のURLのみ許可しHTMLエスケープ（属性へ安全に埋め込む）
function safeUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  return escHtml(url);
}

render();
sendEvent('popup_open');
