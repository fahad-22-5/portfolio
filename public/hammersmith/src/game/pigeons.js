/**
 * Pigeons: small flocks on the open pavements (the station forecourt, the bus stop, Bute Gardens).
 *
 * On the ground they peck and waddle about their patch, shuffle out of people's way, and look up when
 * something comes too close. A trotting cat (or anything that gets within reach) flushes the whole flock:
 * a clatter of wings, up to the rooftops, round in a wide circle, and back down to the same patch once
 * the coast is clear. Creep up on them (walking near a flock, the cat crouches and slows down) and you
 * can get close enough to pounce. You never catch one.
 *
 * All the birds are drawn with one InstancedMesh per body part.
 */
import * as THREE from 'three';

const FLOCKS = [
  { x: -36.3, z: -64.3, r: 2.2, n: 6 },                   // the station forecourt, out from under the building
  { x: -30.0, z: -68.0, r: 2.0, n: 5 },
  { x: 75.6, z: -13.2, r: 2.0, n: 5 },                    // by the bus stop
  { x: 105.6, z: -108.2, r: 1.6, n: 4 },                  // the corner of Bute Gardens
  { x: 95.6, z: -150, r: 3.0, n: 6, road: true },         // halfway down Bute Gardens, in the road (nothing drives there)
];
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createPigeons({ ctx, scene, noise, tone, walkers, onFlush }) {
  const col = ctx.col;

  /* ---------- the birds' parts ---------- */
  const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const sph = (sx, sy, sz) => new THREE.SphereGeometry(1, 10, 7).scale(sx, sy, sz);
  const PARTS = {
    body: [sph(0.075, 0.068, 0.135), mat(0x8c949f)],
    neck: [sph(0.048, 0.058, 0.05), mat(0x4f6a63, 0.45)],                 // the green-purple sheen of the neck
    head: [sph(0.034, 0.034, 0.038), mat(0x59626e)],
    beak: [new THREE.ConeGeometry(0.0075, 0.03, 6).rotateX(Math.PI / 2), mat(0x2a2a2c, 0.5)],
    tail: [new THREE.BoxGeometry(0.07, 0.012, 0.09), mat(0x3d434c)],
    wing: [sph(0.12, 0.012, 0.055).translate(0.115, 0, 0), new THREE.MeshStandardMaterial({ color: 0x7f8894, roughness: 0.8, side: THREE.DoubleSide })],
    leg: [new THREE.BoxGeometry(0.011, 0.055, 0.011).translate(0, 0.0275, 0), mat(0xc4706c, 0.6)],
  };
  const COUNT = { body: 1, neck: 1, head: 1, beak: 1, tail: 1, wing: 2, leg: 2 };
  const birds = [];
  FLOCKS.forEach((f, fi) => {
    f.birds = []; f.flushT = -1; f.state = 'GROUND'; f.i = fi;
    for (let i = 0; i < f.n; i++) {
      const p = spotIn(f) || [f.x, f.z];
      const b = { f, x: p[0], y: ground(p[0], p[1]), z: p[1], h: rnd(0, TAU), st: 'PECK', t: rnd(0, 3), tx: 0, tz: 0, bob: 0, peck: 0, flap: 0, open: 0, pitch: 0,
        a: 0, R: 0, alt: 0, w: 0, vx: 0, vy: 0, vz: 0, fly: 0 };
      f.birds.push(b); birds.push(b);
    }
  });
  const meshes = {};
  for (const k in PARTS) {
    const m = new THREE.InstancedMesh(PARTS[k][0], PARTS[k][1], birds.length * COUNT[k]);
    m.frustumCulled = false; m.castShadow = k === 'body' || k === 'wing'; m.userData.dynamic = true;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); meshes[k] = m;
  }
  if (ctx.zones) for (const k in meshes) ctx.zones.applyTo(meshes[k]);

  /* ---------- where a pigeon may stand ---------- */
  function ground(x, z) { const g = col.groundAt(x, z, 0.6, 0); return g > -5 ? g : 0; }
  function ok(f, x, z) {
    const g = col.groundAt(x, z, 0.6, 0);
    if (!(g > -0.2 && g < 0.25) || col.blocked(x, z, g, 0.05)) return false;
    return f.road || ctx.isPavement?.(x, z) !== false;
  }
  function spotIn(f, near) {
    for (let k = 0; k < 12; k++) {
      const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * f.r, x = (near ? near[0] : f.x) + Math.cos(a) * (near ? Math.min(1.2, r) : r), z = (near ? near[1] : f.z) + Math.sin(a) * (near ? Math.min(1.2, r) : r);
      if (Math.hypot(x - f.x, z - f.z) <= f.r + 0.3 && ok(f, x, z)) return [x, z];
    }
    return null;
  }

  /* ---------- behaviour ---------- */
  function flush(f, from, now = false) {
    if (f.state === 'AIR') return;
    f.state = 'AIR'; f.awayT = 0;
    const dir = from ? Math.atan2(f.z - from.z, f.x - from.x) : rnd(0, TAU);
    // a circle in open sky: the widest that clears every building at its height (else straight up and down)
    f.R = 0; f.altBase = 6; f.cx = f.x; f.cz = f.z;
    search: for (const off of [0, 6, 10, 15]) for (let k = 0; k < (off ? 8 : 1); k++) {
      const cx = f.x + Math.cos(k * TAU / 8) * off, cz = f.z + Math.sin(k * TAU / 8) * off;
      for (const R of [11, 8, 6]) for (const alt of [7, 10, 13]) if (clearRing(cx, cz, R, alt)) { f.R = R; f.altBase = alt; f.cx = cx; f.cz = cz; break search; }
    }
    if (!f.R) { f.R = 0.5; f.altBase = 12; }
    f.cw = Math.random() < 0.5 ? 1 : -1; f.T = rnd(8, 13); f.t = 0;
    for (const b of f.birds) {
      b.st = 'TAKEOFF'; b.t = now ? 0 : -rnd(0, 0.35);
      b.a = dir + rnd(-0.6, 0.6); b.alt = f.altBase + rnd(-1.2, 1.5); b.w = f.cw * rnd(0.55, 0.75) / Math.max(0.6, f.R / 10);
      b.vx = Math.cos(b.a) * 1.5; b.vz = Math.sin(b.a) * 1.5; b.vy = 0;
    }
    if (onFlush) onFlush(f, !!(from && from.cat));
    if (noise) { noise(0.55, 0.06, 1500, 14); setTimeout(() => noise(0.4, 0.04, 1300, 12), 140); }
  }

  function clearRing(cx, cz, R, alt) {
    for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; for (const r of [R, R * 0.5]) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (col.blocked(x, z, alt - 1.5, 0) || col.blocked(x, z, alt + 1, 0)) return false; } }
    return true;
  }
  const steer = (b, x, y, z, max, k, dt) => {   // velocity towards a point, capped
    const dx = x - b.x, dy = y - b.y, dz = z - b.z, d = Math.hypot(dx, dy, dz) || 1, s = Math.min(max, d * 2.2);
    b.vx += (dx / d * s - b.vx) * Math.min(1, dt * k); b.vy += (dy / d * s - b.vy) * Math.min(1, dt * k); b.vz += (dz / d * s - b.vz) * Math.min(1, dt * k);
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    return d;
  };

  function updateBird(b, dt, threats) {
    const f = b.f; b.t += dt;
    switch (b.st) {
      case 'PECK': case 'WALK': case 'ALERT': {
        // what is near: the worst threat sets the mood
        let worst = Infinity, wx = 0, wz = 0, wq = null;
        for (const q of threats) { if (Math.abs(q.y - b.y) > 1.5) continue; const d = Math.hypot(q.x - b.x, q.z - b.z) / q.r; if (d < worst) { worst = d; wx = q.x; wz = q.z; wq = q; } }
        if (worst < 1) { flush(f, wq); return; }
        if (worst < 1.7 && b.st !== 'ALERT') { b.st = 'ALERT'; b.t = 0; const a = Math.atan2(b.z - wz, b.x - wx); const p = [b.x + Math.cos(a) * 0.8, b.z + Math.sin(a) * 0.8]; if (ok(f, p[0], p[1])) { b.tx = p[0]; b.tz = p[1]; } else { b.tx = b.x; b.tz = b.z; } }
        if (walkers) for (const w of walkers()) { const q = w.root.position; if (Math.abs(q.x - b.x) < 0.9 && Math.abs(q.z - b.z) < 0.9 && b.st === 'PECK') { const a = Math.atan2(b.z - q.z, b.x - q.x); const p = [b.x + Math.cos(a) * 0.9, b.z + Math.sin(a) * 0.9]; if (ok(f, p[0], p[1])) { b.st = 'WALK'; b.tx = p[0]; b.tz = p[1]; b.t = 0; b.hurry = 1; } } }
        if (b.st === 'PECK') {
          b.peck = Math.max(0, Math.sin(b.t * 5.5)) ** 3;
          if (b.t > b.dur || b.dur === undefined) { const p = spotIn(f, [b.x, b.z]); if (p && Math.random() < 0.7) { b.st = 'WALK'; b.tx = p[0]; b.tz = p[1]; b.hurry = 0; } b.t = 0; b.dur = rnd(1.5, 5); }
        } else {
          b.peck = 0;
          const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz), sp = b.st === 'ALERT' || b.hurry ? 0.6 : 0.32;
          if (d < 0.03) { if (b.st === 'WALK' || b.t > 2.5) { b.st = 'PECK'; b.t = 0; b.dur = rnd(1, 4); } }
          else { const s = Math.min(d, sp * dt); b.x += dx / d * s; b.z += dz / d * s; b.h += Math.atan2(Math.sin(Math.atan2(dx, dz) - b.h), Math.cos(Math.atan2(dx, dz) - b.h)) * Math.min(1, dt * 10); b.bob += dt * sp * 38; b.y = ground(b.x, b.z); }
        }
        b.open = 0; b.pitch = 0;
        break;
      }
      case 'TAKEOFF': {
        if (b.t < 0) break;
        b.vy = Math.min(4.2, b.vy + dt * 14); b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        b.flap += dt * 15; b.open = 1;
        if (b.t > 0.7) { b.st = 'FLY'; b.t = 0; }
        break;
      }
      case 'FLY': {
        b.a += b.w * dt;
        const x = f.cx + Math.cos(b.a) * f.R, z = f.cz + Math.sin(b.a) * f.R;
        steer(b, x, f.landY + b.alt, z, 7, 1.6, dt);
        const glide = Math.sin(b.t * 0.9 + b.alt) > 0.4;           // now and then they hold their wings out and glide
        b.flap += dt * (glide ? 0 : 9); b.open = 1;
        if (f.state === 'LANDING') { b.st = 'LAND'; b.t = 0; const p = spotIn(f) || [f.x, f.z]; b.tx = p[0]; b.tz = p[1]; }
        break;
      }
      case 'LAND': {
        const gy = ground(b.tx, b.tz), d = steer(b, b.tx, gy + (b.t < 1.5 ? 1.5 : 0), b.tz, 5, 2.2, dt);
        b.flap += dt * (d < 2 ? 14 : 5); b.open = 1;
        if (b.t > 1.5 && d < 0.12) { b.x = b.tx; b.z = b.tz; b.y = gy; b.vx = b.vy = b.vz = 0; b.st = 'PECK'; b.t = 0; b.dur = rnd(0.8, 2.5); }
        break;
      }
    }
    if (b.st === 'TAKEOFF' || b.st === 'FLY' || b.st === 'LAND') {
      if (b.t >= 0 && Math.hypot(b.vx, b.vz) > 0.2) { const want = Math.atan2(b.vx, b.vz); b.h += Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h)) * Math.min(1, dt * 6); }
      b.pitch = -Math.atan2(b.vy, Math.hypot(b.vx, b.vz) + 0.5) * 0.6;
    }
  }

  function updateFlock(f, dt, threats) {
    f.landY = f.landY ?? ground(f.x, f.z);
    if (f.state === 'AIR') {
      f.t += dt;
      const clear = threats.every((q) => Math.hypot(q.x - f.x, q.z - f.z) > Math.max(6, q.r * 1.6));
      if (f.t > f.T && clear) f.state = 'LANDING';
    } else if (f.state === 'LANDING' && f.birds.every((b) => b.st === 'PECK' || b.st === 'WALK')) f.state = 'GROUND';
    for (const b of f.birds) updateBird(b, dt, threats);
  }

  /* ---------- drawing ---------- */
  const M = new THREE.Matrix4(), P = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  const part = (name, i, x, y, z, rx = 0, ry = 0, rz = 0) => { e.set(rx, ry, rz); q.setFromEuler(e); P.compose(v.set(x, y, z), q, s1); meshes[name].setMatrixAt(i, P.premultiply(M)); };
  function draw(b, i) {
    e.set(b.pitch, b.h, 0); q.setFromEuler(e); M.compose(v.set(b.x, b.y, b.z), q, s1);
    const air = b.open > 0.5, bob = air ? 0 : Math.sin(b.bob) * 0.022, pk = b.peck;
    part('body', i, 0, 0.13, 0, air ? 0 : -0.12);
    part('neck', i, 0, 0.175 - pk * 0.04, 0.085 + pk * 0.02);
    part('head', i, 0, 0.215 - pk * 0.1, 0.115 + bob + pk * 0.05, pk * 1.2);
    part('beak', i, 0, 0.21 - pk * 0.12, 0.15 + bob + pk * 0.06, pk * 1.2);
    part('tail', i, 0, air ? 0.12 : 0.15, -0.165, air ? 0.05 : -0.35);
    if (air) {
      const f = Math.sin(b.flap) * 0.95;
      part('wing', i * 2, 0.05, 0.15, 0.02, 0, 0, f);
      part('wing', i * 2 + 1, -0.05, 0.15, 0.02, 0, Math.PI, f);
      part('leg', i * 2, 0, -50, 0); part('leg', i * 2 + 1, 0, -50, 0);
    } else {
      part('wing', i * 2, 0.06, 0.155, 0.04, 0, 1.42, -0.18);                  // folded back along the body
      part('wing', i * 2 + 1, -0.06, 0.155, 0.04, 0, Math.PI - 1.42, -0.18);
      const step = Math.sin(b.bob) * 0.03;
      part('leg', i * 2, 0.022, 0.0, step); part('leg', i * 2 + 1, -0.022, 0.0, -step);
    }
  }

  let near = null;   // the nearest grounded bird to the cat, for stalking and pouncing
  /** threats: [{ x, y, z, r }] things that scare pigeons, r = how close they may come */
  function update(dt, threats, cat) {
    near = null; let nd = Infinity;
    for (const f of FLOCKS) {
      const far = Math.hypot(cat.x - f.x, cat.z - f.z) > 75;
      if (far && f.state === 'GROUND') continue;                     // nothing to see: leave them where they are
      updateFlock(f, dt, threats);
      for (const b of f.birds) {
        if (b.st !== 'PECK' && b.st !== 'WALK' && b.st !== 'ALERT') continue;
        const d = Math.hypot(b.x - cat.x, b.z - cat.z); if (d < nd && Math.abs(b.y - cat.y) < 1) { nd = d; near = b; }
      }
    }
    let i = 0;
    for (const f of FLOCKS) {
      const far = Math.hypot(cat.x - f.x, cat.z - f.z) > 75 && f.state === 'GROUND';
      for (const b of f.birds) { if (!far || !b.drawn) { draw(b, i); b.drawn = true; } i++; }
    }
    for (const k in meshes) meshes[k].instanceMatrix.needsUpdate = true;
    if (near && nd < 7 && Math.random() < dt * 0.08 && tone) tone(330, 260, 0.35, 'sine', 0.012);   // a coo now and then
    return nd;
  }

  /** Space near a pigeon: where to pounce (it will be gone by the time you land), or null */
  function pounce(cat, heading) {
    if (!near) return null;
    const dx = near.x - cat.x, dz = near.z - cat.z, d = Math.hypot(dx, dz);
    if (d > 2.6 || d < 0.2) return null;
    const off = Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading));
    if (Math.abs(off) > 0.8) return null;
    const f = near.f, at = [near.x, near.y, near.z];
    setTimeout(() => flush(f, { x: cat.x, z: cat.z, cat: true }, true), 120);
    return at;
  }

  return {
    update, pounce, flocks: FLOCKS, birds,
    nearFlock(x, z, r = 20) { return FLOCKS.find((f) => f.state === 'GROUND' && Math.hypot(f.x - x, f.z - z) < r) || null; },
    flush,
  };
}
