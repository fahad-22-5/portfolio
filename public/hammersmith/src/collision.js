/**
 * Height-field collision. Everything the cat can touch is a "surface":
 * a footprint in XZ, a top height (constant or a function for ramps), and a
 * thickness (Infinity = solid down to the ground; finite = a slab you can
 * walk underneath, e.g. the bus deck or an escalator).
 *
 *   groundAt(x, z, y, step) -> highest top the cat can stand on from height y
 *   blocked(x, z, y, step)  -> true if the spot is a wall, has no floor, or
 *                              has too little headroom
 *
 * All queries are allocation-free.
 */
export const STEP = 0.4;   // max ledge the cat walks up without jumping
const BODY = 0.7;          // headroom the cat needs

export function createCollision() {
  const S = [];

  function add(s) {
    s.enabled = true;
    if (s.thick === undefined) s.thick = Infinity;
    if (s.h === undefined) s.h = 0;
    S.push(s);
    return s;
  }

  /** Oriented rectangle centred on (x, z). opts: rot, h, hf(x,z), thick, pad. */
  function rect(x, z, w, d, o = {}) {
    const rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
    const hw = w / 2 + (o.pad || 0), hd = d / 2 + (o.pad || 0);
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    return add({
      minX: x - ex, maxX: x + ex, minZ: z - ez, maxZ: z + ez, h: o.h, hf: o.hf, thick: o.thick,
      test(px, pz) {
        const dx = px - x, dz = pz - z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        return lx >= -hw && lx <= hw && lz >= -hd && lz <= hd;
      },
    });
  }

  /** Annular sector about the origin. Angles: 0 = north, +90deg = east; a1 > a0. */
  function sector(r0, r1, a0, a1, o = {}) {
    const span = a1 - a0, r0s = r0 * r0, r1s = r1 * r1, TAU = Math.PI * 2;
    return add({
      minX: -r1, maxX: r1, minZ: -r1, maxZ: r1, h: o.h, hf: o.hf, thick: o.thick,
      test(px, pz) {
        const rs = px * px + pz * pz;
        if (rs < r0s || rs > r1s) return false;
        let da = (Math.atan2(px, -pz) - a0) % TAU;
        if (da < 0) da += TAU;
        return da <= span;
      },
    });
  }

  /* ---------- spatial index: 4 m buckets for static surfaces; huge ones and late additions are always scanned ---------- */
  const CELL = 4, buckets = new Map(), big = [], EMPTY = [];
  let indexed = 0;
  const key = (ix, iz) => (ix + 2048) * 4096 + (iz + 2048);
  function index() {
    buckets.clear(); big.length = 0;
    for (const s of S) {
      const x0 = Math.floor(s.minX / CELL), x1 = Math.floor(s.maxX / CELL), z0 = Math.floor(s.minZ / CELL), z1 = Math.floor(s.maxZ / CELL);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 48) { big.push(s); continue; }
      for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) { const k = key(ix, iz); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(s); }
    }
    indexed = S.length;
  }
  /** Candidate surfaces in the bucket under (x, z). */
  function near(x, z) { return indexed ? (buckets.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY) : S; }

  function groundAt(x, z, y, step) {
    let best = -Infinity;
    const lists = indexed ? 3 : 1;
    for (let L = 0; L < lists; L++) {
      const A = L === 0 ? near(x, z) : L === 1 ? big : S, i0 = L === 2 ? indexed : 0;
      for (let i = i0; i < A.length; i++) {
        const s = A[i];
        if (!s.enabled || x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ || !s.test(x, z)) continue;
        const h = s.hf ? s.hf(x, z) : s.h;
        if (h <= y + step && h > best) best = h;
      }
    }
    return best;
  }

  function blocked(x, z, y, step) {
    let floor = false;
    const lists = indexed ? 3 : 1;
    for (let L = 0; L < lists; L++) {
      const A = L === 0 ? near(x, z) : L === 1 ? big : S, i0 = L === 2 ? indexed : 0;
      for (let i = i0; i < A.length; i++) {
        const s = A[i];
        if (!s.enabled || x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ || !s.test(x, z)) continue;
        const h = s.hf ? s.hf(x, z) : s.h;
        if (h <= y + step) floor = true;
        else if (h - s.thick < y + BODY) return true;
      }
    }
    return !floor;
  }

  return { add, rect, sector, groundAt, blocked, index, surfaces: S };
}
