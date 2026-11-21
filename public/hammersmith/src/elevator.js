import * as THREE from 'three';
import { inst, box, FONT } from './util.js';
import { brushedSteel, heroGlass } from './world/finishes.js';

export const LIFT = { TOP: 6.5, SPEED: 2.5, HALF: 1.75, OPEN_R: 3.0 };

/**
 * Glass lift between the concourse (y = 0) and the bus station deck (y = TOP).
 * States: IDLE_BOTTOM -> MOVING_UP -> IDLE_TOP -> MOVING_DOWN.
 * Placed at (x, z) and turned by rot; doors face local +Z on both floors.
 *
 *   update(dt, catPos)   every frame: doors open by themselves when the cat is within 3 m of
 *                        the doors (or inside the cab) and stay open while it is at the threshold
 *   prompt(catPos)       HUD text, or null
 *   interact(catPos)     on [E]; ride (from inside the cab) or call the lift (from the other landing)
 *
 * Boarding cues: a pulsing cyan/emerald pad in the cab, animated chevrons on both landings pointing
 * in, and a lit floor display over the doors on each level. Everything is pre-built; update()
 * allocates nothing (the display canvas is only redrawn when its text changes).
 */
export function createElevator(ctx, { x: ox = 0, z: oz = 0, rot = 0 } = {}) {
  const { scene, col, mats } = ctx;
  const H = LIFT.HALF, TOP = LIFT.TOP, g = new THREE.Group(), c = Math.cos(rot), s = Math.sin(rot);
  g.position.set(ox, 0, oz); g.rotation.y = rot; g.userData.dynamic = true; scene.add(g);
  const R = (lx, lz, w, d, o) => col.rect(ox + lx * c + lz * s, oz - lx * s + lz * c, w, d, { ...o, rot });
  const L = { x: 0, z: 0 };
  const toLocal = (p) => { const dx = p.x - ox, dz = p.z - oz; L.x = dx * c - dz * s; L.z = dx * s + dz * c; return L; };
  const steel = brushedSteel();

  // shaft: brushed steel corner posts + ring beams, physical glass on three sides
  const posts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) posts.push({ x: sx * H, y: 4.6, z: sz * H });
  inst(g, new THREE.BoxGeometry(0.16, 9.2, 0.16), steel, posts);
  const beams = [];
  for (const y of [0.04, 3.2, TOP - 0.06, 9.2]) beams.push({ x: 0, y, z: -H, sx: 3.5 }, { x: -H, y, z: 0, sx: 3.5, ry: Math.PI / 2 }, { x: H, y, z: 0, sx: 3.5, ry: Math.PI / 2 });
  for (const y of [3.0, TOP + 3.0, 9.2]) beams.push({ x: 0, y, z: H, sx: 3.5 });               // door heads only, no sill to trip over
  inst(g, new THREE.BoxGeometry(1, 0.12, 0.12), steel, beams);
  const shaftGlass = heroGlass();                          // transmissive with ?glass=hi, else physical blended glass
  for (const [x, z, ry] of [[-H, 0, Math.PI / 2], [H, 0, Math.PI / 2], [0, -H, 0]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 9.2), shaftGlass);
    pane.position.set(x, 4.6, z); pane.rotation.y = ry; g.add(pane);
  }
  R(-H - 0.05, 0, 0.2, 3.7, { h: 9.2 });
  R(H + 0.05, 0, 0.2, 3.7, { h: 9.2 });
  R(0, -H - 0.05, 3.7, 0.2, { h: 9.2 });

  // cab: floor slab flush with each landing (top face at cab.y), glowing boarding pad, warm lid
  const cab = new THREE.Group(); g.add(cab);
  box(cab, 3.3, 0.12, 3.3, steel, 0, -0.06, 0);
  box(cab, 3.3, 0.1, 3.3, steel, 0, 2.65, 0);
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(1.2, 32), mats.warm);
  lamp.rotation.x = Math.PI / 2; lamp.position.y = 2.59; cab.add(lamp);
  const padMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 1.5, 1.05), toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false });
  const padShape = new THREE.Shape(); { const a = 1.0, r = 0.25; padShape.moveTo(-a + r, -a); padShape.lineTo(a - r, -a); padShape.quadraticCurveTo(a, -a, a, -a + r); padShape.lineTo(a, a - r); padShape.quadraticCurveTo(a, a, a - r, a); padShape.lineTo(-a + r, a); padShape.quadraticCurveTo(-a, a, -a, a - r); padShape.lineTo(-a, -a + r); padShape.quadraticCurveTo(-a, -a, -a + r, -a); }
  const pad = new THREE.Mesh(new THREE.ShapeGeometry(padShape).rotateX(-Math.PI / 2), padMat); pad.position.y = 0.012; cab.add(pad);
  const rimMat = padMat.clone(); rimMat.opacity = 1;
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.13, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), rimMat); rim.scale.set(1.414, 1, 1.414); rim.position.y = 0.014; cab.add(rim);
  const doorGeo = new THREE.BoxGeometry(1.6, 2.5, 0.05);
  const doorMat = shaftGlass.clone(); doorMat.color.set(0xd8f4ff); if (!doorMat.transmission) doorMat.opacity = 0.32;
  const doorL = new THREE.Mesh(doorGeo, doorMat), doorR = new THREE.Mesh(doorGeo, doorMat);
  doorL.position.set(-0.8, 1.3, H - 0.1); doorR.position.set(0.8, 1.3, H - 0.1);
  cab.add(doorL, doorR);

  // landing chevrons (three per floor) pointing into the cab
  const chevShape = new THREE.Shape([new THREE.Vector2(-0.45, 0.0), new THREE.Vector2(0, -0.32), new THREE.Vector2(0.45, 0.0), new THREE.Vector2(0.45, 0.16), new THREE.Vector2(0, -0.16), new THREE.Vector2(-0.45, 0.16)]);
  const chevGeo = new THREE.ShapeGeometry(chevShape).rotateX(-Math.PI / 2);
  const chevMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 1.4, 1.0), toneMapped: false, transparent: true, opacity: 0.4, depthWrite: false }));
  for (const y of [0.035, TOP + 0.035]) for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(chevGeo, chevMats[i]); m.position.set(0, y, H + 2.3 - i * 0.55); g.add(m); }

  // floor display over the doors on both levels (one shared canvas)
  const dc = document.createElement('canvas'); dc.width = 512; dc.height = 128;
  const dtex = new THREE.CanvasTexture(dc); dtex.colorSpace = THREE.SRGBColorSpace;
  const dispMat = new THREE.MeshBasicMaterial({ map: dtex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) });
  for (const y of [3.35, TOP + 3.35]) {
    box(g, 2.5, 0.62, 0.12, mats.dark, 0, y, H + 0.08);
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 0.54), dispMat); d.position.set(0, y, H + 0.145); g.add(d);
  }
  let shown = '';
  function display(floor, arrow) {
    const key = floor + arrow; if (key === shown) return; shown = key;
    const x = dc.getContext('2d');
    x.fillStyle = '#05080a'; x.fillRect(0, 0, 512, 128);
    x.fillStyle = '#39ffb0'; x.font = `800 58px ${FONT}`; x.textBaseline = 'middle';
    x.fillText(floor ? '[ 1 ]' : '[ G ]', 18, 66);
    x.font = `700 40px ${FONT}`; x.fillStyle = '#e8fff6'; x.fillText(floor ? 'BUS STATION' : 'CONCOURSE', 168, 66);
    if (arrow) { x.fillStyle = '#ffd34d'; x.font = `800 60px ${FONT}`; x.fillText(arrow, 456, 68); }
    dtex.needsUpdate = true;
  }

  // collision: the cab floor rides with the cab; landing doors block when shut
  R(0, 0, 2 * H + 0.1, 2 * H + 0.1, { hf: () => cab.position.y, thick: 0.3 });   // overlaps the landing edge: no gap at the threshold
  const shut0 = R(0, H, 3.7, 0.3, { h: 2.6, thick: 2.6 });
  const shut1 = R(0, H, 3.7, 0.3, { h: TOP + 2.6, thick: 2.6 });
  const shutAll = R(0, H, 3.7, 0.3, { h: 9.2 });
  shut1.enabled = true; shutAll.enabled = false;

  let state = 'IDLE_BOTTOM', door = 0, t = 0, depart = false, clock = 0;

  const inCab = (p) => { toLocal(p); return Math.abs(L.x) < 1.55 && Math.abs(L.z) < 1.6 && Math.abs(p.y - cab.position.y) < 0.7; };
  /** within OPEN_R of the middle of the doors on a level, on the landing side */
  const atLanding = (p, lvl) => { toLocal(p); return Math.abs(p.y - lvl * TOP) < 1 && L.z > H - 0.4 && Math.hypot(L.x, L.z - H) < LIFT.OPEN_R; };
  const idle = () => state === 'IDLE_BOTTOM' || state === 'IDLE_TOP';
  const level = () => (state === 'IDLE_TOP' ? 1 : 0);

  function interact(p) {
    if (!idle()) return inCab(p);
    if (inCab(p) || atLanding(p, 1 - level())) { depart = true; return true; }
    return false;
  }

  function prompt(p) {
    if (!idle() || depart) return inCab(p) && !idle() ? (state === 'MOVING_UP' ? 'Going up to the Bus Station ▲' : 'Going down to the Concourse ▼') : null;
    if (inCab(p)) return level() ? 'Press [E] to Return to Concourse (Level G)' : 'Press [E] to Ride to Bus Station (Level 1)';
    if (atLanding(p, 1 - level())) return 'Press [E] to Call the lift';
    if (atLanding(p, level())) return 'Step onto the glowing pad';
    return null;
  }

  function update(dt, p) {
    clock += dt;
    if (idle()) {
      const want = !depart && (inCab(p) || atLanding(p, level()));
      door = want ? Math.min(1, door + dt / 0.45) : Math.max(0, door - dt / 0.45);
      if (depart && door <= 0) { state = level() ? 'MOVING_DOWN' : 'MOVING_UP'; depart = false; }
    } else {
      const dir = state === 'MOVING_UP' ? 1 : -1;
      t = Math.min(1, Math.max(0, t + dir * dt * LIFT.SPEED / TOP));
      cab.position.y = t * t * (3 - 2 * t) * TOP;              // eased, zero-allocation
      if (inCab(p)) {                                         // keep the passenger on the floor
        const lx = Math.min(1.3, Math.max(-1.3, L.x)), lz = Math.min(1.3, Math.max(-1.3, L.z));
        p.x = ox + lx * c + lz * s; p.z = oz - lx * s + lz * c;
      }
      if (t === 0 || t === 1) state = t ? 'IDLE_TOP' : 'IDLE_BOTTOM';
    }
    doorL.position.x = -0.8 - door * 0.82;                    // 3.2 m clear opening when open
    doorR.position.x = 0.8 + door * 0.82;
    const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
    padMat.opacity = idle() ? 0.55 + 0.4 * pulse : 0.95;
    for (let i = 0; i < 3; i++) chevMats[i].opacity = idle() && door > 0.3 ? 0.3 + 0.7 * Math.max(0, Math.sin(clock * 5 - i * 1.1)) : 0.08;
    const openHere = idle() && door > 0.5;
    shut0.enabled = !(openHere && level() === 0);
    shut1.enabled = !(openHere && level() === 1);
    shutAll.enabled = !idle();
    const blink = Math.floor(clock * 2.5) % 2 === 0;
    display(state === 'IDLE_TOP' || (state === 'MOVING_UP' && t > 0.5) || (state === 'MOVING_DOWN' && t > 0.5) ? 1 : 0, state === 'MOVING_UP' ? (blink ? '▲' : ' ') : state === 'MOVING_DOWN' ? (blink ? '▼' : ' ') : '');
  }
  display(0, '');

  return { cab, update, interact, prompt, get state() { return state; } };
}
