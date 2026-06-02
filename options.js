const API_BASE = 'https://oshicheck.vercel.app';
const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch', twitcasting: 'ツイキャス' };
const FREE_LIMIT = 5;

let pendingChannel = null;

async function init() {
  const { channels = [] } = await chrome.storage.local.get('channels');
  renderChannelList(channels);
  setupPlatformSwitch();
}

// ── Platform switch ───────────────────────────────────────────────────────────

function setupPlatformSwitch() {
  document.querySelectorAll('input[name="platform"]').forEach(r => {
    r.addEventListener('change', () => {
      const label = document.getElementById('inputLabel');
      const input = document.getElementById('channelInput');
      if (r.value === 'youtube') {
        label.textContent = 'YouTubeチャンネルURL / @ハンドル';
        input.placeholder = 'https://www.youtube.com/@... または UCxxxx';
      } else if (r.value === 'twitch') {
        label.textContent = 'Twitchユーザー名';
        input.placeholder = 'username';
      } else {
        label.textContent = 'ツイキャスURL / ユーザーID';
        input.placeholder = 'https://twitcasting.tv/... または username';
      }
      hidePreview();
      clearStatus();
      input.value = '';
    });
  });
}

// ── Add channel ───────────────────────────────────────────────────────────────

document.getElementById('addBtn').addEventListener('click', async () => {
  const platform = document.querySelector('input[name="platform"]:checked').value;
  const q = document.getElementById('channelInput').value.trim();
  if (!q) return setStatus('URLまたはユーザー名を入力してください', 'error');

  setStatus('検索中...', 'loading');
  hidePreview();

  try {
    const res = await fetch(`${API_BASE}/api/channel-info?${new URLSearchParams({ platform, q })}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '検索に失敗しました');

    pendingChannel = { ...data, platform };
    clearStatus();
    showPreview(data, platform);
  } catch (e) {
    setStatus(e.message, 'error');
  }
});

document.getElementById('confirmBtn').addEventListener('click', async () => {
  if (!pendingChannel) return;

  const { channels = [] } = await chrome.storage.local.get('channels');

  if (channels.length >= FREE_LIMIT) {
    setStatus('無料プランは5チャンネルまでです', 'error');
    hidePreview();
    return;
  }

  const exists = channels.some(ch => ch.platform === pendingChannel.platform && ch.channelId === pendingChannel.channelId);
  if (exists) {
    setStatus('このチャンネルはすでに登録済みです', 'error');
    hidePreview();
    return;
  }

  channels.push({
    id: crypto.randomUUID(),
    platform: pendingChannel.platform,
    channelId: pendingChannel.channelId,
    name: pendingChannel.name,
    thumbnail: pendingChannel.thumbnail,
    isLive: false,
    liveVideoId: null,
    lastChecked: null
  });

  await chrome.storage.local.set({ channels });
  pendingChannel = null;
  hidePreview();
  clearStatus();
  document.getElementById('channelInput').value = '';
  renderChannelList(channels);
});

// ── Channel list ──────────────────────────────────────────────────────────────

function renderChannelList(channels) {
  const el = document.getElementById('channelList');
  const count = channels.length;
  const atLimit = count >= FREE_LIMIT;

  // カウンター更新
  const counter = document.getElementById('channelCount');
  counter.textContent = `${count} / ${FREE_LIMIT}`;
  counter.className = 'channel-count' + (atLimit ? ' at-limit' : '');

  // 追加ボタンの状態
  document.getElementById('addBtn').disabled = atLimit;

  // アップグレード誘導
  document.getElementById('upgradePrompt').style.display = atLimit ? 'flex' : 'none';

  if (!channels.length) {
    el.innerHTML = '<p class="empty">チャンネルが登録されていません</p>';
    return;
  }

  el.innerHTML = channels.map(ch => `
    <div class="channel-row">
      ${ch.thumbnail
        ? `<img src="${ch.thumbnail}" alt="">`
        : `<div class="thumb-ph">▶</div>`}
      <span class="ch-name">${escHtml(ch.name)}</span>
      <span class="ch-platform ${ch.platform}">${PLATFORM_LABEL[ch.platform] ?? ch.platform}</span>
      <button class="btn-remove" data-id="${ch.id}" title="削除">×</button>
    </div>
  `).join('');

  el.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeChannel(btn.dataset.id));
  });
}

async function removeChannel(id) {
  const { channels = [] } = await chrome.storage.local.get('channels');
  const updated = channels.filter(ch => ch.id !== id);
  await chrome.storage.local.set({ channels: updated });
  renderChannelList(updated);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showPreview(info, platform) {
  document.getElementById('previewThumb').src = info.thumbnail || '';
  document.getElementById('previewName').textContent = info.name;
  document.getElementById('previewPlatform').textContent = PLATFORM_LABEL[platform] ?? platform;
  document.getElementById('preview').style.display = 'flex';
}

function hidePreview() {
  document.getElementById('preview').style.display = 'none';
  pendingChannel = null;
}

function setStatus(msg, type = '') {
  const el = document.getElementById('addStatus');
  el.textContent = msg;
  el.className = 'add-status' + (type ? ` ${type}` : '');
}

function clearStatus() { setStatus(''); }

function escHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

init();
