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

export function analyze({ user, follows = [], channels = [], messages = [], chatColor = null }) {
  const n = messages.length;
  const allWords = [];
  const wordFreq = new Map();
  const channelFreq = new Map();
  const laughFreq = new Map();
  const hours = new Array(24).fill(0);
  let caps = 0, questions = 0, exclaims = 0, emojis = 0, totalLen = 0, timed = 0, workHours = 0, night = 0, weekend = 0;
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
    for (const w of ws) if (w.length > 3 && !stop.has(w) && !/^\d+$/.test(w)) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    if (m.channel) channelFreq.set(m.channel, (channelFreq.get(m.channel) || 0) + 1);
    for (const l of LAUGHS) if (l.re.test(text)) laughFreq.set(l.label, (laughFreq.get(l.label) || 0) + 1);
    if (m.timestamp) {
      const d = new Date(m.timestamp);
      const h = d.getHours();
      const day = d.getDay();
      hours[h]++;
      timed++;
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
  };

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
  if (lang === 'pt' || regionScores[0]?.name === 'Brasil') origin = 'Brasil (o alguien que ve demasiado a Gaules)';
  else if (lang === 'es' && regionScores.length) {
    const best = regionScores[0];
    const second = regionScores[1];
    origin = second && second.score > best.score * 0.7 ? `${best.name}… o ${second.name}. El testigo no está seguro` : best.name;
  } else if (lang === 'es') origin = 'Territorio hispanohablante sin acento detectable (sospechoso)';
  else origin = `Zona ${LANG_NAMES[lang] || 'desconocida'}`;

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
  age = Math.max(age, 13 + accountYears); // nadie abre cuenta con menos de 13 (en teoría)
  age = Math.round(clamp(age, 13, 70));
  const ageRange = [age - 2, age + 3];

  // ---- Empleo
  let job;
  if (age < 18) job = 'Estudiante (debería estar haciendo los deberes)';
  else if (stats.workPct === null) job = 'Indeterminado: el sujeto no deja huellas horarias';
  else if (stats.nightPct > 35) job = 'Turno de noche, vigilante de seguridad o insomnio crónico';
  else if (stats.workPct > 45) job = 'Desempleado, estudiante o "teletrabajando" con Twitch en la otra pantalla';
  else if (stats.workPct > 25) job = 'Empleado con jefe muy permisivo';
  else if (stats.weekendPct > 50) job = 'Empleado ejemplar: solo chatea los fines de semana';
  else job = 'Empleado con horario de oficina (chatea al salir del curro)';

  // ---- Rasgos de personalidad
  const traits = [];
  if (stats.capsPct > 20) traits.push('GRITA. MUCHO.');
  if (stats.questionPct > 25) traits.push('Pregunta lo que ya está en el título del directo');
  if (stats.swearPer1k > 15) traits.push('Lenguaje no apto para horario infantil');
  if (stats.politePer1k > 15) traits.push('Educado hasta la sospecha');
  if (stats.emojiPer100 > 30) traits.push('Se comunica principalmente con jeroglíficos');
  if (rate(SLANG.twitch) > 0.03) traits.push('Habla emote con fluidez nativa');
  if (stats.avgLen > 70) traits.push('Escribe párrafos en un chat que va a 200 mensajes/s');
  if (stats.avgLen < 12 && n) traits.push('Monosilábico');
  if (stats.nightPct > 25) traits.push('Criatura nocturna');
  if (follows.length > 200) traits.push(`Sigue a ${follows.length} canales. Sin comentarios`);
  if (follows.length && follows.length < 10) traits.push('Fiel a muy pocos streamers');
  if (has(SHOOTERS) >= 2) traits.push('Experto en armas (virtuales)');
  if (!traits.length) traits.push('Perfil gris. Demasiado normal. Sospechoso.');

  const danger = clamp(Math.round(stats.capsPct * 0.6 + stats.swearPer1k * 1.2 + stats.nightPct * 0.4 + rate(SLANG.twitch) * 300 + (n > 2000 ? 15 : 0)), 3, 99);

  // ---- Señas particulares
  const marks = [];
  if (stats.nightPct > 20) marks.push('Ojeras de quien ve directos a las 4 a. m.');
  if (stats.laugh) marks.push(`Ríe exclusivamente en formato "${stats.laugh}"`);
  if (stats.topWords[0]) marks.push(`Repite compulsivamente la palabra "${stats.topWords[0][0]}"`);
  if (follows.length > 50 || n > 1000) marks.push('Marca de auriculares en la cabeza');
  if (stats.topChannels[0]) marks.push(`Visto con frecuencia en #${stats.topChannels[0][0]}`);
  if (chatColor) marks.push(`Viste siempre de ${chatColor}`);

  const seed = hashString(user?.login || 'anon');

  return {
    seed,
    user,
    stats,
    lang,
    origin,
    age,
    ageRange,
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
      nightOwl: (stats.nightPct ?? 0) > 20,
      shouter: stats.capsPct > 15,
      angry: stats.swearPer1k > 10,
      curious: stats.questionPct > 20,
      laughs: !!stats.laugh && n > 0,
      nerd: stats.avgLen > 55 || has(OLD_GAMES) > 0,
      headphones: follows.length > 50 || n > 1000,
      shooter: has(SHOOTERS) > 0,
      polite: stats.politePer1k > 12,
    },
  };
}
