const API_BASE = 'https://oshicheck.vercel.app';
const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch', twitcasting: 'ツイキャス', showroom: 'SHOWROOM', whowatch: 'ふわっち' };
const FREE_LIMIT = 5;

async function getChannelLimit() {
  const { plan } = await chrome.storage.local.get('plan');
  return plan === 'pro' ? 999 : FREE_LIMIT;
}

let pendingChannel = null;

async function init() {
  const { channels = [] } = await chrome.storage.local.get('channels');
  renderChannelList(channels);
  setupPlatformSwitch();
  await initAuth();
}

// ── 認証 ──────────────────────────────────────────────────────────────────────

async function initAuth() {
  const user = await fbGetCurrentUser();
  if (user) {
    await showSignedIn(user);
  } else {
    showSignedOut();
  }
}

function showSignedOut() {
  document.getElementById('authSignedOut').style.display = '';
  document.getElementById('authSignedIn').style.display = 'none';
}

async function showSignedIn(user) {
  document.getElementById('authSignedOut').style.display = 'none';
  document.getElementById('authSignedIn').style.display = '';
  document.getElementById('signedInEmail').textContent = user.email;

  const { plan } = await chrome.storage.local.get('plan');
  const planEl = document.getElementById('signedInPlan');
  if (plan === 'pro') {
    planEl.textContent = 'Pro プラン';
    planEl.className = 'signed-in-plan pro';
  } else {
    planEl.textContent = '無料プラン';
    planEl.className = 'signed-in-plan';
  }

  // チャンネルリストを再描画（プラン反映）
  const { channels = [] } = await chrome.storage.local.get('channels');
  renderChannelList(channels);
}

async function handleAuth(isSignUp) {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if (!email || !password) return setAuthMsg('メールアドレスとパスワードを入力してください', 'error');

  setAuthMsg('処理中...', '');
  try {
    const user = isSignUp ? await fbSignUp(email, password) : await fbSignIn(email, password);

    // Firestoreからプラン取得
    const plan = await fsGetPlan(user.localId);
    await chrome.storage.local.set({ plan });

    // チャンネル同期（Firestore → local）
    await syncFromFirestore(user.localId);

    await showSignedIn({ email: user.email });
    sendEvent(isSignUp ? 'sign_up' : 'sign_in');
  } catch (e) {
    setAuthMsg(e.message, 'error');
  }
}

async function syncFromFirestore(uid) {
  const remoteChannels = await fsGetChannels(uid);
  if (!remoteChannels.length) {
    // ローカルのチャンネルをFirestoreにアップロード
    const { channels = [] } = await chrome.storage.local.get('channels');
    for (const ch of channels) await fsSaveChannel(uid, ch);
    return;
  }
  // Firestoreのデータをローカルに反映
  await chrome.storage.local.set({ channels: remoteChannels });
  const { channels = [] } = await chrome.storage.local.get('channels');
  renderChannelList(channels);
}

document.getElementById('signInBtn').addEventListener('click', () => handleAuth(false));
document.getElementById('signUpBtn').addEventListener('click', () => handleAuth(true));

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await fbSignOut();
  await chrome.storage.local.remove('plan');
  showSignedOut();
  sendEvent('sign_out');
});

function setAuthMsg(msg, type) {
  const el = document.getElementById('authMsg');
  el.textContent = msg;
  el.className = 'auth-msg' + (type ? ` ${type}` : '');
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
      } else if (r.value === 'twitcasting') {
        label.textContent = 'ツイキャスURL / ユーザーID';
        input.placeholder = 'https://twitcasting.tv/... または username';
      } else if (r.value === 'showroom') {
        label.textContent = 'SHOWROOMルームURL / ルームキー';
        input.placeholder = 'https://www.showroom-live.com/... または room_url_key';
      } else {
        label.textContent = 'ふわっちユーザーURL';
        input.placeholder = 'https://whowatch.tv/user/w:xxxxxx';
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
  const limit = await getChannelLimit();

  if (channels.length >= limit) {
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

  const newChannel = {
    id: crypto.randomUUID(),
    platform: pendingChannel.platform,
    channelId: pendingChannel.channelId,
    name: pendingChannel.name,
    thumbnail: pendingChannel.thumbnail,
    isLive: false,
    liveVideoId: null,
    lastChecked: null
  };
  channels.push(newChannel);

  // Firestore同期
  const user = await fbGetCurrentUser();
  if (user) await fsSaveChannel(user.uid, newChannel);

  sendEvent('channel_add', { platform: pendingChannel.platform });

  await chrome.storage.local.set({ channels });
  pendingChannel = null;
  hidePreview();
  clearStatus();
  document.getElementById('channelInput').value = '';
  renderChannelList(channels);
});

// ── Channel list ──────────────────────────────────────────────────────────────

async function renderChannelList(channels) {
  const el = document.getElementById('channelList');
  const count = channels.length;
  const limit = await getChannelLimit();
  const atLimit = count >= limit;

  // カウンター更新
  const counter = document.getElementById('channelCount');
  counter.textContent = limit >= 999 ? `${count} / ∞` : `${count} / ${limit}`;
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

  // Firestore同期
  const user = await fbGetCurrentUser();
  if (user) await fsDeleteChannel(user.uid, id);

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

document.getElementById('upgradeBtn')?.addEventListener('click', async () => {
  sendEvent('upgrade_click');
  const user = await fbGetCurrentUser();
  if (!user) {
    alert('Proプランへのアップグレードにはログインが必要です。');
    return;
  }
  const idToken = await fbGetIdToken();
  const url = `https://oshicheck.vercel.app/api/create-checkout?uid=${user.uid}&token=${encodeURIComponent(idToken)}`;
  chrome.tabs.create({ url });
});

init();
