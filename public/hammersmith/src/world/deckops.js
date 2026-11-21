/**
 * Hammersmith bus station, working: the deck on the centre's roof.
 *
 * A bus that drives into the arch on the street (cars.js) is handed to the deck. After its run up the ramp it
 * comes out of the ramp head on the deck's north edge, goes round behind the row of stands and forward into the
 * stand for its route. There it kneels, opens its doors, lets people off, takes on the people queuing for its
 * route (each taps a card at the reader by the driver), changes its blind for the trip out, and after a layover
 * pulls out, round the east end and back down the ramp, and out of the arch on to its road.
 *
 * Passengers come up in the lift, walk to the shelter for their route and queue there; people getting off walk
 * back to the lift. They are the same jointed figures and skinned bodies as everyone else.
 *
 * The deck runs its buses itself (they are not on a road route while up here) but draws them through the
 * traffic's own instanced meshes: traffic.write(car) after setting car.matrix and car.lit.
 */
import * as THREE from 'three';
import { BUS, ROUTES } from './bus.js';
import { createStaff } from './staff.js';

const TOPS = [0x1f2a44, 0xb08a5a, 0x1b1b1d, 0x7d8288, 0xa3242c, 0x3f5a3a, 0xe9e6df, 0x3b5f8a, 0x5a3a5a, 0xc96a2a, 0x2a6a6a];
const LEGS = [0x2d3f63, 0x1b1c20, 0xc4b08a, 0x55595f, 0x3a3f4a, 0x22314f];
const SKIN = [0xf1c8a8, 0xd9a07a, 0xb07850, 0x7a4e30, 0x5a3a24, 0xe8b896, 0xc68e64];
const HAIR = [0x111111, 0x2a1c12, 0x5a3a24, 0x8a5a33, 0xc9a26a, 0x9a9a9a];
const TUNNEL_UP = 11, TUNNEL_DOWN = 9;                       // seconds on the ramp, out of sight

export function createDeckOps(ctx, parent, { tone } = {}) {
  const D = ctx.deck, T = ctx.traffic; if (!D || !T) return null;
  const Y = D.roof, col = ctx.col;
  const rnd = Math.random, pick = (a) => a[(rnd() * a.length) | 0];
  const _m = new THREE.Matrix4(), _r = new THREE.Matrix4();

  /* ---------- paths: smooth curves through a few points, sampled every half metre ---------- */
  const path = (pts) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const n = Math.max(2, Math.ceil(curve.getLength() / 0.5)), sp = curve.getSpacedPoints(n), p = sp.map((v) => [v.x, v.z]), cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { p, cum, len: cum[cum.length - 1] };
  };
  const at = (pa, s) => { s = Math.max(0, Math.min(pa.len - 1e-3, s)); let i = 0, lo = 0, hi = pa.p.length - 2; while (lo <= hi) { const m = (lo + hi) >> 1; if (pa.cum[m] <= s) { i = m; lo = m + 1; } else hi = m - 1; } const a = pa.p[i], b = pa.p[i + 1], L = pa.cum[i + 1] - pa.cum[i] || 1, f = (s - pa.cum[i]) / L; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const [ox, oz] = D.mouthOut, [ix, iz] = D.mouthIn;
  for (const st of D.stands) {
    st.bus = null; st.queue = [];
    const last = D.stands[D.stands.length - 1];
    st.pin = path([[ox, D.inside], [ox, oz], [ox, oz + 4.5], st.at(0, -22), st.at(0, -14), st.at(0, -6), st.at(0, 0)]);
    st.pout = path([st.at(0, 0), st.at(0, 6), st.at(0, 11), ...(st === last ? [] : [last.at(0, 11)]), [13.5, -27], [11, -34], [4, -41.5], [ix, iz + 3.5], [ix, iz], [ix, D.inside]]);
  }
  const standFor = (n) => D.stands.find((st) => st.routes.includes(n)) || D.stands[D.stands.length - 1];

  /* ---------- buses on the deck ---------- */
  const buses = [];
  T.onPortal = (car, line) => {
    if (!line || car.kind !== 'bus') return false;
    buses.push({ car, line, stand: standFor(line.n), state: 'UP', t: 0, s: 0, v: 0, x: ox, z: D.inside, fx: 0, fz: 1, kneel: 0, boarded: 0 });
    return true;
  };
  // the deck starts working: a few buses already on their stands
  for (const k of [4, 3, 1]) {
    const st = D.stands[k], n = pick(st.routes), line = { ...findLine(n) }, car = T.take(BUS_TYPE(n)); if (!car) continue;
    const b = { car, line, stand: st, state: 'DWELL', t: 4 + rnd() * 10, s: st.pin.len, v: 0, x: 0, z: 0, fx: 0, fz: 1, kneel: 1, boarded: 0, layover: 25 + rnd() * 35, opened: true };
    [b.x, b.z, b.fx, b.fz] = at(st.pin, st.pin.len); car.ry = Math.atan2(b.fx, b.fz); st.bus = b; buses.push(b);
    car.labels.set(line.n, line.dest, line.op); car.lit = { brake: true, indL: false, indR: false, shut: false, open: true };
  }

  function blocked(b, pa) {                                   // another deck bus on my path within 14 m ahead
    for (let d = b.car.len / 2 + 1; d < b.car.len / 2 + 14; d += 1.5) {
      const [px, pz] = at(pa, b.s + d);
      for (const o of buses) {
        if (o === b || o.state === 'UP' || o.state === 'DOWN' || o.state === 'OUT') continue;
        const ex = px - o.x, ez = pz - o.z, along = Math.abs(ex * o.fx + ez * o.fz), side = Math.abs(ex * o.fz - ez * o.fx);
        if (along < o.car.len / 2 + 1 && side < o.car.wid / 2 + 1.4) return d - b.car.len / 2 - 1.5;
      }
    }
    return 99;
  }
  function drive(b, pa, dt, stopAtEnd) {
    const left = pa.len - b.s, gap = Math.min(blocked(b, pa), stopAtEnd ? left - 0.05 : 99);
    const want = gap < 0.5 ? 0 : Math.min(4.5, Math.sqrt(2 * 1.1 * gap));
    b.v += Math.max(-3 * dt, Math.min(1.2 * dt, want - b.v)); if (b.v < 0) b.v = 0;
    b.s = Math.min(pa.len, b.s + b.v * dt);
    if (stopAtEnd && pa.len - b.s < 0.6 && b.v < 0.6) { b.s = pa.len; b.v = 0; }   // close enough: on the mark
    [b.x, b.z, b.fx, b.fz] = at(pa, b.s);
    let turn = Math.atan2(b.fx, b.fz) - b.car.ry; turn = Math.atan2(Math.sin(turn), Math.cos(turn)); b.car.ry += turn * Math.min(1, dt * 4);
    const [, , ax, az] = at(pa, b.s + 9); let ah = Math.atan2(ax, az) - Math.atan2(b.fx, b.fz); ah = Math.atan2(Math.sin(ah), Math.cos(ah)); b.turn = Math.abs(ah) > 0.4 ? Math.sign(ah) : 0;
  }
  function pose(b) {
    const car = b.car;
    _m.makeRotationY(car.ry).multiply(_r.makeRotationZ(-0.03 * b.kneel)); _m.setPosition(b.x, Y + 0.03 - 0.09 * b.kneel, b.z);
    car.matrix.copy(_m); T.write(car);
  }
  const near = (x, z, r) => { const c = ctx.catPos; return c && Math.abs(c.y - Y) < 3 && (c.x - x) ** 2 + (c.z - z) ** 2 < r * r; };

  function updateBuses(dt, t) {
    for (let i = buses.length - 1; i >= 0; i--) {
      const b = buses[i], st = b.stand, car = b.car, lit = car.lit || (car.lit = { brake: false, indL: false, indR: false, shut: true, open: false });
      b.t += dt;
      const blink = (t * 1.5) % 1 < 0.55;
      if (b.state === 'UP') {                                   // on the ramp: comes out when its stand is free and the mouth is clear
        if (b.t > TUNNEL_UP && !st.bus && !buses.some((o) => o !== b && o.state === 'IN' && o.s < 18)) { st.bus = b; b.state = 'IN'; b.s = 0; b.t = 0; b.v = 2.5; [b.x, b.z, b.fx, b.fz] = at(st.pin, 0); car.ry = Math.atan2(b.fx, b.fz); car.labels.set(b.line.n, 'Hammersmith', b.line.op); }
        continue;
      }
      if (b.state === 'IN') {
        drive(b, st.pin, dt, true);
        if (b.s >= st.pin.len - 0.06 && b.v < 0.05) { b.state = 'DWELL'; b.t = 0; b.layover = 20 + rnd() * 40; b.boarded = 0; b.opened = false; }
      } else if (b.state === 'DWELL') {
        b.kneel = Math.min(1, b.t / 1.2);
        if (b.t > 1.4 && !b.opened) {                         // doors open; the blind goes over to the trip out; people get off
          b.opened = true; lit.shut = false; lit.open = true; car.labels.set(b.line.n, b.line.dest, b.line.op);
          if (tone && near(b.x, b.z, 25)) { tone(880, 660, 0.22, 'sine', 0.035); tone(300, 120, 0.6, 'sawtooth', 0.012); }
          alight(b, 1 + ((rnd() * 3) | 0));
        }
        b.boarding = b.opened && b.t > 5;
        const waiting = st.queue.some((q) => q.route === b.line.n && (q.state === 'WAIT' || q.state === 'BOARD' || q.state === 'TAP'));
        if (b.opened && b.t > 5 + b.layover && !waiting && !b.closing) { b.closing = b.t; lit.shut = true; lit.open = false; if (tone && near(b.x, b.z, 25)) tone(660, 880, 0.18, 'sine', 0.03); }
        if (b.closing) { b.kneel = Math.max(0, 1 - (b.t - b.closing) / 1.2); if (b.t - b.closing > 2.4) { b.state = 'OUT'; b.t = 0; b.s = 0; b.v = 0; b.boarding = false; b.closing = 0; } }
      } else if (b.state === 'OUT') {
        drive(b, st.pout, dt, true);
        if (st.bus === b && b.s > 16) st.bus = null;          // the stand is free once it has pulled clear
        if (b.s >= st.pout.len - 0.1) { b.state = 'DOWN'; b.t = 0; T.hide(car); if (st.bus === b) st.bus = null; continue; }
      } else if (b.state === 'DOWN') {                          // back down the ramp and out of the arch on to its road
        if (b.t > TUNNEL_DOWN && T.depart(car, b.line)) buses.splice(i, 1);
        continue;
      }
      lit.brake = b.v < 0.35;
      const pulling = b.state === 'OUT' && b.t < 3;
      lit.indL = blink && b.turn > 0 && !pulling; lit.indR = blink && (b.turn < 0 || pulling);
      pose(b);
    }
  }

  /* ---------- passengers ---------- */
  const crew = createStaff(parent), people = [];
  for (let i = 0; i < 18; i++) {
    const p = crew.add({ manual: true, at: (a, b) => [a, b], yaw: 0, tasks: [{ to: [0, 0], act: 'idle', dur: 1 }], props: ['phone', 'bag'],
      look: { uniform: pick(TOPS), trousers: pick(LEGS), skin: pick(SKIN), hair: pick(HAIR), sleeves: 'long', apron: null } });
    p.root.position.set(0, -60, 0); p.hidden = true;
    people.push({ p, id: i, state: 'HID', t: 0, delay: rnd() * 6, path: [], pi: 0, stand: null, route: null, speed: 1.15 + rnd() * 0.35, after: null });
  }
  crew.flush();
  const [lx0, lz0] = D.lift, LIFT = [lx0, lz0 - 3.2], W = [8, 5];
  const doorZ = (type) => (type === 'dd' ? (BUS.dd.fa + 0.75 + BUS.dd.L / 2 - 0.25) / 2 : (BUS.sd.fa + 0.8 + BUS.sd.L / 2 - 0.25) / 2);
  const hidePerson = (q) => { q.state = 'HID'; q.t = 0; q.delay = 6 + rnd() * 20; q.p.hidden = true; q.p.walking = false; q.p.root.position.y = -60; if (q.stand) { const k = q.stand.queue.indexOf(q); if (k >= 0) q.stand.queue.splice(k, 1); } q.stand = null; };
  function alight(b, n) {
    const st = b.stand;
    for (const q of people) {
      if (n <= 0) break; if (q.state !== 'HID') continue; n--;
      const [x, z] = st.at(1.9, 0.25); q.p.hidden = false; q.p.root.position.set(x, Y, z); q.state = 'WALK'; q.stand = null; q.t = 0;
      q.path = [st.at(2.7, 0.25), st.at(2.6, 7.8), W, LIFT]; q.pi = 0; q.after = 'LEAVE';
      q.p.held.bag.visible = rnd() < 0.3; q.p.carry = q.p.held.bag.visible;
    }
  }
  function slotOf(q) { return q.stand.queue.filter((o) => o.state === 'WAIT' || o.state === 'TOQ').indexOf(q); }
  function updatePeople(dt) {
    // someone new comes up in the lift every few seconds, for a route that leaves from the deck
    for (const q of people) {
      q.t += dt;
      const p = q.p, pos = p.root.position;
      if (q.state === 'HID') {
        if (q.t > q.delay && people.filter((o) => o.state !== 'HID').length < 14) {
          const st = rnd() < 0.35 ? D.stands[D.stands.length - 1] : pick(D.stands); if (st.queue.length >= 6) { q.t = 0; continue; }
          q.stand = st; q.route = pick(st.routes); st.queue.push(q); q.p.hidden = false; pos.set(LIFT[0], Y, LIFT[1]);
          q.state = 'TOQ'; q.path = [W, st.at(2.6, 7.8)]; q.pi = 0; q.after = 'QUEUE';
          p.held.phone.visible = false; p.held.bag.visible = rnd() < 0.3; p.carry = p.held.bag.visible;
        }
        continue;
      }
      if (q.state === 'WALK' || q.state === 'TOQ') {
        if (q.pi >= q.path.length) {
          if (q.after === 'LEAVE') { hidePerson(q); continue; }
          q.state = 'WAIT'; q.t = 0;
        } else if (glide(q, q.path[q.pi][0], q.path[q.pi][1], dt, q.speed)) q.pi++;
      }
      if (q.state === 'WAIT') {                                  // in the queue: shuffle up to my place, face the stand, look at the phone
        const k = Math.max(0, slotOf(q)), [x, z] = q.stand.at(2.55, 3.4 - 0.85 * k);
        if (glide(q, x, z, dt, 0.8)) { face(q, Math.atan2(-D.lat[0], -D.lat[1]), dt); p.act = q.t % 12 < 7 ? 'phone' : 'idle'; p.held.phone.visible = p.act === 'phone'; }
        const b = q.stand.bus;
        if (b && b.boarding && b.line.n === q.route && !q.stand.queue.some((o) => o.state === 'BOARD' || o.state === 'TAP') && q.stand.queue.filter((o) => o.state === 'WAIT' && o.route === q.route)[0] === q) { q.state = 'BOARD'; q.t = 0; p.held.phone.visible = false; }
      } else if (q.state === 'BOARD') {                          // to the front door
        const b = q.stand.bus; if (!b) { q.state = 'WAIT'; continue; }
        const [x, z] = q.stand.at(1.75, doorZ(b.car.btype));
        if (glide(q, x, z, dt, q.speed)) { q.state = 'TAP'; q.t = 0; }
      } else if (q.state === 'TAP') {                            // the card on the reader by the driver: beep
        face(q, Math.atan2(-D.lat[0], -D.lat[1]), dt); p.act = 'tap';
        if (q.t > 0.5 && !q.beeped) { q.beeped = true; if (tone && near(pos.x, pos.z, 12)) tone(1480, 1480, 0.1, 'square', 0.03); }
        if (q.t > 1.2) { q.beeped = false; const b = q.stand.bus; if (b) b.boarded++; hidePerson(q); }
      }
      const g = col.groundAt(pos.x, pos.z, Y + 0.5, 0.6); if (g > Y - 0.5) pos.y += (g - pos.y) * Math.min(1, dt * 10);
    }
    crew.update(dt, 0, null);
  }
  function glide(q, x, z, dt, speed) {
    const pos = q.p.root.position, dx = x - pos.x, dz = z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { q.p.walking = false; return true; }
    const v = Math.min(d, speed * dt); pos.x += dx / d * v; pos.z += dz / d * v;
    q.p.walking = d > 0.1; q.p.pace = speed / 1.05; q.p.act = 'idle';
    if (d > 0.15) face(q, Math.atan2(dx, dz), dt);
    return false;
  }
  function face(q, target, dt) { const r = q.p.root.rotation; let a = target - r.y; a = Math.atan2(Math.sin(a), Math.cos(a)); r.y += a * Math.min(1, dt * 6); }

  function update(dt, t) { updateBuses(dt, t); updatePeople(dt); }
  /** A bus on its stand with its doors open, with the cat at one of them (for "Hop on"). */
  function boardable(p) {
    if (Math.abs(p.y - Y) > 1.2) return null;
    for (const b of buses) {
      if (b.state !== 'DWELL' || !b.opened || b.closing) continue;
      for (const z of [doorZ(b.car.btype), 0.25]) { const [x, zz] = b.stand.at(1.75, z); if ((p.x - x) ** 2 + (p.z - zz) ** 2 < 4.4) return b; }
    }
    return null;
  }
  const ops = { update, buses, people, crew: crew.crew, boardable, board(b) { b.rider = true; b.layover = Math.min(b.layover, Math.max(0, b.t - 5) + 6); } };   // with the cat aboard it leaves soon
  ctx.deckOps = ops;
  return ops;
}

function findLine(n) { return ROUTES.find((e) => e.n === n) || { n, dest: 'Hammersmith', op: 'RATP', type: 'dd', road: 'Hammersmith Rd' }; }
function BUS_TYPE(n) { return findLine(n).type; }
