/**
 * Cat parkour: Space leaps to whatever the cat is looking at.
 *
 * A plain jump only clears about 0.8 m. Facing something higher (a counter, a bench, a car, a garden wall),
 * Space instead leaps onto it, up to 2.1 m above the cat; from a perch it leaps across gaps to another one
 * (further at a trot); under something it can stand on (a kiosk canopy, the bus shelter's roof) it climbs
 * out round the edge and up on top. A ring marks where it will land. Walking off an edge just drops.
 *
 * Everything is read from the collision set: a landing spot is any surface top with room for four paws
 * and headroom above it. Some surfaces are named high spots (surface.perch): reaching each for the first
 * time is saved with the game, and up there the cat can curl up for a nap.
 *
 * api: { pos, heading (get/set), speed (get/set), land() }  (land: the cat is back on its feet)
 */
import * as THREE from 'three';

const MAXUP = 2.1;           // highest leap, from the cat's feet to the landing (m)
const RISE = 0.42;           // anything lower is a step or a hop, not a leap

export function createParkour({ ctx, scene, cat, ui, tone, game, api }) {
  const col = ctx.col;
  let target = null, leap = null, scanT = 0, perchT = 0, onPerch = null, pitch = 0;
  cat.root.rotation.order = 'YXZ';                              // so the leap can tip the cat nose-up without fighting the heading

  /* ---------- the landing marker: a soft ring on the spot ---------- */
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.165, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  ring.renderOrder = 5; ring.visible = false; ring.userData.dynamic = true; scene.add(ring);

  /* ---------- where can the cat land? ---------- */
  const PAWS = [[0, 0], [0.085, 0], [-0.085, 0], [0, 0.085], [0, -0.085]];
  function standable(x, z, h) {
    if (h > 2.94 && h < 3.06) return false;                     // tops of the mall's 3 m shop walls and pillars run on into the fascia above
    for (const [ox, oz] of PAWS) if (Math.abs(col.groundAt(x + ox, z + oz, h, 0.03) - h) > 0.04) return false;
    return !col.blocked(x, z, h, 0.05);
  }

  /** where to land on the surface of height g first met at (x, z), going along (hx, hz): a little way past its near edge, or its middle if it is narrow */
  function landOn(x, z, hx, hz, g) {
    const same = (k) => Math.abs(col.groundAt(x + hx * k, z + hz * k, g, 0.03) - g) < 0.04;
    let a = 0, b = 0;
    while (a > -0.12 && same(a - 0.02)) a -= 0.02;
    while (b < 0.7 && same(b + 0.02)) b += 0.02;
    const k = Math.min(a + 0.26, (a + b) / 2), lx = x + hx * k, lz = z + hz * k;
    return standable(lx, lz, g) ? [lx, lz] : null;
  }

  /** look ahead along the heading (and a little either side) for a leap */
  function scan() {
    const p = api.pos, y0 = p.y, trot = Math.abs(api.speed) > 2.6, reach = trot ? 2.9 : 2.1, h0 = api.heading;
    // under something you could stand on: out round the edge and up
    const over = col.groundAt(p.x, p.z, y0 + MAXUP, 0);
    if (over > y0 + 0.75) {                                       // the nearest edge, preferring the way the cat faces
      let pick = null, score = Infinity;
      for (let k = 0; k < 8; k++) {
        const da = (k < 1 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 4), hx = Math.sin(h0 + da), hz = Math.cos(h0 + da);
        for (let d = 0.1; d <= 1.3; d += 0.05) {
          if (col.groundAt(p.x + hx * d, p.z + hz * d, y0 + MAXUP, 0) < over - 0.05) {
            const lx = p.x + hx * (d - 0.3), lz = p.z + hz * (d - 0.3), sc = d + Math.abs(da) * 0.25;
            if (d > 0.35 && sc < score && standable(lx, lz, over)) { score = sc; pick = { kind: 'clamber', x: lx, y: over, z: lz, cx: p.x + hx * (d + 0.3), cy: over + 0.55, cz: p.z + hz * (d + 0.3), face: h0 + da }; }
            break;
          }
        }
      }
      if (pick) return pick;
    }
    let best = null;
    for (const da of [0, 0.22, -0.22, 0.42, -0.42]) {
      const hx = Math.sin(h0 + da), hz = Math.cos(h0 + da);
      let dropped = false;
      for (let d = 0.3; d <= reach; d += 0.06) {
        const x = p.x + hx * d, z = p.z + hz * d;
        const g = col.groundAt(x, z, y0 + MAXUP, 0);
        if (!(g > -1e3) || col.blocked(x, z, g, 0.02)) break;    // a wall taller than a leap, or nothing at all
        if (g > y0 + RISE) {                                     // the near edge of something higher: land a little way on
          const L = landOn(x, z, hx, hz, g); if (L) { best = { kind: dropped && g < y0 + 0.6 ? 'across' : 'up', x: L[0], y: g, z: L[1] }; break; }
          continue;                                               // no room on this one (a plinth under a wall): look on, maybe at the wall's top
        }
        if (g < y0 - 0.45) dropped = true;                        // over the edge of the perch
        else if (dropped) {                                       // across a gap, onto something about as high
          const L = landOn(x, z, hx, hz, g); if (L) best = { kind: 'across', x: L[0], y: g, z: L[1] };
          break;
        }
      }
      if (best) break;
    }
    return best;
  }

  /** Space: leap if there is somewhere to leap to (true), otherwise leave it to the plain jump */
  function tryLeap() {
    if (leap) return true;
    target = scan();
    if (!target) return false;
    const p = api.pos, t = target, dist = Math.hypot(t.x - p.x, t.z - p.z), rise = t.y - p.y;
    const c = t.kind === 'clamber' ? new THREE.Vector3(t.cx, t.cy, t.cz)
      : new THREE.Vector3((p.x + t.x) / 2, Math.max(p.y, t.y) + 0.3 + dist * 0.1, (p.z + t.z) / 2);
    api.heading = t.kind === 'clamber' ? t.face : Math.atan2(t.x - p.x, t.z - p.z);
    leap = { t: 0, crouch: 0.09, T: 0.3 + dist * 0.09 + Math.max(0, rise) * 0.07, p0: p.clone(), c, p1: new THREE.Vector3(t.x, t.y, t.z) };
    tone(380 + rise * 90, 620 + rise * 120, 0.12, 'triangle', 0.02);
    ring.visible = false; target = null;
    return true;
  }

  /** a leap to a given spot (a pounce): low and quick */
  function leapTo(x, y, z) {
    if (leap) return false;
    const p = api.pos, dist = Math.hypot(x - p.x, z - p.z);
    api.heading = Math.atan2(x - p.x, z - p.z);
    leap = { t: 0, crouch: 0.16, T: 0.22 + dist * 0.08, p0: p.clone(), c: new THREE.Vector3((p.x + x) / 2, Math.max(p.y, y) + 0.32, (p.z + z) / 2), p1: new THREE.Vector3(x, y, z) };
    ring.visible = false; target = null;
    return true;
  }

  const v = new THREE.Vector3(), prev = new THREE.Vector3();
  /** while leaping: moves the cat along the arc; returns false once it has landed */
  function update(dt) {
    if (!leap) { pitch *= Math.max(0, 1 - dt * 10); cat.root.rotation.x = pitch; return false; }
    const L = leap; L.t += dt;
    if (L.t < L.crouch) { cat.root.rotation.x = 0.12 * (L.t / L.crouch); return true; }   // gather, tip back a touch
    const u = Math.min(1, (L.t - L.crouch) / L.T), a = 1 - u;
    prev.copy(api.pos);
    v.copy(L.p0).multiplyScalar(a * a).addScaledVector(L.c, 2 * a * u).addScaledVector(L.p1, u * u);
    api.pos.copy(v);
    const h = Math.hypot(v.x - prev.x, v.z - prev.z), dy = v.y - prev.y;
    if (h + Math.abs(dy) > 1e-5) pitch = -Math.atan2(dy, Math.max(h, 1e-4)) * 0.55;
    cat.root.rotation.x = pitch;
    if (u >= 1) { leap = null; api.speed = Math.min(Math.abs(api.speed), 1.0) * Math.sign(api.speed); api.land(); tone(200, 150, 0.06, 'sine', 0.02); checkPerch(true); }
    return true;
  }

  /* ---------- high spots ---------- */
  const perches = col.surfaces.filter((s) => s.perch), names = [...new Set(perches.map((s) => s.perch))];
  const st = game.state; st.perches = st.perches || new Set();
  function checkPerch(now) {
    const p = api.pos; onPerch = null;
    if (p.y < 0.9) return;
    for (const s of perches) {
      if (!s.enabled || p.x < s.minX || p.x > s.maxX || p.z < s.minZ || p.z > s.maxZ || Math.abs(s.h - p.y) > 0.06 || !s.test(p.x, p.z)) continue;
      onPerch = s.perch;
      if (!st.perches.has(s.perch)) {
        st.perches.add(s.perch); tone(990, 1480, 0.3, 'triangle', 0.05);
        ui.toast(`High spot · ${s.perch} (${st.perches.size}/${names.length})`, 3200); game.emit('perch', s.perch); game.save();
      }
      return;
    }
    if (now) onPerch = null;
  }
  // a nap up there, wherever "there" is
  game.add({ id: 'nap:perch', kind: 'nap', x: 0, y: 0, z: -1e4, r: 0.6, dy: 1, mark: null,
    prompt: () => (onPerch ? `Curl up on ${onPerch.replace(/^an? /, 'the ')}` : null),
    use: () => game.napAt(api.pos.x, api.pos.y, api.pos.z, api.heading, onPerch.replace(/^an? /, 'the ')) });
  const napThing = game.things.find((t) => t.id === 'nap:perch');

  /** per frame, while the cat is on its feet: what it could leap to, and whether it is up on a high spot */
  function look(dt, grounded) {
    if (leap || !grounded) { ring.visible = false; return; }
    if ((scanT -= dt) < 0) { scanT = 0.08; target = scan(); }
    if (target) { ring.position.set(target.x, target.y + 0.015, target.z); ring.visible = true; ring.material.opacity = 0.38 + Math.sin(performance.now() / 180) * 0.14; }
    else ring.visible = false;
    if ((perchT -= dt) < 0) { perchT = 0.25; checkPerch(false); }
    if (onPerch) { napThing.x = api.pos.x; napThing.y = api.pos.y; napThing.z = api.pos.z; } else napThing.z = -1e4;
  }

  return {
    tryLeap, leapTo, update, look, scan,
    get active() { return !!leap; },
    /** the name of the high spot the cat is standing on, or null */
    get onPerch() { return onPerch; },
    /** what the HUD can say when nothing else wants the prompt */
    get hint() { return target && Math.abs(api.speed) < 0.6 ? `[Space] ${target.kind === 'clamber' ? 'Climb up on top' : target.kind === 'across' ? 'Leap across' : 'Jump up'}` : ''; },
    hide() { ring.visible = false; target = null; },
    names,
  };
}
