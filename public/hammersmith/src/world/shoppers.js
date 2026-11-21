/**
 * Live mall simulation: autonomous shoppers and commuters.
 *
 * Each shopper is a jointed figure (same rig and instanced parts as the shop
 * staff, in 'manual' mode) driven by a behaviour state machine:
 *
 *   WALK_TO_STORE -> QUEUE_AND_ORDER -> WAIT_FOR_ORDER -> PICKUP_ITEM
 *     -> FIND_SEAT_OR_CHAT -> CONSUME_OR_WORK -> EXIT_OR_ROAM
 *
 * Routines: cafe + laptop (order, wait, collect a cup, sit, type and sip), dining in pairs
 * (trays/bags, sit across a table, eat and chat), aisle shopping (basket, browse shelves,
 * pay at the checkout), and commuters crossing between exits, the footbridge and the Tube.
 *
 * Navigation: a 0.5 m grid of standable cells built from the collision index (furniture
 * included), A* with octile heuristic on pre-allocated typed arrays, line-of-sight smoothing,
 * and light separation steering. Seats and order points come from the shop builders (sim.js).
 * The per-frame update allocates nothing.
 */
import * as THREE from 'three';
import { SIM } from './sim.js';
import { ENV_BOX, ENVELOPE, OPEN, isMallFloor, inFootbridge, inPoly, FOOTBRIDGE, fbWorld, hallX, hallZ } from './plan2024.js';
import { createStaff } from './staff.js';

const TOPS = [0x1f2a44, 0xb08a5a, 0x1b1b1d, 0x7d8288, 0xa3242c, 0x3f5a3a, 0xe9e6df, 0x3b5f8a, 0x5a3a5a, 0xc96a2a, 0x2a6a6a, 0x8a8f6a];
const LEGS = [0x2d3f63, 0x1b1c20, 0xc4b08a, 0x55595f, 0x3a3f4a, 0x22314f];
const SKIN = [0xf1c8a8, 0xd9a07a, 0xb07850, 0x7a4e30, 0x5a3a24, 0xe8b896, 0xc68e64];
const HAIR = [0x111111, 0x2a1c12, 0x5a3a24, 0x8a5a33, 0xc9a26a, 0x3a2414, 0x9a9a9a, 0x6a2a1a];

export function createShoppers(ctx, parent, { count = 22 } = {}) {
  const { col } = ctx;

  /* ---------- navigation grid ---------- */
  const C = 0.5, X0 = ENV_BOX.minX - 2, Z0 = ENV_BOX.minZ - 2;
  const fbEnd = fbWorld(FOOTBRIDGE.length + 4, 0);
  const NX = Math.ceil((Math.max(ENV_BOX.maxX, fbEnd[0]) + 2 - X0) / C), NZ = Math.ceil((ENV_BOX.maxZ + 2 - Z0) / C), N = NX * NZ;
  const walk = new Uint8Array(N);
  const free = (x, z) => !col.blocked(x, z, 0, 0.4);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C;
    if (!(isMallFloor(x, z) || inFootbridge(x, z))) continue;
    if (free(x, z) && free(x + 0.28, z) && free(x - 0.28, z) && free(x, z + 0.28) && free(x, z - 0.28)) walk[i + j * NX] = 1;
  }
  const cellOf = (x, z) => { const i = Math.floor((x - X0) / C), j = Math.floor((z - Z0) / C); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : i + j * NX; };
  // keep only the biggest connected area (the mall itself), so every target is reachable
  {
    const comp = new Int32Array(N), stack = new Int32Array(N); let best = 0, bestId = 0, id = 0;
    for (let k0 = 0; k0 < N; k0++) {
      if (!walk[k0] || comp[k0]) continue;
      id++; let sp = 0, size = 0; stack[sp++] = k0; comp[k0] = id;
      while (sp) { const k = stack[--sp]; size++; const i = k % NX;
        for (const n of [k - 1, k + 1, k - NX, k + NX]) { if (n < 0 || n >= N || !walk[n] || comp[n]) continue; if ((n === k - 1 && i === 0) || (n === k + 1 && i === NX - 1)) continue; comp[n] = id; stack[sp++] = n; } }
      if (size > best) { best = size; bestId = id; }
    }
    for (let k = 0; k < N; k++) if (comp[k] !== bestId) walk[k] = 0;
  }
  const isWalk = (x, z) => { const k = cellOf(x, z); return k >= 0 && walk[k] === 1; };
  const out2 = [0, 0];
  /** nearest standable cell centre to (x, z), written into out2; false if none within ~4 m */
  function nearest(x, z) {
    const k = cellOf(x, z); if (k >= 0 && walk[k]) { out2[0] = X0 + ((k % NX) + 0.5) * C; out2[1] = Z0 + (Math.floor(k / NX) + 0.5) * C; return true; }
    const i0 = Math.floor((x - X0) / C), j0 = Math.floor((z - Z0) / C);
    let best = 1e9;
    for (let r = 1; r <= 8; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= NX || j >= NZ || !walk[i + j * NX]) continue;
        const cx = X0 + (i + 0.5) * C, cz = Z0 + (j + 0.5) * C, d = (cx - x) ** 2 + (cz - z) ** 2;
        if (d < best) { best = d; out2[0] = cx; out2[1] = cz; }
      }
      if (best < 1e9) return true;
    }
    return false;
  }

  // A* on pre-allocated arrays (generation stamps instead of clearing)
  const g = new Float32Array(N), from = new Int32Array(N), seen = new Uint32Array(N), shut = new Uint32Array(N);
  const heap = new Int32Array(N), hf = new Float32Array(N); let hn = 0, gen = 0;
  const push = (k, f) => { let i = hn++; heap[i] = k; hf[i] = f; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; const tk = heap[p], tf = hf[p]; heap[p] = heap[i]; hf[p] = hf[i]; heap[i] = tk; hf[i] = tf; i = p; } };
  const pop = () => { const top = heap[0]; hn--; if (hn > 0) { heap[0] = heap[hn]; hf[0] = hf[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && hf[l] < hf[m]) m = l; if (r < hn && hf[r] < hf[m]) m = r; if (m === i) break; const tk = heap[m], tf = hf[m]; heap[m] = heap[i]; hf[m] = hf[i]; heap[i] = tk; hf[i] = tf; i = m; } } return top; };
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DC = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];
  const raw = new Int32Array(4096);
  /** Path from (sx,sz) to (tx,tz) into buf as x,z pairs (smoothed); returns the point count, 0 if unreachable. */
  function findPath(sx, sz, tx, tz, buf) {
    if (!nearest(sx, sz)) return 0; const s = cellOf(out2[0], out2[1]);
    if (!nearest(tx, tz)) return 0; const t = cellOf(out2[0], out2[1]);
    gen++; hn = 0; g[s] = 0; seen[s] = gen; from[s] = -1;
    const ti = t % NX, tj = Math.floor(t / NX);
    const h = (k) => { const dx = Math.abs((k % NX) - ti), dz = Math.abs(Math.floor(k / NX) - tj); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
    push(s, h(s)); let found = false, iter = 0;
    while (hn > 0 && iter++ < 40000) {
      const k = pop(); if (shut[k] === gen) continue; shut[k] = gen;
      if (k === t) { found = true; break; }
      const i = k % NX, j = Math.floor(k / NX);
      for (let d = 0; d < 8; d++) {
        const ni = i + DI[d], nj = j + DJ[d]; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
        const n = ni + nj * NX; if (!walk[n] || shut[n] === gen) continue;
        if (d >= 4 && (!walk[i + DI[d] + j * NX] || !walk[i + (j + DJ[d]) * NX])) continue;   // no corner cutting
        const ng = g[k] + DC[d];
        if (seen[n] !== gen || ng < g[n]) { seen[n] = gen; g[n] = ng; from[n] = k; push(n, ng + h(n)); }
      }
    }
    if (!found) return 0;
    let m = 0; for (let k = t; k !== -1 && m < raw.length; k = from[k]) raw[m++] = k;
    // string-pull: keep only the cells where line of sight breaks
    let n = 0, a = m - 1;
    const cx = (k) => X0 + ((k % NX) + 0.5) * C, cz = (k) => Z0 + (Math.floor(k / NX) + 0.5) * C;
    while (a > 0 && n < buf.length / 2 - 1) {
      let b = a - 1;
      while (b > 0 && sight(cx(raw[a]), cz(raw[a]), cx(raw[b - 1]), cz(raw[b - 1]))) b--;
      buf[n * 2] = cx(raw[b]); buf[n * 2 + 1] = cz(raw[b]); n++; a = b;
    }
    // finish exactly on the requested spot when it is standable, else on its nearest cell
    const fx = isWalk(tx, tz) ? tx : cx(raw[0]), fz = isWalk(tx, tz) ? tz : cz(raw[0]);
    if (n > 0) { buf[(n - 1) * 2] = fx; buf[(n - 1) * 2 + 1] = fz; } else { buf[0] = fx; buf[1] = fz; n = 1; }
    return n;
  }
  function sight(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), steps = Math.ceil(d / 0.25);
    for (let i = 1; i < steps; i++) { const t = i / steps; if (!isWalk(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }

  /* ---------- entry/exit points ---------- */
  const gates = [];
  ENVELOPE.forEach((a, i) => { if (!OPEN[i]) return; const b = ENVELOPE[(i + 1) % ENVELOPE.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let nx = (b[1] - a[1]), nz = -(b[0] - a[0]); const l = Math.hypot(nx, nz); nx /= l; nz /= l; if (!inPoly(mx + nx, mz + nz, ENVELOPE)) { nx = -nx; nz = -nz; } if (nearest(mx + nx * 2.5, mz + nz * 2.5)) gates.push([out2[0], out2[1]]); });
  for (const [x, z] of [fbWorld(FOOTBRIDGE.length - 2, 0), [hallX(13.2, 5), hallZ(13.2, 5)]]) if (nearest(x, z)) gates.push([out2[0], out2[1]]);

  /* ---------- places and seats ---------- */
  const places = SIM.places.filter((p) => nearest(p.x, p.z));
  for (const p of places) { nearest(p.x, p.z); p.ax = out2[0]; p.az = out2[1]; }
  const orders = places.filter((p) => p.kind === 'order');
  const cafes = orders.filter((p) => p.type === 'cafe'), foods = orders.filter((p) => p.type === 'food' || p.type === 'pub');
  const browseBy = new Map(); for (const p of places) if (p.kind === 'browse') { if (!browseBy.has(p.shop)) browseBy.set(p.shop, []); browseBy.get(p.shop).push(p); }
  const checkout = new Map(); for (const p of places) if (p.kind === 'checkout') checkout.set(p.shop, p);
  const groceryShops = [...browseBy.keys()].filter((s) => checkout.has(s));
  const seats = SIM.seats.filter((s) => nearest(s.x, s.z) && Math.hypot(out2[0] - s.x, out2[1] - s.z) < 1.6);
  for (const s of seats) { nearest(s.x, s.z); s.ax = out2[0]; s.az = out2[1]; }
  const benchSeats = SIM.benches.filter((s) => nearest(s.ax, s.az) && Math.hypot(out2[0] - s.ax, out2[1] - s.az) < 1.2);   // places on the concourse benches
  for (const s of benchSeats) { nearest(s.ax, s.az); s.ax = out2[0]; s.az = out2[1]; }
  const tables = new Map(); for (const s of seats) { const k = s.tx.toFixed(1) + ',' + s.tz.toFixed(1); if (!tables.has(k)) tables.set(k, []); tables.get(k).push(s); }

  /* ---------- laptops (pool) ---------- */
  const laptops = [];
  {
    const base = new THREE.MeshStandardMaterial({ color: 0x9ea3a8, metalness: 0.85, roughness: 0.3 });
    const screen = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.95, 1.4), toneMapped: false });
    for (let i = 0; i < 10; i++) {
      const L = new THREE.Group(); L.visible = false; L.userData.dynamic = true; parent.add(L);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.22), base); b.position.y = 0.008; L.add(b);
      const lid = new THREE.Group(); lid.position.set(0, 0.015, -0.11); lid.rotation.x = -1.85; L.add(lid);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.21, 0.008), base); back.position.y = 0.105; lid.add(back);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.18), screen); sc.position.set(0, 0.105, 0.0045); lid.add(sc);
      laptops.push(L);
    }
  }
  const takeLaptop = () => { for (const L of laptops) if (!L.visible) { L.visible = true; return L; } return null; };

  /* ---------- the crowd ---------- */
  const crowd = createStaff(parent);
  let seed = 1337; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const S = [];
  for (let i = 0; i < count; i++) {
    const [x, z] = gates.length ? pick(gates) : [0, 0];
    const p = crowd.add({ manual: true, at: (lx, lz) => [lx, lz], yaw: 0, tasks: [{ to: [x, z], act: 'idle', dur: 1 }], props: ['cup', 'pretbag', 'bag', 'tray', 'shopbasket', 'phone'],
      look: { uniform: pick(TOPS), trousers: pick(LEGS), skin: pick(SKIN), hair: pick(HAIR), sleeves: rnd() < 0.7 ? 'long' : 'short', apron: null } });
    S.push({ p, id: i, state: 'SPAWN', timer: -i * 0.05, entered: false, path: new Float32Array(512), pn: 0, pi: 0, next: '', tx: 0, tz: 0, th: 0, routine: '', place: null, seat: null, partner: null, leader: null, laptop: null, browse: 0, react: 0, speed: 1.1 + rnd() * 0.3, repath: 0, cycle: 0, dest: null });
  }
  crowd.flush();
  // dining partners: every fifth shopper is paired with the next one
  for (let i = 0; i + 1 < S.length; i += 5) { S[i].partner = S[i + 1]; S[i + 1].leader = S[i]; }

  /* ---------- behaviour ---------- */
  let budget = 0;                                                       // A* searches allowed this frame
  function goTo(sh, x, z, heading, next) {
    if (budget <= 0) { sh.state = 'PATH_WAIT'; sh.tx = x; sh.tz = z; sh.th = heading; sh.next = next; return; }
    budget--;
    sh.pn = findPath(sh.p.root.position.x, sh.p.root.position.z, x, z, sh.path); sh.pi = 0;
    sh.tx = x; sh.tz = z; sh.th = heading; sh.next = next;
    sh.state = sh.pn ? 'WALK' : (next === 'GONE' ? 'GONE' : 'EXIT_OR_ROAM');
  }
  const setProp = (sh, name) => { for (const k in sh.p.held) sh.p.held[k].visible = k === name; sh.p.carry = !!name && name !== 'phone' && name !== 'shopbasket'; };
  const leaveQueue = (sh) => { if (!sh.place) return; const q = sh.place.queue; for (let i = 0; i < q.length; i++) if (q[i] === sh) { for (let j = i; j < q.length - 1; j++) q[j] = q[j + 1]; q.length--; break; } };
  const slot = (sh) => { const q = sh.place.queue; let i = 0; while (i < q.length && q[i] !== sh) i++; return i; };
  function freeTable(near, pair) {
    let best = null, bd = 1e9;
    for (const list of tables.values()) {
      let freeN = 0; for (const s of list) if (!s.taken) freeN++;
      if (freeN < (pair ? 2 : 1) || (pair && list.length < 2)) continue;
      const d = Math.hypot(list[0].tx - near.x, list[0].tz - near.z) + (list[0].shop === near.shop ? -8 : 0);
      if (d < bd && d < 45) { bd = d; best = list; }
    }
    return best;
  }

  function choose(sh) {
    const r = rnd();
    if (sh.leader) { sh.routine = 'follow'; sh.state = 'FOLLOW'; return; }
    if (sh.partner || (r < 0.28 && foods.length)) { sh.routine = 'dine'; sh.place = pick(foods); }
    else if (r < 0.58 && cafes.length) { sh.routine = 'cafe'; sh.place = pick(cafes); }
    else if (r < 0.8 && groceryShops.length) { sh.routine = 'shop'; sh.dest = pick(groceryShops); sh.browse = 2 + Math.floor(rnd() * 3); sh.place = null; setProp(sh, 'shopbasket'); }
    else if (r < 0.92 && benchSeats.some((s) => !s.taken)) {            // a sit-down on one of the round benches
      const free = benchSeats.filter((s) => !s.taken), s = pick(free);
      sh.routine = 'rest'; sh.place = null; setProp(sh, null); s.taken = sh; sh.seat = s; goTo(sh, s.ax, s.az, s.heading, 'SIT'); return;
    }
    else { sh.routine = 'commute'; sh.place = null; setProp(sh, rnd() < 0.5 ? 'phone' : null); }
    if (sh.routine === 'cafe' || sh.routine === 'dine') { setProp(sh, null); sh.place.queue.push(sh); const k = slot(sh); goTo(sh, sh.place.ax + sh.place.out[0] * 0.95 * k, sh.place.az + sh.place.out[1] * 0.95 * k, sh.place.heading, 'QUEUE_AND_ORDER'); }
    else if (sh.routine === 'shop') { const b = pick(browseBy.get(sh.dest)); goTo(sh, b.ax, b.az, b.heading, 'BROWSE'); }
    else { const gt = pick(gates); goTo(sh, gt[0], gt[1], 0, 'GONE'); }
  }

  function arrive(sh) {
    const st = sh.next; sh.state = st; sh.timer = 0; sh.p.walking = false; sh.mt = 0; sh.lastSlot = -1;
    if (st === 'GONE') { sh.timer = 1 + rnd() * 4; sh.p.hidden = true; }      // out of the door: not drawn until they come back in
  }

  /* ---------- per-frame ---------- */
  const tmpA = { x: 0, z: 0 };
  function update(dt, time, cat) {
    budget = 2;
    for (let i = 0; i < S.length; i++) {
      const sh = S[i], p = sh.p, pos = p.root.position;
      sh.timer += dt; sh.react = Math.max(0, sh.react - dt);
      switch (sh.state) {
        case 'SPAWN': if (sh.timer > 0) {
          // the first wave starts already inside, scattered near the shops; later arrivals come in through the doors
          const gt = gates.length ? gates[(sh.id * 7) % gates.length] : [0, 0]; pos.set(gt[0], 0, gt[1]);
          if (!sh.entered && places.length) { const pl = places[Math.floor(rnd() * places.length)]; if (nearest(pl.ax + (rnd() - 0.5) * 8, pl.az + (rnd() - 0.5) * 8)) pos.set(out2[0], 0, out2[1]); }
          if (sh.leader) { const L = sh.leader.p.root.position; if (nearest(L.x + 0.8, L.z)) pos.set(out2[0], 0, out2[1]); }
          sh.entered = true; choose(sh);
        } break;
        case 'PATH_WAIT': goTo(sh, sh.tx, sh.tz, sh.th, sh.next); break;
        case 'WALK': step(sh, dt, cat); break;
        case 'QUEUE_AND_ORDER': {
          const k = slot(sh); if (k !== sh.lastSlot) { sh.lastSlot = k; sh.mt = 0; }
          const qx = sh.place.ax + sh.place.out[0] * 0.95 * k, qz = sh.place.az + sh.place.out[1] * 0.95 * k;
          if (!reach(sh, qx, qz, dt)) { p.act = 'idle'; sh.timer = 0; }
          else { face(sh, sh.place.heading, dt); p.act = k === 0 ? 'tap' : 'idle'; if (k === 0 && sh.timer > 3.2) { leaveQueue(sh); sh.state = 'WAIT_FOR_ORDER'; sh.timer = 0; sh.mt = 0; sh.wait = 5 + rnd() * 3; } }
          break;
        }
        case 'WAIT_FOR_ORDER': {
          const sx = sh.place.ax - sh.place.out[1] * 1.3, sz = sh.place.az + sh.place.out[0] * 1.3;
          if (reach(sh, sx, sz, dt)) { face(sh, sh.place.heading, dt); p.act = 'phone'; setProp(sh, 'phone'); }
          if (sh.timer > sh.wait) { sh.state = 'PICKUP_ITEM'; sh.timer = 0; sh.mt = 0; setProp(sh, null); }
          break;
        }
        case 'PICKUP_ITEM': {
          const sx = sh.place.ax - sh.place.out[1] * 0.55, sz = sh.place.az + sh.place.out[0] * 0.55;
          if (!reach(sh, sx, sz, dt)) sh.timer = 0;
          else { face(sh, sh.place.heading, dt); p.act = 'handover';
            if (sh.timer > 1.3) { setProp(sh, sh.routine === 'cafe' ? (sh.place.shop === 'Pret A Manger' ? 'pretbag' : 'cup') : (sh.place.shop === "McDonald's" ? 'tray' : 'bag')); sh.state = 'FIND_SEAT_OR_CHAT'; sh.timer = 0; } }
          break;
        }
        case 'FIND_SEAT_OR_CHAT': {
          const pair = !!(sh.partner && sh.partner.routine === 'follow' && !sh.partner.seat);
          const t = freeTable(sh.place || pos, pair);
          if (t) {
            const a = t.find((s) => !s.taken); a.taken = sh; sh.seat = a;
            if (pair) { const b = t.find((s) => !s.taken); if (b) { b.taken = sh.partner; sh.partner.seat = b; sh.partner.state = 'TO_SEAT'; } }
            goTo(sh, a.ax, a.az, a.heading, 'SIT');
          } else { sh.state = 'CHAT_STAND'; sh.timer = 0; sh.dur = 12 + rnd() * 10; }
          break;
        }
        case 'CHAT_STAND': p.walking = false; p.act = sh.routine === 'cafe' ? 'sip' : 'chat'; if (sh.timer > sh.dur) sh.state = 'EXIT_OR_ROAM'; break;
        case 'SIT': {                                                   // slide from the approach cell onto the seat
          const s = sh.seat; glideRaw(sh, s.x, s.z, dt, 1.2);
          if (Math.hypot(s.x - pos.x, s.z - pos.z) < 0.05) {
            p.seated = true; p.bench = !!s.bench; p.seatH = s.h; p.walking = false; p.root.rotation.y = s.heading;
            if (p.held.tray.visible || p.held.bag.visible || p.held.pretbag.visible) setProp(sh, null);   // set the food down
            if (sh.routine === 'cafe') setProp(sh, 'cup');                                                // coffee in hand to sip
            if (sh.routine === 'cafe' && sh.id % 5 !== 4 && s.h < 0.6) { const L = takeLaptop(); if (L) { sh.laptop = L; const k = 0.38; L.position.set(s.x + Math.sin(s.heading) * k, 0.765, s.z + Math.cos(s.heading) * k); L.rotation.y = s.heading + Math.PI; } }
            sh.state = 'CONSUME_OR_WORK'; sh.timer = 0; sh.dur = 35 + rnd() * 40; sh.cycle = 0;
          }
          break;
        }
        case 'CONSUME_OR_WORK': {
          const c = sh.timer % (sh.laptop ? 11 : 8);
          if (sh.routine === 'rest') { p.act = c < 4.5 ? 'idle' : 'phone'; p.held.phone.visible = c >= 4.5; }
          else if (sh.laptop) p.act = c < 7.5 ? 'type' : 'sip';
          else if (sh.routine === 'cafe') p.act = c < 4 ? 'sip' : 'phone';
          else p.act = (sh.partner || sh.leader) && c > 4.5 ? 'chat' : 'eat';
          if (sh.timer > sh.dur && !(sh.leader && sh.leader.state === 'CONSUME_OR_WORK')) stand(sh);
          break;
        }
        case 'BROWSE': {
          p.act = 'browse'; face(sh, sh.th, dt);
          if (sh.timer > 4 + (sh.id % 3)) {
            if (--sh.browse > 0) { const b = pick(browseBy.get(sh.dest)); goTo(sh, b.ax, b.az, b.heading, 'BROWSE'); }
            else { sh.place = checkout.get(sh.dest); sh.place.queue.push(sh); const k = slot(sh); goTo(sh, sh.place.ax + sh.place.out[0] * 0.9 * k, sh.place.az + sh.place.out[1] * 0.9 * k, sh.place.heading, 'CHECKOUT'); }
          }
          break;
        }
        case 'CHECKOUT': {
          const k = slot(sh); if (k !== sh.lastSlot) { sh.lastSlot = k; sh.mt = 0; }
          const qx = sh.place.ax + sh.place.out[0] * 0.9 * k, qz = sh.place.az + sh.place.out[1] * 0.9 * k;
          if (!reach(sh, qx, qz, dt)) sh.timer = 0;
          else { face(sh, sh.place.heading, dt); p.act = k === 0 ? 'tap' : 'idle'; if (k === 0 && sh.timer > 3.5) { leaveQueue(sh); setProp(sh, 'bag'); sh.state = 'EXIT_OR_ROAM'; } }
          break;
        }
        case 'FOLLOW': {                                               // a dining partner: stays by the leader, chatting
          const L = sh.leader;
          if (!L || L.routine !== 'dine') { sh.state = 'EXIT_OR_ROAM'; break; }
          const ox = L.p.root.position.x + Math.cos(L.p.root.rotation.y) * 0.75, oz = L.p.root.position.z - Math.sin(L.p.root.rotation.y) * 0.75;
          const d = Math.hypot(ox - pos.x, oz - pos.z);
          if (d > 6 && (sh.repath -= dt) < 0) { sh.repath = 1.5; if (nearest(ox, oz)) { goTo(sh, out2[0], out2[1], 0, 'FOLLOW'); } }
          else if (d > 0.3 && isWalk(ox, oz)) { glide(sh, ox, oz, dt); }
          else { p.walking = false; p.act = 'chat'; face(sh, Math.atan2(L.p.root.position.x - pos.x, L.p.root.position.z - pos.z), dt); }
          break;
        }
        case 'TO_SEAT': goTo(sh, sh.seat.ax, sh.seat.az, sh.seat.heading, 'SIT'); setProp(sh, 'bag'); sh.routine = 'dine'; break;
        case 'EXIT_OR_ROAM': { p.seated = false; const gt = pick(gates); goTo(sh, gt[0], gt[1], 0, 'GONE'); if (sh.state === 'EXIT_OR_ROAM') { sh.state = 'GONE'; sh.timer = 0; p.hidden = true; } break; }   // unreachable: just leave
        case 'GONE': if (sh.timer > 2) { setProp(sh, null); sh.place = null; if (sh.leader) { sh.state = 'FOLLOW'; sh.routine = 'follow'; break; } const gt = pick(gates); pos.set(gt[0], 0, gt[1]); p.hidden = false; choose(sh); } break;
      }

      // cat awareness: glance down at a cat close by; turn and wave after a meow
      p.lookYaw = null; p.lookPitch = null;
      if (cat) {
        const dx = cat.x - pos.x, dz = cat.z - pos.z, d = Math.hypot(dx, dz);
        if (d < (sh.react > 0 ? 5 : 1.8) && Math.abs(cat.y) < 1) {
          let a = Math.atan2(dx, dz) - p.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
          p.lookYaw = Math.max(-1.1, Math.min(1.1, a)); p.lookPitch = 0.55;
          if (sh.react > 0 && !p.seated && !p.walking) { face(sh, Math.atan2(dx, dz), dt); p.act = 'wave'; }
        }
      }
    }
    crowd.update(dt, time, null);
  }

  function stand(sh) {
    const p = sh.p; p.seated = false; p.bench = false;
    if (sh.seat) { sh.seat.taken = null; p.root.position.set(sh.seat.ax, 0, sh.seat.az); sh.seat = null; }
    if (sh.laptop) { sh.laptop.visible = false; sh.laptop = null; }
    setProp(sh, null);
    sh.state = 'EXIT_OR_ROAM';
  }

  function step(sh, dt, cat) {
    const p = sh.p, pos = p.root.position;
    if (sh.pi >= sh.pn) { arrive(sh); return; }
    const tx = sh.path[sh.pi * 2], tz = sh.path[sh.pi * 2 + 1];
    let dx = tx - pos.x, dz = tz - pos.z; const d = Math.hypot(dx, dz);
    if (d < (sh.pi === sh.pn - 1 ? 0.08 : 0.3)) { sh.pi++; if (sh.pi >= sh.pn) arrive(sh); return; }
    dx /= d; dz /= d;
    // separation from other people and from the cat
    let sx = 0, sz = 0;
    for (let j = 0; j < S.length; j++) { const o = S[j].p.root.position; if (S[j] === sh) continue; const ox = pos.x - o.x, oz = pos.z - o.z, od = ox * ox + oz * oz; if (od < 0.42 && od > 1e-4) { const k = (0.65 - Math.sqrt(od)) / 0.65; sx += ox * k * 2; sz += oz * k * 2; } }
    if (cat && Math.abs(cat.y) < 1) { const ox = pos.x - cat.x, oz = pos.z - cat.z, od = ox * ox + oz * oz; if (od < 0.5 && od > 1e-4) { sx += ox * 2.5; sz += oz * 2.5; } }
    let vx = dx + sx, vz = dz + sz; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    const v = Math.min(d, sh.speed * dt);
    let nx = pos.x + vx * v, nz = pos.z + vz * v;
    if (!isWalk(nx, nz) && sh.pi < sh.pn - 1) { nx = pos.x + dx * v; nz = pos.z + dz * v; }
    pos.x = nx; pos.z = nz;
    p.walking = true; p.pace = sh.speed / 1.05; p.act = 'idle';
    face(sh, Math.atan2(vx, vz), dt * 1.4);
  }
  /** Move towards (x, z); true once there, or after ~3.5 s of trying (blocked spot): never stuck. */
  function reach(sh, x, z, dt) {
    const pos = sh.p.root.position;
    if (Math.hypot(x - pos.x, z - pos.z) <= 0.12) { sh.mt = 0; sh.p.walking = false; return true; }
    sh.mt = (sh.mt || 0) + dt;
    if (sh.mt > 3.5) { sh.p.walking = false; return true; }
    if (isWalk(x, z)) glideRaw(sh, x, z, dt, sh.speed * 0.8); else sh.p.walking = false;
    return false;
  }
  /** short direct moves (queue shuffles, stepping aside) without pathing */
  function glide(sh, x, z, dt) { if (!isWalk(x, z)) { sh.p.walking = false; return; } glideRaw(sh, x, z, dt, sh.speed * 0.8); }
  function glideRaw(sh, x, z, dt, speed) {
    const pos = sh.p.root.position, dx = x - pos.x, dz = z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.01) { sh.p.walking = false; return; }
    const v = Math.min(d, speed * dt); pos.x += dx / d * v; pos.z += dz / d * v;
    sh.p.walking = d > 0.06; sh.p.pace = 0.7;
    if (d > 0.1) face(sh, Math.atan2(dx, dz), dt);
  }
  function face(sh, target, dt) { let a = target - sh.p.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); sh.p.root.rotation.y += a * Math.min(1, dt * 6); }

  /** [E] meow from the cat at (x, z): people nearby turn round and wave. */
  function meow(x, z) { for (const sh of S) if (Math.hypot(sh.p.root.position.x - x, sh.p.root.position.z - z) < 5) sh.react = 2.6; }

  void tmpA;
  return { update, meow, shoppers: S, crowd, stats: () => ({ cells: walk.reduce((a, b) => a + b, 0), gates: gates.length, orders: orders.length, seats: seats.length, tables: tables.size, grocery: groceryShops.length }) };
}
