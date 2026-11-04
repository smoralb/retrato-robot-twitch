// Elige una variante de una lista de forma estable: el mismo usuario y la misma clave
// dan siempre la misma frase, pero usuarios distintos reciben frases distintas.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function choose(list, key) {
  return Array.isArray(list) ? list[hash(key) % list.length] : list;
}
