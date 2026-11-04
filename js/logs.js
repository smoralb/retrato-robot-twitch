import { LOGS_BASE, LIMITS, DEMO } from './config.js';

async function getJson(url) {
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`logs ${res.status}`);
  return res.json();
}

export async function loggedChannels() {
  const data = await getJson(`${LOGS_BASE}/channels`);
  return new Set((data?.channels || []).map((c) => c.name.toLowerCase()));
}

async function userLogsInChannel(channel, user) {
  const list = await getJson(`${LOGS_BASE}/list?channel=${channel}&user=${user}`);
  const months = (list?.availableLogs || []).slice(0, LIMITS.monthsPerChannel);
  const messages = [];
  const moderation = [];
  for (const { year, month } of months) {
    const data = await getJson(`${LOGS_BASE}/channel/${channel}/user/${user}/${year}/${month}?json`);
    for (const m of data?.messages || []) {
      // type 1 = PRIVMSG (mensaje normal); type 2 = CLEARCHAT (timeout, o ban si no trae duración)
      if (m.type === 2) {
        const seconds = Number(m.tags?.['ban-duration']) || 0;
        moderation.push({ kind: seconds ? 'timeout' : 'ban', seconds, channel, timestamp: m.timestamp });
      } else if (m.type === undefined || m.type === 1) {
        messages.push({ text: m.text, channel, timestamp: m.timestamp });
      }
    }
  }
  return { messages, moderation };
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(await fn(item).catch(() => null));
    }
  });
  await Promise.all(workers);
  return results;
}

// candidates: logins de canal ordenados por prioridad.
// Devuelve { messages, moderation } con los mensajes y los timeouts/bans recibidos.
export async function fetchUserMessages(user, candidates, onProgress) {
  const logged = await loggedChannels();
  const channels = [...new Set(candidates.map((c) => c.toLowerCase()))]
    .filter((c) => logged.has(c))
    .slice(0, LIMITS.maxLogChannels);
  onProgress?.(`${channels.length} de tus canales aparecen en el archivo de logs`);
  let done = 0;
  const chunks = await pool(channels, LIMITS.concurrency, async (ch) => {
    const logs = await userLogsInChannel(ch, user.toLowerCase());
    const mod = logs.moderation.length ? `, ${logs.moderation.length} sanciones` : '';
    onProgress?.(`[${++done}/${channels.length}] #${ch}: ${logs.messages.length} mensajes${mod}`);
    return logs;
  });
  const ok = chunks.filter(Boolean);
  return { messages: ok.flatMap((c) => c.messages), moderation: ok.flatMap((c) => c.moderation) };
}

// Formatos aceptados al pegar a mano:
//   [2024-05-01 21:03:11] #canal usuario: mensaje
//   mensaje suelto (una línea por mensaje)
export function parsePasted(text) {
  const re = /^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?)\]\s*(?:#(\S+)\s+)?(?:[^:\s]+:\s)?(.*)$/;
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(re);
      if (!m) return { text: line, channel: null, timestamp: null };
      return { text: m[3], channel: m[2] || null, timestamp: new Date(m[1].replace(' ', 'T')).toISOString() };
    });
}

const BOTS = /^(nightbot|streamelements|streamlabs|moobot|fossabot|wizebot|sery_bot|pajbot|supibot|commanderroot|streamholics)$|bot$/i;

// Usuarios que han escrito en un canal archivado durante sus últimos días con logs,
// ordenados por mensajes. Sirve de "seguidores" de ejemplo para el modo demo.
export async function recentChatters(channel = DEMO.channel, days = DEMO.days) {
  const list = await getJson(`${LOGS_BASE}/list?channel=${channel}`);
  if (!list) throw new Error(`El canal «${channel}» no está en el archivo de logs.`);
  const picked = (list.availableLogs || []).slice(0, days);
  const users = new Map();
  const dayLogs = await pool(picked, LIMITS.concurrency, ({ year, month, day }) =>
    getJson(`${LOGS_BASE}/channel/${channel}/${year}/${month}/${day}?json`));
  for (const day of dayLogs) {
    for (const m of day?.messages || []) {
      if (m.type !== 1 || !m.username || BOTS.test(m.username)) continue;
      const u = users.get(m.username) || { user_id: m.tags?.['user-id'], user_login: m.username, user_name: m.displayName || m.username, count: 0, last: m.timestamp };
      u.count++;
      if (m.timestamp > u.last) u.last = m.timestamp;
      users.set(m.username, u);
    }
  }
  return [...users.values()]
    .sort((a, b) => b.count - a.count)
    .map((u) => ({ ...u, followed_at: u.last, note: `${u.count} mensajes · visto ${new Date(u.last).toLocaleDateString('es')}` }));
}
