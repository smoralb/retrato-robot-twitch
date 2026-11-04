// Compartir el retrato: imagen PNG (canvas) + enlaces a redes sociales.
// Las redes no permiten adjuntar imagen por URL, así que ahí se comparte texto + enlace;
// la imagen se comparte con el menú nativo (móvil) o se descarga para subirla a mano.

const MONO = "'Cascadia Mono', Consolas, 'Courier New', monospace";

export function shareUrl() {
  return location.origin + location.pathname;
}

export function shareText(profile) {
  const name = profile.user?.display_name || 'Un sospechoso';
  const level = profile.wanted.stars === 0 ? 'Nivel de búsqueda: indiferente' : `Nivel de búsqueda: ${'★'.repeat(profile.wanted.stars)}`;
  return `La Brigada de Delitos en el Chat ha hecho mi retrato robot: ${name}, peligrosidad ${profile.danger}/100. ${level}. ¿Y el tuyo?`;
}

// Ajusta el texto a un ancho máximo y devuelve las líneas.
function wrap(g, text, maxW) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
  }
  if (line) out.push(line);
  return out;
}

// Dibuja la tarjeta (cartel + retrato a la izquierda, resumen a la derecha) y devuelve el canvas.
export function buildImage(profile, views, ink, joke = '') {
  const clean = profile.wanted.stars === 0;
  const RED = clean ? '#6b6b6b' : '#b3261e';
  const INK = '#1f1b16';
  const lines = views.front.split('\n');
  const cols = Math.max(...lines.map((l) => l.length));
  const fs = 9;
  const portraitW = Math.ceil(cols * fs * 0.6);
  const portraitH = lines.length * fs;
  const W = 1200;
  const headH = 120;
  const pad = 50;
  const H = headH + portraitH + 80;

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ece4d2';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.strokeRect(14, 14, W - 28, H - 28);

  // Cabecera
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.font = `bold 18px ${MONO}`;
  g.fillText('BRIGADA DE DELITOS EN EL CHAT · RETRATO ROBOT', pad, 62);
  g.save();
  g.translate(W - pad - 150, 70);
  g.rotate(0.07);
  g.strokeStyle = RED; g.fillStyle = RED;
  g.lineWidth = 5;
  g.font = `bold 46px ${MONO}`;
  const stamp = clean ? 'INDIFERENTE' : 'SE BUSCA';
  const sw = g.measureText(stamp).width;
  g.strokeRect(-sw / 2 - 14, -44, sw + 28, 62);
  g.textAlign = 'center';
  g.fillText(stamp, 0, 2);
  g.restore();
  g.fillStyle = INK;
  g.fillRect(pad, headH - 8, W - pad * 2, 3);

  // Retrato
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = '#f7f2e6';
  g.fillRect(pad - 10, headH + 6, portraitW + 20, portraitH + 12);
  g.fillStyle = ink || INK;
  g.font = `${fs}px ${MONO}`;
  lines.forEach((l, i) => g.fillText(l, pad, headH + 12 + i * fs));

  // Resumen
  const x = pad + portraitW + 50;
  const maxW = W - pad - x;
  let y = headH + 20;
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = `bold 36px ${MONO}`;
  for (const l of wrap(g, profile.user?.display_name || 'Sospechoso', maxW).slice(0, 2)) { g.fillText(l, x, y + 30); y += 42; }
  y += 14;

  const field = (label, value) => {
    g.font = `bold 13px ${MONO}`;
    g.fillStyle = RED;
    g.fillText(label.toUpperCase(), x, y);
    y += 22;
    g.font = `18px ${MONO}`;
    g.fillStyle = INK;
    for (const l of wrap(g, value, maxW).slice(0, 3)) { g.fillText(l, x, y); y += 24; }
    y += 14;
  };
  field('Edad estimada', `${profile.ageRange[0]}–${profile.ageRange[1]} años`);
  field('Situación laboral', profile.job);
  field('Posible origen', profile.origin);
  field('Antecedentes', profile.record);

  // Peligrosidad
  g.font = `bold 13px ${MONO}`;
  g.fillStyle = RED;
  g.fillText(`PELIGROSIDAD  ${profile.danger}/100`, x, y);
  y += 12;
  g.strokeStyle = INK; g.lineWidth = 2;
  g.strokeRect(x, y, maxW, 18);
  g.fillStyle = RED;
  g.fillRect(x + 2, y + 2, (maxW - 4) * (profile.danger / 100), 14);
  y += 56;

  if (!clean) {
    g.fillStyle = RED;
    g.font = `36px ${MONO}`;
    g.fillText('★'.repeat(profile.wanted.stars) + '☆'.repeat(5 - profile.wanted.stars), x, y);
    g.font = `bold 13px ${MONO}`;
    g.fillText(String(profile.wanted.label || '').toUpperCase(), x, y + 24);
    y += 56;
  }

  if (profile.traits?.length) {
    g.font = `bold 13px ${MONO}`;
    g.fillStyle = RED;
    g.fillText('RASGOS', x, y);
    y += 22;
    g.font = `17px ${MONO}`;
    g.fillStyle = INK;
    for (const t of profile.traits.slice(0, 3)) {
      const text = typeof t === 'string' ? t : t.text || t.label || '';
      for (const l of wrap(g, `• ${text}`, maxW).slice(0, 2)) { g.fillText(l, x, y); y += 22; }
    }
  }

  // Chiste y pie
  if (joke) {
    g.font = `italic 17px ${MONO}`;
    g.fillStyle = INK;
    g.globalAlpha = 0.85;
    const jl = wrap(g, `“${joke}”`, maxW);
    let jy = H - 40 - jl.length * 22;
    g.fillStyle = RED; g.globalAlpha = 1;
    g.fillRect(x - 14, jy - 18, 4, jl.length * 22 + 4);
    g.fillStyle = INK;
    for (const l of jl) { g.fillText(l, x, jy); jy += 22; }
  }
  g.globalAlpha = 0.55;
  g.fillStyle = INK;
  g.font = `13px ${MONO}`;
  g.fillText('Análisis heurístico de broma, sin IA · ¿Y el tuyo?', pad, H - 30);
  g.globalAlpha = 1;
  return c;
}

export const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

export function download(blob, name = 'retrato-robot.png') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Menú nativo de compartir con la imagen adjunta. Devuelve false si el navegador no lo soporta.
export async function nativeShare(profile, blob) {
  const file = new File([blob], 'retrato-robot.png', { type: 'image/png' });
  const data = { text: shareText(profile), url: shareUrl(), files: [file] };
  if (!navigator.canShare?.(data)) return false;
  try {
    await navigator.share(data);
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
  return true;
}
