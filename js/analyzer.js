import { readAlias, MAX_AGE } from './alias.js';
import { choose } from './humor.js';
import { F } from './frases.js';

// Análisis 100% heurístico (sin IA). Las conclusiones son de broma: listas de palabras,
// horarios y categorías de juegos convertidas en un "perfil criminal" con aire oficial.

const STOPWORDS = {
  es: ['que', 'de', 'no', 'la', 'el', 'en', 'y', 'es', 'los', 'por', 'un', 'una', 'con', 'para', 'pero', 'lo', 'me', 'se', 'te', 'ya', 'muy', 'esto', 'eso', 'como', 'qué', 'porque', 'pues', 'también', 'está', 'hay', 'tiene'],
  en: ['the', 'and', 'is', 'you', 'that', 'it', 'to', 'of', 'this', 'what', 'in', 'for', 'with', 'are', 'was', 'just', 'but', 'have', 'not', 'he', 'so', 'they', 'like', 'my', 'his'],
  pt: ['não', 'que', 'de', 'é', 'com', 'pra', 'uma', 'mano', 'muito', 'você', 'isso', 'tá', 'ele', 'mais', 'por', 'kkkk', 'então', 'também', 'tudo'],
  fr: ['le', 'la', 'les', 'est', 'et', 'pas', 'je', 'tu', 'des', 'une', 'que', 'pour', 'mais', 'c\'est', 'oui', 'avec', 'très', 'ça'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'ein', 'eine', 'auch', 'mit', 'aber', 'was', 'ja', 'sehr', 'schon'],
  it: ['che', 'non', 'il', 'di', 'è', 'per', 'una', 'sono', 'anche', 'questo', 'perché', 'molto', 'ciao', 'però', 'gli', 'della'],
};

const LANG_NAMES = { es: 'hispanohablante', en: 'anglosajón', pt: 'lusófono', fr: 'francófono', de: 'germanoparlante', it: 'italiano' };

const REGIONS = [
  { name: 'España', words: ['tío', 'tio', 'tía', 'tia', 'vale', 'mola', 'guay', 'hostia', 'joder', 'gilipollas', 'chaval', 'curro', 'currar', 'flipas', 'flipo', 'macho', 'mazo', 'vosotros', 'coño', 'cutre', 'pavo', 'quillo', 'illo', 'osea', 'bocata'] },
  { name: 'México', words: ['wey', 'güey', 'guey', 'neta', 'chido', 'chida', 'órale', 'orale', 'carnal', 'chamba', 'padrísimo', 'naco', 'mames', 'chingón', 'chingon', 'ahorita', 'cuate', 'alv'] },
  { name: 'Argentina', words: ['che', 'boludo', 'boluda', 'pibe', 'piba', 'laburo', 're', 'posta', 'quilombo', 'chabón', 'chabon', 'vos', 'sos', 'mina', 'birra', 'bondi', 'ndeah'] },
  { name: 'Colombia', words: ['parce', 'parcero', 'bacano', 'chimba', 'gonorrea', 'marica', 'berraco', 'pues', 'llave', 'nea', 'vaina'] },
  { name: 'Chile', words: ['po', 'weón', 'weon', 'wn', 'cachai', 'fome', 'bacán', 'bacan', 'pololo', 'polola', 'cuático', 'altiro', 'hueón'] },
  { name: 'Venezuela', words: ['pana', 'chévere', 'chevere', 'vale', 'chamo', 'chama', 'arrecho', 'burda', 'ladilla', 'coroto'] },
  { name: 'Perú', words: ['causa', 'pata', 'chamba', 'jato', 'bacán', 'chévere', 'pe', 'jerma', 'huevadas'] },
  { name: 'Brasil', words: ['kkkk', 'kkkkk', 'mano', 'cara', 'caralho', 'porra', 'mds', 'vlw', 'tmj', 'slk', 'pqp', 'blz'] },
];

const SLANG = {
  zoomer: ['skibidi', 'rizz', 'sigma', 'npc', 'cringe', 'based', 'bussin', 'nocap', 'fr', 'ong', 'delulu', 'aura', 'gyatt', 'ohio', 'slay', 'goat', 'literal', 'bro', 'mewing', 'ratio', 'xddd', 'f', 'lmfao', 'pov', 'basado', 'god', 'potente'],
  millennial: ['lol', 'xd', 'epic', 'épico', 'troll', 'fail', 'lmao', 'rofl', 'owned', 'noob', 'zas', 'yolo', 'swag', 'okey', 'jajaja', 'haha', 'pwned', 'gg', 'wtf'],
  boomer: ['saludos', 'jeje', 'jejeje', 'caballero', 'señor', 'estimado', 'buenas', 'bendiciones', 'enhorabuena', 'felicidades', 'ole', 'cordial', 'atentamente', 'vuestra', 'usted'],
  twitch: ['pog', 'poggers', 'kekw', 'lul', 'pepega', 'omegalul', 'monkas', 'sadge', 'copium', 'hopium', 'pogchamp', 'ez', 'clap', 'kappa', 'catjam', 'pausechamp', 'lulw', 'weirdchamp', 'aware', 'xdd', 'icant', 'gigachad', 'peepoclap', 'stare'],
};

const SWEARS = ['joder', 'mierda', 'puta', 'puto', 'hostia', 'coño', 'cabrón', 'cabron', 'gilipollas', 'pendejo', 'verga', 'chinga', 'carajo', 'concha', 'fuck', 'shit', 'bitch', 'damn', 'ass', 'idiota', 'imbécil', 'subnormal', 'mrd', 'ctm', 'hdp', 'alv', 'caralho', 'porra'];
const POLITE = ['gracias', 'thanks', 'thank', 'porfa', 'por favor', 'please', 'pls', 'perdón', 'perdon', 'sorry', 'buenas', 'hola', 'saludos', 'disculpa', 'obrigado', 'merci', 'danke'];

const KID_GAMES = ['minecraft', 'fortnite', 'roblox', 'brawl stars', 'among us', 'geometry dash', 'clash royale', 'pokémon', 'pokemon', 'fall guys', 'rocket league'];
const OLD_GAMES = ['world of warcraft', 'counter-strike', 'chess', 'age of empires', 'diablo', 'starcraft', 'retro', 'poker', 'slots', 'path of exile', 'eve online', 'microsoft flight simulator', 'football manager', 'tibia'];
const SHOOTERS = ['valorant', 'counter-strike', 'call of duty', 'apex legends', 'overwatch', 'fortnite', 'rainbow six', 'escape from tarkov', 'pubg', 'the finals', 'marvel rivals'];

const LAUGHS = [
  { re: /\b(?:ja){2,}j?\b/i, label: 'jajaja' },
  { re: /\b(?:js){2,}j?\b|\bajs[jdk]+/i, label: 'jsjsjs' },
  { re: /\bx+d+\b/i, label: 'xD' },
  { re: /\bk{4,}\b/i, label: 'kkkk' },
  { re: /\b(?:lol|lmao|lmfao)\b/i, label: 'lol' },
  { re: /\b(?:je){2,}\b/i, label: 'jeje' },
  { re: /\b(?:ha){2,}\b/i, label: 'haha' },
];

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

// Temas que nunca se muestran en la ficha ni se usan para bromas: política, conflictos,
// violencia, tragedias, religión, salud e insultos discriminatorios.
// Las raíces se buscan dentro de la palabra (genocidio, genocida…); las palabras, exactas.
const SENSITIVE_ROOTS = [
  'israel', 'palestin', 'gaza', 'hamas', 'hezbol', 'sionis', 'genocid', 'holocaust', 'ucrani', 'ukrain', 'putin', 'zelensk',
  'guerra', 'bombard', 'terroris', 'atentad', 'yihad', 'jihad', 'taliban', 'nazi', 'hitler', 'fascis', 'franquis', 'comunis',
  'dictad', 'trump', 'biden', 'kamala', 'milei', 'abascal', 'politic', 'eleccion', 'gobierno', 'asesin', 'muerte', 'murder',
  'suicid', 'violac', 'violad', 'pederast', 'pedofil', 'secuestr', 'tiroteo', 'masacre', 'tortur', 'cancer', 'covid',
  'pandemi', 'enfermedad', 'judio', 'musulman', 'muslim', 'islam', 'cristian', 'catolic', 'religion', 'iglesia', 'mezquita',
  'sinagoga', 'racis', 'negrata', 'nigg', 'sudaca', 'gitan', 'maricon', 'faggot', 'travelo', 'tranny', 'retrasad', 'retard',
  'subnormal', 'mongol', 'autist', 'sidoso',
];
const SENSITIVE_WORDS = new Set([
  'rusia', 'russia', 'iran', 'irani', 'irak', 'iraq', 'siria', 'libano', 'yemen', 'afganistan', 'atacado', 'atacados', 'war', 'bomba', 'bombas', 'misil', 'misiles', 'isis', 'franco', 'maduro', 'petro', 'sanchez', 'ayuso',
  'psoe', 'pp', 'vox', 'podemos', 'matar', 'mato', 'muerto', 'muertos', 'kill', 'rape', 'abuso', 'tumor', 'jew', 'jews',
  'moro', 'moros', 'chino', 'chinos', 'marica', 'puta', 'putas', 'zorra', 'perra',
]);
const strip = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function isSensitive(word) {
  const w = strip(word.toLowerCase());
  return SENSITIVE_WORDS.has(w) || SENSITIVE_ROOTS.some((r) => w.includes(r));
}

function words(text) {
  return text.toLowerCase().normalize('NFC').match(/[\p{L}\p{N}']+/gu) || [];
}

function count(list, wordsArr) {
  const set = new Set(list);
  return wordsArr.reduce((n, w) => n + (set.has(w) ? 1 : 0), 0);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hashString(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function top(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// Resume los timeouts y bans recibidos en un "historial delictivo".
function criminalRecord(moderation) {
  const timeouts = moderation.filter((m) => m.kind === 'timeout');
  const bans = moderation.filter((m) => m.kind === 'ban');
  const seconds = timeouts.reduce((a, m) => a + m.seconds, 0);
  const byChannel = new Map();
  for (const m of moderation) byChannel.set(m.channel, (byChannel.get(m.channel) || 0) + 1);
  const worst = top(byChannel, 1)[0];
  const longest = timeouts.reduce((a, m) => Math.max(a, m.seconds), 0);
  return { timeouts: timeouts.length, bans: bans.length, seconds, longest, worst, banChannels: [...new Set(bans.map((b) => b.channel))] };
}

// Colores por defecto de Twitch y, para el resto, un nombre aproximado según el tono.
const TWITCH_COLORS = {
  '#FF0000': 'rojo', '#0000FF': 'azul', '#008000': 'verde', '#B22222': 'rojo ladrillo', '#FF7F50': 'coral',
  '#9ACD32': 'verde lima', '#FF4500': 'naranja rojizo', '#2E8B57': 'verde mar', '#DAA520': 'dorado',
  '#D2691E': 'chocolate', '#5F9EA0': 'azul cadete', '#1E90FF': 'azul eléctrico', '#FF69B4': 'rosa chicle',
  '#8A2BE2': 'violeta', '#00FF7F': 'verde primavera',
};
export function colorName(hex) {
  const key = hex.toUpperCase();
  if (TWITCH_COLORS[key]) return TWITCH_COLORS[key];
  const n = parseInt(key.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 0.12) return l > 0.85 ? 'blanco' : l < 0.15 ? 'negro' : 'gris';
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const base = h < 15 ? 'rojo' : h < 40 ? 'naranja' : h < 65 ? 'amarillo' : h < 160 ? 'verde' : h < 190 ? 'turquesa' : h < 250 ? 'azul' : h < 290 ? 'morado' : h < 335 ? 'rosa' : 'rojo';
  return l > 0.7 ? `${base} pastel` : l < 0.3 ? `${base} oscuro` : base;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const quote = (t, max = 70) => `“${t.length > max ? t.slice(0, max - 1) + '…' : t}”`;
const shortDate = (d) => d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });

// "Huellas en el chat": datos curiosos de los mensajes, cada uno con su comentario.
function evidence(messages, stats, allWords, key) {
  const out = [];
  const V = (id, list) => choose(list, `${key}:ev_${id}`);
  const safe = messages.filter((m) => m.text && !words(m.text).some(isSensitive) && !/https?:\/\//.test(m.text));
  if (!safe.length) return out;

  const byLen = [...safe].sort((a, b) => b.text.length - a.text.length);
  const longest = byLen[0];
  if (longest.text.length > 25) out.push({ label: 'Declaración más extensa', value: quote(longest.text), note: V('long', F.ev_long(longest.text.length)) });
  const shortest = byLen[byLen.length - 1];
  if (shortest !== longest && shortest.text.length <= 12) out.push({ label: 'Declaración más escueta', value: quote(shortest.text), note: V('short', F.ev_short) });

  const dated = safe.filter((m) => m.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (dated.length && dated[0] !== longest && dated[0] !== shortest) {
    const f = dated[0];
    out.push({ label: 'Primera prueba registrada', value: quote(f.text, 50), note: `${shortDate(new Date(f.timestamp))}${f.channel ? ` en #${f.channel}` : ''}` });
  }

  const emotes = new Map();
  for (const w of allWords) if (SLANG.twitch.includes(w)) emotes.set(w, (emotes.get(w) || 0) + 1);
  const emote = top(emotes, 1)[0];
  if (emote) out.push({ label: 'Emote de cabecera', value: emote[0].toUpperCase(), note: V('emote', F.ev_emote(emote[1])) });

  if (stats.laugh) out.push({ label: 'Risa oficial', value: stats.laugh, note: V('laugh', F.ev_laugh[stats.laugh] || F.ev_laugh.other) });

  const isLaugh = (w) => /^(?:[jh][aeiou]|js|aj|sj|x+d+|k+)+[jhsdk]?$/i.test(w) || /^(.)\1+$/.test(w);
  const longWord = [...new Set(allWords)].filter((w) => w.length <= 25 && !/\d/.test(w) && !isSensitive(w) && !isLaugh(w)).sort((a, b) => b.length - a.length)[0];
  if (longWord && longWord.length >= 9) out.push({ label: 'Palabra más larga', value: longWord, note: V('word', F.ev_word(longWord.length)) });

  if (stats.hours.some(Boolean)) {
    const h = stats.hours.indexOf(Math.max(...stats.hours));
    const tag = V('hour', F.ev_hour[h < 6 ? 'vampiro' : h < 9 ? 'cafe' : h < 14 ? 'laboral' : h < 16 ? 'sobremesa' : h < 21 ? 'prime' : 'noche']);
    out.push({ label: 'Hora punta', value: `${h}:00`, note: tag });
    const days = new Array(7).fill(0);
    for (const m of dated) days[new Date(m.timestamp).getDay()]++;
    const d = days.indexOf(Math.max(...days));
    out.push({ label: 'Día de más actividad', value: WEEKDAYS[d], note: V('day', F.ev_day[d === 1 ? 'lunes' : d === 0 || d === 6 ? 'finde' : 'semana']) });
  }

  const avg = Math.round(stats.avgLen);
  out.push({ label: 'Longitud media', value: `${avg} caracteres`, note: V('avg', F.ev_avg[avg < 15 ? 'telegrama' : avg < 40 ? 'tuit' : avg < 90 ? 'parrafo' : 'ensayo']) });

  if (stats.capsPct >= 10) out.push({ label: 'Mensajes EN MAYÚSCULAS', value: `${Math.round(stats.capsPct)}%`, note: V('caps', F.ev_caps) });
  if (stats.questionPct >= 10) out.push({ label: 'Preguntas', value: `${Math.round(stats.questionPct)}% de los mensajes`, note: V('q', F.ev_q) });
  if (stats.emojiPer100 >= 10) out.push({ label: 'Emojis', value: `${Math.round(stats.emojiPer100)} por cada 100 mensajes`, note: V('emoji', F.ev_emoji) });
  return out.slice(0, 8);
}

// Nivel de búsqueda de 0 a 5 estrellas según timeouts y bans.
function wantedLevel(rec, key) {
  const stars = Math.min(5, rec.bans * 2 + (rec.timeouts >= 1) + (rec.timeouts >= 3) + (rec.timeouts >= 6) + (rec.timeouts >= 10) + (rec.longest >= 86400));
  return { stars, label: choose(F.wanted[stars], `${key}:wanted`) };
}

function duration(s) {
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1).replace('.0', '')} h`;
  const d = (s / 86400).toFixed(1).replace('.0', '');
  return `${d} ${d === '1' ? 'día' : 'días'}`;
}

export function analyze({ user, follows = [], channels = [], messages = [], chatColor = null, moderation = [] }) {
  const n = messages.length;
  const userKey = user?.login || 'anon';
  const V = (id, list) => choose(list, `${userKey}:${id}`);
  const allWords = [];
  const wordFreq = new Map();
  const channelFreq = new Map();
  const laughFreq = new Map();
  const hours = new Array(24).fill(0);
  let caps = 0, questions = 0, exclaims = 0, emojis = 0, totalLen = 0, timed = 0, workHours = 0, night = 0, weekend = 0;
  let first = null, last = null;
  const stop = new Set(Object.values(STOPWORDS).flat());

  for (const m of messages) {
    const text = m.text || '';
    const ws = words(text);
    allWords.push(...ws);
    totalLen += text.length;
    const letters = text.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) caps++;
    if (text.includes('?')) questions++;
    if (text.includes('!')) exclaims++;
    emojis += (text.match(EMOJI_RE) || []).length;
    for (const w of ws) if (w.length > 3 && !stop.has(w) && !/^\d+$/.test(w) && !isSensitive(w)) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    if (m.channel) channelFreq.set(m.channel, (channelFreq.get(m.channel) || 0) + 1);
    for (const l of LAUGHS) if (l.re.test(text)) laughFreq.set(l.label, (laughFreq.get(l.label) || 0) + 1);
    if (m.timestamp) {
      const d = new Date(m.timestamp);
      const h = d.getHours();
      const day = d.getDay();
      hours[h]++;
      timed++;
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
      if (day === 0 || day === 6) weekend++;
      else if (h >= 9 && h < 18) workHours++;
      if (h >= 1 && h < 7) night++;
    }
  }

  const W = Math.max(allWords.length, 1);
  const rate = (list) => count(list, allWords) / W;
  const per100 = (x) => (n ? (x / n) * 100 : 0);

  const stats = {
    messages: n,
    avgLen: n ? totalLen / n : 0,
    capsPct: per100(caps),
    questionPct: per100(questions),
    exclaimPct: per100(exclaims),
    emojiPer100: per100(emojis),
    swearPer1k: rate(SWEARS) * 1000,
    politePer1k: rate(POLITE) * 1000,
    workPct: timed ? (workHours / timed) * 100 : null,
    nightPct: timed ? (night / timed) * 100 : null,
    weekendPct: timed ? (weekend / timed) * 100 : null,
    hours,
    topWords: top(wordFreq, 10),
    topChannels: top(channelFreq, 5),
    laugh: top(laughFreq, 1)[0]?.[0] || null,
    first,
    last,
    channelCount: channelFreq.size,
  };
  stats.topWords = stats.topWords.filter(([, c]) => c > 1);
  stats.evidence = evidence(messages, stats, allWords, userKey);

  // ---- Idioma y origen
  const langScores = Object.fromEntries(Object.entries(STOPWORDS).map(([k, list]) => [k, rate(list)]));
  const followLangs = new Map();
  for (const c of channels) if (c.broadcaster_language) followLangs.set(c.broadcaster_language, (followLangs.get(c.broadcaster_language) || 0) + 1);
  for (const [lang, cnt] of followLangs) if (langScores[lang] !== undefined) langScores[lang] += (cnt / Math.max(channels.length, 1)) * (n ? 0.02 : 1);
  const [lang, langScore] = top(new Map(Object.entries(langScores)), 1)[0] || ['es', 0];

  const regionScores = REGIONS.map((r) => ({ name: r.name, score: count(r.words, allWords) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  let origin;
  if (lang === 'pt' || regionScores[0]?.name === 'Brasil') origin = V('origin_br', F.origin_br);
  else if (lang === 'es' && regionScores.length) {
    const best = regionScores[0];
    const second = regionScores[1];
    origin = second && second.score > best.score * 0.7 ? V('origin_tie', F.origin_tie(best.name, second.name)) : best.name;
  } else if (lang === 'es') origin = V('origin_es', F.origin_es);
  else origin = `Zona ${LANG_NAMES[lang] || 'desconocida'}`;

  // ---- Pistas del alias (mandan sobre las deducciones del chat)
  const alias = readAlias(user);
  if (alias.country) origin = V('origin_alias', F.origin_alias(alias.country));

  // ---- Juegos
  const gameFreq = new Map();
  for (const c of channels) if (c.game_name) gameFreq.set(c.game_name, (gameFreq.get(c.game_name) || 0) + 1);
  const topGames = top(gameFreq, 5);
  const gamesLower = topGames.map(([g]) => g.toLowerCase());
  const has = (list) => gamesLower.filter((g) => list.some((x) => g.includes(x))).length;

  // ---- Edad
  const accountYears = user?.created_at ? (Date.now() - new Date(user.created_at)) / 3.156e10 : 0;
  let age = 27;
  age -= rate(SLANG.zoomer) * 400;
  age += rate(SLANG.millennial) * 150;
  age += rate(SLANG.boomer) * 700;
  age -= rate(SLANG.twitch) * 60;
  age -= stats.emojiPer100 * 0.04;
  age += (stats.avgLen - 30) * 0.08;
  age -= has(KID_GAMES) * 2.5;
  age += has(OLD_GAMES) * 2.5;
  if (stats.laugh === 'jsjsjs' || stats.laugh === 'xD') age -= 3;
  if (stats.laugh === 'jeje') age += 6;
  if (alias.features.old) age += 15;
  if (alias.features.young) age -= 8;
  age = Math.max(age, 13 + accountYears); // nadie abre cuenta con menos de 13 (en teoría)
  age = Math.round(clamp(age, 13, MAX_AGE - 3));
  let ageRange = [age - 2, age + 3];
  let ageSource = null;
  if (alias.birthYear) {
    age = new Date().getFullYear() - alias.birthYear;
    ageRange = [age - 1, age];
    ageSource = `nació en ${alias.birthYear}, según su alias`;
  }

  // ---- Empleo
  let job;
  if (age < 18) job = V('job_student', F.job_student);
  else if (stats.workPct === null) job = V('job_unknown', F.job_unknown);
  else if (stats.nightPct > 35) job = V('job_night', F.job_night);
  else if (stats.workPct > 45) job = V('job_idle', F.job_idle);
  else if (stats.workPct > 25) job = V('job_lax', F.job_lax);
  else if (stats.weekendPct > 50) job = V('job_weekend', F.job_weekend);
  else job = V('job_office', F.job_office);

  // ---- Rasgos de personalidad
  const traits = [];
  if (stats.capsPct > 20) traits.push(V('caps', F.caps));
  if (stats.questionPct > 25) traits.push(V('q', F.q));
  if (stats.swearPer1k > 15) traits.push(V('swear', F.swear));
  if (stats.politePer1k > 15) traits.push(V('polite', F.polite));
  if (stats.emojiPer100 > 30) traits.push(V('emoji', F.emoji));
  if (rate(SLANG.twitch) > 0.03) traits.push(V('emote', F.emote));
  if (stats.avgLen > 70) traits.push(V('long', F.long));
  if (stats.avgLen < 12 && n) traits.push(V('short', F.short));
  if (stats.nightPct > 25) traits.push(V('night', F.night));
  if (follows.length > 200) traits.push(V('follows', F.follows(follows.length)));
  if (follows.length && follows.length < 10) traits.push(V('fewfollows', F.fewfollows));
  if (has(SHOOTERS) >= 2) traits.push(V('guns', F.guns));
  // ---- Antecedentes (timeouts y bans del archivo de logs)
  const rec = criminalRecord(moderation);
  let record;
  if (!rec.timeouts && !rec.bans) record = V('clean', F.clean);
  else {
    const parts = [];
    if (rec.timeouts) parts.push(V('rec_timeouts', F.rec_timeouts(rec.timeouts, duration(rec.seconds))));
    if (rec.bans) parts.push(V('rec_bans', F.rec_bans(rec.banChannels.map((c) => '#' + c).join(', '))));
    record = parts.join(' · ');
  }
  if (rec.bans) traits.push(V('ban', F.ban(rec.banChannels.length > 1 ? `${rec.banChannels.length} canales` : '#' + rec.banChannels[0])));
  if (rec.timeouts >= 10) traits.push(V('rec10', F.rec10));
  else if (rec.timeouts >= 3) traits.push(V('rec3', F.rec3));
  else if (rec.timeouts) traits.push(V('rec1', F.rec1));
  if (rec.longest >= 86400) traits.push(V('longTimeout', F.longTimeout(duration(rec.longest))));
  if (stats.exclaimPct > 35) traits.push(V('exclaim', F.exclaim));
  if (has(KID_GAMES) >= 2) traits.push(V('g_kid', F.g_kid));
  if (has(OLD_GAMES) >= 2) traits.push(V('g_old', F.g_old));
  if (topGames[0] && topGames.length >= 1 && channels.length >= 3) traits.push(V('g_fav', F.g_fav(topGames[0][0])));
  const topCh = stats.topChannels[0];
  if (topCh && n >= 50 && topCh[1] / n > 0.6) traits.push(V('loyal', F.loyal(topCh[0])));
  if (stats.channelCount >= 12) traits.push(V('manychannels', F.manychannels(stats.channelCount)));
  if (accountYears >= 8) traits.push(V('acct_old', F.acct_old(Math.floor(accountYears))));
  else if (user?.created_at && accountYears < 0.5) traits.push(V('acct_new', F.acct_new));
  if (age < 18) traits.push(V('age_young', F.age_young));
  else if (age > 40) traits.push(V('age_old', F.age_old));
  traits.push(...alias.jokes);
  if (!traits.length) traits.push(V('gray', F.gray));

  const danger = clamp(Math.round(rec.timeouts * 4 + rec.bans * 20 + alias.danger + stats.capsPct * 0.6 + stats.swearPer1k * 1.2 + stats.nightPct * 0.4 + rate(SLANG.twitch) * 300 + (n > 2000 ? 15 : 0)), 3, 99);

  // ---- Señas particulares
  const marks = [];
  if (stats.nightPct > 20) marks.push(V('m_night', F.m_night));
  if (stats.laugh) marks.push(V('m_laugh', F.m_laugh(stats.laugh)));
  if (stats.topWords[0]?.[1] > 1) marks.push(V('m_word', F.m_word(stats.topWords[0][0])));
  if (follows.length > 50 || n > 1000) marks.push(V('m_head', F.m_head));
  if (stats.topChannels[0]) marks.push(V('m_channel', F.m_channel(stats.topChannels[0][0])));
  if (chatColor) marks.push({ text: V('m_color', F.m_color(colorName(chatColor))), color: chatColor });
  marks.unshift(...alias.marks);
  if (rec.worst && rec.worst[1] > 1) marks.push(V('m_fichado', F.m_fichado(rec.worst[0], rec.worst[1])));

  const seed = hashString(user?.login || 'anon');

  return {
    seed,
    user,
    stats,
    lang,
    origin,
    age,
    ageRange,
    ageSource,
    alias,
    record,
    criminal: rec,
    wanted: wantedLevel(rec, userKey),
    accountYears,
    job,
    traits,
    marks,
    danger,
    topGames,
    chatColor,
    features: {
      young: age < 22,
      old: age > 38,
      nightOwl: (stats.nightPct ?? 0) > 20 || !!alias.features.sleepy,
      shouter: stats.capsPct > 15,
      angry: stats.swearPer1k > 10 || !!alias.features.angry || rec.bans > 0 || rec.timeouts >= 3,
      curious: stats.questionPct > 20,
      laughs: (!!stats.laugh && n > 0) || !!alias.features.handsome,
      nerd: stats.avgLen > 55 || has(OLD_GAMES) > 0 || !!alias.features.glasses,
      headphones: follows.length > 50 || n > 1000 || !!alias.features.gamer,
      shooter: has(SHOOTERS) > 0 || !!alias.features.shooter,
      polite: stats.politePer1k > 12,
      sad: !!alias.features.sad,
      // rasgos físicos confesados en el alias
      fat: !!alias.features.fat,
      thin: !!alias.features.thin,
      bald: !!alias.features.bald,
      beard: !!alias.features.beard,
      glasses: !!alias.features.glasses,
      blond: !!alias.features.blond,
      ginger: !!alias.features.ginger,
      darkHair: !!alias.features.dark,
    },
  };
}
