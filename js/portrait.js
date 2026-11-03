import { rng } from './analyzer.js';

// Retrato robot en ASCII de alta densidad, sin IA:
//  1. Se pinta una cara procedural en un canvas en escala de grises (formas, degradados,
//     texturas de pelo/barba) a partir de los rasgos del análisis y una semilla por usuario.
//  2. Se convierte a ASCII: cada celda se divide en 2x3 sub-bloques y se elige el carácter cuya
//     forma (medida dibujando la fuente real) más se parece a ese trozo de imagen.

// La cara se dibuja en un lienzo lógico de 440x560 y se escala a la resolución de salida.
const W = 440;
const H = 560;
// Celdas de 6x10 px ≈ proporción de un carácter monoespaciado con line-height 1.
export const COLS = 120;
export const ROWS = 92;
const CW = 6;
const CH = 10;
const OW = COLS * CW;
const OH = ROWS * CH;
export const FONT = "'Cascadia Mono', Consolas, 'Courier New', monospace";

const gray = (l, a = 1) => {
  const v = Math.round(Math.max(0, Math.min(1, l)) * 255);
  return `rgba(${v},${v},${v},${a})`;
};

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return Object.assign(document.createElement('canvas'), { width: w, height: h });
}

// ---------------------------------------------------------------- parámetros

function params(profile) {
  const f = profile.features;
  const r = rng(profile.seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => a + r() * (b - a);

  const top = between(78, 92);
  const chin = between(392, 412);
  const eyeY = between(238, 250);
  const noseY = eyeY + between(56, 70);

  let hair;
  if (f.shooter && r() < 0.5) hair = 'cap';
  else if (f.old) hair = pick(['receding', 'bald', 'short', 'buzz']);
  else if (f.young) hair = pick(['messy', 'spiky', 'curly', 'long', 'beanie', 'cap']);
  else hair = pick(['short', 'messy', 'curly', 'long', 'buzz', 'beanie']);

  let mouth;
  if (f.shouter) mouth = 'shout';
  else if (f.laughs) mouth = pick(['grin', 'smile', 'grin']);
  else if (f.angry) mouth = 'frown';
  else if (f.polite) mouth = 'smile';
  else mouth = pick(['neutral', 'smirk', 'smile']);

  const beard = !f.young && r() < (f.old ? 0.65 : 0.4);
  return {
    r,
    cx: W / 2 + between(-4, 4),
    top,
    chin,
    hw: between(92, 112),
    jaw: between(0.5, 0.78),
    eyeY,
    eyeGap: between(40, 48),
    eyeSize: between(13, 16) + (f.shouter ? 3 : 0),
    noseY,
    noseW: between(13, 20),
    mouthY: noseY + between(32, 40),
    mouthW: between(26, 36),
    skin: between(0.6, 0.74),
    hair,
    hairTone: f.old ? between(0.5, 0.72) : between(0.08, 0.35),
    hairline: top + between(42, 58) + (f.old ? 14 : 0),
    brow: f.angry ? 'angry' : f.curious ? 'raised' : pick(['flat', 'arched', 'flat']),
    browThick: between(5, 9),
    eyes: f.nightOwl ? 'sleepy' : f.shouter ? 'wide' : 'normal',
    bags: f.nightOwl,
    glasses: f.angry && f.shouter && r() < 0.5 ? 'shades' : f.nerd ? pick(['round', 'square']) : null,
    mouth,
    beard,
    stubble: !beard && !f.young && r() < 0.5,
    mustache: beard || (!f.young && r() < 0.2),
    wrinkles: f.old,
    freckles: f.young && r() < 0.35,
    headphones: f.headphones,
    shirt: f.young || f.shooter ? 'hoodie' : pick(['tshirt', 'collar', 'tshirt']),
    shirtTone: between(0.18, 0.55),
  };
}

// ---------------------------------------------------------------- utilidades de dibujo

function headPath(ctx, P) {
  const { cx, top, hw, chin, jaw, eyeY } = P;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.bezierCurveTo(cx + hw * 0.62, top, cx + hw, top + 50, cx + hw, eyeY);
  ctx.bezierCurveTo(cx + hw, eyeY + 75, cx + hw * jaw + 14, chin - 18, cx, chin);
  ctx.bezierCurveTo(cx - hw * jaw - 14, chin - 18, cx - hw, eyeY + 75, cx - hw, eyeY);
  ctx.bezierCurveTo(cx - hw, top + 50, cx - hw * 0.62, top, cx, top);
  ctx.closePath();
}

function shade(ctx, x, y, radius, alpha, light = false) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const c = light ? '255,255,255' : '0,0,0';
  g.addColorStop(0, `rgba(${c},${alpha})`);
  g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// pts: recta (4), cuadrática (6) o bézier cúbica (8)
function line(ctx, pts, width, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  if (pts.length === 4) ctx.lineTo(pts[2], pts[3]);
  else if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Rellena la región del path actual con trazos cortos que simulan pelo.
function strands(ctx, P, count, { len = [10, 26], width = 1.6, tone, flow, curly = false }) {
  const { r } = P;
  ctx.save();
  ctx.clip();
  for (let i = 0; i < count; i++) {
    const x = P.cx - 170 + r() * 340;
    const y = P.top - 70 + r() * (P.chin + 150 - P.top);
    const a = flow(x, y) + (r() - 0.5) * 0.5;
    const l = len[0] + r() * (len[1] - len[0]);
    const t = tone + (r() - 0.5) * 0.35;
    ctx.globalAlpha = 0.35 + r() * 0.5;
    if (curly) {
      ctx.beginPath();
      ctx.arc(x, y, 3 + r() * 5, r() * 6, r() * 6 + 3.5);
      ctx.lineWidth = width;
      ctx.strokeStyle = gray(t);
      ctx.stroke();
    } else {
      const bend = (r() - 0.5) * 8;
      line(ctx, [x, y, x + Math.cos(a) * l * 0.5 + bend, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l], width, gray(t));
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Casquete de pelo + línea de nacimiento (con flequillo y pinchos opcionales).
function hairPath(ctx, P, { volume = 10, sideY = P.eyeY - 10, bangs = 0, spikes = 0 }) {
  const { cx, top, hw, hairline } = P;
  const L = cx - hw - volume * 0.5;
  const R = cx + hw + volume * 0.5;
  // jitter determinista para que repetir el path (relleno + textura) dé la misma forma
  const jr = rng(P.jitterSeed);
  ctx.beginPath();
  ctx.moveTo(L, sideY);
  if (spikes) {
    const n = 9;
    const rx = hw + volume;
    const ry = P.eyeY - top + volume;
    for (let i = 0; i <= n; i++) {
      const ang = Math.PI + (i / n) * Math.PI;
      ctx.lineTo(cx + Math.cos(ang) * rx, P.eyeY - 10 + Math.sin(ang) * ry);
      if (i < n) {
        const mid = ang + Math.PI / n / 2;
        const k = spikes * (0.6 + jr() * 0.7);
        ctx.lineTo(cx + Math.cos(mid) * (rx + k) + 6, P.eyeY - 10 + Math.sin(mid) * (ry + k));
      }
    }
  } else {
    ctx.bezierCurveTo(L - 4, top - volume, cx - hw * 0.45, top - volume - 14, cx, top - volume - 14);
    ctx.bezierCurveTo(cx + hw * 0.45, top - volume - 14, R + 4, top - volume, R, sideY);
  }
  ctx.lineTo(cx + hw - 8, sideY);
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = 1 - (2 * i) / steps; // 1 → -1
    let y = hairline + (sideY - 12 - hairline) * Math.pow(Math.abs(t), 3);
    if (bangs && Math.abs(t) < 0.85) y += (i % 2 ? bangs : bangs * 0.3) * (0.6 + jr() * 0.6);
    ctx.lineTo(cx + t * (hw - 8), y);
  }
  ctx.closePath();
}

function fillHair(ctx, P, opts, texture = {}) {
  const tone = P.hairTone;
  const crown = { x: P.cx + 10, y: P.top + 20 };
  const flow = texture.flow ?? ((x, y) => Math.atan2(y - crown.y, x - crown.x));
  hairPath(ctx, P, opts);
  const g = ctx.createLinearGradient(P.cx - P.hw, P.top, P.cx + P.hw, P.eyeY);
  g.addColorStop(0, gray(tone + 0.12));
  g.addColorStop(1, gray(tone - 0.05));
  ctx.fillStyle = g;
  ctx.fill();
  hairPath(ctx, P, opts);
  strands(ctx, P, texture.count ?? 900, { tone: tone + 0.22, flow, curly: texture.curly, len: texture.len });
  hairPath(ctx, P, opts);
  strands(ctx, P, 400, { tone: Math.max(0, tone - 0.15), flow, curly: texture.curly, len: texture.len });
}

// ---------------------------------------------------------------- partes

function drawBackground(ctx) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // pared de comisaría con marcas de altura
  for (let y = 40; y < H; y += 48) {
    ctx.fillStyle = gray(0.9);
    ctx.fillRect(0, y, W, 1.5);
    ctx.fillStyle = gray(0.55);
    ctx.fillRect(0, y, 26, 3);
    ctx.fillRect(W - 26, y, 26, 3);
  }
}

function drawLongHairBack(ctx, P) {
  const { cx, hw, top, chin, hairTone } = P;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - hw - 18, P.eyeY - 40);
    ctx.bezierCurveTo(cx - hw - 30, top - 10, cx + hw + 30, top - 10, cx + hw + 18, P.eyeY - 40);
    ctx.bezierCurveTo(cx + hw + 30, chin, cx + hw + 50, chin + 60, cx + hw + 30, chin + 90);
    ctx.lineTo(cx - hw - 30, chin + 90);
    ctx.bezierCurveTo(cx - hw - 50, chin + 60, cx - hw - 30, chin, cx - hw - 18, P.eyeY - 40);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = gray(hairTone - 0.04);
  ctx.fill();
  path();
  strands(ctx, P, 900, { tone: hairTone + 0.22, flow: () => Math.PI / 2, len: [20, 45] });
}

function drawTorso(ctx, P) {
  const { cx, hw, chin, shirtTone, skin } = P;
  const nw = hw * 0.42;
  ctx.fillStyle = gray(skin - 0.08);
  ctx.fillRect(cx - nw, chin - 50, nw * 2, 110);
  const ng = ctx.createLinearGradient(0, chin - 10, 0, chin + 40);
  ng.addColorStop(0, 'rgba(0,0,0,0.35)');
  ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ng;
  ctx.fillRect(cx - nw, chin - 10, nw * 2, 50);

  const sy = chin + 48;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, sy + 60);
  ctx.bezierCurveTo(20, sy + 10, cx - nw - 60, sy - 6, cx - nw - 6, sy - 20);
  ctx.quadraticCurveTo(cx, sy + (P.shirt === 'collar' ? 30 : 18), cx + nw + 6, sy - 20);
  ctx.bezierCurveTo(cx + nw + 60, sy - 6, W - 20, sy + 10, W, sy + 60);
  ctx.lineTo(W, H);
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, sy, W, H);
  sg.addColorStop(0, gray(shirtTone + 0.15));
  sg.addColorStop(1, gray(shirtTone - 0.1));
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gray(0.1);
  ctx.stroke();

  if (P.shirt === 'hoodie') {
    line(ctx, [cx - nw - 30, sy - 14, cx - 30, sy + 50, cx, sy + 30], 6, gray(shirtTone - 0.2));
    line(ctx, [cx + nw + 30, sy - 14, cx + 30, sy + 50, cx, sy + 30], 6, gray(shirtTone - 0.2));
    line(ctx, [cx - 16, sy + 34, cx - 20, sy + 90], 3, gray(0.9));
    line(ctx, [cx + 16, sy + 34, cx + 20, sy + 90], 3, gray(0.9));
  } else if (P.shirt === 'collar') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * (nw + 6), sy - 22);
      ctx.lineTo(cx + s * 4, sy + 30);
      ctx.lineTo(cx + s * (nw + 30), sy + 10);
      ctx.closePath();
      ctx.fillStyle = gray(0.92);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = gray(0.2);
      ctx.stroke();
    }
  } else {
    line(ctx, [cx - nw - 4, sy - 20, cx, sy + 26, cx + nw + 4, sy - 20], 4, gray(shirtTone - 0.15));
  }
}

function drawEars(ctx, P) {
  for (const s of [-1, 1]) {
    const x = P.cx + s * (P.hw - 2);
    const y = P.eyeY + 22;
    ctx.beginPath();
    ctx.ellipse(x, y, 15, 30, s * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = gray(P.skin - 0.1);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = gray(0.25);
    ctx.stroke();
    line(ctx, [x + s * 6, y - 18, x + s * 12, y, x + s * 4, y + 18], 3, gray(P.skin - 0.35));
  }
}

function drawHead(ctx, P) {
  const { cx, hw, eyeY, skin, chin } = P;
  headPath(ctx, P);
  const g = ctx.createRadialGradient(cx - 30, eyeY - 30, 10, cx, eyeY, hw * 1.5);
  g.addColorStop(0, gray(skin + 0.08));
  g.addColorStop(0.6, gray(skin));
  g.addColorStop(1, gray(skin - 0.3));
  ctx.fillStyle = g;
  ctx.fill();

  ctx.save();
  headPath(ctx, P);
  ctx.clip();
  // luz desde la izquierda: el lado derecho queda en sombra
  const side = ctx.createLinearGradient(cx - hw * 0.1, 0, cx + hw, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = side;
  ctx.fillRect(cx - hw, 0, hw * 2, H);
  for (const s of [-1, 1]) {
    shade(ctx, cx + s * P.eyeGap, eyeY - 2, P.eyeSize * 2.6, 0.22);
    shade(ctx, cx + s * (hw * 0.62), P.noseY + 6, 26, s < 0 ? 0.18 : 0.08, s < 0);
  }
  shade(ctx, cx - 10, P.top + 60, 50, 0.2, true);
  shade(ctx, cx, chin - 14, 24, 0.15, true);
  shade(ctx, cx, P.mouthY + 26, 22, 0.15);
  if (P.freckles) {
    for (let i = 0; i < 40; i++) {
      const s = P.r() < 0.5 ? -1 : 1;
      ctx.fillStyle = gray(skin - 0.3, 0.7);
      ctx.beginPath();
      ctx.arc(cx + s * (20 + P.r() * 45), P.noseY - 20 + P.r() * 26, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (P.wrinkles) {
    for (let i = 0; i < 3; i++) {
      const y = P.hairline + 18 + i * 10;
      line(ctx, [cx - 50, y + 4, cx, y - 4, cx + 50, y + 4], 1.8, gray(skin - 0.3, 0.8));
    }
    for (const s of [-1, 1]) {
      line(ctx, [cx + s * (P.noseW + 6), P.noseY - 4, cx + s * (P.mouthW + 12), P.mouthY - 4, cx + s * (P.mouthW + 8), P.mouthY + 14], 2, gray(skin - 0.3, 0.8));
      for (let k = 0; k < 3; k++) {
        line(ctx, [cx + s * (P.eyeGap + P.eyeSize * 1.6), eyeY - 2 + k * 6, cx + s * (P.eyeGap + P.eyeSize * 2.4), eyeY - 6 + k * 9], 1.4, gray(skin - 0.3, 0.7));
      }
    }
  }
  ctx.restore();

  headPath(ctx, P);
  ctx.lineWidth = 3;
  ctx.strokeStyle = gray(0.18);
  ctx.stroke();
}

function drawEyes(ctx, P) {
  const { cx, eyeY: ey, eyeGap, eyeSize: es, skin, r } = P;
  const look = (r() - 0.5) * es * 0.5;
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeGap;
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(ex - es * 1.35, ey + 1);
      ctx.bezierCurveTo(ex - es * 0.6, ey - es * 0.95, ex + es * 0.6, ey - es * 0.95, ex + es * 1.35, ey - 1);
      ctx.bezierCurveTo(ex + es * 0.6, ey + es * 0.75, ex - es * 0.6, ey + es * 0.75, ex - es * 1.35, ey + 1);
      ctx.closePath();
    };
    almond();
    ctx.fillStyle = gray(0.96);
    ctx.fill();
    ctx.save();
    almond();
    ctx.clip();
    const ix = ex + look;
    const ig = ctx.createRadialGradient(ix, ey, 1, ix, ey, es * 0.62);
    ig.addColorStop(0, gray(0.55));
    ig.addColorStop(1, gray(0.22));
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(ix, ey, es * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = gray(0.03);
    ctx.beginPath();
    ctx.arc(ix, ey, es * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ix - es * 0.2, ey - es * 0.22, es * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // sombra del párpado sobre el globo
    const lg = ctx.createLinearGradient(0, ey - es, 0, ey);
    lg.addColorStop(0, 'rgba(0,0,0,0.45)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(ex - es * 1.5, ey - es, es * 3, es);
    if (P.eyes === 'sleepy') {
      ctx.fillStyle = gray(skin - 0.1);
      ctx.fillRect(ex - es * 1.5, ey - es, es * 3, es * 0.95);
    }
    ctx.restore();
    const lidY = P.eyes === 'sleepy' ? ey - 1 : ey - es * 0.72;
    line(ctx, [ex - es * 1.4, ey + 1, ex - es * 0.5, lidY - 2, ex + es * 0.6, lidY - 2, ex + es * 1.4, ey - 1], 3.2, gray(0.08));
    line(ctx, [ex - es * 1.1, ey + es * 0.35, ex, ey + es * 0.75, ex + es * 1.2, ey + es * 0.25], 1.4, gray(0.35));
    line(ctx, [ex - es * 1.2, ey - es * 0.9, ex, ey - es * 1.35, ex + es * 1.25, ey - es * 0.85], 1.4, gray(skin - 0.3, 0.8));
    if (P.bags) {
      line(ctx, [ex - es * 1.1, ey + es * 0.9, ex, ey + es * 1.5, ex + es * 1.2, ey + es * 0.85], 2.4, gray(skin - 0.35));
      line(ctx, [ex - es * 0.8, ey + es * 1.3, ex, ey + es * 1.9, ex + es * 0.9, ey + es * 1.25], 1.6, gray(skin - 0.3, 0.7));
    }
  }
}

function drawBrows(ctx, P) {
  const { cx, eyeY, eyeGap, eyeSize: es, hairTone, browThick, r } = P;
  const tone = Math.min(hairTone, 0.45);
  for (const s of [-1, 1]) {
    const inner = cx + s * (eyeGap - es * 1.25);
    const outer = cx + s * (eyeGap + es * 1.6);
    const y = eyeY - es * 1.7;
    let iy = y, oy = y + 2, my = y - 6;
    if (P.brow === 'angry') { iy = y + 10; oy = y - 6; my = y - 2; }
    if (P.brow === 'raised') { iy = y - 4; oy = y; my = y - 16; }
    if (P.brow === 'arched') my = y - 11;
    const mx = (inner + outer) / 2;
    line(ctx, [inner, iy, mx, my, outer, oy], browThick, gray(tone));
    for (let i = 0; i < 26; i++) {
      const t = r();
      const x = (1 - t) * (1 - t) * inner + 2 * (1 - t) * t * mx + t * t * outer;
      const yy = (1 - t) * (1 - t) * iy + 2 * (1 - t) * t * my + t * t * oy;
      line(ctx, [x, yy + browThick * 0.5, x + s * 6, yy - browThick * 0.6], 1.5, gray(tone + 0.1, 0.8));
    }
  }
}

function drawNose(ctx, P) {
  const { cx, eyeY, noseY, noseW, skin } = P;
  line(ctx, [cx + 8, eyeY + 6, cx + 12, noseY - 26, cx + noseW * 0.8, noseY - 10], 3, gray(skin - 0.28, 0.7));
  line(ctx, [cx - 8, eyeY + 10, cx - 9, noseY - 26, cx - noseW * 0.6, noseY - 12], 1.5, gray(skin - 0.2, 0.5));
  shade(ctx, cx + 10, noseY - 18, 16, 0.18);
  shade(ctx, cx - 4, noseY - 6, 10, 0.5, true);
  for (const s of [-1, 1]) {
    line(ctx, [cx + s * noseW * 0.5, noseY - 14, cx + s * (noseW + 4), noseY - 4, cx + s * noseW * 0.6, noseY + 4], 2.6, gray(skin - 0.38));
    ctx.beginPath();
    ctx.ellipse(cx + s * noseW * 0.45, noseY + 2, 5, 3, s * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = gray(0.12);
    ctx.fill();
  }
  line(ctx, [cx - noseW * 0.3, noseY + 6, cx, noseY + 9, cx + noseW * 0.3, noseY + 6], 2, gray(skin - 0.3));
  shade(ctx, cx, noseY + 14, 14, 0.2);
}

function drawMouth(ctx, P) {
  const { cx, mouthY: my, mouthW: mw, skin, mouth } = P;
  const lip = skin - 0.22;
  let cornerL = 0, cornerR = 0, open = 0, teeth = false;
  if (mouth === 'smile') cornerL = cornerR = -7;
  if (mouth === 'grin') { cornerL = cornerR = -9; open = 10; teeth = true; }
  if (mouth === 'shout') { open = 30; teeth = true; }
  if (mouth === 'frown') cornerL = cornerR = 8;
  if (mouth === 'smirk') { cornerR = -9; cornerL = 2; }
  const w = mouth === 'shout' ? mw * 0.75 : mw;
  const L = [cx - w, my + cornerL];
  const R = [cx + w, my + cornerR];
  const mid = my + (cornerL + cornerR) / 2;

  // labio superior
  ctx.beginPath();
  ctx.moveTo(...L);
  ctx.bezierCurveTo(cx - w * 0.6, my - 8, cx - w * 0.25, my - 12, cx, my - 7);
  ctx.bezierCurveTo(cx + w * 0.25, my - 12, cx + w * 0.6, my - 8, ...R);
  ctx.quadraticCurveTo(cx, mid + 4, ...L);
  ctx.fillStyle = gray(lip - 0.06);
  ctx.fill();

  if (open) {
    const inside = () => {
      ctx.beginPath();
      ctx.moveTo(L[0] + 2, L[1] + 1);
      ctx.quadraticCurveTo(cx, mid + 2, R[0] - 2, R[1] + 1);
      ctx.quadraticCurveTo(cx, my + open * 2, L[0] + 2, L[1] + 1);
    };
    inside();
    ctx.fillStyle = gray(0.05);
    ctx.fill();
    ctx.save();
    inside();
    ctx.clip();
    if (teeth) {
      ctx.fillStyle = gray(0.95);
      ctx.fillRect(cx - w, my - 10, w * 2, 8 + open * 0.25);
      for (let x = cx - w; x < cx + w; x += 9) line(ctx, [x, my - 4, x, my + 2 + open * 0.2], 1.2, gray(0.6));
    }
    if (mouth === 'shout') {
      ctx.fillStyle = gray(0.4);
      ctx.beginPath();
      ctx.ellipse(cx, my + open * 1.1, w * 0.6, open * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // labio inferior
  const lowY = my + (open ? open * 1.05 : 0);
  ctx.beginPath();
  ctx.moveTo(...L);
  ctx.quadraticCurveTo(cx, lowY + 4 + (cornerL + cornerR) / 2, ...R);
  ctx.quadraticCurveTo(cx, lowY + 16, ...L);
  const lg = ctx.createLinearGradient(0, lowY, 0, lowY + 16);
  lg.addColorStop(0, gray(lip));
  lg.addColorStop(1, gray(lip - 0.1));
  ctx.fillStyle = lg;
  ctx.fill();
  shade(ctx, cx - 6, lowY + 8, 8, 0.4, true);
  if (!open) line(ctx, [L[0], L[1], cx, mid + 3, R[0], R[1]], 2.4, gray(0.12));
  for (const c of [L, R]) shade(ctx, c[0], c[1], 6, 0.35);
}

function beardPath(ctx, P) {
  const { cx, hw, jaw, chin, eyeY, noseY } = P;
  ctx.beginPath();
  ctx.moveTo(cx - hw + 4, eyeY + 14);
  ctx.bezierCurveTo(cx - hw, eyeY + 90, cx - hw * jaw - 20, chin + 4, cx, chin + 16);
  ctx.bezierCurveTo(cx + hw * jaw + 20, chin + 4, cx + hw, eyeY + 90, cx + hw - 4, eyeY + 14);
  ctx.lineTo(cx + hw - 18, eyeY + 14);
  ctx.bezierCurveTo(cx + hw * 0.7, noseY + 10, cx + 40, noseY + 4, cx, noseY + 10);
  ctx.bezierCurveTo(cx - 40, noseY + 4, cx - hw * 0.7, noseY + 10, cx - hw + 18, eyeY + 14);
  ctx.closePath();
}

function drawFacialHair(ctx, P) {
  const tone = P.hairTone;
  if (P.beard) {
    beardPath(ctx, P);
    ctx.fillStyle = gray(tone + 0.1, 0.55);
    ctx.fill();
    beardPath(ctx, P);
    strands(ctx, P, 1400, { tone: tone + 0.05, flow: (x) => Math.PI / 2 + (x - P.cx) * -0.006, len: [6, 14], width: 1.4 });
  } else if (P.stubble) {
    beardPath(ctx, P);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = gray(tone + 0.2, 0.35);
    for (let i = 0; i < 1500; i++) {
      ctx.fillRect(P.cx - P.hw + P.r() * P.hw * 2, P.noseY + P.r() * (P.chin - P.noseY + 20), 1.6, 1.6);
    }
    ctx.restore();
  }
}

function drawMustache(ctx, P) {
  if (!P.mustache) return;
  const { cx, noseY, mouthY, mouthW, r } = P;
  for (let i = 0; i < 260; i++) {
    const s = r() < 0.5 ? -1 : 1;
    const t = r();
    const x = cx + s * (4 + t * (mouthW + 6));
    const y = noseY + 10 + t * (mouthY - noseY - 12) * 0.9 + r() * 6;
    line(ctx, [x, y - 5, x + s * 3, y + 6], 1.8, gray(P.hairTone + r() * 0.15, 0.85));
  }
}

function drawHair(ctx, P) {
  const { cx, hw, top, eyeY, hairTone } = P;
  switch (P.hair) {
    case 'short':
      fillHair(ctx, P, { volume: 8, bangs: 2 });
      break;
    case 'messy':
      fillHair(ctx, P, { volume: 18, bangs: 16 }, { len: [14, 34] });
      break;
    case 'spiky':
      fillHair(ctx, P, { volume: 10, spikes: 34, bangs: 10 }, { flow: (x, y) => Math.atan2(y - eyeY, x - cx) });
      break;
    case 'curly':
      fillHair(ctx, P, { volume: 32, bangs: 12, sideY: eyeY + 10 }, { curly: true, count: 1600 });
      break;
    case 'long':
      fillHair(ctx, P, { volume: 14, sideY: eyeY + 40 }, { flow: (x) => (x < cx ? Math.PI * 0.62 : Math.PI * 0.38), len: [20, 40] });
      line(ctx, [cx + 18, top - 4, cx + 10, P.hairline - 20, cx - 20, P.hairline + 6], 2, gray(hairTone + 0.35, 0.7));
      break;
    case 'buzz':
      hairPath(ctx, P, { volume: 2 });
      ctx.save();
      ctx.clip();
      ctx.fillStyle = gray(P.skin - 0.15, 0.7);
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = gray(hairTone, 0.6);
      for (let i = 0; i < 2200; i++) ctx.fillRect(cx - hw - 10 + P.r() * (hw * 2 + 20), top - 10 + P.r() * (eyeY - top), 1.8, 1.8);
      ctx.restore();
      break;
    case 'receding':
    case 'bald':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * (hw + 6), eyeY + 6);
        ctx.bezierCurveTo(cx + s * (hw + 12), eyeY - 50, cx + s * (hw - 10), top + 40, cx + s * (hw - 30), top + (P.hair === 'bald' ? 70 : 34));
        ctx.lineTo(cx + s * (hw - 14), eyeY - 16);
        ctx.closePath();
        ctx.fillStyle = gray(hairTone);
        ctx.fill();
      }
      if (P.hair === 'receding') {
        for (let i = 0; i < 70; i++) {
          const x = cx - 40 + P.r() * 80;
          const y = top + 6 + P.r() * 28;
          line(ctx, [x, y, x + (P.r() - 0.5) * 18, y - 10], 1.2, gray(hairTone, 0.7));
        }
      }
      shade(ctx, cx - 30, top + 30, 30, 0.6, true);
      break;
    case 'cap': {
      fillHair(ctx, P, { volume: 6, sideY: eyeY + 4 }, { count: 300 });
      ctx.beginPath();
      ctx.moveTo(cx - hw - 8, P.hairline + 6);
      ctx.bezierCurveTo(cx - hw - 10, top - 40, cx + hw + 10, top - 40, cx + hw + 8, P.hairline + 6);
      ctx.closePath();
      const cg = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
      cg.addColorStop(0, gray(0.45));
      cg.addColorStop(1, gray(0.2));
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = gray(0.08);
      ctx.stroke();
      line(ctx, [cx, top - 28, cx, P.hairline - 20], 2, gray(0.12));
      ctx.beginPath();
      ctx.arc(cx, top + 26, 18, 0, Math.PI * 2);
      ctx.fillStyle = gray(0.92);
      ctx.fill();
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = gray(0.1);
      ctx.textAlign = 'center';
      ctx.fillText('GG', cx, top + 33);
      // visera
      ctx.beginPath();
      ctx.moveTo(cx - hw - 14, P.hairline + 4);
      ctx.quadraticCurveTo(cx, P.hairline - 8, cx + hw + 14, P.hairline + 4);
      ctx.quadraticCurveTo(cx, P.hairline + 34, cx - hw - 14, P.hairline + 4);
      ctx.fillStyle = gray(0.15);
      ctx.fill();
      shade(ctx, cx, P.hairline + 40, 80, 0.25);
      break;
    }
    case 'beanie': {
      const band = P.hairline + 4;
      ctx.beginPath();
      ctx.moveTo(cx - hw - 8, band);
      ctx.bezierCurveTo(cx - hw - 12, top - 46, cx + hw + 12, top - 46, cx + hw + 8, band);
      ctx.closePath();
      ctx.fillStyle = gray(0.35);
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let x = cx - hw - 10; x < cx + hw + 10; x += 9) line(ctx, [x, band, cx + (x - cx) * 0.5, top - 40], 3, gray(0.2));
      ctx.restore();
      ctx.fillStyle = gray(0.28);
      ctx.fillRect(cx - hw - 10, band - 26, hw * 2 + 20, 30);
      for (let x = cx - hw - 8; x < cx + hw + 10; x += 7) line(ctx, [x, band - 24, x, band + 2], 2.5, gray(0.12));
      for (let i = 0; i < 160; i++) {
        const a = P.r() * Math.PI * 2;
        const rr = P.r() * 22;
        line(ctx, [cx, top - 50, cx + Math.cos(a) * rr, top - 50 + Math.sin(a) * rr], 2, gray(0.2 + P.r() * 0.6));
      }
      break;
    }
  }
}

function drawGlasses(ctx, P) {
  if (!P.glasses) return;
  const { cx, eyeY: ey, eyeGap, eyeSize: es, hw } = P;
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeGap;
    ctx.beginPath();
    if (P.glasses === 'round') ctx.arc(ex, ey, es * 1.75, 0, Math.PI * 2);
    else ctx.roundRect(ex - es * 2, ey - es * 1.35, es * 4, es * 2.5, 8);
    ctx.fillStyle = P.glasses === 'shades' ? gray(0.08) : 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = gray(0.06);
    ctx.stroke();
    line(ctx, [ex - es * 1.2, ey + es * 0.5, ex - es * 0.2, ey - es * 0.9], 2.5, 'rgba(255,255,255,0.75)');
    line(ctx, [cx + s * (eyeGap + es * 2), ey - 4, cx + s * (hw - 4), ey - 2], 4, gray(0.08));
  }
  line(ctx, [cx - eyeGap + es * 1.9, ey - 4, cx, ey - 12, cx + eyeGap - es * 1.9, ey - 4], 4, gray(0.06));
}

function drawHeadphones(ctx, P) {
  if (!P.headphones) return;
  const { cx, hw, top, eyeY } = P;
  ctx.beginPath();
  ctx.ellipse(cx, eyeY + 10, hw + 22, eyeY - top + 40, 0, Math.PI * 1.04, Math.PI * 1.96);
  ctx.lineWidth = 16;
  ctx.strokeStyle = gray(0.12);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gray(0.6);
  ctx.stroke();
  for (const s of [-1, 1]) {
    const x = cx + s * (hw + 14);
    ctx.beginPath();
    ctx.roundRect(x - 20, eyeY - 18, 40, 82, 16);
    const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, gray(0.35));
    g.addColorStop(1, gray(0.05));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = gray(0.02);
    ctx.stroke();
    line(ctx, [x - 10, eyeY - 6, x - 12, eyeY + 50], 3, gray(0.75));
  }
}

// ---------------------------------------------------------------- conversión a ASCII

const GLYPHS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).filter((c) => c !== '`');
const GX = 2; // sub-bloques por celda (horizontal)
const GY = 3; // sub-bloques por celda (vertical)
let glyphCache = null;

// Mide cuánta "tinta" tiene cada carácter en cada sub-bloque de su celda, dibujándolo
// con la misma fuente monoespaciada que usa la página.
function measureGlyphs(createCanvas) {
  if (glyphCache) return glyphCache;
  const gw = 36;
  const gh = 60;
  const ctx = createCanvas(gw, gh).getContext('2d');
  ctx.font = `${gh}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const raw = GLYPHS.map((ch) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, gw, gh);
    ctx.fillStyle = '#000';
    ctx.fillText(ch, gw / 2, gh * 0.55);
    const { data } = ctx.getImageData(0, 0, gw, gh);
    const v = new Float32Array(GX * GY);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const k = Math.floor((y * GY) / gh) * GX + Math.floor((x * GX) / gw);
        v[k] += 1 - data[(y * gw + x) * 4] / 255;
      }
    }
    for (let k = 0; k < v.length; k++) v[k] /= (gw * gh) / (GX * GY);
    return v;
  });
  // normaliza para que el carácter más denso cuente como negro
  const max = Math.max(...raw.map((v) => v.reduce((a, b) => a + b) / v.length));
  glyphCache = raw.map((v) => v.map((x) => Math.min(1, x / max)));
  return glyphCache;
}

function toAscii(ctx, createCanvas) {
  const glyphs = measureGlyphs(createCanvas);
  const { data } = ctx.getImageData(0, 0, OW, OH);
  const cell = new Float32Array(GX * GY);
  const rows = [];
  for (let cy = 0; cy < ROWS; cy++) {
    let row = '';
    for (let cx = 0; cx < COLS; cx++) {
      cell.fill(0);
      for (let py = 0; py < CH; py++) {
        for (let px = 0; px < CW; px++) {
          const i = ((cy * CH + py) * OW + cx * CW + px) * 4;
          const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          cell[Math.floor((py * GY) / CH) * GX + Math.floor((px * GX) / CW)] += 1 - lum;
        }
      }
      let ink = 0;
      for (let k = 0; k < cell.length; k++) {
        // curva de contraste: el blanco queda limpio y los grises medios se refuerzan
        const d = cell[k] / ((CW * CH) / (GX * GY));
        cell[k] = d < 0.02 ? 0 : Math.min(1, Math.pow((d - 0.02) / 0.9, 0.8));
        ink += cell[k];
      }
      if (ink === 0) {
        row += ' ';
        continue;
      }
      let best = 0;
      let bestErr = Infinity;
      for (let g = 0; g < glyphs.length; g++) {
        const v = glyphs[g];
        let err = 0;
        for (let k = 0; k < cell.length; k++) err += (v[k] - cell[k]) ** 2;
        if (err < bestErr) {
          bestErr = err;
          best = g;
        }
      }
      row += GLYPHS[best];
    }
    rows.push(row.replace(/\s+$/, ''));
  }
  return rows.join('\n');
}


// ---------------------------------------------------------------- API

export function renderPortrait(profile, createCanvas = defaultCanvas) {
  const P = params(profile);
  P.jitterSeed = profile.seed ^ 0xa11ce;
  const canvas = createCanvas(OW, OH);
  const ctx = canvas.getContext('2d');
  ctx.scale(OW / W, OH / H);
  drawBackground(ctx);
  if (P.hair === 'long') drawLongHairBack(ctx, P);
  drawTorso(ctx, P);
  drawEars(ctx, P);
  drawHead(ctx, P);
  drawFacialHair(ctx, P);
  drawEyes(ctx, P);
  drawBrows(ctx, P);
  drawNose(ctx, P);
  drawMouth(ctx, P);
  drawMustache(ctx, P);
  drawHair(ctx, P);
  drawGlasses(ctx, P);
  drawHeadphones(ctx, P);
  return { canvas, ascii: toAscii(ctx, createCanvas) };
}

export function drawPortrait(profile, createCanvas) {
  return renderPortrait(profile, createCanvas).ascii;
}
