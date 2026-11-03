// Pistas sacadas del nombre de usuario: posible año de nacimiento, nacionalidad y rasgos
// confesados en el propio alias (gordo_cabron, calvo88, PeruanoGamer…).

// Edad máxima creíble para alguien que chatea en Twitch.
export const MAX_AGE = 55;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palabras cortas solo cuentan como token completo; las largas también dentro de otra palabra.
function matcher(tokens, flat) {
  return (words) => words.find((w) => (w.length >= 5 ? flat.includes(w) : tokens.includes(w)));
}

const COUNTRIES = [
  { name: 'Perú', words: ['peruano', 'peruana', 'peru', 'limeño', 'limeno', 'cholo', 'chola'] },
  { name: 'México', words: ['mexicano', 'mexicana', 'mexico', 'mexa', 'mx', 'chilango', 'chilanga', 'tapatio', 'regio', 'wey'] },
  { name: 'Argentina', words: ['argentino', 'argentina', 'arg', 'porteño', 'porteno', 'boludo', 'che'] },
  { name: 'Chile', words: ['chileno', 'chilena', 'chile', 'weon', 'cl'] },
  { name: 'Colombia', words: ['colombiano', 'colombiana', 'colombia', 'col', 'paisa', 'parce', 'rolo'] },
  { name: 'Venezuela', words: ['venezolano', 'venezolana', 'venezuela', 'vzla', 'chamo', 'chama'] },
  { name: 'España', words: ['español', 'espanol', 'española', 'espanola', 'spain', 'esp', 'madrid', 'madrileño', 'madrileno', 'bcn', 'barcelona', 'sevilla', 'andaluz', 'gallego', 'vasco', 'canario', 'catalan'] },
  { name: 'Uruguay', words: ['uruguayo', 'uruguaya', 'uruguay', 'uru', 'charrua'] },
  { name: 'Ecuador', words: ['ecuatoriano', 'ecuatoriana', 'ecuador', 'ecu'] },
  { name: 'Bolivia', words: ['boliviano', 'boliviana', 'bolivia'] },
  { name: 'Cuba', words: ['cubano', 'cubana', 'cuba'] },
  { name: 'República Dominicana', words: ['dominicano', 'dominicana', 'rd'] },
  { name: 'Puerto Rico', words: ['boricua', 'puertorriqueño', 'puertorriqueno', 'pr'] },
  { name: 'Brasil', words: ['brasileiro', 'brasil', 'brazil', 'brazuca', 'br'] },
  { name: 'Estados Unidos', words: ['gringo', 'gringa', 'yankee', 'usa', 'american'] },
];

// Cada rasgo: palabras que lo delatan, broma para el expediente y efecto en el modelo 3D.
const TRAITS = [
  { key: 'fat', words: ['gordo', 'gorda', 'gordito', 'gordita', 'gordinflon', 'fat', 'fatty', 'chubby', 'panzon', 'panzona', 'obeso', 'tripas', 'chonky', 'gordaco'],
    joke: 'Complexión generosa: lo confiesa en su propio alias', mark: 'Papada visible desde el satélite' },
  { key: 'thin', words: ['flaco', 'flaca', 'skinny', 'fideo', 'palillo', 'esqueleto'], joke: 'Complexión de fideo, según su alias', mark: 'Mejillas hundidas' },
  { key: 'bald', words: ['calvo', 'calva', 'bald', 'pelon', 'pelado', 'calvito', 'baldie'], joke: 'Calvo declarado: no gasta en champú', mark: 'Cráneo reflectante' },
  { key: 'beard', words: ['barbas', 'barbudo', 'barba', 'beard', 'bearded'], joke: 'Barba documentada en el alias', mark: 'Barba de leñador' },
  { key: 'glasses', words: ['gafas', 'gafotas', 'gafitas', 'lentes', 'glasses', 'cuatrojos', '4eyes', 'nerd', 'friki'], joke: 'Usuario de gafas confeso', mark: 'Marca de gafas en la nariz' },
  { key: 'old', words: ['viejo', 'vieja', 'abuelo', 'abuela', 'boomer', 'grandpa', 'yayo', 'yaya', 'old', 'oldman', 'veterano', 'carroza', 'señor', 'senor'],
    joke: 'Se autodenomina viejo: respeto', mark: 'Canas' },
  { key: 'young', words: ['nino', 'niño', 'nina', 'niña', 'kid', 'baby', 'bebe', 'teen', 'chaval', 'chavala', 'peque', 'junior', 'jr'], joke: 'Menor de edad aparente (o lo finge)', mark: 'Cara de no haber pagado nunca un alquiler' },
  { key: 'blond', words: ['rubio', 'rubia', 'blonde', 'blond', 'guero', 'guera', 'catire'], joke: 'Rubio declarado', mark: 'Pelo rubio' },
  { key: 'ginger', words: ['pelirrojo', 'pelirroja', 'ginger', 'colorado', 'zanahoria'], joke: 'Pelirrojo confeso', mark: 'Pecas' },
  { key: 'dark', words: ['moreno', 'morena', 'negro', 'negra', 'prieto', 'morocho', 'morocha'], joke: null, mark: 'Pelo oscuro' },
  { key: 'angry', words: ['cabron', 'cabrona', 'malo', 'mala', 'evil', 'toxic', 'toxico', 'toxica', 'diablo', 'demon', 'satan', 'asesino', 'killer', 'psycho', 'psico', 'loco', 'loca', 'hater', 'troll', 'bastardo', 'perro'],
    joke: 'Él mismo avisa de que es peligroso', mark: 'Ceño fruncido de fábrica', danger: 25 },
  { key: 'handsome', words: ['sabroso', 'sabrosa', 'guapo', 'guapa', 'sexy', 'handsome', 'hot', 'papi', 'mami', 'chulo', 'chula', 'bombon', 'galan', 'facha', 'lindo', 'linda', 'precioso', 'preciosa'],
    joke: 'Autoestima por las nubes (dato no verificado por la policía)', mark: 'Sonrisa de anuncio' },
  { key: 'sad', words: ['triste', 'sad', 'emo', 'depre', 'llorar', 'lloron', 'sadboy', 'sadgirl', 'sadge'], joke: 'Melancolía declarada', mark: 'Mirada perdida' },
  { key: 'sleepy', words: ['dormilon', 'dormilona', 'sleepy', 'insomne', 'insomnia', 'noche', 'night', 'nocturno', 'owl', 'buho', 'vampiro', 'vampire', 'zombie'], joke: 'Criatura de la noche según su alias', mark: 'Ojeras' },
  { key: 'shooter', words: ['sniper', 'headshot', 'aim', 'fps', 'pistolero', 'tirador', 'cod', 'cs', 'valorant'], joke: 'Su alias es de francotirador', mark: 'Dedo índice entrenado' },
  { key: 'gamer', words: ['gamer', 'gaming', 'player', 'pro', 'noob', 'manco', 'tryhard'], joke: null, mark: 'Postura de silla gaming' },
];

const MEME_NUMBERS = {
  69: 'El "69" no es su año de nacimiento: es su sentido del humor (nivel 13 años)',
  420: 'El "420" sugiere aficiones botánicas',
  666: 'El "666" indica pacto con el maligno o con el administrador del chat',
  777: 'El "777" delata afición a las tragaperras',
  1337: 'El "1337" lo delata: hacker de los 2000',
  123: 'El "123" demuestra mucho esfuerzo creativo',
  1234: 'El "1234" es también su contraseña, probablemente',
  10: 'El "10" es un dorsal, no una edad (esperemos)',
};

// Devuelve las pistas que se pueden sacar del alias.
export function readAlias(user, now = new Date()) {
  const raw = `${user?.display_name || ''} ${user?.login || ''}`;
  const tokens = [
    ...new Set(
      norm(raw.replace(/([a-z])([A-Z])/g, '$1 $2'))
        .split(/[^a-z0-9ñ]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/)
        .filter(Boolean),
    ),
  ];
  const flat = norm(user?.login || raw).replace(/[^a-z]/g, '');
  const find = matcher(tokens, flat);
  const clues = { birthYear: null, country: null, features: {}, jokes: [], marks: [], danger: 0, notes: [] };

  // ---- País
  for (const c of COUNTRIES) {
    const w = find(c.words);
    if (w) {
      clues.country = c.name;
      clues.notes.push(`"${w}" → ${c.name}`);
      break;
    }
  }

  // ---- Rasgos
  for (const t of TRAITS) {
    const w = find(t.words);
    if (!w) continue;
    clues.features[t.key] = true;
    clues.notes.push(`"${w}" → ${t.key === 'gamer' ? 'gamer' : t.mark.toLowerCase()}`);
    if (t.joke) clues.jokes.push(t.joke);
    if (t.mark) clues.marks.push(`${t.mark} (pista del alias)`);
    clues.danger += t.danger || 0;
  }

  // ---- Números: ¿año de nacimiento?
  const year = now.getFullYear();
  const created = user?.created_at ? new Date(user.created_at).getFullYear() : year;
  const numbers = tokens.filter((t) => /^\d+$/.test(t));
  for (const num of numbers) {
    const n = Number(num);
    if (MEME_NUMBERS[n] !== undefined && num.length <= 4) {
      clues.jokes.push(MEME_NUMBERS[n]);
      clues.notes.push(`"${num}" → número con historia`);
      continue;
    }
    let candidates = [];
    if (num.length === 4) candidates = [n];
    else if (num.length === 2) candidates = [1900 + n, 2000 + n];
    else continue;
    // edad plausible y al menos 13 años al abrir la cuenta de Twitch
    const valid = candidates.filter((y) => year - y >= 13 && year - y <= MAX_AGE && y <= created - 13);
    if (valid.length) {
      clues.birthYear = valid[valid.length - 1];
      clues.notes.push(`"${num}" → nacido en ${clues.birthYear}`);
      break;
    }
    const impossible = candidates.map((y) => (y > year ? `${y} (aún no ha llegado)` : year - y > MAX_AGE ? `${y} (tendría ${year - y} años)` : `${y} (tendría ${created - y} años al abrir la cuenta)`));
    clues.jokes.push(`El "${num}" no puede ser su año de nacimiento: ${impossible.join(' ni ')}. Será su número de la suerte`);
    clues.notes.push(`"${num}" → no es un año`);
  }

  if (/^x+[a-z]/i.test(user?.display_name || '') && /[a-z]x+$/i.test(user?.display_name || '')) {
    clues.jokes.push('Alias tipo "xXnombreXx": creó su identidad digital hacia 2008');
    clues.notes.push('"xX…Xx" → estética de 2008');
  }

  return clues;
}
