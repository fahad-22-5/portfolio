/**
 * Procedural PBR texture sets, generated once at load (no image files):
 * albedo + normal + roughness, all seamlessly tiling. Height fields are built
 * from tileable value noise, and normals are derived from them with a wrapped
 * Sobel filter, so the lighting matches the detail you see in the colour.
 */
import * as THREE from 'three';

/* ---------- tileable value noise ---------- */
function makeNoise(seed) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const P = 256, lat = new Float32Array(P * P); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  /** value noise with period `per` cells (per <= 256) */
  const vn = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    const a0 = lat[x0 + y0 * P], b0 = lat[x1 + y0 * P], a1 = lat[x0 + y1 * P], b1 = lat[x1 + y1 * P];
    return (a0 + (b0 - a0) * ux) * (1 - uy) + (a1 + (b1 - a1) * ux) * uy;
  };
  /** fbm over the unit square [0,1)^2, tiling, base frequency f */
  const fbm = (u, v, f, oct = 5, gain = 0.5) => { let s = 0, amp = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += amp * vn(u * f, v * f, f); n += amp; f *= 2; amp *= gain; } return s / n; };
  return { rnd, vn, fbm };
}

/** Normal map (tangent space) from a height array, wrapped at the edges. */
function normalFromHeight(h, W, H, strength) {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = (x - 1 + W) % W, xr = (x + 1) % W, yu = (y - 1 + H) % H, yd = (y + 1) % H;
    const dx = (h[xr + y * W] - h[xl + y * W]) * strength, dy = (h[x + yd * W] - h[x + yu * W]) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (x + y * W) * 4; data[i] = (nx * 0.5 + 0.5) * 255; data[i + 1] = (ny * 0.5 + 0.5) * 255; data[i + 2] = (nz * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  return data;
}

function tex(data, W, H, srgb, repeat) {
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.flipY = false;
  if (repeat) t.repeat.set(repeat, repeat);
  t.needsUpdate = true; return t;
}

/** Build a set from a per-pixel function returning [r, g, b (0-1 sRGB), height (0-1), roughness (0-1)]. */
function build(W, H, fn, { normal = 6, repeat = 1 } = {}) {
  const col = new Uint8Array(W * H * 4), rough = new Uint8Array(W * H * 4), hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b, h, ro] = fn(x / W, y / H, x, y), i = x + y * W, j = i * 4;
    col[j] = Math.max(0, Math.min(255, r * 255)); col[j + 1] = Math.max(0, Math.min(255, g * 255)); col[j + 2] = Math.max(0, Math.min(255, b * 255)); col[j + 3] = 255;
    const rv = Math.max(0, Math.min(255, ro * 255)); rough[j] = rv; rough[j + 1] = rv; rough[j + 2] = rv; rough[j + 3] = 255;
    hgt[i] = h;
  }
  return { map: tex(col, W, H, true, repeat), normalMap: tex(normalFromHeight(hgt, W, H, normal), W, H, false, repeat), roughnessMap: tex(rough, W, H, false, repeat) };
}

const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

/** Concrete paving flags, `n` x `n` per tile, grey tone (0-1). UVs in metres -> tile = n * 0.6 m. */
export function pavingSet(seed = 3, n = 6, tone = 0.66) {
  return once(`pav${seed}${n}${tone}`, () => {
    const N = makeNoise(seed), shade = []; for (let i = 0; i < n * n; i++) shade.push((N.rnd() - 0.5) * 0.07);
    const S = 1024, set = build(S, S, (u, v) => {
      const cx = Math.floor(u * n), cy = Math.floor(v * n), fx = u * n - cx, fy = v * n - cy;
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * 0.6 * 1000;          // mm from the joint
      const joint = edge < 4 ? 1 : 0, bevel = Math.min(1, edge / 9);
      const grit = N.fbm(u, v, 64, 3), mott = N.fbm(u, v, 6, 4), stain = Math.max(0, N.fbm(u + 0.3, v, 3, 4) - 0.55) * 1.6;
      let g = tone + shade[cx + cy * n] + (mott - 0.5) * 0.08 + (grit - 0.5) * 0.09 - stain * 0.12;
      if (joint) g = tone * 0.55 + (grit - 0.5) * 0.05;
      const h = joint ? 0.1 : 0.55 + bevel * 0.35 + (grit - 0.5) * 0.25;
      return [g * 1.0, g * 0.985, g * 0.955, h, joint ? 0.98 : 0.78 + (grit - 0.5) * 0.25 - stain * 0.25];
    }, { normal: 5 });
    set.tile = n * 0.6; return set;
  });
}

/** Asphalt: dark binder with fine exposed aggregate, worn polished lanes and damp patches
 *  (roughness 0.45 wet .. 0.85 dry). Tile = 4 m (UVs * 0.25). */
export function asphaltSet() {
  return once('asphalt', () => {
    const N = makeNoise(77), S = 1024;
    const stone = new Float32Array(S * S), tint = new Float32Array(S * S);
    for (let k = 0; k < 120000; k++) {
      const x = N.rnd() * S, y = N.rnd() * S, r = 0.5 + N.rnd() * N.rnd() * 1.3, t = 0.25 + N.rnd() * 0.5;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy) / r; if (d > 1) continue;
        const i = ((Math.floor(x + dx) % S + S) % S) + ((Math.floor(y + dy) % S + S) % S) * S, hh = Math.sqrt(1 - d * d);
        if (hh > stone[i]) { stone[i] = hh; tint[i] = t; }
      }
    }
    return build(S, S, (u, v, x, y) => {
      const i = x + y * S, s = stone[i], wear = N.fbm(u, v, 3, 4), damp = N.fbm(u + 0.37, v + 0.11, 2, 4), lane = N.fbm(u * 0.5, v, 4, 3);
      const wet = Math.min(1, Math.max(0, (damp - 0.52) * 5));
      const binder = 0.085 + (wear - 0.5) * 0.03 - wet * 0.025;
      const g = binder + s * tint[i] * 0.11 * (1 - wet * 0.5);
      const rough = 0.85 - wet * 0.4 - Math.max(0, lane - 0.6) * 0.3 - s * 0.05;
      return [g, g, g * 1.04, 0.3 + s * 0.45, Math.max(0.45, Math.min(0.85, rough))];
    }, { normal: 2.4 });
  });
}

/** Polished concourse floor, from the walking-tour footage: cream 600 mm porcelain with pale grout and a salmon
 *  insert at every corner, plus a little tone variation from tile to tile. The roughness and normal maps come from
 *  the same layout (glossy tile, matt recessed grout), so reflections break at the joints. One texture = 4 x 4
 *  tiles = 2.4 m; floor.js turns the grid on to the diagonal and adds the terracotta border band. */
export function concourseSet() {
  return once('concourse', () => {
    const N = makeNoise(5), S = 1024, T = 4, shade = [], warm = [];
    for (let i = 0; i < T * T; i++) { shade.push((N.rnd() - 0.5) * 0.06); warm.push((N.rnd() - 0.5) * 0.025); }
    return build(S, S, (u, v) => {
      const tu = u * T, tv = v * T, cx = Math.floor(tu), cy = Math.floor(tv), fx = tu - cx, fy = tv - cy, tile = cx + cy * T;
      const ex = Math.min(fx, 1 - fx) * 600, ey = Math.min(fy, 1 - fy) * 600, edge = Math.min(ex, ey), dia = ex + ey;   // mm from the joint / the corner
      const mott = N.fbm(u, v, 8, 4), fleck = N.fbm(u, v, 128, 2);
      if (dia < 78) {                                                              // salmon corner insert, with its own grout line
        if (dia > 74.5) return [0.66, 0.62, 0.56, 0.25, 0.7];
        const k = 1 + (mott - 0.5) * 0.16 + (fleck - 0.5) * 0.08;
        return [0.80 * k, 0.56 * k, 0.48 * k, 0.56, 0.2];
      }
      if (edge < 2.2) return [0.68 + (fleck - 0.5) * 0.05, 0.645, 0.59, 0.25, 0.7];   // pale grout, recessed and matt
      const g = 1 + shade[tile] + (mott - 0.5) * 0.04 - Math.max(0, fleck - 0.74) * 0.18, w = warm[tile];
      return [0.925 * g * (1 + w), 0.895 * g, 0.83 * g * (1 - w), 0.55 + Math.min(1, edge / 7) * 0.06, 0.2 + (mott - 0.5) * 0.06];
    }, { normal: 3, repeat: 1 / 2.4 });
  });
}

const GRANITE = { brown: [0.5, 0.385, 0.3], red: [0.47, 0.27, 0.205], tan: [0.66, 0.56, 0.44], grey: [0.56, 0.56, 0.57] };
/** Polished granite cladding: 1.2 x 0.8 m slabs with fine joints, dark mica and pale feldspar crystals. Tile = 2.4 m. */
export function graniteSet(kind = 'brown') {
  return once('granite' + kind, () => {
    const base = GRANITE[kind] || GRANITE.brown, N = makeNoise(41 + kind.length * 7), S = 512, tone = []; for (let i = 0; i < 6; i++) tone.push((N.rnd() - 0.5) * 0.14);
    return build(S, S, (u, v) => {
      const su = u * 2, sv = v * 3, cx = Math.floor(su), cy = Math.floor(sv), fx = su - cx, fy = sv - cy;
      const edge = Math.min(Math.min(fx, 1 - fx) * 1200, Math.min(fy, 1 - fy) * 800);               // mm from the joint
      if (edge < 3.5) return [base[0] * 0.3, base[1] * 0.3, base[2] * 0.3, 0.15, 0.75];
      const g1 = N.fbm(u, v, 112, 2), g2 = N.fbm(u + 0.31, v + 0.77, 56, 3), cl = N.fbm(u, v, 5, 3);
      const dark = g1 > 0.6 ? Math.min(1, (g1 - 0.6) * 4) : 0, pale = g2 > 0.6 ? Math.min(1, (g2 - 0.6) * 3.2) : 0;
      const k = (1 + tone[cx + cy * 2] + (cl - 0.5) * 0.22) * (1 - dark * 0.6);
      return [base[0] * k + pale * 0.28, base[1] * k + pale * 0.25, base[2] * k + pale * 0.22, 0.55 + Math.min(1, edge / 8) * 0.08, 0.14 + dark * 0.1 + (cl - 0.5) * 0.06];
    }, { normal: 1.4, repeat: 1 / 2.4 });
  });
}

/** Honed travertine cladding: cream 1.2 x 0.6 m slabs, each with its own run of horizontal bedding and small open pits. Tile = 2.4 m. */
export function travertineSet() {
  return once('travertine', () => {
    const N = makeNoise(63), S = 512, tone = [], off = []; for (let i = 0; i < 8; i++) { tone.push((N.rnd() - 0.5) * 0.09); off.push(N.rnd() * 200); }
    return build(S, S, (u, v) => {
      const su = u * 2, sv = v * 4, cx = Math.floor(su), cy = Math.floor(sv), fx = su - cx, fy = sv - cy, slab = cx + cy * 2;
      const edge = Math.min(Math.min(fx, 1 - fx) * 1200, Math.min(fy, 1 - fy) * 600);
      if (edge < 3) return [0.42, 0.37, 0.3, 0.12, 0.85];
      // bedding: stretched noise in the slab's own coordinates (the joints hide the seams)
      const o = off[slab], band = N.vn(fx * 2.5 + o, fy * 13 + o, 256) * 0.6 + N.vn(fx * 6 + o, fy * 34 + o, 256) * 0.4;
      const pitN = N.vn(fx * 40 + o, fy * 70 + o, 256), pit = pitN > 0.8 && band > 0.5 ? Math.min(1, (pitN - 0.8) * 9) : 0, cl = N.fbm(u, v, 4, 3);
      const k = 1 + tone[slab] + (band - 0.5) * 0.2 + (cl - 0.5) * 0.08 - pit * 0.3;
      return [0.86 * k, 0.79 * k, 0.665 * k, 0.6 - pit * 0.5 + Math.min(1, edge / 8) * 0.06, 0.42 + pit * 0.4 + (band - 0.5) * 0.12];
    }, { normal: 2.2, repeat: 1 / 2.4 });
  });
}

/** Brick: per-brick tone variation, weathering, recessed gritty mortar. 1 tile = 2 m x 2 m (16 courses x 8 bricks). */
export function brickSet(hex) {
  return once('brick' + hex, () => {
    const N = makeNoise(hex % 9973 + 7), S = 512, base = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    const tones = []; for (let i = 0; i < 16 * 9; i++) tones.push([(N.rnd() - 0.5) * 0.16, (N.rnd() - 0.5) * 0.05]);
    return build(S, S, (u, v) => {
      const row = Math.floor(v * 16), off = row % 2 ? 1 / 16 : 0, cu = (u + off) * 8, col = Math.floor(cu), fx = cu - col, fy = v * 16 - row;
      const mortar = fx < 0.06 || fy < 0.12;
      const grit = N.fbm(u, v, 64, 3), weather = N.fbm(u, v, 4, 4);
      if (mortar) { const m = 0.62 + (grit - 0.5) * 0.12; return [m, m * 0.97, m * 0.92, 0.1 + grit * 0.1, 0.95]; }
      const [tl, ts] = tones[(row * 9 + ((col % 9) + 9) % 9) % tones.length];
      const k = 1 + tl + (grit - 0.5) * 0.12 - Math.max(0, weather - 0.6) * 0.3;
      return [base[0] * k * (1 + ts), base[1] * k, base[2] * k * (1 - ts), 0.7 + (grit - 0.5) * 0.25, 0.85 + (grit - 0.5) * 0.1];
    }, { normal: 4, repeat: 0.5 });
  });
}

/** Detail set for painted render / concrete / stone: a near-white mottled multiplier, fine pitted normal. Tile = 2 m. */
export function concreteSet(seed = 9) {
  return once('conc' + seed, () => {
    const N = makeNoise(seed), S = 512;
    return build(S, S, (u, v) => {
      const m = N.fbm(u, v, 4, 5), f = N.fbm(u, v, 48, 3), streak = N.fbm(u * 0.25 + 0.1, v, 8, 3);
      const pit = f > 0.72 ? (f - 0.72) * 2 : 0;
      const g = 0.93 + (m - 0.5) * 0.1 - pit * 0.25 - Math.max(0, streak - 0.6) * 0.15;
      return [g, g, g * 0.995, 0.5 + (f - 0.5) * 0.6 - pit, 0.88 + (m - 0.5) * 0.18];
    }, { normal: 2.2, repeat: 0.5 });
  });
}

/** Short, directional fur strands for the cat (normal + a subtle albedo multiplier). */
export function furSet() {
  return once('fur', () => {
    const N = makeNoise(5), S = 512, h = new Float32Array(S * S);
    for (let k = 0; k < 26000; k++) {
      const x = N.rnd() * S, y = N.rnd() * S, len = 6 + N.rnd() * 10, w = 0.6 + N.rnd() * 0.8, a = Math.PI / 2 + (N.rnd() - 0.5) * 0.5;
      for (let t = 0; t < len; t++) {
        const px = Math.floor(x + Math.cos(a) * t), py = Math.floor(y + Math.sin(a) * t);
        for (let o = -1; o <= 1; o++) { const i = (((px + o) % S + S) % S) + ((py % S + S) % S) * S; h[i] = Math.max(h[i], (1 - t / len) * (o === 0 ? 1 : w * 0.5)); }
      }
    }
    return build(S, S, (u, v, x, y) => { const s = h[x + y * S], g = 0.82 + s * 0.18; return [g, g, g, s, 0.7 + (1 - s) * 0.2]; }, { normal: 3.5, repeat: 3 });
  });
}
