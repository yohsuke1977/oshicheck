// Firebase Auth + Firestore REST API helper
// API Keyはクライアントサイド公開前提（Firebase標準）

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBcuXMkbbhpB1YBnoN2XPZa7VU0IJoA4kM',
  projectId: 'oshicheck'
};

const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN_BASE = 'https://securetoken.googleapis.com/v1/token';
const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// ── Auth ─────────────────────────────────────────────────────────────────────

async function fbSignUp(email, password) {
  const res = await fetch(`${AUTH_BASE}:signUp?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.error) throw new Error(_authError(data.error.message));
  await _saveAuth(data);
  return data;
}

async function fbSignIn(email, password) {
  const res = await fetch(`${AUTH_BASE}:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.error) throw new Error(_authError(data.error.message));
  await _saveAuth(data);
  return data;
}

async function fbSignOut() {
  await chrome.storage.local.remove('auth');
}

async function fbGetIdToken() {
  const { auth } = await chrome.storage.local.get('auth');
  if (!auth) return null;

  // トークンの有効期限確認（5分前にリフレッシュ）
  if (auth.expiresAt > Date.now() + 5 * 60 * 1000) return auth.idToken;

  // リフレッシュ
  const res = await fetch(`${TOKEN_BASE}?key=${FIREBASE_CONFIG.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refreshToken })
  });
  const data = await res.json();
  if (data.error || !data.id_token) { await fbSignOut(); return null; }

  const updated = { ...auth, idToken: data.id_token, refreshToken: data.refresh_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  await chrome.storage.local.set({ auth: updated });
  return data.id_token;
}

async function fbGetCurrentUser() {
  const { auth } = await chrome.storage.local.get('auth');
  return auth || null;
}

// ── Firestore ─────────────────────────────────────────────────────────────────

async function fsGetChannels(uid) {
  const idToken = await fbGetIdToken();
  if (!idToken) return [];

  const res = await fetch(`${FS_BASE()}/users/${uid}/channels`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const data = await res.json();
  if (!data.documents) return [];

  return data.documents.map(_docToChannel);
}

async function fsSaveChannel(uid, channel) {
  const idToken = await fbGetIdToken();
  if (!idToken) return;

  await fetch(`${FS_BASE()}/users/${uid}/channels/${channel.id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: _channelToDoc(channel) })
  });
}

async function fsDeleteChannel(uid, channelId) {
  const idToken = await fbGetIdToken();
  if (!idToken) return;

  await fetch(`${FS_BASE()}/users/${uid}/channels/${channelId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
}

async function fsGetPlan(uid) {
  const idToken = await fbGetIdToken();
  if (!idToken) return 'free';

  const res = await fetch(`${FS_BASE()}/users/${uid}/subscription/plan`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const data = await res.json();
  return data.fields?.value?.stringValue || 'free';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _saveAuth(data) {
  await chrome.storage.local.set({
    auth: {
      uid: data.localId,
      email: data.email,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + Number(data.expiresIn) * 1000
    }
  });
}

function _channelToDoc(ch) {
  return {
    id:         { stringValue: ch.id },
    platform:   { stringValue: ch.platform },
    channelId:  { stringValue: ch.channelId },
    name:       { stringValue: ch.name },
    thumbnail:  { stringValue: ch.thumbnail || '' }
  };
}

function _docToChannel(doc) {
  const f = doc.fields || {};
  return {
    id:          f.id?.stringValue || doc.name.split('/').pop(),
    platform:    f.platform?.stringValue || '',
    channelId:   f.channelId?.stringValue || '',
    name:        f.name?.stringValue || '',
    thumbnail:   f.thumbnail?.stringValue || '',
    isLive:      false,
    lastChecked: null
  };
}

function _authError(code) {
  const map = {
    EMAIL_EXISTS:             'このメールアドレスはすでに登録されています',
    INVALID_LOGIN_CREDENTIALS:'メールアドレスまたはパスワードが違います',
    WEAK_PASSWORD:            'パスワードは6文字以上必要です',
    INVALID_EMAIL:            'メールアドレスの形式が正しくありません',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'しばらく時間をおいて再試行してください'
  };
  return map[code] || `エラーが発生しました（${code}）`;
}
