import { LIMITS } from './config.js';
import * as twitch from './twitch.js';
import { fetchUserMessages, parsePasted } from './logs.js';
import * as share from './share.js';
import { analyze } from './analyzer.js';
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
  $('wanted-stars').innerHTML = Array.from({ length: 5 }, (_, i) => (i < profile.wanted.stars ? '★' : '<span class="off">★</span>')).join('');
  $('wanted-stars').title = `Nivel de búsqueda: ${profile.wanted.stars}/5`;
  $('wanted-label').textContent = profile.wanted.label;
  // Sin estrellas no hay orden de búsqueda: sello de "indiferente" y sin estrellas
  const clean = profile.wanted.stars === 0;
  $('wanted-stamp').textContent = clean ? 'INDIFERENTE' : 'SE BUSCA';
  $('wanted-stamp').classList.toggle('meh', clean);
  $('wanted-stars').hidden = clean;
  $('msg-count').textContent = stats.messages;
  const links = share.socialLinks(profile);
  for (const k of Object.keys(links)) $(`share-${k}`).href = links[k];
  const PROFILE_JOKES = [
    'Ninguno es el bueno.',
    'Ambos perfiles coinciden: es feo por los dos lados.',
    'Se negó a sonreír para la foto.',
    'No hay perfil bueno. Lo hemos comprobado dos veces.',
    'Cualquier parecido con una persona real es mala suerte para esa persona.',
    'Al menos es simétrico. Más o menos.',
    'El perfil izquierdo no se habla con el derecho.',
  ];
  $('profiles-joke').textContent = PROFILE_JOKES[Number(profile.seed) % PROFILE_JOKES.length];
  $('f-alias').textContent = user ? `${user.display_name}${user.description ? ` — “${user.description}”` : ''}` : '—';
  $('f-age').textContent = `${profile.ageRange[0]}–${profile.ageRange[1]} años${profile.ageSource ? ` (${profile.ageSource})` : ''}`;
  $('f-record').textContent = profile.record;
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
  $('f-hours-joke').textContent = hoursJoke(stats);
  $('f-evidence').replaceChildren(...stats.evidence.flatMap(({ label, value, note }) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const v = document.createElement('b');
    v.textContent = value;
    const small = document.createElement('small');
    small.textContent = note;
    dd.append(v, ' ', small);
    return [dt, dd];
  }));
  if (!stats.evidence.length) $('f-evidence').textContent = 'Sin declaraciones registradas.';
  $('f-words').replaceChildren(...stats.topWords.map(([w, c]) => {
    const tag = document.createElement('span');
    tag.textContent = `${w} ×${c}`;
    return tag;
  }));

  state.profile = profile;
  show('result');
}

// Los elementos pueden ser texto o { text, color } para añadir una muestra del color.
function fillList(id, items) {
  $(id).replaceChildren(...items.map((t) => {
    const li = document.createElement('li');
    li.textContent = t.text ?? t;
    if (t.color) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = t.color;
      swatch.title = t.color;
      li.append(' ', swatch);
    }
    return li;
  }));
}

// Comentario de broma sobre el horario, según la hora punta y el reparto del día.
function hoursJoke(stats) {
  const total = stats.hours.reduce((a, b) => a + b, 0);
  if (!total) return 'Sin datos de horario: o es un fantasma o la coartada es perfecta.';
  const peak = stats.hours.indexOf(Math.max(...stats.hours));
  const hh = `${peak}:00`;
  if (stats.nightPct > 30) return `Hora punta: ${hh}. Mientras el resto duerme, el sospechoso escribe. Los vecinos no han oído nada, pero el chat sí.`;
  if (peak >= 1 && peak < 7) return `Hora punta: ${hh}. A esas horas solo están despiertos los panaderos, los gatos y este sospechoso.`;
  if (stats.workPct > 40) return `Hora punta: ${hh}. Casi todo en horario laboral. O es muy productivo o su jefe debería revisar el historial.`;
  if (peak >= 9 && peak < 14) return `Hora punta: ${hh}. Madrugador: charla de chat antes de comer. Sospechosamente sano.`;
  if (peak >= 14 && peak < 18) return `Hora punta: ${hh}. Sobremesa en el chat. La siesta, de momento, brilla por su ausencia.`;
  if (peak >= 18 && peak < 22) return `Hora punta: ${hh}. Horario de prime time: sale del trabajo, cena rápido y a delinquir en el chat.`;
  return `Hora punta: ${hh}. Cuando cae la noche, el sospechoso se crece. Las ojeras no son casualidad.`;
}

// Los colores de chat suelen ser muy claros; los oscurecemos para que se lean sobre papel.
function darken(hex) {
  if (!hex) return '';
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * 0.4));
  return `rgb(${ch.join(',')})`;
}

$('btn-login').onclick = () => {
  if (twitch.isConfigured()) return twitch.login();
  $('config-warning').hidden = false;
  $('config-warning').classList.add('flash');
  setTimeout(() => $('config-warning').classList.remove('flash'), 600);
};
$('btn-paste').onclick = () => { state.messages = parsePasted($('paste').value); render(); };
$('btn-skip').onclick = () => render();

async function currentImage() {
  const p = state.profile;
  return share.toBlob(share.buildImage(p, state.views, darken(p.chatColor), $('profiles-joke').textContent));
}
$('btn-download').onclick = async () => share.download(await currentImage());
$('btn-share-native').onclick = async () => {
  const blob = await currentImage();
  if (!(await share.nativeShare(state.profile, blob))) share.download(blob);
};
$('btn-share-native').hidden = !(navigator.canShare && navigator.share);

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
