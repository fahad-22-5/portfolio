/**
 * The rival: a scruffy tuxedo tom with a torn ear who runs Bute Gardens.
 *
 * He patrols the street (both pavements and the quiet road between), sits on parked cars, washes, and
 * now and then stalks the pigeons in the road. Come close and he stops and watches you; closer, and he
 * arches up and hisses. Stand your ground with E ("Stare him down"): hold still for three seconds and
 * either he blinks first and slinks off, or he sees you off. Win three and he respects you: no more
 * hissing. Then touch noses and he is your friend; or skip all that and bring him a sausage roll.
 *
 * A friend comes over to say hello, will walk with you for a while ("Walk together"), and curls up
 * next to you if you nap nearby. What he thinks of you is saved with the game (game.state.stray).
 *
 * api: the player cat { pos, heading, speed, get busy, get riding, push(v) }
 */
import * as THREE from 'three';
import { createCat } from '../cat.js';

const HOME = { x0: 89.4, x1: 101.8, z0: -186, z1: -114 };      // Bute Gardens, kerb to kerb
const NAME = 'Smudge';
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createStray({ ctx, scene, ui, tone, noise, game, api, pigeons, mischief }) {
  const col = ctx.col, st = game.state;
  st.stray = st.stray || { respect: 0, friend: false };
  const R = st.stray;

  const cat = createCat({ fur: 0x1b1b1e, dark: 0x111113, cream: 0xefede6, eye: 0xe2b43c, coat: [0x1e1e21, 0x131315, 0xefede6], sheen: 0x9a9aa8, size: 0.71, nick: true });
  cat.root.traverse((o) => { o.userData.dynamic = true; });
  scene.add(cat.root);
  if (ctx.zones) ctx.zones.applyTo(cat.root);

  const s = { x: 95, y: 0, z: -150, h: 0, v: 0, st: 'IDLE', t: 0, dur: 3, tx: 0, tz: 0, air: null, said: -99, follow: 0, stuck: 0, lastHiss: -99, stare: null, perch: null };
  let clock = 0;
  const pos = new THREE.Vector3();
  const ground = (x, z, y = s.y) => { const g = col.groundAt(x, z, y + 0.4, 0); return g > -50 ? g : y; };
  s.y = ground(s.x, s.z, 0.5);

  /* ---------- getting about ---------- */
  function free(x, z, y) { return !col.blocked(x, z, y, 0.4) && !col.blocked(x + 0.14, z, y, 0.4) && !col.blocked(x - 0.14, z, y, 0.4) && !col.blocked(x, z + 0.14, y, 0.4) && !col.blocked(x, z - 0.14, y, 0.4); }
  function clearLine(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.4);
    for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, g = col.groundAt(x, z, 0.5, 0); if (!(g > -0.1 && g < 0.3) || !free(x, z, g)) return false; }
    return true;
  }
  function homeSpot() {
    for (let k = 0; k < 20; k++) {
      const x = rnd(HOME.x0, HOME.x1), z = rnd(HOME.z0, HOME.z1), g = col.groundAt(x, z, 0.5, 0);
      if (g > -0.1 && g < 0.3 && free(x, z, g) && (s.y > 0.4 || clearLine(s.x, s.z, x, z))) return [x, z];
    }
    return null;
  }
  const inHome = (x, z, m = 0) => x > HOME.x0 - m && x < HOME.x1 + m && z > HOME.z0 - m && z < HOME.z1 + m;
  /** walk towards (x, z); true when there */
  function walk(x, z, speed, dt, stop = 0.08) {
    const dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
    if (d <= stop) { s.v = 0; return true; }
    const want = Math.atan2(dx, dz); s.h += wrap(want - s.h) * Math.min(1, dt * 8);
    s.v += (speed - s.v) * Math.min(1, dt * 6);
    const step = Math.min(d - stop, s.v * dt), ux = Math.sin(s.h), uz = Math.cos(s.h);
    const tryMove = (nx, nz) => { if (!free(nx, nz, s.y)) return false; s.x = nx; s.z = nz; return true; };
    if (tryMove(s.x + ux * step, s.z + uz * step) || tryMove(s.x + ux * step, s.z) || tryMove(s.x, s.z + uz * step)) s.stuck = 0; else s.stuck += dt;
    const g = ground(s.x, s.z); s.y += (g - s.y) * Math.min(1, dt * 20);
    return false;
  }
  /** a leap along an arc onto (x, y, z) */
  function leapTo(x, y, z, then) {
    s.air = { t: 0, T: 0.32 + Math.hypot(x - s.x, z - s.z) * 0.09 + Math.abs(y - s.y) * 0.08, p0: new THREE.Vector3(s.x, s.y, s.z), p1: new THREE.Vector3(x, y, z), c: new THREE.Vector3((s.x + x) / 2, Math.max(s.y, y) + 0.35, (s.z + z) / 2), then };
    s.h = Math.atan2(x - s.x, z - s.z); cat.setPose(null);
  }
  const roofs = col.surfaces.filter((q) => q.perch === 'a parked car' && inHome((q.minX + q.maxX) / 2, (q.minZ + q.maxZ) / 2, 1.5));

  /* ---------- the stray's own life ---------- */
  function choose() {
    cat.setPose(null);
    const r = Math.random(), flock = pigeons && pigeons.nearFlock(s.x, s.z, 30);
    if (flock && r < 0.18 && inHome(flock.x, flock.z, 1) && s.y < 0.4) { s.st = 'HUNT'; s.flock = flock; s.t = 0; return; }
    if (r < 0.45 && roofs.length && s.y < 0.4) {
      const roof = pick(roofs), cx = (roof.minX + roof.maxX) / 2, cz = (roof.minZ + roof.maxZ) / 2;
      for (const [ox, oz] of [[1.25, 0], [-1.25, 0], [0, 1.6], [0, -1.6], [1.25, 1], [-1.25, -1]]) {
        const bx = cx + ox, bz = cz + oz, g = col.groundAt(bx, bz, 0.5, 0);
        if (g > -0.1 && g < 0.3 && free(bx, bz, g) && clearLine(s.x, s.z, bx, bz)) { s.st = 'TOPERCH'; s.perch = { roof, cx, cz, bx, bz }; s.t = 0; return; }
      }
    }
    const p = homeSpot();
    if (p) { s.st = 'WANDER'; s.tx = p[0]; s.tz = p[1]; s.t = 0; } else { s.st = 'IDLE'; s.t = 0; s.dur = rnd(2, 5); }
  }

  function life(dt) {
    switch (s.st) {
      case 'IDLE': s.v = 0; if (s.t > 0.6) cat.setPose('sit'); if (s.t > s.dur) choose(); break;
      case 'WANDER': if (walk(s.tx, s.tz, 0.85, dt) || s.stuck > 1.5 || s.t > 40) { s.st = 'IDLE'; s.t = 0; s.dur = rnd(3, 9); } break;
      case 'TOPERCH': {
        const P = s.perch;
        if (walk(P.bx, P.bz, 0.95, dt, 0.1)) leapTo(P.cx, P.roof.h, P.cz, () => { s.st = 'PERCHED'; s.t = 0; s.dur = rnd(15, 35); });
        else if (s.stuck > 1.5 || s.t > 40) choose();
        break;
      }
      case 'PERCHED': s.v = 0; if (s.t > 0.5) cat.setPose('sit'); if (s.t > s.dur) { const P = s.perch; leapTo(P.bx, ground(P.bx, P.bz, 0.5), P.bz, () => { s.st = 'IDLE'; s.t = 0; s.dur = 1.5; }); } break;
      case 'HUNT': {                                            // creep up, then pounce: they always get away
        const f = s.flock; cat.setPose('stalk');
        if (f.state !== 'GROUND' || s.t > 30) { choose(); break; }
        const d = Math.hypot(f.x - s.x, f.z - s.z);
        if (d < 2.3) { const g = ground(f.x, f.z); leapTo(s.x + (f.x - s.x) * 0.7, g, s.z + (f.z - s.z) * 0.7, () => { s.st = 'IDLE'; s.t = 0; s.dur = rnd(2, 4); }); pigeons.flush(f, s, false); }
        else if (walk(f.x, f.z, 0.45, dt, 2.2) || s.stuck > 2) choose();
        break;
      }
    }
  }

  /* ---------- meeting the player ---------- */
  const level = () => (R.friend ? 'friend' : R.respect >= 3 ? 'truce' : 'rival');
  const who = () => (R.friend ? NAME : 'the stray');
  function hiss() {
    if (clock - s.lastHiss < 5) return; s.lastHiss = clock;
    if (noise) noise(0.8, 0.05, 4200, 0); tone(220, 160, 0.4, 'sawtooth', 0.012);
    ui.say(pick(['"Hsssssss!"', 'The stray flattens his ears and hisses.', '"HSSSS!" He means it.']));
  }
  function meet(dt, d, p) {
    const lv = level(), face = Math.atan2(p.x - s.x, p.z - s.z);
    if (s.st === 'STARE') {
      s.v = 0; cat.setPose('arch'); s.h += wrap(face - s.h) * Math.min(1, dt * 6);
      if (Math.abs(api.speed) > 0.2 || d > 4.5) { endStare(false); return true; }   // you moved: you lost
      if (s.t > 3) endStare(Math.random() < 0.35 + R.respect * 0.12 + Math.min(0.2, (st.perches ? st.perches.size : 0) * 0.04) + (st.energy > 50 ? 0.08 : 0));
      return true;
    }
    if (s.st === 'LUNGE') {
      cat.setPose(null);
      if (walk(p.x, p.z, 3.4, dt, 0.5) || s.t > 1.2) { api.heading = face; api.push(3.4); ui.say('He swipes at you, and you back off.'); tone(500, 300, 0.12, 'square', 0.03); s.st = 'RETREAT'; s.t = 0; const q = homeSpot(); if (q) { s.tx = q[0]; s.tz = q[1]; } }
      return true;
    }
    if (s.st === 'RETREAT') { cat.setPose(null); if (walk(s.tx, s.tz, 1.6, dt) || s.t > 8 || s.stuck > 1.5) { s.st = 'IDLE'; s.t = 0; s.dur = 6; } return true; }
    if (s.st === 'FED') { s.v = 0; cat.setPose('eat'); if (s.t > 5) { cat.setPose(null); s.st = 'IDLE'; s.t = 0; s.dur = 4; } return true; }
    if (s.st === 'PERCHED' || s.air) return false;              // up on a car: he just watches
    if (lv === 'rival') {
      if (d < 1.3) { s.st = 'LUNGE'; s.t = 0; return true; }
      if (d < 3.2) { s.v = 0; cat.setPose('arch'); s.h += wrap(face - s.h) * Math.min(1, dt * 6); hiss(); return true; }
      if (d < 7) { s.v = 0; cat.setPose(null); s.h += wrap(face - s.h) * Math.min(1, dt * 4); return true; }
      return false;
    }
    if (lv === 'truce') { if (d < 6) { s.v = 0; cat.setPose('sit'); s.h += wrap(face - s.h) * Math.min(1, dt * 4); return true; } return false; }
    // a friend comes to say hello
    if (d < 10 && d > 1.1) { cat.setPose(null); walk(p.x, p.z, d > 4 ? 2.2 : 0.9, dt, 1.0); if (clock - s.said > 30 && d < 2) { s.said = clock; ui.say(pick(['"Mrrrp!"', `${NAME} bumps his head against yours.`, `${NAME} winds round you, purring.`])); tone(70, 60, 1.2, 'sawtooth', 0.008); } return true; }
    if (d <= 1.1) { s.v = 0; cat.setPose('sit'); s.h += wrap(face - s.h) * Math.min(1, dt * 4); return true; }
    return false;
  }
  function endStare(won) {
    if (won) {
      R.respect += 1; game.emit('stare'); s.st = 'RETREAT'; s.t = 0; const q = homeSpot(); if (q) { s.tx = q[0]; s.tz = q[1]; }
      ui.say(R.respect >= 3 ? 'He blinks first, slowly. A cat\'s way of saying: fine, you can stay.' : 'He blinks first and looks away, then slinks off.');
      if (R.respect === 3) setTimeout(() => ui.toast('The stray respects you now · no more hissing'), 1500);
      tone(660, 880, 0.2, 'triangle', 0.03); game.save();
    } else { s.st = 'LUNGE'; s.t = 0; ui.say('He holds your stare… then comes at you.'); }
  }

  /* ---------- following the player ---------- */
  function follow(dt, d, p) {
    s.follow -= dt;
    if (s.follow <= 0 || d > 30 || (s.stuck > 4 && d > 12)) { s.follow = 0; ui.toast(`${NAME} heads back to Bute Gardens`); s.st = 'HOME'; s.t = 0; return; }
    if (api.napping && d < 5) { if (s.st !== 'NAP') { s.st = 'NAP'; cat.setPose('curl'); ui.toast(`${NAME} curls up next to you`); } s.v = 0; return; }
    if (s.st === 'NAP') { s.st = 'FOLLOW'; cat.setPose(null); }
    s.st = 'FOLLOW';
    const bx = p.x - Math.sin(api.heading) * 1.1 + Math.cos(api.heading) * 0.5, bz = p.z - Math.cos(api.heading) * 1.1 - Math.sin(api.heading) * 0.5;
    if (p.y > s.y + 0.45 && d < 2.6) {                           // you went up: he follows you up
      const g = col.groundAt(p.x, p.z, p.y, 0.05);
      if (Math.abs(g - p.y) < 0.05) { leapTo(p.x - Math.sin(api.heading) * 0.35, p.y, p.z - Math.cos(api.heading) * 0.35, () => {}); return; }
    }
    if (d > 1.3) { cat.setPose(null); walk(bx, bz, d > 6 ? 4.0 : Math.max(0.9, Math.abs(api.speed) * 1.05), dt, 0.3); }
    else { s.v = 0; if (Math.abs(api.speed) < 0.1) cat.setPose('sit'); }
  }

  /* ---------- E: what you can do with him ---------- */
  const thing = game.add({ id: 'stray', kind: 'stray', x: 0, y: 0, z: -1e4, r: 3.3, dy: 1.2,
    prompt: () => {
      thing.pri = 0;
      if (s.air || s.st === 'FED' || s.st === 'LUNGE' || s.st === 'STARE') return null;
      const d = Math.hypot(api.pos.x - s.x, api.pos.z - s.z);
      if (mischief && mischief.carrying && d < 2.2) { thing.pri = 1; return `Offer ${who()} the sausage roll`; }
      const lv = level();
      if (lv === 'rival') return s.st === 'RETREAT' || s.st === 'PERCHED' ? null : 'Stare him down';
      if (lv === 'truce') return d < 1.6 ? 'Touch noses' : null;
      if (s.follow > 0) return d < 2.5 ? `Say goodbye to ${NAME}` : null;
      return d < 2.0 ? `Walk with ${NAME}` : null;
    },
    use: () => {
      const d = Math.hypot(api.pos.x - s.x, api.pos.z - s.z);
      api.heading = Math.atan2(s.x - api.pos.x, s.z - api.pos.z);
      if (mischief && mischief.carrying && d < 2.2) {
        const h = Math.atan2(api.pos.x - s.x, api.pos.z - s.z);
        mischief.giveRoll(s.x + Math.sin(h) * 0.3, s.y, s.z + Math.cos(h) * 0.3, h, 5);
        s.h = h; s.st = 'FED'; s.t = 0; s.follow = 0;
        if (!R.friend) { R.friend = true; game.emit('friend'); setTimeout(() => ui.toast(`You made a friend · ${NAME}, the Bute Gardens tuxedo`, 4000), 2500); }
        ui.say(pick(['He sniffs it… and tucks in.', 'A sausage roll! He forgets all about the feud.'])); tone(520, 700, 0.25, 'triangle', 0.03); game.save();
        return;
      }
      const lv = level();
      if (lv === 'rival') { s.st = 'STARE'; s.t = 0; ui.say('You hold his stare. Don\'t move…'); return; }
      if (lv === 'truce') { R.friend = true; game.emit('friend'); s.st = 'IDLE'; s.t = 0; s.dur = 4; ui.say('You touch noses. He purrs.'); tone(70, 60, 1.4, 'sawtooth', 0.01); setTimeout(() => ui.toast(`You made a friend · ${NAME}, the Bute Gardens tuxedo`, 4000), 1200); game.save(); return; }
      if (s.follow > 0) { s.follow = 0; s.st = 'HOME'; s.t = 0; ui.say(`${NAME} sits, watches you go, and wanders home.`); return; }
      s.follow = 180; s.st = 'FOLLOW'; ui.say(`${NAME} falls in beside you.`); tone(600, 450, 0.3, 'triangle', 0.02);
    } });

  /* ---------- per frame ---------- */
  const p3 = new THREE.Vector3();
  function update(dt, t) {
    clock += dt; s.t += dt;
    const p = api.pos, d = Math.hypot(p.x - s.x, p.z - s.z), sameLevel = Math.abs(p.y - s.y) < 1.2 && !api.riding;
    if (s.air) {                                               // mid-leap
      const A = s.air; A.t += dt; const u = Math.min(1, A.t / A.T), a = 1 - u;
      p3.copy(A.p0).multiplyScalar(a * a).addScaledVector(A.c, 2 * a * u).addScaledVector(A.p1, u * u);
      s.x = p3.x; s.y = p3.y; s.z = p3.z; s.v = 2;
      if (u >= 1) { s.air = null; s.v = 0; A.then && A.then(); }
    } else if (s.follow > 0) follow(dt, d, p);
    else if (s.st === 'HOME') {                                // back to his street
      if (inHome(s.x, s.z)) { s.st = 'IDLE'; s.t = 0; s.dur = 3; }
      else if (s.stuck > 3 || s.t > 60) { if (d > 25) { const q = homeSpot() || [95, -150]; s.x = q[0]; s.z = q[1]; s.y = ground(s.x, s.z, 0.5); s.st = 'IDLE'; s.t = 0; s.dur = 3; } }
      else walk((HOME.x0 + HOME.x1) / 2, Math.min(HOME.z1, Math.max(HOME.z0, s.z)), 1.3, dt, 0.5);
    } else if (!(sameLevel && d < 10 && meet(dt, d, p))) {
      if (s.st === 'STARE' || s.st === 'LUNGE' || s.st === 'FED') { s.st = 'IDLE'; s.t = 0; s.dur = 2; }
      life(dt);
    }
    // draw
    cat.root.position.set(s.x, s.y, s.z); cat.root.rotation.y = s.h;
    cat.animate(dt, t, s.v, !!s.air);
    thing.x = s.x; thing.y = s.y; thing.z = s.z;
  }

  return {
    update,
    get pos() { return pos.set(s.x, s.y, s.z); },
    get hunting() { return s.st === 'HUNT'; },
    get state() { return s.st; },
    debug: s, R,
  };
}
