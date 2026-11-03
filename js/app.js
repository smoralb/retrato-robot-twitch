import { LIMITS } from './config.js';
import * as twitch from './twitch.js';
import { fetchUserMessages, parsePasted } from './logs.js';
import { analyze, rng } from './analyzer.js';
import { renderPortrait } from './portrait.js';

const $ = (id) => document.getElementById(id);
const state = { token: null, user: null, follows: [], channels: [], chatColor: null, messages: [], moderation: [] };

function show(screen) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${screen}`;
  // La ficha ocupa toda la pantalla: sin cabecera
  document.querySelector('header').hidden = screen === 'result';
  if (screen === 'result') scrollTo(0, 0);
}

function log(line) {
  $('log').textContent += `> ${line}\n`;
}

function fail(err) {
  console.error(err);
  $('error').textContent = err.message || String(err);
  $('error').hidden = false;
  show('login');
}

async function investigate() {
  show('loading');
  log('Abriendo expediente…');
  state.user = await twitch.getMe(state.token);
  log(`Sujeto identificado: ${state.user.display_name} (id ${state.user.id})`);

  state.follows = await twitch.getFollows(state.token, state.user.id, LIMITS.maxFollows);
  log(`Sigue a ${state.follows.length} canales`);

  state.channels = await twitch.getChannels(state.token, state.follows.map((f) => f.broadcaster_id));
  state.chatColor = await twitch.getChatColor(state.token, state.user.id).catch(() => null);
  log('Interrogando a testigos (archivo de logs)…');

  // Prioridad: su propio canal y los follows más recientes.
  const candidates = [state.user.login, ...state.follows.map((f) => f.broadcaster_login)];
  const logs = await fetchUserMessages(state.user.login, candidates, log).catch((e) => {
    log(`El archivo de logs no responde (${e.message})`);
    return { messages: [], moderation: [] };
  });
  state.messages = logs.messages;
  state.moderation = logs.moderation;
  log(`Total: ${state.messages.length} mensajes y ${state.moderation.length} sanciones recuperados`);

  if (!state.messages.length && !state.moderation.length) return show('paste');
  render();
}

function render() {
  const profile = analyze(state);
  const { stats, user } = profile;

  const ink = darken(profile.chatColor);
  for (const id of ['portrait', 'portrait-left', 'portrait-right']) {
    $(id).style.color = ink;
    $(id).textContent = '';
  }
  $('portrait').textContent = 'Revelando retrato…';
  // El render 3D tarda un par de segundos: se lanza después de pintar la ficha.
  setTimeout(() => {
    const views = renderPortrait(profile);
    $('portrait').textContent = views.front;
    $('portrait-left').textContent = views.left;
    $('portrait-right').textContent = views.right;
    state.views = views;
  }, 50);
  $('case-no').textContent = String(profile.seed).slice(0, 6).padStart(6, '0');
  $('msg-count').textContent = stats.messages;
  $('f-alias').textContent = user ? `${user.display_name}${user.description ? ` — “${user.description}”` : ''}` : '—';
  $('f-age').textContent = `${profile.ageRange[0]}–${profile.ageRange[1]} años${profile.ageSource ? ` (${profile.ageSource})` : ''}`;
  $('f-record').textContent = profile.record;
  $('f-alias-clues').textContent = profile.alias.notes.length ? profile.alias.notes.join(' · ') : 'Ninguna: alias sin delatar nada';
  $('f-job').textContent = profile.job;
  $('f-origin').textContent = profile.origin;
  const fmt = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  $('f-period').textContent = stats.first
    ? `Del ${fmt(stats.first)} al ${fmt(stats.last)} · ${stats.messages} mensajes${stats.channelCount ? ` en ${stats.channelCount} canales` : ''}`
    : stats.messages
      ? `${stats.messages} mensajes sin fecha`
      : 'Sin mensajes: solo perfil y canales seguidos';
  $('f-account').textContent = user?.created_at
    ? `${profile.accountYears.toFixed(1)} años (desde ${new Date(user.created_at).toLocaleDateString('es')})`
    : '—';
  $('f-games').textContent = profile.topGames.length ? profile.topGames.map(([g]) => g).join(', ') : 'Desconocidas';
  $('f-danger').textContent = `${profile.danger}/100`;
  $('f-danger-bar').style.width = `${profile.danger}%`;

  fillList('f-traits', profile.traits);
  fillList('f-marks', profile.marks.length ? profile.marks : ['Ninguna. Un fantasma.']);

  const max = Math.max(...stats.hours, 1);
  $('f-hours').replaceChildren(...stats.hours.map((v, h) => {
    const bar = document.createElement('span');
    bar.style.height = `${(v / max) * 100}%`;
    bar.title = `${h}:00 — ${v} mensajes`;
    return bar;
  }));
  $('f-words').replaceChildren(...stats.topWords.map(([w, c]) => {
    const tag = document.createElement('span');
    tag.textContent = `${w} ×${c}`;
    return tag;
  }));
  if (!stats.topWords.length) $('f-words').textContent = 'Sin declaraciones registradas.';

  state.profile = profile;
  show('result');
}

function fillList(id, items) {
  $(id).replaceChildren(...items.map((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    return li;
  }));
}

// Los colores de chat suelen ser muy claros; los oscurecemos para que se lean sobre papel.
function darken(hex) {
  if (!hex) return '';
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.4));
  return `rgb(${ch.join(',')})`;
}

function demoData() {
  const r = rng(42);
  const lines = [
    'jajaja que manco tío', 'KEKW', 'vale vale', 'POGGERS', 'alguien sabe a qué hora empieza el torneo?', 'joder qué jugada',
    'gracias por el directo!', 'xd', 'ese build está roto', 'mola mucho la nueva skin', 'NO PUEDE SER', 'gg', 'Sadge',
    'hostia el clutch', 'tío eso era easy', 'copium', 'buenas a todos', 'qué juego es este?', 'jajajaja mazo bueno', 'LUL',
  ];
  const now = Date.now();
  const messages = Array.from({ length: 400 }, () => ({
    text: lines[Math.floor(r() * lines.length)],
    channel: ['ibai', 'illojuan', 'elxokas', 'auronplay'][Math.floor(r() * 4)],
    timestamp: new Date(now - r() * 90 * 864e5 - (r() < 0.6 ? 0 : 6 * 36e5)).toISOString(),
  }));
  return {
    user: { login: 'sospechoso_demo', display_name: 'Sospechoso_Demo', description: 'aquí pasando el rato', created_at: '2016-03-14T00:00:00Z' },
    follows: Array.from({ length: 73 }),
    channels: [
      { game_name: 'Just Chatting', broadcaster_language: 'es' }, { game_name: 'Valorant', broadcaster_language: 'es' },
      { game_name: 'League of Legends', broadcaster_language: 'es' }, { game_name: 'Valorant', broadcaster_language: 'es' },
      { game_name: 'Counter-Strike', broadcaster_language: 'en' },
    ],
    chatColor: '#1E90FF',
    messages,
    moderation: [
      { kind: 'timeout', seconds: 600, channel: 'ibai', timestamp: new Date(now - 20 * 864e5).toISOString() },
      { kind: 'timeout', seconds: 3600, channel: 'ibai', timestamp: new Date(now - 9 * 864e5).toISOString() },
      { kind: 'timeout', seconds: 60, channel: 'elxokas', timestamp: new Date(now - 3 * 864e5).toISOString() },
    ],
  };
}

$('btn-login').onclick = () => {
  if (twitch.isConfigured()) return twitch.login();
  $('config-warning').hidden = false;
  $('config-warning').classList.add('flash');
  setTimeout(() => $('config-warning').classList.remove('flash'), 600);
};
$('btn-demo').onclick = () => { Object.assign(state, demoData()); render(); };
$('btn-paste').onclick = () => { state.messages = parsePasted($('paste').value); render(); };
$('btn-skip').onclick = () => render();

// Pega dos bloques de texto uno al lado del otro.
function sideBySide(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const w = Math.max(...la.map((l) => l.length));
  return Array.from({ length: Math.max(la.length, lb.length) }, (_, i) => `${(la[i] || '').padEnd(w + 8)}${lb[i] || ''}`.trimEnd()).join('\n');
}

$('btn-copy').onclick = async () => {
  const p = state.profile;
  const text = [
    'RETRATO ROBOT — SE BUSCA', '', $('portrait').textContent, '', sideBySide($('portrait-left').textContent, $('portrait-right').textContent), '',
    `Alias: ${p.user?.display_name}`, `Edad: ${p.ageRange.join('–')} años`, `Ocupación: ${p.job}`, `Origen: ${p.origin}`,
    `Peligrosidad: ${p.danger}/100`,
  ].join('\n');
  await navigator.clipboard.writeText(text);
  $('btn-copy').textContent = '¡Copiado!';
  setTimeout(() => ($('btn-copy').textContent = 'Copiar retrato'), 1500);
};
$('btn-logout').onclick = async () => {
  await twitch.logout(state.token);
  location.reload();
};

(async function init() {
  $('config-warning').hidden = twitch.isConfigured();
  $('redirect-hint').textContent = twitch.redirectUri();
  try {
    state.token = twitch.consumeRedirect() || twitch.storedToken();
    if (state.token) await investigate();
  } catch (err) {
    fail(err);
  }
})();
