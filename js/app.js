import { LIMITS, DEMO } from './config.js';
import * as twitch from './twitch.js';
import { fetchUserMessages, parsePasted, recentChatters } from './logs.js';
import * as share from './share.js';
import { analyze } from './analyzer.js';
import { renderPortrait } from './portrait.js';

const $ = (id) => document.getElementById(id);
const state = { ownDone: false, followers: [], token: null, user: null, follows: [], channels: [], chatColor: null, messages: [], moderation: [] };

function show(screen) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== `screen-${screen}`;
  // La ficha ocupa toda la pantalla: sin cabecera
  document.querySelector('header').hidden = screen === 'result';
  $('btn-logout').hidden = !state.token;
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
  state.ownDone = true;
  render();
}

function render(subject = state) {
  const profile = analyze(subject);
  const own = subject === state;
  $('btn-back-followers').hidden = own;
  $('btn-back-top').textContent = own ? '← Volver al inicio' : '← Volver a los seguidores';
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

// ---------- Modo streamer: buscador de seguidores ----------

const SHOWN = 40;

function renderFollowers() {
  const q = $('followers-search').value.trim().toLowerCase().replace(/^@/, '');
  const hits = state.followers.filter((f) => !q || f.user_login.includes(q) || f.user_name.toLowerCase().includes(q));
  const items = hits.slice(0, SHOWN).map((f) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    const name = document.createElement('span');
    name.textContent = f.user_name;
    const since = document.createElement('small');
    since.textContent = f.note || `desde ${new Date(f.followed_at).toLocaleDateString('es')}`;
    li.append(name, since);
    const go = () => investigateFollower({ id: f.user_id, login: f.user_login });
    li.onclick = go;
    li.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    return li;
  });
  if (!hits.length && /^\w{1,25}$/.test(q)) {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.textContent = `No aparece en la lista. Investigar a «${q}» igualmente`;
    li.onclick = () => investigateFollower({ login: q });
    items.push(li);
  }
  $('followers-list').replaceChildren(...items);
  $('followers-info').textContent = hits.length > SHOWN
    ? `${hits.length} coincidencias de ${state.followers.length} ${state.source?.demo ? 'usuarios' : 'seguidores'}: se muestran las ${SHOWN} primeras. Sigue escribiendo para afinar.`
    : `${hits.length} de ${state.followers.length} ${state.source?.demo ? `usuarios activos en #${state.source.login} (modo demo)` : 'seguidores cargados'}`;
}

async function openFollowers(reload = false) {
  if (!twitch.hasScope(twitch.FOLLOWERS_SCOPE)) {
    return twitch.login({ scopes: [twitch.FOLLOWERS_SCOPE], mode: 'followers' });
  }
  if (!state.user) state.user = await twitch.getMe(state.token);
  state.source = { login: state.user.login, id: state.user.id };
  if (!state.followers.length || reload || state.demoLoaded) {
    state.demoLoaded = false;
    show('loading');
    $('log').textContent = '';
    log('Pasando lista de seguidores…');
    try {
      const { followers, total } = await twitch.getFollowers(state.token, state.user.id, LIMITS.maxFollowers, (n, t) => {
        $('log').textContent = `> Pasando lista de seguidores… ${n}/${t}\n`;
      });
      state.followers = followers;
      if (!total) throw new Error('Todavía no tienes seguidores. Cuando los tengas, vuelve por aquí.');
    } catch (err) {
      // 400/401/403: el permiso no se ha concedido o ha cambiado
      if (/\b(400|403)\b/.test(err.message)) err.message = 'Twitch no nos deja leer tus seguidores. Vuelve a entrar y acepta el permiso.';
      throw err;
    }
  }
  $('followers-search').value = '';
  renderFollowers();
  show('followers');
  $('followers-search').focus();
}

async function openDemo() {
  show('loading');
  $('log').textContent = '';
  log(`Reuniendo sospechosos del canal #${DEMO.channel} (últimos ${DEMO.days} días con logs)…`);
  state.followers = await recentChatters();
  if (!state.followers.length) throw new Error(`No hay actividad reciente en #${DEMO.channel}.`);
  state.demoLoaded = true;
  state.source = { login: DEMO.channel, id: null, demo: true };
  $('followers-search').value = '';
  renderFollowers();
  show('followers');
  $('followers-search').focus();
}

async function investigateFollower({ id, login }) {
  show('loading');
  $('log').textContent = '';
  log(`Abriendo expediente de ${login}…`);
  try {
    const user = await twitch.getUserByLogin(state.token, login);
    if (!user) throw new Error(`No existe ningún usuario llamado «${login}».`);
    log(`Sujeto identificado: ${user.display_name}`);
    const [chatColor, channels] = await Promise.all([
      twitch.getChatColor(state.token, user.id).catch(() => null),
      (async () => {
        const src = state.source;
        if (!src.id) src.id = (await twitch.getUserByLogin(state.token, src.login))?.id;
        return twitch.getChannels(state.token, [src.id]);
      })().catch(() => []),
    ]);
    log('Interrogando a testigos (archivo de logs)…');
    const logs = await fetchUserMessages(user.login, [state.source.login], log).catch((e) => {
      log(`El archivo de logs no responde (${e.message})`);
      return { messages: [], moderation: [] };
    });
    log(`Total: ${logs.messages.length} mensajes y ${logs.moderation.length} sanciones recuperados`);
    render({ user, follows: [], channels, chatColor, messages: logs.messages, moderation: logs.moderation });
  } catch (err) {
    console.error(err);
    show('followers');
    $('followers-info').textContent = err.message || String(err);
  }
}

function showMenu() {
  $('menu-name').textContent = state.user?.display_name || 'agente';
  show('menu');
}
$('btn-back-top').onclick = () => ($('btn-back-followers').hidden ? showMenu() : $('btn-back-followers').click());
$('btn-menu-me').onclick = () => investigate().catch(fail);
$('btn-menu-demo').onclick = () => openDemo().catch(fail);
$('btn-menu-others').onclick = () => openFollowers().catch(fail);
$('btn-followers-refresh').onclick = () => openFollowers(true).catch(fail);
$('btn-followers-back').onclick = showMenu;
$('btn-back-followers').onclick = () => { renderFollowers(); show('followers'); };
$('followers-search').oninput = renderFollowers;

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
$('btn-paste').onclick = () => { state.messages = parsePasted($('paste').value); state.ownDone = true; render(); };
$('btn-skip').onclick = () => { state.ownDone = true; render(); };

async function currentImage() {
  const p = state.profile;
  return share.toBlob(share.buildImage(p, state.views, darken(p.chatColor), $('profiles-joke').textContent));
}
$('btn-copy-image').onclick = async () => {
  const btn = $('btn-copy-image');
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': currentImage() })]);
    btn.textContent = '¡Copiada!';
  } catch {
    share.download(await currentImage());
    btn.textContent = 'Copia no disponible: descargada';
  }
  setTimeout(() => (btn.textContent = 'Copiar imagen'), 2000);
};
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
  const mode = twitch.takeMode();
  try {
    state.token = twitch.consumeRedirect() || twitch.storedToken();
    if (state.token && mode === 'followers') await openFollowers();
    else if (state.token) {
      state.user = await twitch.getMe(state.token);
      showMenu();
    }
  } catch (err) {
    fail(err);
  }
})();
