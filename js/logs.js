import { LOGS_BASE, LIMITS } from './config.js';

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
  const out = [];
  for (const { year, month } of months) {
    const data = await getJson(`${LOGS_BASE}/channel/${channel}/user/${user}/${year}/${month}?json`);
    for (const m of data?.messages || []) {
      // type 1 = PRIVMSG (mensaje normal); ignora subs, timeouts, etc.
      if (m.type !== undefined && m.type !== 1) continue;
      out.push({ text: m.text, channel, timestamp: m.timestamp });
    }
  }
  return out;
}

async function pool(items, size, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const item = items[i++];
      results.push(await fn(item).catch(() => []));
    }
  });
  await Promise.all(workers);
  return results;
}

// candidates: logins de canal ordenados por prioridad.
export async function fetchUserMessages(user, candidates, onProgress) {
  const logged = await loggedChannels();
  const channels = [...new Set(candidates.map((c) => c.toLowerCase()))]
    .filter((c) => logged.has(c))
    .slice(0, LIMITS.maxLogChannels);
  onProgress?.(`${channels.length} de tus canales aparecen en el archivo de logs`);
  let done = 0;
  const chunks = await pool(channels, LIMITS.concurrency, async (ch) => {
    const msgs = await userLogsInChannel(ch, user.toLowerCase());
    onProgress?.(`[${++done}/${channels.length}] #${ch}: ${msgs.length} mensajes`);
    return msgs;
  });
  return chunks.flat();
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
