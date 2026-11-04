// Pistas sacadas del nombre de usuario: posible año de nacimiento, nacionalidad y rasgos
// confesados en el propio alias (gordo_cabron, calvo88, PeruanoGamer…).

import { choose } from './humor.js';
import { F } from './frases.js';

// Edad máxima creíble para alguien que chatea en Twitch.
export const MAX_AGE = 55;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Palabras cortas solo cuentan como token completo; las largas también dentro de otra palabra.
function matcher(tokens, flat) {
  return (words) => words.find((w) => (w.length >= 5 ? flat.includes(w) : tokens.includes(w)));
}

const COUNTRIES = [
  { name: 'Perú', words: ['peruano', 'peruana', 'peru', 'limeño', 'limeno'] },
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
    joke: ["Complexión generosa: lo confiesa en su propio alias", "Dice ser grande y no hace falta que nadie lo desmienta", "Su alias ya es una confesión de sofá", "Se describe a sí mismo con una honestidad que nadie le pidió", "Cuerpo de sillón gaming: ergonómico, pero poco usado", "Su alias va delante de él, y a veces llega antes"], mark: ["Papada visible desde el satélite", "Mejillas que tienen mejillas", "Aspecto de haberse quedado sin silla en el cine"] },
  { key: 'thin', words: ['flaco', 'flaca', 'skinny', 'fideo', 'palillo', 'esqueleto'], joke: ["Complexión de fideo, según su alias", "Se define como fino. Los demás, como escurridizo", "Delgado por convicción o por falta de nevera", "Su alias no pesa, y él tampoco", "Tan fino que el micrófono lo tapa"], mark: ["Mejillas hundidas", "Parece que le pesa más la mochila", "Codos que cortan el aire"] },
  { key: 'bald', words: ['calvo', 'calva', 'bald', 'pelon', 'pelado', 'calvito', 'baldie'], joke: ["Calvo declarado: no gasta en champú", "Calvo, y lo dice como si fuera una virtud", "Su cabeza no necesita secador", "Cabeza despejada, ideas igual de despejadas", "Su alias ya trae calva de serie"], mark: ["Cráneo reflectante", "Cráneo al aire libre, sin aislante", "Brillo capilar que no es de champú"] },
  { key: 'beard', words: ['barbas', 'barbudo', 'barba', 'beard', 'bearded'], joke: ["Barba documentada en el alias", "Barbudo profesional, o eso asegura", "Su alias ya trae barba incluida", "Cree que la barba da autoridad. No da", "Barba de intelectual; razonamiento de bar"], mark: ["Barba de leñador", "Barba con cobertura de migas", "Barba que esconde barbilla y secretos"] },
  { key: 'glasses', words: ['gafas', 'gafotas', 'gafitas', 'lentes', 'glasses', 'cuatrojos', '4eyes', 'nerd', 'friki'], joke: ["Usuario de gafas confeso", "Sin gafas no ve ni el chat", "Cuatro ojos en el alias y cero en puntería", "Su alias lleva montura propia", "Mira el mundo a través de un cristal. Y no solo el del monitor"], mark: ["Marca de gafas en la nariz", "Graduación visible a simple vista", "Cristales gruesos como los cuadros de su sala"] },
  { key: 'old', words: ['viejo', 'vieja', 'abuelo', 'abuela', 'boomer', 'grandpa', 'yayo', 'yaya', 'old', 'oldman', 'veterano', 'carroza', 'señor', 'senor'],
    joke: ["Se autodenomina viejo: respeto", "Dice ser veterano. El chat lo llama «abuelo»", "Viejo de alias; viejo de verdad, ya veremos", "Se cree sabio solo porque lleva más tiempo con wifi", "Edad avanzada y uso de emotes anticuado"], mark: ["Canas", "Mirada de haber visto nacer a Twitch", "Arrugas de preocupación y de memes"] },
  { key: 'young', words: ['nino', 'niño', 'nina', 'niña', 'kid', 'baby', 'bebe', 'teen', 'chaval', 'chavala', 'peque', 'junior', 'jr'], joke: ["Menor de edad aparente (o lo finge)", "Su alias huele a sudadera y deberes pendientes", "Se define como niño. Y el comportamiento no ayuda", "Aspirante a adulto con wifi y sin cartera", "Edad mental: dudosa. Edad legal: por comprobar"], mark: ["Cara de no haber pagado nunca un alquiler", "Cara de haber hecho los deberes tarde", "Barbilla sin una pizca de vello. Ni de criterio"] },
  { key: 'blond', words: ['rubio', 'rubia', 'blonde', 'blond', 'guero', 'guera', 'catire'], joke: ["Rubio declarado", "Rubio de alias, ya veremos de bote", "Se hace llamar rubio. Los otros colores no le contestan", "Rubio autoproclamado: ni lo confirmamos ni lo desmentimos"], mark: ["Pelo rubio", "Mechas doradas que no están en el presupuesto", "Rubio de los que no pasan desapercibidos"] },
  { key: 'ginger', words: ['pelirrojo', 'pelirroja', 'ginger', 'colorado', 'zanahoria'], joke: ["Pelirrojo confeso", "Pelirrojo por decreto ley", "Se define como pelirrojo. El sol no está de acuerdo", "Pelirrojo declarado: sufre en verano, pero se lo pasa genial"], mark: ["Pecas", "Pelo anaranjado que llama la atención", "Piel que se quema hasta con el brillo del monitor"] },
  { key: 'dark', words: ['moreno', 'morena', 'morocho', 'morocha'], joke: null, mark: ["Pelo oscuro", "Pelo negro como su sentido del humor", "Cabello azabache y poca gracia"] },
  { key: 'angry', words: ['cabron', 'cabrona', 'malo', 'mala', 'evil', 'toxic', 'toxico', 'toxica', 'diablo', 'demon', 'killer', 'psycho', 'loco', 'loca', 'hater', 'troll'],
    joke: ["Él mismo avisa de que es peligroso", "Su alias es una advertencia por escrito", "Quien avisa no es traidor, es un peligro con nombre", "Su alias da más miedo que él", "Amenaza desde el apodo; en el chat apenas muerde", "Se ha puesto nombre de villano de serie B"], mark: ["Ceño fruncido de fábrica", "Mirada de «¿me hablas a mí?»", "Frente permanentemente arrugada de odiar"], danger: 25 },
  { key: 'handsome', words: ['sabroso', 'sabrosa', 'guapo', 'guapa', 'sexy', 'handsome', 'hot', 'papi', 'mami', 'chulo', 'chula', 'bombon', 'galan', 'facha', 'lindo', 'linda', 'precioso', 'preciosa'],
    joke: ["Autoestima por las nubes (dato no verificado por la policía)", "Se cree guapo; la policía lo investiga", "Autoestima de nivel Hollywood, evidencias de nivel youtuber", "Su alias dice «guapo»; su cámara, otra cosa", "Narcisismo certificado por su propio apodo", "Se pone el piropo antes de que lo diga otro"], mark: ["Sonrisa de anuncio", "Dientes de postal que no vienen al caso", "Pose de selfie incluso en foto de carné"] },
  { key: 'sad', words: ['triste', 'sad', 'emo', 'depre', 'llorar', 'lloron', 'sadboy', 'sadgirl', 'sadge'], joke: ["Melancolía declarada","Tristeza de autor: lo pone hasta en el alias","Su alias llora, y no lo ha invitado nadie","Sad boy con wifi: el género más antiguo de internet","Alias de poeta maldito; en el chat, de pesado"], mark: ["Mirada perdida", "Ojos de cachorro abandonado", "Gesto de haber perdido el mando"] },
  { key: 'sleepy', words: ['dormilon', 'dormilona', 'sleepy', 'insomne', 'insomnia', 'noche', 'night', 'nocturno', 'owl', 'buho', 'vampiro', 'vampire', 'zombie'], joke: ["Criatura de la noche según su alias", "Su alias duerme de día", "Vampiro por convicción, o por mal horario", "Nombre de noctámbulo; sueño de bebé", "Alias de ojeras garantizadas"], mark: ["Ojeras", "Párpados de sábado a las 7 de la mañana", "Ojos de pantalla apagada"] },
  { key: 'shooter', words: ['sniper', 'headshot', 'aim', 'fps', 'pistolero', 'tirador', 'cod', 'cs', 'valorant'], joke: ["Su alias es de francotirador", "Su alias dispara más que él", "Francotirador de nombre; de puntería, ya se verá", "Se pone de apodo lo que no consigue en el juego", "Alias de tirador; cobertura de buscaminas"], mark: ["Dedo índice entrenado", "Callo en el dedo de tanto disparar", "Mirada fija de francotirador"] },
  { key: 'gamer', words: ['gamer', 'gaming', 'player', 'pro', 'noob', 'manco', 'tryhard'], joke: null, mark: ["Postura de silla gaming", "Espalda en forma de interrogación", "Pulgares de torero"] },
];

const MEME_NUMBERS = {
  69: ["El «69» no es su año de nacimiento: es su sentido del humor (nivel 13 años)", "El «69»: la broma que sigue viva desde el instituto", "El «69»: edad mental de quien aún se ríe de ello"],
  420: ["El «420» sugiere aficiones botánicas", "El «420» lo dice todo: el humo del chat no es el de la tostadora", "El «420»: una fecha a la que acude con puntualidad"],
  666: ["El «666» indica pacto con el maligno o con el administrador del chat", "El «666» lo convierte en un villano de dibujos animados", "El «666»: se cree satánico, y es solo un aficionado"],
  777: ["El «777» delata afición a las tragaperras", "El «777»: cree en la suerte, aunque la suerte no cree en él", "El «777»: seguro que ha perdido el sueldo alguna vez"],
  1337: ["El «1337» lo delata: hacker de los 2000", "El «1337»: su idea de hacker es cambiar vocales por números", "El «1337» deja claro que se quedó en 2003"],
  123: ["El «123» demuestra mucho esfuerzo creativo", "El «123»: su imaginación se cansó pronto", "El «123»: su contraseña de todo, probablemente"],
  1234: ["El «1234» es también su contraseña, probablemente", "El «1234»: seguridad informática nivel abuelo", "El «1234»: no se esforzó, y se nota"],
  10: ["El «10» es un dorsal, no una edad (esperemos)", "El «10» es su nota media, nunca la ha tenido", "El «10»: pura vanidad de apodo"],
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
    clues.notes.push(`"${w}" → ${t.key === 'gamer' ? 'gamer' : (Array.isArray(t.mark) ? t.mark[0] : t.mark).toLowerCase()}`);
    if (t.joke) clues.jokes.push(choose(t.joke, `${user?.login || 'anon'}:${t.key}`));
    if (t.mark) {
      const k = `${user?.login || 'anon'}:${t.key}`;
      clues.marks.push(`${choose(t.mark, `${k}:mark`)} (${choose(F.m_alias_prefix, `${k}:pfx`)})`);
    }
    clues.danger += t.danger || 0;
  }

  // ---- Números: ¿año de nacimiento?
  const year = now.getFullYear();
  const created = user?.created_at ? new Date(user.created_at).getFullYear() : year;
  const numbers = tokens.filter((t) => /^\d+$/.test(t));
  for (const num of numbers) {
    const n = Number(num);
    if (MEME_NUMBERS[n] !== undefined && num.length <= 4) {
      clues.jokes.push(choose(MEME_NUMBERS[n], `${user?.login || 'anon'}:num${n}`));
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
    const impossible = candidates.map((y) => (y > year ? `${y} (aún no ha llegado)` : year - y > MAX_AGE ? `${y} (tendría ${year - y} años)` : `${y} (tendría ${created - y} ${created - y === 1 ? 'año' : 'años'} al abrir la cuenta)`));
    clues.jokes.push(
      choose(
        [
          `El «${num}» no puede ser su año de nacimiento: ${impossible.join(' ni ')}. Será su número de la suerte`,
          `Presume de «${num}» como si fuera un año de nacimiento. Spoiler: ${impossible.join(' ni ')}`,
          `El «${num}» no cuadra con ninguna fecha creíble (${impossible.join(' ni ')}). Matemáticas creativas`,
          `Ese «${num}» en su alias es puro misterio: ${impossible.join(' ni ')}`,
        ],
        `${user?.login || 'anon'}:badyear`,
      ),
    );
    clues.notes.push(`"${num}" → no es un año`);
  }

  if (/^x+[a-z]/i.test(user?.display_name || '') && /[a-z]x+$/i.test(user?.display_name || '')) {
    clues.jokes.push(choose(['Alias tipo «xXnombreXx»: creó su identidad digital hacia 2008', 'Alias con «xX»: sigue esperando que MSN Messenger vuelva', 'Alias xX…Xx: vivió el apogeo de los foros y no lo ha superado', 'Su alias parece un tatuaje tribal de 2008'], `${user?.login || 'anon'}:xx`));
    clues.notes.push('"xX…Xx" → estética de 2008');
  }

  return clues;
}
