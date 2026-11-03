import { TWITCH_CLIENT_ID, REDIRECT_URI } from './config.js';

const API = 'https://api.twitch.tv/helix';
const SCOPES = ['user:read:follows'];
const TOKEN_KEY = 'rr_token';
const STATE_KEY = 'rr_state';

export function redirectUri() {
  // Sin "index.html" para que /repo/ y /repo/index.html usen la misma Redirect URL registrada.
  return REDIRECT_URI || location.origin + location.pathname.replace(/index\.html$/, '');
}

export function isConfigured() {
  return TWITCH_CLIENT_ID && !TWITCH_CLIENT_ID.startsWith('PON_AQUI');
}

export function login() {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    force_verify: 'true',
  });
  location.href = `https://id.twitch.tv/oauth2/authorize?${params}`;
}

// Lee el token del fragmento (#access_token=...) tras volver de Twitch.
export function consumeRedirect() {
  if (!location.hash.includes('access_token') && !location.hash.includes('error')) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname);
  if (params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (!expected || params.get('state') !== expected) throw new Error('El parámetro state no coincide. Vuelve a iniciar sesión.');
  const token = params.get('access_token');
  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function storedToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export async function logout(token) {
  sessionStorage.removeItem(TOKEN_KEY);
  if (!token) return;
  const body = new URLSearchParams({ client_id: TWITCH_CLIENT_ID, token });
  await fetch('https://id.twitch.tv/oauth2/revoke', { method: 'POST', body }).catch(() => {});
}

async function helix(path, token) {
  const res = await fetch(API + path, {
    headers: { 'Client-Id': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('La sesión de Twitch ha caducado. Vuelve a entrar.');
  }
  if (!res.ok) throw new Error(`Twitch API ${res.status} en ${path}`);
  return res.json();
}

export async function getMe(token) {
  const { data } = await helix('/users', token);
  return data[0];
}

export async function getFollows(token, userId, max) {
  const out = [];
  let cursor = '';
  do {
    const q = new URLSearchParams({ user_id: userId, first: '100' });
    if (cursor) q.set('after', cursor);
    const page = await helix(`/channels/followed?${q}`, token);
    out.push(...page.data);
    cursor = page.pagination?.cursor;
  } while (cursor && out.length < max);
  return out.slice(0, max);
}

export async function getChannels(token, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const q = ids.slice(i, i + 100).map((id) => `broadcaster_id=${id}`).join('&');
    const { data } = await helix(`/channels?${q}`, token);
    out.push(...data);
  }
  return out;
}

export async function getChatColor(token, userId) {
  const { data } = await helix(`/chat/color?user_id=${userId}`, token);
  return data[0]?.color || null;
}
