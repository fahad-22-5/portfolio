/**
 * The concourse ceiling and its light.
 *
 * The soffit is a dark, exposed industrial ceiling: structural beams, round
 * supply ducts, cable trays and sprinkler mains, all instanced and laid only
 * over the open mall (never through a shop). Round the edge, above every
 * shopfront, runs a white dropped bulkhead with recessed warm downlights.
 * The halo rings hang below the services on three fine wires each.
 *
 * Light comes from three layers, cheapest first:
 *   1. emissive lamps (rings, downlights) bright enough to bloom
 *   2. additive decals on the floor: a soft pool under every ring and a warm
 *      spill in front of every shopfront, all in two instanced draws
 *   3. a small pool of real PointLights that hop to the rings and shops
 *      nearest the cat (fading out and in, so nothing pops), giving true
 *      specular highlights on the polished tiles. ?lights=lo turns this off.
 */
import * as THREE from 'three';
import { inst, canvasTex, TAU } from '../util.js';
import { paint, lamp, galvanised } from './finishes.js';
import { ENV_BOX, CEIL, UNITS, unitFronts, floorSamples, isConcourse, inSkylight, inLiftShaft } from './plan2024.js';

const LO_LIGHTS = typeof location !== 'undefined' && /[?&]lights=lo/.test(location.search);
const SHOP = new Set(['shop', 'food', 'walkin']);
export const WARM = 0xffd6a5;

export function buildCeiling(ctx, parent) {
  const unit = new THREE.BoxGeometry(1, 1, 1);

  /* ---------- exposed services over the open floor ---------- */
  const open = (x, z) => isConcourse(x, z) && !inSkylight(x, z, 0.5) && !inLiftShaft(x, z, 0.5);
  /** Open runs along one axis at a fixed other coordinate, each pushed 0.6 m into the walls at its ends: [[a, b], ...] */
  const runs = (alongX, fixed, min = 1.5) => {
    const lo = alongX ? ENV_BOX.minX : ENV_BOX.minZ, hi = alongX ? ENV_BOX.maxX : ENV_BOX.maxZ, out = []; let start = null;
    for (let t = lo; t <= hi + 0.5; t += 0.5) {
      const ok = t <= hi && (alongX ? open(t, fixed) : open(fixed, t));
      if (ok && start === null) start = t;
      if (!ok && start !== null) { if (t - 0.5 - start >= min) out.push([start - 0.6, t - 0.5 + 0.6]); start = null; }
    }
    return out;
  };
  const beams = [], joists = [], ducts = [], flanges = [], trays = [], pipes = [];
  for (let z = ENV_BOX.minZ + 2; z < ENV_BOX.maxZ; z += 6) {
    for (const [a, b] of runs(true, z)) beams.push({ x: (a + b) / 2, y: CEIL - 0.21, z, sx: b - a, sy: 0.42, sz: 0.3 });
    for (const [a, b] of runs(true, z + 3, 3)) pipes.push({ x: (a + b) / 2, y: CEIL - 0.3, z: z + 3, sx: b - a });
  }
  for (let x = ENV_BOX.minX + 3; x < ENV_BOX.maxX; x += 6) for (const [a, b] of runs(false, x)) joists.push({ x, y: CEIL - 0.14, z: (a + b) / 2, sx: 0.18, sy: 0.28, sz: b - a });
  for (let x = ENV_BOX.minX + 5; x < ENV_BOX.maxX; x += 13) for (const [a, b] of runs(false, x, 4)) {
    ducts.push({ x, y: CEIL - 0.8, z: (a + b) / 2, sz: b - a });
    for (let z = a + 0.9; z < b - 0.3; z += 1.5) flanges.push({ x, y: CEIL - 0.8, z });
  }
  for (let z = ENV_BOX.minZ + 4.6; z < ENV_BOX.maxZ; z += 12) for (const [a, b] of runs(true, z, 3)) trays.push({ x: (a + b) / 2, y: CEIL - 0.47, z, sx: b - a, sy: 0.06, sz: 0.32 });
  const off = { shadow: false };
  inst(parent, unit, paint(0x232528, 0.8), beams.concat(joists), off);
  inst(parent, new THREE.CylinderGeometry(0.27, 0.27, 1, 16, 1, true).rotateX(Math.PI / 2), galvanised(0x3f4349, 0.45), ducts, off);
  inst(parent, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16).rotateX(Math.PI / 2), galvanised(0x2e3136, 0.5), flanges, off);
  inst(parent, unit, galvanised(0x4a4e54, 0.5), trays, off);
  inst(parent, new THREE.CylinderGeometry(0.03, 0.03, 1, 8).rotateZ(Math.PI / 2), paint(0x7d231d, 0.45), pipes, off);

  /* ---------- white bulkhead with recessed downlights over every shopfront, and the warm spill in front of it ---------- */
  const bulk = [], cans = [], trims = [], spill = [], shopSites = [];
  for (const u of UNITS) {
    if (!SHOP.has(u.kind)) continue;
    const fronts = unitFronts(u); if (!fronts.length) continue;
    shopSites.push([u.c[0], 3.1, u.c[1]]);
    for (const f of fronts) {
      const at = (t, o) => [f.a[0] + (f.b[0] - f.a[0]) * t + f.nx * o, f.a[1] + (f.b[1] - f.a[1]) * t + f.nz * o], face = Math.atan2(f.nx, f.nz);
      const m = at(0.5, 0.53);
      bulk.push({ x: m[0], y: 4.3, z: m[1], ry: face, sx: f.len + 0.2, sy: 0.36, sz: 0.86 });
      const n = Math.max(1, Math.round(f.len / 1.6));
      for (let i = 0; i < n; i++) { const p = at((i + 0.5) / n, 0.58); cans.push({ x: p[0], y: 4.115, z: p[1] }); trims.push({ x: p[0], y: 4.118, z: p[1] }); }
      const s = at(0.5, 1.45); spill.push({ x: s[0], y: 0.046, z: s[1], ry: face, sx: f.len, sz: 2.9 });
    }
  }
  inst(parent, unit, paint(0xf3f1ec, 0.85), bulk, off);
  inst(parent, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), lamp(WARM, 5), cans, off);
  inst(parent, new THREE.CylinderGeometry(0.1, 0.1, 0.012, 14), paint(0xd9d6cf, 0.4), trims, off);

  /* ---------- halo rings: thin LED hoops 1.2-2 m across, hung in overlapping clusters at different heights ---------- */
  const SIZES = [0.6, 0.75, 0.9, 1.0];
  const ringFits = (x, z, r) => { for (let k = 0; k < 8; k++) { const a = k * TAU / 8; if (!isConcourse(x + Math.cos(a) * r, z + Math.sin(a) * r)) return false; } return !inSkylight(x, z, r + 0.3); };
  const clusters = floorSamples(5).filter(([x, z]) => !inSkylight(x, z, 1.2)), rings = [];
  clusters.forEach(([x, z], i) => {
    const n = 2 + (i % 2);
    for (let k = 0; k < n; k++) {
      const a = i * 2.4 + k * TAU / n, d = k ? 1.15 + ((i + k) % 3) * 0.25 : 0.25, s = SIZES[(i * 3 + k * 5) % 4], rx = x + Math.cos(a) * d, rz = z + Math.sin(a) * d;
      if (ringFits(rx, rz, s + 0.45)) rings.push({ x: rx, z: rz, s, y: CEIL - 1.05 - ((i * 7 + k * 3) % 5) * 0.1 });
    }
  });
  inst(parent, new THREE.TorusGeometry(1, 0.03, 6, 48).rotateX(Math.PI / 2), lamp(0xfff8e7, 3.5), rings.map((r) => ({ x: r.x, y: r.y, z: r.z, sx: r.s, sz: r.s })), off);
  const wires = [];
  rings.forEach((r, i) => { for (let k = 0; k < 3; k++) { const a = i * 0.7 + k * TAU / 3; wires.push({ x: r.x + Math.cos(a) * r.s, y: (r.y + CEIL) / 2, z: r.z + Math.sin(a) * r.s, sy: CEIL - r.y }); } });
  inst(parent, new THREE.CylinderGeometry(0.004, 0.004, 1, 4), paint(0x0c0c0d, 0.6), wires, off);

  /* ---------- light on the floor: additive decals (every ring, every shopfront) ---------- */
  const decal = (tex, color) => new THREE.MeshBasicMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolTex = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#9a9a9a'); g.addColorStop(1, '#000000'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  // brightest against the glass (the top of the canvas), fading out into the mall and at both ends
  const spillTex = canvasTex(128, 128, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#8c8c8c'); g.addColorStop(1, '#000000'); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    const e = c.createLinearGradient(0, 0, 128, 0); e.addColorStop(0, '#000000'); e.addColorStop(0.1, 'rgba(0,0,0,0)'); e.addColorStop(0.9, 'rgba(0,0,0,0)'); e.addColorStop(1, '#000000'); c.fillStyle = e; c.fillRect(0, 0, 128, 128);
  });
  const pools = inst(parent, flat, decal(poolTex, new THREE.Color(1, 0.9, 0.74).multiplyScalar(0.13)), clusters.map(([x, z]) => ({ x, y: 0.045, z, sx: 6.4, sz: 6.4 })), off);
  const spills = inst(parent, flat, decal(spillTex, new THREE.Color(WARM).multiplyScalar(0.2)), spill, off);
  pools.renderOrder = spills.renderOrder = 2;

  /* ---------- real lights near the cat ---------- */
  const nLights = ctx.quality ? ctx.quality.lights : 3;
  if (LO_LIGHTS || !nLights) return;
  /** `n` PointLights shared among `sites` ([x, y, z]): each sits on one of the n sites nearest the cat. */
  function lightPool(sites, n, color, intensity, distance) {
    const slots = [], want = new Int32Array(n).fill(-1), d2 = new Float32Array(sites.length);
    for (let i = 0; i < n; i++) { const L = new THREE.PointLight(color, 0, distance, 2); L.userData.dynamic = true; parent.add(L); slots.push({ L, site: -1, level: 0 }); }
    let timer = 0;
    return (dt, p) => {
      const on = p.y > -1.5 && p.y < 5.5;                       // not from the platforms below or the bus deck above
      if ((timer -= dt) <= 0) {
        timer = 0.25;
        for (let i = 0; i < sites.length; i++) { const s = sites[i]; d2[i] = (s[0] - p.x) ** 2 + (s[2] - p.z) ** 2; }
        for (let k = 0; k < n; k++) if (slots[k].site >= 0) d2[slots[k].site] *= 0.7;       // hysteresis: a held site is not dropped for a marginally nearer one
        for (let k = 0; k < n; k++) { let b = -1, bd = Infinity; for (let i = 0; i < sites.length; i++) if (d2[i] < bd) { bd = d2[i]; b = i; } want[k] = on ? b : -1; if (b >= 0) d2[b] = Infinity; }
      }
      for (let k = 0; k < n; k++) {
        const s = slots[k]; let keep = false;
        if (s.site >= 0) for (let j = 0; j < n; j++) if (want[j] === s.site) keep = true;
        if (keep) s.level = Math.min(1, s.level + dt * 2.5);
        else {
          s.level = Math.max(0, s.level - dt * 4);
          if (s.level === 0) for (let j = 0; j < n; j++) {         // dark: move to a wanted site that no other light holds
            const w = want[j]; if (w < 0) continue;
            let held = false; for (let q = 0; q < n; q++) if (slots[q].site === w) held = true;
            if (!held) { s.site = w; s.L.position.set(sites[w][0], sites[w][1], sites[w][2]); break; }
          }
        }
        s.L.intensity = intensity * s.level * s.level * (3 - 2 * s.level);
      }
    };
  }
  const ringLights = lightPool(clusters.map(([x, z]) => [x, CEIL - 1.5, z]), nLights, 0xfff1dc, 30, 13);
  const shopLights = lightPool(shopSites, nLights, WARM, 16, 10);
  ctx.updaters.push((dt) => { const p = ctx.catPos; if (p) { ringLights(dt, p); shopLights(dt, p); } });
}
