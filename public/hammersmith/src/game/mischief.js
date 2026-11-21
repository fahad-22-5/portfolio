/**
 * Mischief: the things a cat does that staff notice.
 *
 *   Greggs     sneak a sausage roll off the counter. Wait for the moment nobody behind the counter is
 *              looking (they turn away when they walk between stations); if you are seen, one of them
 *              comes after you, and a walk won't outrun them: trot.
 *   Tesco      knock something off a shelf. A few packets tumble into the aisle and someone comes over
 *              to tidy up, with a word for you if you are still standing there.
 *   McDonald's beg a chip from someone eating. Cat people give you one, others ignore you or shoo you;
 *              beg too much and a member of staff walks you out, and won't have it for a while.
 *
 * Staff remember: every time you are caught a shop thinks a little less of you (game.state.rep, saved
 * with the game), and at a shop that is fed up with you the staff grumble as soon as you walk in. It
 * wears off with time.
 *
 * Staff are borrowed from the shop's crew: taken over (manual), walked about, then handed back to walk
 * to their station and carry on. Everything goes through the game's interaction registry.
 */
import * as THREE from 'three';
import { SIM } from '../world/sim.js';
import { UNITS } from '../world/plan2024.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createMischief({ ctx, scene, ui, cat, game, api, staff, diners, tone }) {
  const st = game.state; st.rep = st.rep || {};
  const col = ctx.col, v3 = new THREE.Vector3();
  let clock = 0;

  /* ---------- the staff: who works where, borrowing and handing back ---------- */
  const inside = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
  const crewOf = (name) => { const u = UNITS.find((q) => q.name === name); if (!u) return []; const inPoly = staff.filter((p) => inside(u.poly, p.tasks[0].x, p.tasks[0].z)), B = u.box; return inPoly.length ? inPoly : staff.filter((p) => p.tasks[0].x > B.minX && p.tasks[0].x < B.maxX && p.tasks[0].z > B.minZ && p.tasks[0].z < B.maxZ); };   // the staff who work in that unit (its fit-out can spill past the plan's outline: then its bounding box)
  const busy = new Set();
  function borrow(p) { returning.delete(p); busy.add(p); p.manual = true; p.walking = false; p.seated = false; p.act = 'idle'; p.carry = false; if (p.prop) p.prop.visible = false; }
  const returning = new Map();                                // staff walking back to their station: p -> seconds
  function sendBack(p) { p.act = 'idle'; p.lookYaw = null; p._route = null; returning.set(p, 0); }
  function giveBack(p) { busy.delete(p); p._route = null; p.manual = false; p.walking = false; p.lookYaw = null; p.phase = 'walk'; p.t = 0; }
  /** walk p towards (x, z) at speed, sliding along counters and walls; returns the distance left */
  function walkTo(p, x, z, speed, dt, stopAt = 0.05) {
    const q = p.root.position, dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
    if (d <= stopAt) { p.walking = false; return d; }
    const s = Math.min(d - stopAt, speed * dt), ux = dx / d, uz = dz / d;
    const free = (nx, nz) => !col.blocked(nx, nz, 0, 0.3);
    if (free(q.x + ux * s, q.z + uz * s)) { q.x += ux * s; q.z += uz * s; }
    else if (Math.abs(ux) > 0.2 && free(q.x + Math.sign(ux) * s, q.z)) q.x += Math.sign(ux) * s;
    else if (Math.abs(uz) > 0.2 && free(q.x, q.z + Math.sign(uz) * s)) q.z += Math.sign(uz) * s;
    else { q.x += ux * s * 0.35; q.z += uz * s * 0.35; }     // squeeze past (the counter flap)
    p.root.rotation.y += angle(Math.atan2(dx, dz) - p.root.rotation.y) * Math.min(1, dt * 9);
    p.walking = true; p.pace = speed / 1.05;
    return d;
  }
  /** a route for p to (x, z) round counters and shelves: a breadth-first search on a 0.3 m grid around both */
  const CELL = 0.3, free0 = (x, z) => !col.blocked(x, z, 0, 0.3);
  function route(p, x, z) {
    const q = p.root.position, x0 = Math.min(q.x, x) - 5, z0 = Math.min(q.z, z) - 5;
    const nx = Math.min(90, Math.ceil((Math.abs(q.x - x) + 10) / CELL)), nz = Math.min(90, Math.ceil((Math.abs(q.z - z) + 10) / CELL));
    const cell = (cx, cz) => cz * nx + cx, from = new Int32Array(nx * nz).fill(-1), ok = new Int8Array(nx * nz).fill(-1);
    const isFree = (i) => { if (ok[i] < 0) ok[i] = free0(x0 + (i % nx + 0.5) * CELL, z0 + (Math.floor(i / nx) + 0.5) * CELL) ? 1 : 0; return ok[i] === 1; };
    const clampC = (v, n) => Math.max(0, Math.min(n - 1, v));
    const s0 = cell(clampC(Math.floor((q.x - x0) / CELL), nx), clampC(Math.floor((q.z - z0) / CELL), nz)), goal = cell(clampC(Math.floor((x - x0) / CELL), nx), clampC(Math.floor((z - z0) / CELL), nz));
    const queue = [s0]; from[s0] = s0;
    for (let h = 0; h < queue.length && from[goal] < 0; h++) {
      const i = queue[h], cx = i % nx, cz = Math.floor(i / nx);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ax = cx + dx, az = cz + dz; if (ax < 0 || az < 0 || ax >= nx || az >= nz) continue;
        const j = cell(ax, az); if (from[j] >= 0 || !isFree(j)) continue;
        if (dx && dz && (!isFree(cell(cx + dx, cz)) || !isFree(cell(cx, cz + dz)))) continue;   // no cutting corners
        from[j] = i; queue.push(j);
      }
    }
    if (from[goal] < 0) return null;
    const pts = []; for (let i = goal; i !== s0; i = from[i]) pts.push([x0 + (i % nx + 0.5) * CELL, z0 + (Math.floor(i / nx) + 0.5) * CELL]);
    return pts.reverse();
  }
  /** walk p towards (x, z) along a route, re-planned every half second; returns the straight distance left */
  function hunt(p, x, z, speed, dt, stopAt) {
    const q = p.root.position, d = Math.hypot(x - q.x, z - q.z);
    if ((p._rt = (p._rt || 0) - dt) < 0 || !p._route) { p._rt = 0.5; p._route = route(p, x, z); }
    const r = p._route;
    while (r && r.length > 1 && Math.hypot(r[0][0] - q.x, r[0][1] - q.z) < 0.2) r.shift();
    if (!r || r.length <= 1 || d < 1.2) return walkTo(p, x, z, speed, dt, stopAt);
    walkTo(p, r[0][0], r[0][1], speed, dt, 0);
    return d;
  }
  function face(p, x, z, dt) { const q = p.root.position; p.root.rotation.y += angle(Math.atan2(x - q.x, z - q.z) - p.root.rotation.y) * Math.min(1, dt * 6); }
  const dist = (p, x, z) => Math.hypot(p.root.position.x - x, p.root.position.z - z);
  /** is p looking at the cat? (within 4.5 m, facing it within 60 degrees) */
  function watching(p) {
    const q = p.root.position, dx = api.pos.x - q.x, dz = api.pos.z - q.z;
    return Math.hypot(dx, dz) < 4.5 && Math.abs(angle(Math.atan2(dx, dz) - p.root.rotation.y)) < 1.05;
  }
  /** shove the cat away from (x, z) */
  function shove(x, z, v = 3) { api.heading = Math.atan2(api.pos.x - x, api.pos.z - z); api.push(v); }
  function caught(shop) { st.rep[shop] = Math.max(-5, (st.rep[shop] || 0) - 1); }

  /* ---------- small things: a sausage roll, a chip, packets off a shelf ---------- */
  const lambert = (c, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const roll = new THREE.Group(); roll.userData.dynamic = true;
  {
    const pastry = lambert(0xd9a04e, 0.55), flake = lambert(0xe8c27a, 0.6), meat = lambert(0x9a5a3a, 0.7);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.13, 10).rotateZ(Math.PI / 2), pastry); roll.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.03), flake); top.position.y = 0.026; roll.add(top);
    for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(0.02, 10), meat); end.position.x = sx * 0.0655; end.rotation.y = sx * Math.PI / 2; roll.add(end); }
  }
  roll.visible = false; scene.add(roll);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.011, 0.011), lambert(0xf2c84b, 0.5)); chip.userData.dynamic = true; chip.visible = false; scene.add(chip);
  if (ctx.zones) { ctx.zones.applyTo(roll); ctx.zones.applyTo(chip); }
  let carrying = false, eating = null, given = null;           // given: the roll you gave away, being eaten by someone else                         // eating: { mesh, t, dur, s0 }
  const mouth = new THREE.Vector3(0, 0.335, 0.47);             // in the cat's root frame: just under the nose
  function inMouth() { roll.position.copy(v3.copy(mouth).applyMatrix4(cat.root.matrixWorld)); roll.rotation.set(0, api.heading, 0); }
  function eatOff(mesh, amount, dur, line) {
    const h = api.heading; mesh.position.set(api.pos.x + Math.sin(h) * 0.3, api.pos.y + (mesh === roll ? 0.03 : 0.008), api.pos.z + Math.cos(h) * 0.3); mesh.rotation.set(0, h + Math.PI / 2, 0); mesh.scale.setScalar(1); mesh.visible = true;
    game.eat({ amount, dur, line });
    eating = { mesh, t: 0, dur };
  }

  const packets = [];
  {
    const cols = [0xe23d3d, 0x2f7fd0, 0xf2c230, 0x3fa34d, 0xffffff, 0xf08a3c, 0x7a3fb0];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12 + (i % 2) * 0.04, 0.2 - (i % 3) * 0.04, 0.08), lambert(cols[i % cols.length], 0.45));
      m.castShadow = true; m.userData.dynamic = true; m.visible = false; scene.add(m); if (ctx.zones) ctx.zones.applyTo(m);
      packets.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), rest: false });
    }
  }

  /* ---------- Greggs: the sausage roll ---------- */
  const greggsAt = SIM.places.find((p) => p.kind === 'order' && /greggs/i.test(p.shop));
  const greggsCrew = greggsAt ? crewOf(greggsAt.shop) : [];
  let chase = null, stealT = -99;                             // chase: { p, t }
  if (greggsAt) {
    const g = greggsAt, looking = () => greggsCrew.some((p) => !busy.has(p) && watching(p));
    game.add({ id: 'steal:Greggs', kind: 'mischief', x: g.x, y: 0, z: g.z, r: 1.5,
      prompt: () => (carrying || chase || eating || clock - stealT < 20 ? null : `Sneak a sausage roll · ${looking() ? 'they\'re watching' : 'nobody\'s looking'}`),
      use: () => {
        api.heading = g.heading; stealT = clock; carrying = true; roll.visible = true; inMouth();
        tone(900, 1300, 0.08, 'square', 0.025);
        const seen = Math.random() < (looking() ? 0.85 : 0.12) || (st.rep.Greggs || 0) <= -3;
        const p = greggsCrew.filter((q) => !busy.has(q)).sort((a, b) => dist(a, g.x, g.z) - dist(b, g.x, g.z))[0];
        if (seen && p) {
          borrow(p); chase = { p, t: 0, said: false }; caught('Greggs');
          ui.say('"Oi! That cat\'s got a sausage roll!"'); tone(520, 380, 0.25, 'sawtooth', 0.04);
        } else ui.say('Nobody saw a thing.');
      } });
  }
  // the roll you are carrying: eat it (once nobody is after you)
  const eatRoll = game.add({ id: 'eat:roll', kind: 'mischief', x: 0, y: 0, z: 0, r: 0.5, dy: 2,
    prompt: () => (carrying && !chase ? 'Eat the sausage roll' : null),
    use: () => { carrying = false; eatOff(roll, 30, 5, 'Flaky pastry, warm sausage. Worth it.'); game.emit('roll'); } });

  function updateChase(dt) {
    const c = chase, p = c.p, cx = api.pos.x, cz = api.pos.z;
    c.t += dt;
    const d = c.t < 0.9 ? (face(p, cx, cz, dt), p.walking = false, dist(p, cx, cz)) : hunt(p, cx, cz, 2.7, dt, 0.55);   // a moment to react, then after you
    p.lookYaw = 0;
    if (d < 0.75 && carrying) {                                // caught: the roll goes back
      carrying = false; roll.visible = false; ui.say('"I\'ll have that back, thank you!"'); tone(300, 200, 0.2, 'square', 0.04);
      shove(p.root.position.x, p.root.position.z, 3.2); c.done = 'caught'; c.t2 = 0;
    } else if (!c.done && (d > 12 || c.t > 14)) { ui.say(pick(['"…Unbelievable."', '"Every single day."', '"That cat!"'])); c.done = 'lost'; c.t2 = 0; game.emit('mischief', 'greggs'); }
    if (c.done) { c.t2 += dt; p.walking = false; face(p, cx, cz, dt); if (c.t2 > 1.2) { sendBack(p); chase = null; } }
  }

  /* ---------- Tesco: off the shelf ---------- */
  const shelves = SIM.places.filter((p) => p.kind === 'browse' && /tesco/i.test(p.shop));
  const tescoCrew = shelves.length ? crewOf(shelves[0].shop) : [];
  let mess = null, knockT = -99;                              // mess: { x, z, p, t, phase }
  shelves.forEach((s, i) => game.add({ id: 'knock:' + i, kind: 'mischief', x: s.x, y: 0, z: s.z, r: 0.9,
    prompt: () => (mess || clock - knockT < 25 ? null : 'Knock something off the shelf'),
    use: () => knock(s) }));
  function knock(s) {
    knockT = clock; api.heading = s.heading; cat.meow();
    const fx = Math.sin(s.heading), fz = Math.cos(s.heading), n = 3 + Math.floor(Math.random() * 2);
    packets.forEach((k, i) => {
      k.m.visible = i < n; k.rest = false; if (i >= n) return;
      const lat = (i - (n - 1) / 2) * 0.17;
      k.m.position.set(s.x + fx * 0.55 + fz * lat, 0.95 + Math.random() * 0.5, s.z + fz * 0.55 - fx * lat);
      k.m.rotation.set(0, s.heading + Math.random(), 0);
      k.v.set(-fx * (0.8 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.8, -fz * (0.8 + Math.random() * 0.9) + (Math.random() - 0.5) * 0.6);
      k.w.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 14);
    });
    tone(240, 120, 0.12, 'square', 0.04); setTimeout(() => tone(180, 90, 0.1, 'square', 0.035), 260); setTimeout(() => tone(210, 110, 0.09, 'square', 0.03), 470);
    caught('TESCO'); game.emit('mischief', 'tesco');
    const p = tescoCrew.filter((q) => !busy.has(q)).sort((a, b) => dist(a, s.x, s.z) - dist(b, s.x, s.z))[0];
    mess = { x: s.x, z: s.z, s, p: null, cand: p, t: 0, phase: 'fall' };
  }
  function updateMess(dt) {
    const m = mess; m.t += dt;
    for (const k of packets) {                                 // a little physics: fall, bounce, tumble, lie still
      if (!k.m.visible || k.rest) continue;
      k.v.y -= 9.8 * dt; k.m.position.addScaledVector(k.v, dt);
      k.m.rotation.x += k.w.x * dt; k.m.rotation.y += k.w.y * dt; k.m.rotation.z += k.w.z * dt;
      if (k.m.position.y < 0.05) {
        k.m.position.y = 0.05; k.v.y *= -0.3; k.v.x *= 0.5; k.v.z *= 0.5; k.w.multiplyScalar(0.4);
        if (Math.abs(k.v.y) < 0.4) { k.rest = true; k.m.rotation.x = Math.round(k.m.rotation.x / (Math.PI / 2)) * Math.PI / 2 + Math.PI / 2; k.m.rotation.z = 0; k.m.position.y = 0.045; }
      }
    }
    if (m.phase === 'fall' && m.t > 1.4) {
      if (m.cand && !busy.has(m.cand)) { m.p = m.cand; borrow(m.p); m.phase = 'come'; ui.say(pick(['"What was that?"', '"Oh, not again…"'])); }
      else m.phase = 'wait';
    }
    if (m.phase === 'wait' && m.t > 12) { packets.forEach((k) => { k.m.visible = false; }); mess = null; return; }
    const p = m.p; if (!p) return;
    const sx = m.s.x - Math.sin(m.s.heading) * 0.2, sz = m.s.z - Math.cos(m.s.heading) * 0.2;
    if (m.phase === 'come') {
      if (hunt(p, sx, sz, 1.5, dt, 0.35) <= 0.36 || m.t > 16) {
        m.phase = 'tidy'; m.t2 = 0;
        const near = Math.hypot(api.pos.x - sx, api.pos.z - sz) < 1.8;
        ui.say(near ? '"Was that you? Go on, out of the aisle!"' : pick(['"Honestly, that cat…"', '"Who keeps doing this?"']));
        if (near) shove(sx, sz, 2.6);
      }
    } else if (m.phase === 'tidy') {
      m.t2 += dt; p.walking = false; p.act = 'restock'; face(p, m.s.x + Math.sin(m.s.heading), m.s.z + Math.cos(m.s.heading), dt);
      const left = packets.filter((k) => k.m.visible);
      if (left.length && m.t2 > 1.2 * (packets.length - left.length + 1)) left[0].m.visible = false;
      if (!left.length && m.t2 > 1.0) { sendBack(p); mess = null; }
    }
  }

  /* ---------- McDonald's: begging for chips ---------- */
  const heat = [];                                            // times of recent begging
  let banUntil = -1, escort = null;                            // escort: { p, t, phase }
  const begged = {};
  const mcd = crewOf("McDonald's");
  const beg = game.add({ id: 'beg', kind: 'mischief', x: 0, y: 0, z: -1e4, r: 1.1, dy: 1.2, who: null,
    prompt: () => (beg.who && clock > banUntil && !escort && !eating && !(begged[beg.who.id] > clock) ? 'Beg for a chip' : null),
    use: () => {
      const sh = beg.who, key = 's' + sh.id, d = game.disposition(key), q = sh.p.root.position;
      api.heading = Math.atan2(q.x - api.pos.x, q.z - api.pos.z); cat.meow(); tone(760, 520, 0.28, 'triangle', 0.03);
      begged[sh.id] = clock + 25; heat.push(clock);
      if (d === 'loves') { sh.react = 2.6; ui.say(pick(['"Go on then, just the one."', '"Aww, here you go."', '"Don\'t tell anyone."'])); eatOff(chip, 5, 2.2, null); game.emit('chip'); }
      else if (d === 'ignores') ui.say('They pretend not to see you.');
      else { ui.say(pick(['"Shoo! Not my chips!"', '"Get away, go on!"'])); shove(q.x, q.z, 2.4); }
      while (heat.length && clock - heat[0] > 90) heat.shift();
      if (heat.length >= 3) throwOut();
    } });
  /** too much begging: one of the crew comes out from behind the counter and sees you out */
  function throwOut() {
    game.emit('mischief', 'mcd');
    const p = mcd.filter((x) => !busy.has(x)).sort((a, b) => dist(a, api.pos.x, api.pos.z) - dist(b, api.pos.x, api.pos.z))[0];
    heat.length = 0; banUntil = clock + 60; caught("McDonald's");
    if (p) { borrow(p); escort = { p, t: 0, phase: 'come' }; setTimeout(() => ui.say('"Right, that\'s enough begging!"'), 900); }
  }
  function nearestDiner() {
    beg.who = null; beg.z = -1e4;
    let bd = 1.1 * 1.1;
    for (const sh of diners) {
      if (sh.state !== 'CONSUME_OR_WORK' || !sh.seat || sh.seat.shop !== "McDonald's") continue;
      const q = sh.p.root.position, d = (q.x - api.pos.x) ** 2 + (q.z - api.pos.z) ** 2;
      if (d < bd) { bd = d; beg.who = sh; beg.x = q.x; beg.y = 0; beg.z = q.z; }
    }
  }
  function updateEscort(dt) {
    const e = escort, p = e.p; e.t += dt;
    if (e.phase === 'come') {
      if (hunt(p, api.pos.x, api.pos.z, 1.6, dt, 0.9) < 1.0 || e.t > 10) {
        e.phase = 'tell'; e.t2 = 0; ui.say('"Out you go. No begging in here."'); shove(p.root.position.x, p.root.position.z, 3.4);
      }
    } else { e.t2 += dt; p.walking = false; p.act = e.t2 < 1.6 ? 'wave' : 'idle'; face(p, api.pos.x, api.pos.z, dt); if (e.t2 > 2.4) { sendBack(p); escort = null; } }
  }

  /* ---------- staff who are fed up with you ---------- */
  const mcdAt = SIM.places.find((p) => p.kind === 'order' && p.shop === "McDonald's");
  const GRUMBLE = [
    greggsAt && { shop: 'Greggs', x: greggsAt.x, z: greggsAt.z, lines: ['"Not you again. Go on, shoo."', '"I\'m watching you, cat."'] },
    shelves.length && { shop: 'TESCO', x: shelves[0].x, z: shelves[0].z, lines: ['"Keep an eye on that one."', '"Don\'t even think about it."'] },
    mcdAt && { shop: "McDonald's", x: mcdAt.x, z: mcdAt.z, lines: ['"You\'re not begging in here again."', '"Oh no. It\'s the chip cat."'] },
  ].filter(Boolean);
  const grumbled = {};

  function update(dt) {
    clock += dt;
    for (const [p, t] of returning) {
      const tk = p.tasks[p.i]; returning.set(p, t + dt);
      if (hunt(p, tk.x, tk.z, 1.1, dt, 0.05) < 0.1 || t > 15) { returning.delete(p); giveBack(p); }
    }
    if (chase) updateChase(dt);
    if (mess) updateMess(dt);
    if (escort) updateEscort(dt);
    if (carrying) { inMouth(); eatRoll.x = api.pos.x; eatRoll.y = api.pos.y; eatRoll.z = api.pos.z; }
    if (given) { given.t += dt; roll.scale.set(Math.max(0.05, 1 - Math.max(0, given.t - 0.8) / given.dur), 1, 1); if (given.t > given.dur + 0.6) { roll.visible = false; roll.scale.setScalar(1); given = null; } }
    if (eating) {                                              // the food on the floor gets smaller as it goes
      eating.t += dt; const k = Math.max(0.05, 1 - Math.max(0, eating.t - 1.2) / Math.max(0.5, eating.dur - 1.4));
      eating.mesh.scale.set(k, 1, 1);
      if (!game.busy || eating.t > eating.dur + 0.5) { eating.mesh.visible = false; eating.mesh.scale.setScalar(1); eating = null; }
    }
    nearestDiner();
    for (const g of GRUMBLE) {                                 // a shop that is fed up with you says so when you walk in
      if ((st.rep[g.shop] || 0) > -2 || (grumbled[g.shop] || -99) > clock - 40) continue;
      if (Math.hypot(api.pos.x - g.x, api.pos.z - g.z) < 3.5 && Math.abs(api.pos.y) < 1) { grumbled[g.shop] = clock; ui.say(pick(g.lines)); }
    }
    for (const k in st.rep) if (st.rep[k] < 0) { st.rep[k] = Math.min(0, st.rep[k] + dt / 240); if (st.rep[k] > -0.01) delete st.rep[k]; }   // shops forgive, slowly (half a point every two minutes)
  }

  /** hand the roll over (to the stray): it goes down at (x, y, z) and is eaten over dur seconds */
  function giveRoll(x, y, z, h, dur = 5) {
    if (!carrying) return false;
    carrying = false; roll.position.set(x, y + 0.03, z); roll.rotation.set(0, h + Math.PI / 2, 0); roll.scale.setScalar(1); roll.visible = true;
    given = { t: 0, dur }; return true;
  }
  return { update, giveRoll, get debug() { return { escort: escort && { phase: escort.phase, t: escort.t }, mess: mess && mess.phase, chase: chase && chase.t, returning: returning.size, banUntil, clock, heat: heat.length }; }, throwOut, get carrying() { return carrying; }, get chasing() { return !!chase; }, crews: { greggs: greggsCrew, tesco: tescoCrew, mcd } };
}
