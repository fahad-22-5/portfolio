/**
 * Things that happen at certain times of day.
 *
 *   08:00-18:00  a flower stall outside the station: sniff the flowers (achoo), or knock a bucket over
 *   11:00-17:00  a busker in the station entrance, guitar case open: sit and listen and he plays one for you
 *   afternoons   someone loses a red balloon (by the bus stop, or in Bute Gardens) and it snags somewhere
 *                high: climb up, grab the string, and bring it back
 *
 * Each starts with a toast and a purple mark on the minimap. The people are one small crew of their own,
 * made before the skinned bodies are handed out (createEventCrew), so they get real bodies like everyone else.
 */
import * as THREE from 'three';
import { createStaff } from '../world/staff.js';

const BUSKER = { x: -36.3, z: -57.0, h: Math.PI / 2 };                    // against the west wall of the station entrance, facing in
const STALL = { x: -45.86, z: -60.14, h: Math.PI };                        // Wheelers' tiered stand outside the station; its front faces south
const ROUTES = [
  { name: 'by the bus stop', from: [86.5, -22.5], to: [82.6, -13.2], away: [88.5, -2.5], snag: [78.9, 2.7, -10.4] },          // stuck on the bus shelter's roof
  { name: 'in Bute Gardens', from: [90.3, -114], to: [90.3, -139.2], away: [90.3, -110], snag: [88.3, 2.5, -141.0] },         // in the top of the tall hedge
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** the event people, made early so the skinned bodies can adopt them */
export function createEventCrew(scene) {
  const crew = createStaff(scene);
  const add = (look, props = []) => crew.add({ manual: true, at: (x, z) => [x, z], yaw: 0, look, props, tasks: [{ to: [0, -400], face: 0, act: 'idle', dur: 999 }] });
  const people = {
    busker: add({ uniform: 0x3b4a5c, trousers: 0x23262b, skin: 0xb07850, hair: 0x2a1c12, sleeves: 'long' }),
    florist: add({ uniform: 0x2f5d3a, apron: 0x6b8f4e, trousers: 0x2a2a2a, skin: 0xf1c8a8, hair: 0x8a5a33, sleeves: 'long' }),
    owner: add({ uniform: 0xd9534f, trousers: 0x34495e, skin: 0xd9a07a, hair: 0x3a2414, sleeves: 'short' }),
  };
  crew.flush();
  for (const p of crew.crew) { p.hidden = true; p.root.position.set(0, -100, 0); }
  return { crew, people };
}

export function createEvents({ ctx, scene, ui, game, tone, noise, daylight, api, cat, eventCrew }) {
  const col = ctx.col, { people } = eventCrew, st = game.state;
  const mat = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const dyn = (o) => { o.traverse((q) => { q.userData.dynamic = true; if (q.isMesh) q.castShadow = true; }); if (ctx.zones) ctx.zones.applyTo(o); return o; };
  const show = (p, on) => { p.hidden = !on; if (!on) { p.root.position.y = -100; p.walking = false; } };
  let clock = 0, lastHour = daylight.hour, day = 0;
  const gy = (x, z) => { const g = col.groundAt(x, z, 1, 0.5); return g > -5 ? g : 0; };

  /* =================== the busker =================== */
  const guitar = new THREE.Group();
  {
    const wood = mat(0x8a4b22, 0.45), dark = mat(0x2a1a10, 0.5), top = mat(0xc98a4b, 0.5);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 20).rotateX(Math.PI / 2), wood); guitar.add(body);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20).rotateX(Math.PI / 2), wood); upper.position.y = 0.22; guitar.add(upper);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.005, 20).rotateX(Math.PI / 2), top); face.position.z = 0.046; guitar.add(face);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), dark); hole.position.set(0, 0.12, 0.05); guitar.add(hole);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.03), dark); neck.position.set(0, 0.56, 0.02); guitar.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.03), dark); head.position.set(0, 0.86, 0.02); guitar.add(head);
  }
  const caseG = new THREE.Group();
  {
    const shell = mat(0x1d1d20, 0.7), lining = mat(0x8c1d2c, 0.9), coin = mat(0xd4a93a, 0.3, 0.8);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 1.05), shell); base.position.y = 0.04; caseG.add(base);
    const felt = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.01, 0.98), lining); felt.position.y = 0.075; caseG.add(felt);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.05), shell); lid.position.set(-0.24, 0.2, 0); lid.rotation.z = 1.2; caseG.add(lid);
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 10), coin); c.position.set((Math.random() - 0.5) * 0.25, 0.082, (Math.random() - 0.5) * 0.7); caseG.add(c); }
  }
  guitar.visible = caseG.visible = false; scene.add(dyn(guitar)); scene.add(dyn(caseG));
  const fx = Math.sin(BUSKER.h), fz = Math.cos(BUSKER.h);
  caseG.position.set(BUSKER.x + fx * 0.85, gy(BUSKER.x + fx * 0.85, BUSKER.z + fz * 0.85), BUSKER.z + fz * 0.85); caseG.rotation.y = BUSKER.h;
  const busker = { on: false, mark: null, note: 0, nextT: 0, bar: 0, listen: false, flourish: 0 };
  // C, G, Am, F: a slow, friendly arpeggio
  const CHORDS = [[130.8, 196, 261.6, 329.6, 392], [98, 146.8, 196, 246.9, 293.7], [110, 164.8, 220, 261.6, 329.6], [87.3, 130.8, 174.6, 220, 261.6]];
  const PATTERN = [0, 2, 3, 4, 3, 2, 1, 2];
  function strum(dt) {
    const d = Math.hypot(api.pos.x - BUSKER.x, api.pos.z - BUSKER.z);
    if (d > 26 || Math.abs(api.pos.y) > 3) return;
    const g = 0.03 * Math.min(1, Math.max(0, 1 - d / 26)) ** 1.5;
    if ((busker.nextT -= dt) > 0) return;
    busker.nextT += busker.flourish > 0 ? 0.13 : 0.27;
    const ch = CHORDS[busker.bar % 4], f = ch[PATTERN[busker.note % 8]] * (busker.flourish > 0 ? 2 : 1);
    tone(f, f * 0.995, 1.1, 'triangle', g); if (busker.note % 4 === 0) tone(ch[0], ch[0], 1.4, 'sine', g * 0.6);
    busker.note++; if (busker.note % 8 === 0) busker.bar++;
    if (busker.flourish > 0) busker.flourish--;
  }
  const buskThing = game.add({ id: 'busker', kind: 'event', x: BUSKER.x + fx * 1.4, y: 0, z: BUSKER.z + fz * 1.4, r: 1.6, dy: 1,
    prompt: () => (busker.on && !busker.listen ? 'Sit and listen' : null),
    use: () => {
      busker.listen = true; api.heading = Math.atan2(BUSKER.x - api.pos.x, BUSKER.z - api.pos.z);
      game.rest({ pose: 'sit', dur: 9, line: 'You sit down by the guitar case and listen.', done: () => {
        busker.listen = false; busker.flourish = 16; ui.say(pick(['"This one\'s for the cat!"', '"A furry fan! Here\'s one for you."']));
        st.energy = Math.min(100, st.energy + 8); game.emit('busker');
      } });
      setTimeout(() => { if (!game.busy) busker.listen = false; }, 9500);
    } });
  function updateBusker(dt, active) {
    const p = people.busker;
    if (active !== busker.on) {
      busker.on = active; show(p, active); guitar.visible = caseG.visible = active;
      if (active) {
        p.root.position.set(BUSKER.x, gy(BUSKER.x, BUSKER.z), BUSKER.z); p.root.rotation.y = BUSKER.h; p.act = 'work'; p.walking = false;
        busker.mark = game.mark({ x: BUSKER.x, z: BUSKER.z, kind: 'event', done: false });
        ui.toast('A busker is playing in the station entrance', 3200);
      } else if (busker.mark) { game.unmark(busker.mark); busker.mark = null; }
    }
    if (!active) return;
    p.act = 'work';
    const y = BUSKER.h, cx = Math.cos(y), sx = Math.sin(y);
    guitar.position.set(BUSKER.x + sx * 0.24 - cx * 0.05, p.root.position.y + 1.0, BUSKER.z + cx * 0.24 + sx * 0.05);   // across his chest
    guitar.rotation.set(0, y, -0.95);
    strum(dt);
  }

  /* =================== the flower stall (Wheelers of Chiswick's tiered stand, staffed 8-18) =================== */
  // STALL: the stand's centre; local +z is out of its front, local x along it. In the day a row of loose buckets
  // stands on the paving in front, and the florist minds the west end.
  const stall = new THREE.Group(); stall.position.set(STALL.x, 0, STALL.z); stall.rotation.y = STALL.h;
  const toWorld = (lx, lz) => { const c = Math.cos(STALL.h), s = Math.sin(STALL.h); return [STALL.x + lx * c + lz * s, STALL.z - lx * s + lz * c]; };
  const buckets = [], BX = [-1.6, -0.8, 0, 0.8, 1.6];
  {
    const zinc = mat(0xb4b9bf, 0.36, 0.7), stem = mat(0x3d7a2e, 0.8), COLS = [0xd7263d, 0xf4d35e, 0xf28aa8, 0xffffff, 0x7b4fa8, 0xf08a3c];
    const bunch = (c) => { const g = new THREE.Group(); for (let i = 0; i < 11; i++) { const a = i * 2.4, r = 0.025 + (i % 3) * 0.035; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), stem); s.position.set(Math.cos(a) * r * 0.6, 0.25, Math.sin(a) * r * 0.6); g.add(s); const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true })); f.position.set(Math.cos(a) * r, 0.5 + (i % 2) * 0.05, Math.sin(a) * r); g.add(f); } return g; };
    BX.forEach((lx, i) => {
      const g = new THREE.Group(); g.position.set(lx, 0, 1.15);
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.36, 16, 1, true), zinc); pail.position.y = 0.18; g.add(pail);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16).rotateX(-Math.PI / 2), zinc); floor.position.y = 0.01; g.add(floor);
      const b = bunch(COLS[(i * 2 + 1) % COLS.length]); b.position.y = 0.08; g.add(b);
      stall.add(g); buckets.push({ g, b, tip: 0, want: 0, lx });
    });
  }
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2228, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0 }));
  scene.add(puddle);
  stall.visible = false; scene.add(dyn(stall)); stall.position.y = gy(STALL.x, STALL.z);
  const front = toWorld(0, 1.6);
  const home = (() => { for (const [lx, lz] of [[3.75, 0.75], [-3.75, 0.75], [2.6, 1.9]]) { const [x, z] = toWorld(lx, lz); if (!col.blocked(x, z, gy(x, z), 0.4)) return [x, z]; } return toWorld(0, 2.2); })();
  const flowers = { on: false, mark: null, mess: null, sniffT: -99 };
  game.add({ id: 'flowers:sniff', kind: 'event', x: front[0], y: 0, z: front[1], r: 1.2, dy: 1,
    prompt: () => (flowers.on && !flowers.mess && clock - flowers.sniffT > 6 ? 'Sniff the flowers' : null),
    use: () => {
      flowers.sniffT = clock; api.heading = STALL.h + Math.PI;
      game.rest({ pose: 'eat', dur: 2.6, done: () => { ui.say('Achoo!'); if (noise) noise(0.18, 0.06, 2600, 0); tone(900, 500, 0.12, 'square', 0.02); game.emit('sniff'); } });
    } });
  buckets.forEach((bk, i) => {
    const [bx, bz] = toWorld(bk.lx, 1.15);
    game.add({ id: 'flowers:knock' + i, kind: 'event', x: bx, y: 0, z: bz, r: 0.6, dy: 1,
      prompt: () => (flowers.on && !flowers.mess && !bk.want ? 'Knock over a bucket' : null),
      use: () => knock(bk, bx, bz) });
  });
  function knock(bk, bx, bz) {
    bk.want = 1; cat.meow(); if (noise) noise(0.35, 0.05, 900, 0); tone(300, 120, 0.2, 'square', 0.03);
    const [px, pz] = toWorld(bk.lx, 1.55); puddle.position.set(px, stall.position.y + 0.006, pz); puddle.material.opacity = 0.55;
    flowers.mess = { bk, t: 0, phase: 'shout' };
    st.rep.Flowers = Math.max(-5, (st.rep.Flowers || 0) - 1);
    game.emit('mischief', 'flowers');
  }
  function stepTo(p, tgt, speed, dt) {
    const q = p.root.position, dx = tgt[0] - q.x, dz = tgt[1] - q.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const s = Math.min(d, speed * dt); q.x += dx / d * s; q.z += dz / d * s; q.y = gy(q.x, q.z); p.root.rotation.y += wrap(Math.atan2(dx, dz) - p.root.rotation.y) * Math.min(1, dt * 8); p.walking = true; return false; }
    p.walking = false; return true;
  }
  function updateFlowers(dt, active) {
    const p = people.florist;
    if (active !== flowers.on) {
      flowers.on = active; show(p, active); stall.visible = active;
      if (active) { p.root.position.set(home[0], gy(home[0], home[1]), home[1]); p.root.rotation.y = STALL.h; p.act = 'idle'; flowers.mark = game.mark({ x: STALL.x, z: STALL.z, kind: 'event', done: false }); ui.toast('Wheelers\' flower stall is open outside the station', 3200); }
      else { if (flowers.mark) game.unmark(flowers.mark); flowers.mark = null; for (const bk of buckets) bk.tip = bk.want = 0; flowers.mess = null; puddle.material.opacity = 0; }
    }
    for (const bk of buckets) { bk.tip += (bk.want - bk.tip) * Math.min(1, dt * 7); bk.g.rotation.x = bk.tip * 1.45; bk.b.position.z = bk.tip * 0.14; }
    if (puddle.material.opacity > 0 && !flowers.mess) puddle.material.opacity = Math.max(0, puddle.material.opacity - dt * 0.01);
    if (!active) return;
    const m = flowers.mess;
    if (!m) { p.act = Math.sin(clock * 0.3) > 0.6 ? 'work' : 'idle'; p.walking = false; p.root.rotation.y += wrap(STALL.h - p.root.rotation.y) * Math.min(1, dt * 3); return; }
    m.t += dt;
    const bw = toWorld(m.bk.lx, 1.7);
    if (m.phase === 'shout' && m.t > 0.5) { ui.say(pick(['"Oi! Those are ten quid a bunch!"', '"Oh, you little—! My tulips!"'])); m.phase = 'come'; m.t = 0; }
    else if (m.phase === 'come') {
      if (stepTo(p, bw, 1.3, dt) || m.t > 8) {
        m.phase = 'tidy'; m.t = 0;
        const q = p.root.position;
        if (Math.hypot(api.pos.x - q.x, api.pos.z - q.z) < 1.8) { ui.say('"Go on, shoo!"'); api.heading = Math.atan2(api.pos.x - q.x, api.pos.z - q.z); api.push(3); }
      }
    } else if (m.phase === 'tidy') {
      p.act = 'work'; p.walking = false; p.root.rotation.y += wrap(STALL.h + Math.PI - p.root.rotation.y) * Math.min(1, dt * 6);
      if (m.t > 2.2) m.bk.want = 0;
      if (m.t > 3.2) { m.phase = 'back'; m.t = 0; }
    } else if (m.phase === 'back') { if (stepTo(p, home, 1.1, dt) || m.t > 10) flowers.mess = null; }
  }

  /* =================== the red balloon =================== */
  const balloon = new THREE.Group();
  {
    const rubber = new THREE.MeshStandardMaterial({ color: 0xd61f2c, roughness: 0.25, metalness: 0.05 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14).scale(1, 1.18, 1), rubber); balloon.add(ball);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.04, 8), rubber); knot.position.y = -0.235; balloon.add(knot);
  }
  const strGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const string = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: 0xf2f2f2 })); string.frustumCulled = false;
  balloon.visible = string.visible = false; scene.add(dyn(balloon)); scene.add(string);
  const B = { state: 'off', route: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), knot: new THREE.Vector3(), t: 0, mark: null, startHour: 14.5 + Math.random() * 1.5, doneToday: false };
  const hand = new THREE.Vector3();
  function ownerHand() { const p = people.owner.root, h = p.rotation.y; return hand.set(p.position.x + Math.cos(h) * -0.24 + Math.sin(h) * 0.12, p.position.y + 1.02, p.position.z - Math.sin(h) * -0.24 + Math.cos(h) * 0.12); }
  const ownerThing = game.add({ id: 'balloon:owner', kind: 'event', x: 0, y: 0, z: -1e4, r: 1.8, dy: 1.2,
    prompt: () => { ownerThing.pri = 0; if (B.state === 'cat') { ownerThing.pri = 1; return 'Give back the balloon'; } return null; },
    use: () => {
      B.state = 'returned'; B.t = 0; ui.say(pick(['"My balloon! Thank you, kitty!"', '"You got it back! Who\'s a clever cat?"']));
      tone(660, 990, 0.3, 'triangle', 0.04); st.energy = Math.min(100, st.energy + 10); game.emit('balloon');
      if (B.mark) { game.unmark(B.mark); B.mark = null; }
    } });
  const grabThing = game.add({ id: 'balloon:grab', kind: 'event', x: 0, y: 0, z: -1e4, r: 1.5, dy: 0.45,
    prompt: () => { grabThing.pri = 1; return B.state === 'snagged' ? 'Grab the balloon string' : null; },
    use: () => { B.state = 'cat'; ui.say('You get the string in your teeth.'); tone(800, 1100, 0.1, 'triangle', 0.03); } });
  const mouth = new THREE.Vector3();
  function walkOwner(tx, tz, dt, speed = 1.1) {
    const p = people.owner, q = p.root.position, dx = tx - q.x, dz = tz - q.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { p.walking = false; return true; }
    const s = Math.min(d, speed * dt); q.x += dx / d * s; q.z += dz / d * s; q.y = gy(q.x, q.z);
    p.root.rotation.y += wrap(Math.atan2(dx, dz) - p.root.rotation.y) * Math.min(1, dt * 8); p.walking = true;
    return false;
  }
  function updateBalloon(dt, hour) {
    const p = people.owner;
    if (B.state === 'off') {
      if (!B.doneToday && hour >= B.startHour && hour < 18.5) {
        B.route = ROUTES[day % ROUTES.length]; B.state = 'arrive'; B.t = 0; B.doneToday = true;
        show(p, true); p.root.position.set(B.route.from[0], gy(B.route.from[0], B.route.from[1]), B.route.from[1]); p.carry = true; p.act = 'idle';
        balloon.visible = string.visible = true;
      } else return;
    }
    B.t += dt;
    const R = B.route, sway = Math.sin(clock * 1.3) * 0.08;
    switch (B.state) {
      case 'arrive':                                            // walking along with it
        ownerHand(); B.knot.copy(hand); B.pos.set(hand.x + sway, hand.y + 1.0, hand.z + Math.cos(clock) * 0.05);
        if (walkOwner(R.to[0], R.to[1], dt)) {                  // and then a gust takes it
          B.state = 'free'; B.t = 0; B.vel.set(0, 0, 0); p.carry = false; p.act = 'browse';
          const near = Math.hypot(api.pos.x - p.root.position.x, api.pos.z - p.root.position.z) < 20;
          if (near) ui.say('"Oh no, my balloon!"'); else ui.toast(`Someone has lost a red balloon ${R.name}`, 3600);
          B.mark = game.mark({ x: R.snag[0], z: R.snag[2], kind: 'event', done: false });
        }
        break;
      case 'free': {                                            // up and over, until the string catches
        const [sx, sy, sz] = R.snag, tx = sx, ty = sy + 1.05, tz = sz;
        B.pos.x += (tx - B.pos.x) * Math.min(1, dt * 0.9); B.pos.z += (tz - B.pos.z) * Math.min(1, dt * 0.9); B.pos.y += (ty + 0.3 - B.pos.y) * Math.min(1, dt * 1.2);
        B.knot.set(B.pos.x - sway, B.pos.y - 1.0, B.pos.z);
        if (B.t > 3.5) { B.state = 'snagged'; B.t = 0; }
        break;
      }
      case 'snagged': {
        const [sx, sy, sz] = R.snag;
        B.knot.set(sx, sy + 0.02, sz); B.pos.set(sx + sway, sy + 1.02 + Math.sin(clock * 2) * 0.03, sz + Math.cos(clock * 1.1) * 0.06);
        grabThing.x = sx; grabThing.y = sy; grabThing.z = sz;
        if (hour > 19) { B.state = 'lost'; B.t = 0; }
        break;
      }
      case 'cat': {                                             // in the cat's mouth, bobbing along overhead
        mouth.set(0, 0.335, 0.47).applyMatrix4(cat.root.matrixWorld);
        B.knot.copy(mouth);
        B.pos.x += (mouth.x - B.pos.x) * Math.min(1, dt * 4); B.pos.z += (mouth.z - B.pos.z) * Math.min(1, dt * 4); B.pos.y += (mouth.y + 0.95 - B.pos.y) * Math.min(1, dt * 5);
        grabThing.z = -1e4;
        break;
      }
      case 'returned': {                                        // back where it belongs; off they go, happy
        ownerHand(); B.knot.copy(hand); B.pos.set(hand.x + sway, hand.y + 1.0, hand.z);
        p.carry = true;
        if (B.t < 2.5) { p.act = 'wave'; p.walking = false; p.root.rotation.y += wrap(Math.atan2(api.pos.x - p.root.position.x, api.pos.z - p.root.position.z) - p.root.rotation.y) * Math.min(1, dt * 5); }
        else if (walkOwner(R.away[0], R.away[1], dt)) end();
        break;
      }
      case 'lost':                                              // evening: the string slips and it sails away
        B.pos.y += dt * 1.6; B.knot.set(B.pos.x, B.pos.y - 1.0, B.pos.z);
        if (B.t > 1) walkOwner(R.away[0], R.away[1], dt);
        if (B.t > 14) end();
        break;
    }
    balloon.position.copy(B.pos); balloon.rotation.z = sway * 0.6;
    const a = strGeo.attributes.position.array; a[0] = B.knot.x; a[1] = B.knot.y; a[2] = B.knot.z; a[3] = B.pos.x; a[4] = B.pos.y - 0.24; a[5] = B.pos.z; strGeo.attributes.position.needsUpdate = true;
    const q = p.root.position; ownerThing.x = q.x; ownerThing.y = 0; ownerThing.z = q.z;
  }
  function end() {
    B.state = 'off'; balloon.visible = string.visible = false; show(people.owner, false); people.owner.carry = false;
    ownerThing.z = grabThing.z = -1e4; if (B.mark) { game.unmark(B.mark); B.mark = null; }
  }

  /* =================== the day =================== */
  function update(dt, time) {
    clock += dt;
    const hour = daylight.hour;
    if (hour < lastHour - 12) { day++; B.doneToday = false; B.startHour = 14.5 + Math.random() * 1.5; }   // a new day
    lastHour = hour;
    updateBusker(dt, hour >= 11 && hour < 17);
    updateFlowers(dt, hour >= 8 && hour < 18);
    updateBalloon(dt, hour);
    eventCrew.crew.update(dt, time, api.pos);
  }

  return {
    update,
    /** for testing: start the balloon now (route 0 or 1) */
    balloonNow(r = 0) { end(); B.doneToday = false; B.startHour = 0; day = r; },
    get balloon() { return B; }, busker, flowers,
  };
}
