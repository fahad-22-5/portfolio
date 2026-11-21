/**
 * People on the pavements.
 *
 * The mall's shoppers stay under its roof (shoppers.js); these are the people
 * outside: walking between the station doors, the hostel, the shops along the
 * A315, the ends of the streets and the bus stop on Butterwick. They use the
 * same jointed stand-in and the same skinned bodies as everyone else.
 *
 * Where they can walk is worked out, not drawn by hand: a 1 m grid of the
 * streets round the station, in which a cell is pavement if it has ground, is
 * clear of everything in the collision set, and is not carriageway. Carriageway
 * is only walkable inside a crossing:
 *   - the two signalled crossings (outside the station, and on Hammersmith Road
 *     by the newsagent): people wait at the kerb for the traffic to be held
 *   - the mouth of Bute Gardens and the bus ramp: people wait for a gap
 * Vehicles are told who is on the road (ctx.walkers) and brake for them.
 *
 * Routes are A* over the grid (edge cells cost more, so people keep off the
 * kerb), pulled straight where there is a clear line. People keep apart from
 * each other and from the cat, look down at it, and wave after a meow. When it
 * rains about half of them put an umbrella up. After dark there are fewer.
 * The per-frame update allocates nothing.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStaff } from './staff.js';
import { P } from './stationStreet.js';
import { ENVELOPE, MAIN_DOOR, inEnvelope, fbWorld, FOOTBRIDGE } from './plan2024.js';
import { box } from '../util.js';
import { paint } from './finishes.js';

const TOPS = [0x1f2a44, 0xb08a5a, 0x1b1b1d, 0x7d8288, 0xa3242c, 0x3f5a3a, 0xe9e6df, 0x3b5f8a, 0x5a3a5a, 0xc96a2a, 0x2a6a6a, 0x8a8f6a];
const LEGS = [0x2d3f63, 0x1b1c20, 0xc4b08a, 0x55595f, 0x3a3f4a, 0x22314f];
const SKIN = [0xf1c8a8, 0xd9a07a, 0xb07850, 0x7a4e30, 0x5a3a24, 0xe8b896, 0xc68e64];
const HAIR = [0x111111, 0x2a1c12, 0x5a3a24, 0x8a5a33, 0xc9a26a, 0x3a2414, 0x9a9a9a, 0x6a2a1a];
const BROLLY = [0x16171a, 0x16171a, 0x1f2a44, 0x7a1f2a, 0x2a6a6a, 0xc9a23a];

export function createPedestrians(ctx, parent, { count = 30 } = {}) {
  const { col } = ctx, ways = ctx.roadways || [];
  let seed = 9001; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  /* ---------- the street cleaner outside "one" (Street View, Oct 2025): orange hi-vis, a hand cart with green sacks ---------- */
  const sweeper = createStaff(parent);
  {
    const [cx, cz] = P(17.4, 5.2), ry = Math.atan2(MAIN_DOOR.n[1], -MAIN_DOOR.n[0]), green = paint(0x2f7d3a, 0.8), dark = paint(0x2b2f33, 0.6);
    box(parent, 0.62, 0.5, 0.95, dark, cx, 0.5, cz, ry); box(parent, 0.04, 0.5, 0.04, dark, cx, 1.0, cz, ry);
    for (const [dx, dy, dz, r] of [[0, 0.95, 0.12, 0.3], [0.05, 1.0, -0.25, 0.26]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), green); m.position.set(cx + dx, dy, cz + dz); m.scale.y = 1.15; m.castShadow = true; parent.add(m); }
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12).rotateZ(Math.PI / 2), dark); w.position.set(cx + Math.cos(ry) * 0.36 * s, 0.16, cz - Math.sin(ry) * 0.36 * s); w.rotation.y = ry; parent.add(w); }
    col.rect(cx, cz, 0.7, 1.0, { rot: ry, h: 1.2, pad: 0.05 });
    const clear = (x, z) => !col.blocked(x, z, 0, 0.3) && !col.blocked(x + 0.3, z, 0, 0.3) && !col.blocked(x - 0.3, z, 0, 0.3);
    const beat = [[18.4, 2.2], [18.0, 7.6], [18.6, -2.6], [17.6, 3.6]].map(([d, o]) => P(d, o)).filter(([x, z]) => clear(x, z));
    if (beat.length >= 2) sweeper.add({ at: (x, z) => [x, z], yaw: 0, look: { uniform: 0xff6a13, trousers: 0xff6a13, skin: 0xd9a07a, hair: 0x9a9a9a, sleeves: 'long' },
      tasks: beat.map((to, i) => ({ to, face: ry + i * 1.3, act: 'wipe', dur: 6 + i * 2, prop: 'mop', carry: true })) });
    sweeper.flush();
  }

  /* ---------- where people can walk ---------- */
  const C = 1, X0 = -72, Z0 = -216, NX = 248, NZ = 240, N = NX * NZ;
  const type = new Uint8Array(N), gy = new Float32Array(N), cost = new Float32Array(N), road = new Uint8Array(N);
  const cellOf = (x, z) => { const i = Math.floor((x - X0) / C), j = Math.floor((z - Z0) / C); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : i + j * NX; };
  const cx = (k) => X0 + ((k % NX) + 0.5) * C, cz = (k) => Z0 + (Math.floor(k / NX) + 0.5) * C;
  // carriageways, stamped into the grid along their centre lines
  const apron = { pts: [P(12.4, 23.1), P(23.2, 23.1)], w: 8.8 };              // the buses' way into the ramp arch: carriageway, except where the crossing strip runs over it
  for (const wy of [...ways, apron]) {
    const r = wy.w / 2 + 0.1, r2 = r * r;                                      // to the kerb face, near enough
    for (let s = 0; s < wy.pts.length - 1; s++) {
      const a = wy.pts[s], b = wy.pts[s + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 0.5));
      for (let q = 0; q <= m; q++) {
        const x = a[0] + (b[0] - a[0]) * q / m, z = a[1] + (b[1] - a[1]) * q / m;
        const i0 = Math.max(0, Math.floor((x - r - X0) / C)), i1 = Math.min(NX - 1, Math.floor((x + r - X0) / C)), j0 = Math.max(0, Math.floor((z - r - Z0) / C)), j1 = Math.min(NZ - 1, Math.floor((z + r - Z0) / C));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const ex = X0 + (i + 0.5) * C - x, ez = Z0 + (j + 0.5) * C - z; if (ex * ex + ez * ez < r2) road[i + j * NX] = 1; }
      }
    }
  }
  // crossings: a strip of carriageway people may use. u is the way across; hl and hw are half its length and width.
  const D = MAIN_DOOR, zones = [];
  const zone = (kind, site, [x, z], [ux, uz], hl, hw, any = false) => { const L = Math.hypot(ux, uz); zones.push({ kind, site, x, z, ux: ux / L, uz: uz / L, hl, hw, any, busy: 0 }); };
  zone('signal', 'front', P(31, 7.4), D.n, 9.5, 2.6);                         // outside the station entrance
  zone('signal', 'bute', [84, -99.2], [0, 1], 8.4, 1.7);                       // Hammersmith Road by the newsagent
  zone('gap', null, [96, -108.6], [1, 0], 6.2, 1.8);                           // the mouth of Bute Gardens
  zone('gap', null, P(18.0, 23.5), [-D.n[1], D.n[0]], 6.2, 2.3, true);          // across the bus ramp, out to the pavement round the wing's corner
  zone('gap', null, [-26.3, -92.5], [1, 0], 8.4, 1.9);                         // Shepherd's Bush Road at its mouth: the corner block to the shops east of it
  const zoneAt = (x, z, onRoad) => { for (let q = 0; q < zones.length; q++) { const Z = zones[q], dx = x - Z.x, dz = z - Z.z; if ((onRoad || Z.any) && Math.abs(dx * Z.ux + dz * Z.uz) < Z.hl && Math.abs(dx * Z.uz - dz * Z.ux) < Z.hw) return q; } return -1; };
  // the two station doors on the street: a few metres inside each is walkable, so people go in rather than vanish on the step
  const doorIn = [[D.m[0] - D.n[0] * 2.4, D.m[1] - D.n[1] * 2.4], [(ENVELOPE[7][0] + ENVELOPE[8][0]) / 2, (ENVELOPE[7][1] + ENVELOPE[8][1]) / 2 + 2.3]];
  const nearDoor = (x, z) => doorIn.some(([dx, dz]) => (x - dx) ** 2 + (z - dz) ** 2 < 20);
  const OFF = [[0, 0], [0.36, 0], [-0.36, 0], [0, 0.36], [0, -0.36]];
  for (let k = 0; k < N; k++) {
    const x = cx(k), z = cz(k), zi = zoneAt(x, z, road[k] === 1);
    if (road[k] && zi < 0) continue;
    if (inEnvelope(x, z) && !nearDoor(x, z)) continue;
    const h = col.groundAt(x, z, 0.3, 0.3); if (!(h > -0.4)) continue;
    let ok = true; for (const [ox, oz] of OFF) if (col.blocked(x + ox, z + oz, h, 0.3)) { ok = false; break; }
    if (!ok) continue;
    type[k] = zi >= 0 ? 2 + zi : 1; gy[k] = h;
  }
  const pre = type.slice();                                                   // before the trim below: for debugging
  // keep the part joined to the hostel's pavement, so every destination can be reached from every other
  {
    const stack = new Int32Array(N), mark = new Uint8Array(N); let sp = 0, s0 = -1, bd = 1e9;
    for (let k = 0; k < N; k++) if (type[k] === 1) { const d = (cx(k) - 101.7) ** 2 + (cz(k) + 172) ** 2; if (d < bd) { bd = d; s0 = k; } }
    if (s0 >= 0) { stack[sp++] = s0; mark[s0] = 1; }
    while (sp) { const k = stack[--sp], i = k % NX; for (const n of [k - 1, k + 1, k - NX, k + NX]) { if (n < 0 || n >= N || !type[n] || mark[n]) continue; if ((n === k - 1 && i === 0) || (n === k + 1 && i === NX - 1)) continue; mark[n] = 1; stack[sp++] = n; } }
    for (let k = 0; k < N; k++) if (!mark[k]) type[k] = 0;
  }
  for (let k = 0; k < N; k++) {
    if (!type[k]) continue; const i = k % NX, j = Math.floor(k / NX); let edge = i === 0 || j === 0 || i === NX - 1 || j === NZ - 1;
    for (let d = 0; d < 8 && !edge; d++) { const n = k + [1, -1, NX, -NX, NX + 1, NX - 1, -NX + 1, -NX - 1][d]; if (!type[n]) edge = true; }
    cost[k] = edge ? 2.6 : 1;
  }
  const isWalk = (x, z) => { const k = cellOf(x, z); return k >= 0 && type[k] > 0; };
  ctx.isPavement = (x, z) => { const k = cellOf(x, z); return k < 0 ? null : type[k] === 1; };   // null: outside the mapped streets   // for getting off a bus on to the pavement
  const out2 = [0, 0];
  /** nearest walkable cell centre to (x, z) within r cells, into out2 */
  function nearest(x, z, r = 3) {
    const i0 = Math.floor((x - X0) / C), j0 = Math.floor((z - Z0) / C); let best = 1e9;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= NX || j >= NZ || !type[i + j * NX]) continue;
      const ex = X0 + (i + 0.5) * C - x, ez = Z0 + (j + 0.5) * C - z, d = ex * ex + ez * ez; if (d < best) { best = d; out2[0] = x + ex; out2[1] = z + ez; }
    }
    return best < 1e9;
  }

  // A* on pre-allocated arrays (generation stamps instead of clearing)
  const g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N), heap = new Int32Array(N), hf = new Float32Array(N), raw = new Int32Array(2048);
  let hn = 0, gen = 0;
  const push = (k, f) => { let i = hn++; heap[i] = k; hf[i] = f; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; const tk = heap[p], tf = hf[p]; heap[p] = heap[i]; hf[p] = hf[i]; heap[i] = tk; hf[i] = tf; i = p; } };
  const pop = () => { const top = heap[0]; hn--; if (hn > 0) { heap[0] = heap[hn]; hf[0] = hf[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && hf[l] < hf[m]) m = l; if (r < hn && hf[r] < hf[m]) m = r; if (m === i) break; const tk = heap[m], tf = hf[m]; heap[m] = heap[i]; hf[m] = hf[i]; heap[i] = tk; hf[i] = tf; i = m; } } return top; };
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  function sight(ax, az, bx, bz) {                                           // a clear line with half a metre to spare either side
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / 0.4), px = -(bz - az) / d * 0.45, pz = (bx - ax) / d * 0.45;
    for (let i = 1; i < steps; i++) { const x = ax + (bx - ax) * i / steps, z = az + (bz - az) * i / steps; if (!isWalk(x, z) || !isWalk(x + px, z + pz) || !isWalk(x - px, z - pz)) return false; }
    return true;
  }
  /** Path from (sx, sz) to (tx, tz) into buf as x,z pairs; returns the point count, 0 if there is none. */
  function findPath(sx, sz, tx, tz, buf) {
    if (!nearest(sx, sz)) return 0; const s = cellOf(out2[0], out2[1]);
    if (!nearest(tx, tz)) return 0; const t = cellOf(out2[0], out2[1]);
    gen++; hn = 0; g[s] = 0; seen[s] = gen; from[s] = -1;
    const ti = t % NX, tj = Math.floor(t / NX);
    const h = (k) => { const dx = Math.abs((k % NX) - ti), dz = Math.abs(Math.floor(k / NX) - tj); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
    push(s, h(s)); let found = false, iter = 0;
    while (hn > 0 && iter++ < 60000) {
      const k = pop(); if (shut[k] === gen) continue; shut[k] = gen;
      if (k === t) { found = true; break; }
      const i = k % NX, j = Math.floor(k / NX);
      for (let d = 0; d < 8; d++) {
        const ni = i + DI[d], nj = j + DJ[d]; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const n = ni + nj * NX; if (!type[n] || shut[n] === gen) continue;
        if (d >= 4 && (!type[i + DI[d] + j * NX] || !type[i + (j + DJ[d]) * NX])) continue;
        const ng = g[k] + DC[d] * cost[n];
        if (seen[n] !== gen || ng < g[n]) { seen[n] = gen; g[n] = ng; from[n] = k; push(n, ng + h(n)); }
      }
    }
    if (!found) return 0;
    let m = 0; for (let k = t; k !== -1 && m < raw.length; k = from[k]) raw[m++] = k;
    let n = 0, a = m - 1;
    while (a > 0 && n < buf.length / 2 - 1) {
      let b = a - 1;
      while (b > 0 && a - b < 40 && sight(cx(raw[a]), cz(raw[a]), cx(raw[b - 1]), cz(raw[b - 1]))) b--;
      buf[n * 2] = cx(raw[b]); buf[n * 2 + 1] = cz(raw[b]); n++; a = b;
    }
    if (n === 0) { buf[0] = cx(t); buf[1] = cz(t); n = 1; }
    return n;
  }

  /* ---------- where people come from and go to ---------- */
  const portals = [];
  const portal = (x, z, kind, weight = 1) => { if (nearest(x, z)) portals.push({ x: out2[0], z: out2[1], kind, weight, taken: null }); };
  portal(...D.front(8), 'door', 5);                                            // Hammersmith station: into the passage under the station building
  portal(23, -55.4, 'door', 2);                                               // the centre's north door
  portal(...fbWorld(FOOTBRIDGE.length + 3, 0), 'door', 2);                    // the Broadway Shopping Centre entrance
  portal(103.2, -174.25, 'door', 2);                                           // Abercorn House
  for (const o of [39, 52, 70, 86, 98]) portal(...P(32.4, o), 'door', 1);      // the dentist, the cafes and shops along the north side
  portal(140, -108.6, 'edge', 3); portal(174, -91.2, 'edge', 2);               // Hammersmith Road, away to the east
  portal(101.7, -213, 'edge', 2); portal(90.4, -213, 'edge', 1);               // Bute Gardens, away to the north
  portal(150, -90.6, 'door', 2); portal(170, -90.6, 'door', 1);                // the offices on the south side
  const stop = ctx.busStop;
  if (stop) for (const [x, z] of stop.spots) portal(x, z, 'bus', 1);
  const ends = portals.filter((q) => q.kind !== 'bus'), busSpots = portals.filter((q) => q.kind === 'bus');
  const total = ends.reduce((a, q) => a + q.weight, 0);
  const pickEnd = (not) => { for (let tries = 0; tries < 6; tries++) { let r = rnd() * total; for (const q of ends) { r -= q.weight; if (r <= 0) { if (q !== not) return q; break; } } } return ends[0]; };
  const open = []; for (let k = 0; k < N; k++) if (type[k] === 1 && cost[k] === 1 && !inEnvelope(cx(k), cz(k)) && Math.min((cx(k) - 0) ** 2 + (cz(k) + 80) ** 2, (cx(k) - 98) ** 2 + (cz(k) + 130) ** 2) < 95 * 95) open.push(k);

  /* ---------- the people ---------- */
  const crowd = createStaff(parent), S = [];
  const brolly = (hex) => {
    const canopy = new THREE.ConeGeometry(0.56, 0.2, 10, 1, true).translate(0, 0.98, 0), shaft = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 5).translate(0, 0.42, 0);
    const m = new THREE.Mesh(mergeGeometries([canopy.toNonIndexed(), shaft.toNonIndexed()]), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, side: THREE.DoubleSide })); m.castShadow = false; m.visible = false; return m;
  };
  if (ends.length >= 2) for (let i = 0; i < count; i++) {
    const p = crowd.add({ manual: true, at: (lx, lz) => [lx, lz], yaw: 0, tasks: [{ to: [0, 0], act: 'idle', dur: 1 }], props: ['phone', 'cup', 'bag'],
      look: { uniform: pick(TOPS), trousers: pick(LEGS), skin: pick(SKIN), hair: pick(HAIR), sleeves: 'long', apron: null } });
    const u = brolly(BROLLY[i % BROLLY.length]); p.R.ha.add(u); p.held.umbrella = u;
    p.root.position.set(0, -60, 0); p.hidden = true;
    S.push({ p, id: i, state: 'HID', timer: 0, delay: 0, first: true, path: new Float32Array(720), pn: 0, pi: 0, dest: null, from: null, speed: 1.25 + rnd() * 0.45, umb: i % 5 < 3, prop: i % 4 === 1 ? 'phone' : i % 7 === 3 ? 'cup' : i % 9 === 5 ? 'bag' : null, react: 0, wz: -1, wait: 0, pause: 0, stall: 0, replan: 0, dur: 0, inZone: -1 });
  }
  crowd.flush();

  const walkers = ctx.walkers || (ctx.walkers = { n: 0, x: new Float32Array(64), z: new Float32Array(64) });
  const hold = (sh, name) => { for (const k in sh.p.held) sh.p.held[k].visible = k === name; sh.p.carry = name === 'umbrella' || name === 'cup' || name === 'bag'; };
  let budget = 0, rain = 0, quiet = 0;

  function plan(sh, to) {
    const pos = sh.p.root.position;
    if (budget <= 0) { sh.state = 'PLAN'; sh.dest = to; return; }
    budget--;
    sh.pn = findPath(pos.x, pos.z, to.x, to.z, sh.path); sh.pi = 0; sh.dest = to;
    if (!sh.pn) { leave(sh); return; }
    sh.state = 'WALK'; sh.stall = 0; if (!sh.replan) sh.pause = rnd() < 0.25 ? 6 + rnd() * 30 : 0;
  }
  function leave(sh) {
    if (sh.dest && sh.dest.taken === sh) sh.dest.taken = null;
    sh.state = 'HID'; sh.timer = 0; sh.delay = (2 + rnd() * 9) * (1 + quiet * 6); sh.p.hidden = true; sh.p.walking = false; sh.p.root.position.y = -60; sh.from = sh.dest;
  }
  function enter(sh) {
    const p = sh.p, pos = p.root.position;
    if (sh.first && open.length) { const k = open[Math.floor(rnd() * open.length)]; pos.set(cx(k), gy[k], cz(k)); sh.from = null; }        // the street starts with people already on it
    else { const a = pickEnd(sh.from === null ? null : sh.from); pos.set(a.x, 0, a.z); sh.from = a; }
    sh.first = false; p.hidden = false; p.root.rotation.y = rnd() * 6.28;
    const free = busSpots.filter((q) => !q.taken);
    if (free.length && rnd() < 0.16) { const q = pick(free); q.taken = sh; plan(sh, q); } else plan(sh, pickEnd(sh.from));
  }
  function mayCross(Z, sh) {
    if (Z.kind === 'signal') { const s = ctx.signals && ctx.signals[Z.site]; return !s || s.walk; }
    const cars = ctx.traffic ? ctx.traffic.cars : null; if (!cars) return true;
    for (let i = 0; i < cars.length; i++) {                                    // never through a vehicle that is standing on the crossing (a queue at the junction)
      const v = cars[i], ex = v.x - Z.x, ez = v.z - Z.z;
      if (Math.abs(ex * Z.ux + ez * Z.uz) < Z.hl && Math.abs(ex * Z.uz - ez * Z.ux) < Z.hw + v.len / 2 + 0.6) return false;
    }
    if (sh.wait > 9) return true;                                              // moving traffic gives way in the end
    for (let i = 0; i < cars.length; i++) {
      const v = cars[i]; if (v.v < 0.8) continue;
      if ((v.x - Z.x) ** 2 + (v.z - Z.z) ** 2 < (Z.hl + 4 + v.v * 3) ** 2) return false;   // anything moving that could be here in three seconds, whichever way it points (a bus turning in)
      const dx = Z.x - v.x, dz = Z.z - v.z, fd = dx * v.fx + dz * v.fz;
      if (fd > -2 && fd < 8 + v.v * 3.2 && Math.abs(dx * v.fz - dz * v.fx) < Z.hl + 2) return false;
    }
    return true;
  }
  const face = (sh, target, dt) => { let a = target - sh.p.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); sh.p.root.rotation.y += a * Math.min(1, dt * 6); };

  function step(sh, dt, cat) {
    const p = sh.p, pos = p.root.position;
    if (sh.pi >= sh.pn) { arrive(sh); return; }
    const tx = sh.path[sh.pi * 2], tz = sh.path[sh.pi * 2 + 1];
    let dx = tx - pos.x, dz = tz - pos.z; const d = Math.hypot(dx, dz);
    if (d < (sh.pi === sh.pn - 1 ? 0.25 : 0.6)) { sh.pi++; if (sh.pi >= sh.pn) arrive(sh); return; }
    dx /= d; dz /= d;
    // about to step off the kerb onto a crossing: is it my turn?
    if (sh.inZone < 0) {
      const k1 = cellOf(pos.x + dx * 1.3, pos.z + dz * 1.3), t1 = k1 >= 0 ? type[k1] : 0;
      if (t1 >= 2 && !mayCross(zones[t1 - 2], sh)) { sh.state = 'WAIT'; sh.wz = t1 - 2; p.walking = false; p.act = sh.prop === 'phone' ? 'phone' : 'idle'; return; }
    }
    let sx = 0, sz = 0;
    for (let j = 0; j < S.length; j++) { if (S[j] === sh || S[j].state === 'HID') continue; const o = S[j].p.root.position, ox = pos.x - o.x, oz = pos.z - o.z, od = ox * ox + oz * oz; if (od < 0.64 && od > 1e-4) { const q = (0.8 - Math.sqrt(od)) / 0.8; sx += ox * q * 2; sz += oz * q * 2; } }
    if (cat && Math.abs(cat.y) < 1) { const ox = pos.x - cat.x, oz = pos.z - cat.z, od = ox * ox + oz * oz; if (od < 0.6 && od > 1e-4) { sx += ox * 2.5; sz += oz * 2.5; } }
    let vx = dx + sx, vz = dz + sz; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    const sp = sh.speed * (sh.inZone >= 0 ? 1.3 : 1) * (rain > 0.4 && !sh.umb ? 1.2 : 1), v = Math.min(d, sp * dt);     // brisk on a crossing, and in the rain without an umbrella
    let nx = pos.x + vx * v, nz = pos.z + vz * v;
    if (!isWalk(nx, nz)) { nx = pos.x + dx * v; nz = pos.z + dz * v; }
    if (sh.inZone >= 0 || type[cellOf(nx, nz)] >= 2) {                     // on or stepping onto a crossing: never into a vehicle
      const cars = ctx.traffic ? ctx.traffic.cars : null;
      if (cars) for (let i = 0; i < cars.length; i++) { const c = cars[i], ex = nx - c.x, ez = nz - c.z; if (Math.abs(ex * c.fx + ez * c.fz) < c.len / 2 + 0.4 && Math.abs(ex * c.fz - ez * c.fx) < c.wid / 2 + 0.4) { nx = pos.x; nz = pos.z; break; } }
    }
    if (!isWalk(nx, nz) && isWalk(pos.x, pos.z)) {                              // never off the kerb except on a crossing: slide along the edge, or wait a moment
      if (isWalk(nx, pos.z)) nz = pos.z; else if (isWalk(pos.x, nz)) nx = pos.x; else { nx = pos.x; nz = pos.z; }
    }
    // boxed in (someone in the way at the kerb edge): after 4 s, find a new way from here; after three tries, go home
    if (Math.abs(nx - pos.x) + Math.abs(nz - pos.z) < 0.002) { if ((sh.stall += dt) > 4) { sh.stall = 0; if (++sh.replan > 3) { sh.replan = 0; leave(sh); return; } plan(sh, sh.dest); return; } } else sh.stall = 0;
    pos.x = nx; pos.z = nz;
    p.walking = true; p.pace = sp / 1.05; p.act = 'idle';
    face(sh, Math.atan2(vx, vz), dt * 1.4);
    if (sh.pause > 0 && sh.inZone < 0 && (sh.pause -= dt) <= 0) { const k = cellOf(pos.x, pos.z); if (k >= 0 && type[k] === 1 && cost[k] === 1) { sh.state = 'PAUSE'; sh.timer = 0; sh.dur = 5 + rnd() * 9; p.walking = false; } }
  }
  function arrive(sh) {
    sh.replan = 0;
    const q = sh.dest; sh.p.walking = false;
    if (q && q.kind === 'bus') { sh.state = 'STAND'; sh.timer = 0; sh.dur = 25 + rnd() * 40; } else leave(sh);
  }

  /** env: { rain 0-1, night 0-1 } from the daylight controller. */
  function update(dt, time, cat, env) {
    budget = 1; walkers.n = 0;
    rain = env ? env.rain : 0; quiet = env ? env.night : 0;
    for (let i = 0; i < S.length; i++) {
      const sh = S[i], p = sh.p, pos = p.root.position;
      sh.timer += dt; sh.react = Math.max(0, sh.react - dt);
      switch (sh.state) {
        case 'HID': if (sh.timer > sh.delay) enter(sh); break;
        case 'PLAN': plan(sh, sh.dest); break;
        case 'WALK': sh.wait = 0; step(sh, dt, cat); break;
        case 'WAIT': sh.wait += dt; if (mayCross(zones[sh.wz], sh)) sh.state = 'WALK'; break;
        case 'PAUSE': p.act = 'phone'; p.held.phone.visible = true; if (sh.timer > sh.dur) { p.held.phone.visible = false; sh.state = 'WALK'; } break;
        case 'STAND': p.act = sh.timer % 14 < 8 ? 'phone' : 'idle'; face(sh, stop ? stop.face : 0, dt); if (sh.timer > sh.dur) { sh.dest.taken = null; sh.from = sh.dest; plan(sh, pickEnd(null)); } break;
      }
      if (sh.state === 'HID') continue;
      // what is in the right hand: an umbrella when it rains, otherwise whatever they left home with
      const want = rain > 0.4 && sh.umb ? 'umbrella' : sh.state === 'PAUSE' || (sh.state === 'STAND' && p.act === 'phone') ? 'phone' : sh.prop;
      if (want !== sh.holding) { sh.holding = want; hold(sh, want); }
      const k = cellOf(pos.x, pos.z);
      if (k >= 0 && type[k]) { pos.y += (gy[k] - pos.y) * Math.min(1, dt * 8); sh.inZone = type[k] >= 2 ? type[k] - 2 : -1; }
      if (sh.inZone >= 0 && walkers.n < 64) { walkers.x[walkers.n] = pos.x; walkers.z[walkers.n] = pos.z; walkers.n++; }
      // the cat: a glance down when it is close; turn and wave after a meow
      p.lookYaw = null; p.lookPitch = null;
      if (cat) {
        const dx = cat.x - pos.x, dz = cat.z - pos.z, d = Math.hypot(dx, dz);
        if (d < (sh.react > 0 ? 5 : 1.8) && Math.abs(cat.y - pos.y) < 1) {
          let a = Math.atan2(dx, dz) - p.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
          p.lookYaw = Math.max(-1.1, Math.min(1.1, a)); p.lookPitch = 0.55;
          if (sh.react > 0 && !p.walking) { face(sh, Math.atan2(dx, dz), dt); p.act = 'wave'; }
        }
      }
    }
    crowd.update(dt, time, null);
    sweeper.update(dt, time, cat);
  }

  /** [E] meow from the cat at (x, z): people nearby turn round and wave. */
  function meow(x, z) { for (const sh of S) if (sh.state !== 'HID' && Math.hypot(sh.p.root.position.x - x, sh.p.root.position.z - z) < 5) sh.react = 2.6; }

  return { update, meow, crew: crowd.crew, sweeper, people: S, zones, portals, grid: { type, cost, road, pre, NX, NZ, X0, Z0, C }, findPath,
    stats: () => ({ cells: type.reduce((a, b) => a + (b ? 1 : 0), 0), crossing: type.reduce((a, b) => a + (b > 1 ? 1 : 0), 0), portals: portals.map((q) => q.kind + '@' + Math.round(q.x) + ',' + Math.round(q.z)), out: S.filter((s) => s.state !== 'HID').length, waiting: S.filter((s) => s.state === 'WAIT').length }) };
}
