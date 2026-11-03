import { rng } from './analyzer.js';

// Retrato robot ASCII en 3D, sin IA:
//  1. La cabeza es un modelo 3D construido con funciones de distancia (SDF): elipsoides,
//     cápsulas y esferas unidas con mezcla suave. Sus medidas y accesorios dependen de los
//     rasgos del análisis y de una semilla por usuario.
//  2. Se renderiza por ray marching con luz principal, relleno, sombras suaves y oclusión
//     ambiental, desde tres cámaras: frente y los dos perfiles.
//  3. Cada carácter cubre 2x3 muestras; se elige el carácter cuya forma (medida dibujando la
//     fuente real) más se parece a ese trozo de imagen.

export const FONT = "'Cascadia Mono', Consolas, 'Courier New', monospace";
const CHAR_ASPECT = 0.6; // ancho/alto de un carácter monoespaciado con line-height 1
const GX = 2;
const GY = 3;

export const VIEWS = {
  front: { cols: 120, rows: 92 },
  left: { cols: 56, rows: 40 },
  right: { cols: 56, rows: 40 },
};

// ---------------------------------------------------------------- utilidades SDF

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len2 = (x, y) => Math.sqrt(x * x + y * y);
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function sdSphere(x, y, z, r) {
  return len3(x, y, z) - r;
}

function sdEllipsoid(x, y, z, a, b, c) {
  const k0 = len3(x / a, y / b, z / c);
  const k1 = len3(x / (a * a), y / (b * b), z / (c * c));
  return k1 === 0 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1;
}

function sdCapsule(x, y, z, ax, ay, az, bx, by, bz, r1, r2 = r1) {
  const px = x - ax, py = y - ay, pz = z - az;
  const bxa = bx - ax, bya = by - ay, bza = bz - az;
  const h = clamp((px * bxa + py * bya + pz * bza) / (bxa * bxa + bya * bya + bza * bza), 0, 1);
  return len3(px - bxa * h, py - bya * h, pz - bza * h) - (r1 + (r2 - r1) * h);
}

function sdBox(x, y, z, bx, by, bz) {
  const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a, b, k) {
  return -smin(-a, -b, k);
}

const noise3 = (x, y, z) => Math.sin(x * 1.7 + Math.sin(y * 2.3)) * Math.sin(y * 1.9 + Math.sin(z * 2.9)) * Math.sin(z * 2.1 + Math.sin(x * 1.3));

// ---------------------------------------------------------------- parámetros

function params(profile) {
  const f = profile.features;
  const r = rng(profile.seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => a + r() * (b - a);

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

  const ey = between(0.04, 0.1);
  const noseLen = between(0.28, 0.38);
  const beard = !f.young && r() < (f.old ? 0.65 : 0.4);
  return {
    w: between(0.92, 1.06),
    jaw: between(0.85, 1.12),
    eg: between(0.25, 0.3),
    ey,
    ez: 0.66,
    eyeR: 0.12 + (f.shouter ? 0.012 : 0),
    look: (r() - 0.5) * 0.5,
    noseLen,
    noseSize: between(0.9, 1.25),
    my: ey - noseLen - between(0.14, 0.18),
    mw: between(0.17, 0.22),
    skin: between(0.66, 0.8),
    hair,
    hairTone: f.old ? between(0.5, 0.7) : between(0.1, 0.32),
    hl: between(0.52, 0.62) + (f.old ? 0.08 : 0),
    brow: f.angry ? 'angry' : f.curious ? 'raised' : pick(['flat', 'arched', 'flat']),
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
    shirtTone: between(0.25, 0.55),
  };
}

// ---------------------------------------------------------------- escena

const M = { skin: 0, lips: 1, teeth: 2, eye: 3, hair: 4, hat: 5, frame: 6, lens: 7, phones: 8, shirt: 9 };

function makeScene(P) {
  const { w, jaw, eg, ey, ez, eyeR, noseLen, noseSize, my, mw, hl } = P;
  const noseTipY = ey - noseLen;
  const noseTipZ = 0.86 + noseLen * 0.5;
  const lidH = P.eyes === 'sleepy' ? 0.005 : P.eyes === 'wide' ? 0.1 : 0.07;
  const curve = { smile: 0.9, grin: 1.1, shout: 0.2, frown: -0.8, smirk: 0.35, neutral: 0.12 }[P.mouth];
  const asym = P.mouth === 'smirk' ? 0.22 : 0;
  const open = { grin: 0.035, shout: 0.1 }[P.mouth] || 0;
  const thick = { short: 0.06, messy: 0.1, spiky: 0.07, curly: 0.15, long: 0.07, buzz: 0.018, receding: 0.05, bald: 0.05, cap: 0.04, beanie: 0.03 }[P.hair];
  // desplazamientos de las cejas: [interior, centro, exterior]
  const brow = { flat: [0, 0.01, 0], arched: [-0.01, 0.04, -0.01], angry: [-0.05, 0, 0.04], raised: [0.03, 0.06, 0] }[P.brow];

  // z de la superficie de la frente/cara (para apoyar cejas y gafas)
  const surfZ = (x, y) => 0.84 * Math.sqrt(Math.max(0, 1 - ((y - 0.12) / 0.92) ** 2 - (x / (0.74 * w)) ** 2)) - 0.02;

  const cavity = (x, yy, z) => sdEllipsoid(x, yy + open * 0.3, z - 0.9, mw * 0.82, open, 0.3);

  let mat = 0;
  function scene(x, y, z, wantMat = false) {
    const ax = Math.abs(x);

    // ---- torso y cuello (baratos, fuera del volumen de la cabeza)
    let shirt = sdEllipsoid(x, y + 2.05, z + 0.1, 1.65, 0.8, 0.65);
    if (P.shirt === 'hoodie') shirt = smin(shirt, len2(len2(x, z + 0.12) - 0.5, y + 1.45) - 0.13, 0.1);
    else if (P.shirt === 'collar') shirt = smin(shirt, len2(len2(x, z + 0.05) - 0.38, y + 1.38) - 0.06, 0.05);
    const neck = Math.max(len2(x, z + 0.08) - 0.31, Math.abs(y + 1.2) - 0.5);

    const bound = sdEllipsoid(x, y - 0.12, z, 1.2, 1.55, 1.25);
    if (bound > 0.15 && !wantMat) return Math.min(shirt, neck, bound);

    // ---- piel
    let skin = sdEllipsoid(x, y - 0.12, z + 0.02, 0.74 * w, 0.92, 0.86);
    skin = smin(skin, sdEllipsoid(x, y + 0.36, z - 0.1, 0.6 * jaw, 0.62, 0.68), 0.3);
    skin = smin(skin, sdSphere(x, y + 0.86, z - 0.4, 0.17), 0.2);
    skin = smin(skin, sdSphere(ax - 0.4, y + 0.06, z - 0.47, 0.2), 0.2);
    skin = smin(skin, sdCapsule(x, y, z, -0.4, ey + 0.2, 0.64, 0.4, ey + 0.2, 0.64, 0.07), 0.15);
    skin = smin(skin, sdEllipsoid(x, y - (my - 0.02), z - 0.66, 0.3, 0.22, 0.22), 0.15);
    skin = smax(skin, -sdSphere(ax - eg, y - ey, z - 0.8, 0.17), 0.1);
    skin = smin(skin, sdCapsule(x, y, z, 0, ey - 0.02, 0.8, 0, noseTipY + 0.03, noseTipZ - 0.05, 0.05 * noseSize, 0.075 * noseSize), 0.07);
    skin = smin(skin, sdSphere(ax - 0.08 * noseSize, y - (noseTipY + 0.01), z - (noseTipZ - 0.1), 0.06 * noseSize), 0.04);
    skin = smax(skin, -sdSphere(ax - 0.045, y - (noseTipY - 0.03), z - (noseTipZ - 0.07), 0.026), 0.015);
    skin = smin(skin, sdEllipsoid(ax - 0.72 * w, y, z + 0.02, 0.07, 0.21, 0.13), 0.06);
    skin = smax(skin, -sdEllipsoid(ax - 0.77 * w, y, z, 0.03, 0.13, 0.07), 0.02);
    skin = smin(skin, neck, 0.15);
    skin = Math.min(skin, Math.max(sdSphere(ax - eg, y - ey, z - ez, eyeR + 0.018), ey + lidH - y)); // párpado
    if (P.bags) skin = smin(skin, sdCapsule(ax, y, z, eg - 0.08, ey - 0.13, ez + 0.07, eg + 0.08, ey - 0.12, ez + 0.05, 0.022), 0.03);

    // ---- boca
    const yy = y - my - curve * x * x - asym * x;
    let lips = Math.min(sdEllipsoid(x, yy - 0.035, z - 0.87, mw, 0.04, 0.07), sdEllipsoid(x, yy + 0.045, z - 0.86, mw * 0.92, 0.05, 0.075));
    let teeth = 1e9;
    if (open) {
      const cav = cavity(x, yy, z);
      skin = smax(skin, -cav, 0.02);
      lips = smax(lips, -cav, 0.01);
      teeth = sdBox(x, yy + 0.012, z - 0.84, mw * 0.7, 0.022, 0.03);
    } else {
      lips = smax(lips, -sdBox(x, yy, z - 0.9, mw * 1.05, 0.006, 0.2), 0.005);
    }

    // ---- ojos
    const eye = sdSphere(ax - eg, y - ey, z - ez, eyeR);

    // ---- pelo (cejas, cabello, barba)
    let hair = 1e9;
    const bi = [eg - 0.11, ey + 0.17 + brow[0]];
    const bm = [eg + 0.01, ey + 0.2 + brow[1]];
    const bo = [eg + 0.13, ey + 0.16 + brow[2]];
    hair = Math.min(
      sdCapsule(ax, y, z, bi[0], bi[1], surfZ(bi[0], bi[1]) + 0.01, bm[0], bm[1], surfZ(bm[0], bm[1]) + 0.01, 0.03),
      sdCapsule(ax, y, z, bm[0], bm[1], surfZ(bm[0], bm[1]) + 0.01, bo[0], bo[1], surfZ(bo[0], bo[1]) + 0.01, 0.03, 0.022),
    );

    const shellAt = (t) => sdEllipsoid(x, y - 0.12, z + 0.02, 0.74 * w + t, 0.92 + t, 0.86 + t);
    let cut = hl - 0.75 * clamp(0.25 - z, 0, 1.3) - 0.22 * smooth(0.45, 0.72, ax);
    if (P.hair === 'receding') cut += 0.22 * smooth(0.12, 0.42, ax) * clamp(z * 2, 0, 1);
    let scalp = smax(shellAt(thick), cut - y, 0.04);
    if (P.hair === 'bald') scalp = smax(scalp, Math.max(y - 0.4, z - 0.4), 0.05);
    if (P.hair === 'messy') scalp += 0.035 * noise3(x * 9, y * 9, z * 9);
    if (P.hair === 'curly') scalp += 0.03 * Math.sin(x * 30) * Math.sin(y * 30) * Math.sin(z * 30);
    if (P.hair === 'spiky') {
      const s = Math.max(0, Math.sin(Math.atan2(x, z) * 8) * Math.sin(y * 10 + 1));
      scalp -= 0.13 * s * s * clamp((y - 0.3) * 2, 0, 1);
    }
    if (P.hair === 'long') scalp = smin(scalp, smax(sdEllipsoid(x, y + 0.45, z + 0.32, 0.86 * w, 1.15, 0.52), z - 0.3, 0.05), 0.1);
    hair = Math.min(hair, scalp);
    if (P.hair !== 'bald') hair = smin(hair, sdCapsule(ax, y, z, 0.69 * w, hl - 0.3, 0.12, 0.7 * w, 0.05, 0.16, 0.035), 0.04);

    if (P.beard) {
      let b = sdEllipsoid(x, y + 0.36, z - 0.1, 0.6 * jaw + 0.08, 0.7, 0.76);
      b = smin(b, sdSphere(x, y + 0.9, z - 0.42, 0.22), 0.15);
      b = smax(b, y - (noseTipY - 0.08), 0.05);
      b = smax(b, -0.25 - z, 0.05);
      b = smax(b, -sdEllipsoid(x, y - my, z - 0.92, mw * 1.05, 0.085, 0.25), 0.03);
      hair = Math.min(hair, b + 0.015 * noise3(x * 25, y * 25, z * 25));
    }
    if (P.mustache) {
      hair = Math.min(hair, sdCapsule(ax, y, z, 0, my + 0.085, 0.95, mw + 0.03, my + 0.02, 0.86, 0.03, 0.02) + 0.008 * noise3(x * 40, y * 40, z * 40));
    }

    // ---- gorra / gorro
    let hat = 1e9;
    if (P.hair === 'cap') {
      hat = smax(shellAt(0.08), hl - 0.05 - 0.25 * clamp(-z, 0, 1) - y, 0.02);
      hat = Math.min(hat, smax(sdEllipsoid(x, y - (hl - 0.03), z - 0.72, 0.55, 0.025, 0.45), 0.3 - z, 0.02));
      hat = Math.min(hat, sdSphere(x, y - 1.12, z, 0.045));
    } else if (P.hair === 'beanie') {
      hat = smax(shellAt(0.1), hl - 0.08 - y, 0.02) + 0.01 * Math.sin(Math.atan2(x, z) * 36);
      hat = Math.min(hat, smax(shellAt(0.13), Math.max(hl - 0.08 - y, y - (hl + 0.12)), 0.01));
      hat = Math.min(hat, sdSphere(x, y - 1.2, z, 0.17) + 0.03 * noise3(x * 20, y * 20, z * 20));
    }

    // ---- gafas
    let frame = 1e9;
    let lens = 1e9;
    if (P.glasses) {
      const gx = ax - eg, gy = y - ey, gz = z - 0.9;
      let inside;
      if (P.glasses === 'round') inside = len2(gx, gy) - 0.15;
      else {
        const qx = Math.abs(gx) - 0.12, qy = Math.abs(gy) - 0.08;
        inside = len2(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.035;
      }
      frame = len2(Math.abs(inside), gz) - 0.016;
      frame = Math.min(frame, sdCapsule(x, y, z, -(eg - 0.15), ey + 0.03, 0.92, eg - 0.15, ey + 0.03, 0.92, 0.015));
      frame = Math.min(frame, sdCapsule(ax, y, z, eg + 0.16, ey + 0.03, 0.88, 0.73 * w, ey + 0.05, 0.0, 0.014));
      if (P.glasses === 'shades') lens = Math.max(inside, Math.abs(gz) - 0.008);
    }

    // ---- cascos
    let phones = 1e9;
    if (P.headphones) {
      const e = len2(x / (0.86 * w), (y - 0.05) / (1.12 + thick)) - 1;
      phones = Math.max(len2(e * 0.95, z) - 0.045, -y);
      phones = Math.min(phones, Math.max(len2(y + 0.02, z + 0.02) - 0.25, Math.abs(ax - 0.84 * w) - 0.075) - 0.01);
    }

    const ds = [skin, lips, teeth, eye, hair, hat, frame, lens, phones, shirt];
    let best = 0;
    for (let i = 1; i < ds.length; i++) if (ds[i] < ds[best]) best = i;
    mat = best;
    return ds[best];
  }

  // Tono (albedo) y brillo especular en un punto de la superficie.
  function material(x, y, z) {
    scene(x, y, z, true);
    const ax = Math.abs(x);
    switch (mat) {
      case M.skin: {
        let a = P.skin;
        const yy = y - my - curve * x * x - asym * x;
        if (open && cavity(x, yy, z) < 0.03) return [0.06, 0];
        if (P.stubble && y < noseTipY - 0.06 && z > 0.1 && y > -1.0) a -= 0.1 + 0.08 * Math.max(0, Math.sin(x * 90) * Math.sin(y * 85) * Math.sin(z * 70));
        if (P.freckles && y > noseTipY - 0.05 && y < ey - 0.05 && z > 0.55 && Math.sin(x * 90) * Math.sin(y * 80) * Math.sin(z * 70) > 0.6) a -= 0.18;
        if (P.wrinkles && y > ey + 0.3 && y < hl - 0.04 && z > 0.5) a -= 0.08 * Math.max(0, Math.sin(y * 70));
        if (y < -0.95) a -= 0.06; // cuello en sombra
        return [a, 0.08];
      }
      case M.lips:
        return [P.skin - 0.2, 0.25];
      case M.teeth:
        return [0.95, 0.3];
      case M.eye: {
        const sx = x < 0 ? -1 : 1;
        const nx = (x - sx * eg) / eyeR, ny = (y - ey) / eyeR, nz = (z - ez) / eyeR;
        const gl = len3(P.look, -0.05, 1);
        const d = (nx * P.look + ny * -0.05 + nz) / gl;
        if (d > 0.955) return [0.03, 0.9];
        if (d > 0.82) return [0.3 + 0.08 * Math.sin(Math.atan2(ny, nx) * 20), 0.9];
        return [0.93, 0.6];
      }
      case M.hair: {
        if (P.hair === 'curly') return [P.hairTone + 0.14 * Math.sin(x * 40) * Math.sin(y * 40) * Math.sin(z * 40), 0.15];
        const strand = Math.sin(Math.atan2(x, z) * 26 + y * 14 + 2 * noise3(x * 6, y * 6, z * 6));
        return [P.hairTone + 0.12 * strand, 0.2];
      }
      case M.hat:
        return [P.hair === 'beanie' ? 0.3 + 0.06 * Math.sin(Math.atan2(x, z) * 36) : 0.38, 0.15];
      case M.frame:
        return [0.06, 0.6];
      case M.lens:
        return [0.08, 1];
      case M.phones:
        return [ax > 0.7 ? 0.14 : 0.1, 0.7];
      default:
        return [P.shirtTone + 0.03 * Math.sin(y * 50 + x * 10), 0.05];
    }
  }

  return { scene, material };
}

// ---------------------------------------------------------------- render

const CAMERAS = {
  // f: dirección de la cámara, r: derecha de la pantalla, key/fill: luces (siempre de cara)
  front: { f: [0, 0, -1], r: [1, 0, 0], v: [-2.05, 1.5], uc: 0, key: [-0.5, 0.6, 0.65], fill: [0.6, 0.1, 0.5] },
  left: { f: [-1, 0, 0], r: [0, 0, -1], v: [-1.55, 1.45], uc: -0.08, key: [0.6, 0.6, 0.55], fill: [0.5, 0, -0.5] },
  right: { f: [1, 0, 0], r: [0, 0, 1], v: [-1.55, 1.45], uc: 0.08, key: [-0.6, 0.6, 0.55], fill: [-0.5, 0, -0.5] },
};

function norm(v) {
  const l = len3(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

function renderView(S, view) {
  const { cols, rows } = VIEWS[view];
  const cam = CAMERAS[view];
  const sw = cols * GX;
  const sh = rows * GY;
  const vh = cam.v[1] - cam.v[0];
  const uw = (vh * cols * CHAR_ASPECT) / rows;
  const [fx, fy, fz] = cam.f;
  const [rx, ry, rz] = cam.r;
  const key = norm(cam.key);
  const fill = norm(cam.fill);
  const out = new Float32Array(sw * sh);
  const map = S.scene;

  for (let j = 0; j < sh; j++) {
    const v = cam.v[1] - ((j + 0.5) / sh) * vh;
    for (let i = 0; i < sw; i++) {
      const u = cam.uc - uw / 2 + ((i + 0.5) / sw) * uw;
      // cámara ortográfica: rayo paralelo a f desde 4 unidades de distancia
      const ox = rx * u - fx * 4, oy = v, oz = rz * u - fz * 4;
      let t = 0;
      let hit = false;
      for (let s = 0; s < 120 && t < 8; s++) {
        const d = map(ox + fx * t, oy + fy * t, oz + fz * t);
        if (d < 0.0015) {
          hit = true;
          break;
        }
        t += d * 0.8;
      }
      if (!hit) {
        // pared de comisaría con líneas de altura
        out[j * sw + i] = Math.abs(((v + 10) % 0.35) - 0.175) > 0.163 ? 0.8 : 1;
        continue;
      }
      const px = ox + fx * t, py = oy + fy * t, pz = oz + fz * t;
      // normal por tetraedro
      const e = 0.0015;
      const a = map(px + e, py - e, pz - e), b = map(px - e, py - e, pz + e);
      const c = map(px - e, py + e, pz - e), d = map(px + e, py + e, pz + e);
      const n = norm([a - b - c + d, -a - b + c + d, -a + b - c + d]);
      // oclusión ambiental
      let occ = 0;
      for (let k = 1; k <= 4; k++) {
        const h = 0.035 * k;
        occ += (h - map(px + n[0] * h, py + n[1] * h, pz + n[2] * h)) / k;
      }
      const ao = clamp(1 - 2.2 * occ, 0, 1);
      // sombra suave hacia la luz principal
      let sh_ = 1;
      let st = 0.03;
      for (let k = 0; k < 22 && st < 2; k++) {
        const h = map(px + key[0] * st, py + key[1] * st, pz + key[2] * st);
        if (h < 0.001) {
          sh_ = 0;
          break;
        }
        sh_ = Math.min(sh_, (8 * h) / st);
        st += clamp(h, 0.02, 0.2);
      }
      sh_ = clamp(sh_, 0, 1);
      const [alb, spec] = S.material(px, py, pz);
      const dk = Math.max(0, n[0] * key[0] + n[1] * key[1] + n[2] * key[2]);
      const df = Math.max(0, n[0] * fill[0] + n[1] * fill[1] + n[2] * fill[2]);
      // especular (Blinn) con el vector medio entre luz y cámara
      const hv = norm([key[0] - fx, key[1] - fy, key[2] - fz]);
      const sp = Math.pow(Math.max(0, n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]), 30) * spec * sh_;
      const rim = Math.pow(1 - Math.abs(n[0] * fx + n[1] * fy + n[2] * fz), 3) * 0.12;
      out[j * sw + i] = clamp(alb * (0.38 * ao + 0.75 * dk * sh_ + 0.3 * df * ao) + sp * 0.6 + rim * ao, 0, 1);
    }
  }
  return { lum: out, cols, rows };
}

// ---------------------------------------------------------------- conversión a ASCII

const GLYPHS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).filter((c) => c !== '`');
let glyphCache = null;

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return Object.assign(document.createElement('canvas'), { width: w, height: h });
}

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

// Máscara de enfoque: realza el contraste local para que ojos, nariz y boca destaquen en ASCII.
function sharpen(lum, sw, sh, radius = 3, amount = 1.4) {
  const tmp = new Float32Array(lum.length);
  const out = new Float32Array(lum.length);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let s = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < sw) { s += lum[y * sw + xx]; n++; }
      }
      tmp[y * sw + x] = s / n;
    }
  }
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let s = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < sh) { s += tmp[yy * sw + x]; n++; }
      }
      const v = lum[y * sw + x];
      out[y * sw + x] = v >= 0.999 ? 1 : clamp(v + amount * (v - s / n), 0, 1);
    }
  }
  return out;
}

function toAscii({ lum: raw, cols, rows }, glyphs) {
  const sw = cols * GX;
  const lum = sharpen(raw, sw, rows * GY);
  const cell = new Float32Array(GX * GY);
  const lines = [];
  for (let cy = 0; cy < rows; cy++) {
    let row = '';
    for (let cx = 0; cx < cols; cx++) {
      let ink = 0;
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          const d = 1 - lum[(cy * GY + gy) * sw + cx * GX + gx];
          // curva de contraste: el blanco queda limpio y los grises medios se refuerzan
          const v = d < 0.03 ? 0 : Math.min(1, (d - 0.03) / 0.9);
          cell[gy * GX + gx] = v;
          ink += v;
        }
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
    lines.push(row.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- API

// Devuelve { front, left, right } con el ASCII de cada vista.
export function renderPortrait(profile, createCanvas = defaultCanvas) {
  const S = makeScene(params(profile));
  const glyphs = measureGlyphs(createCanvas);
  const out = {};
  for (const view of Object.keys(VIEWS)) out[view] = toAscii(renderView(S, view), glyphs);
  return out;
}

// Imagen en escala de grises de una vista (útil para depurar el modelo 3D).
export function renderLuminance(profile, view = 'front') {
  return renderView(makeScene(params(profile)), view);
}
