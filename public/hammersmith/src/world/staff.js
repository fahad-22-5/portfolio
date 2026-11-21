/**
 * Shop staff: jointed human figures that walk between work stations and act
 * out their job (pull an espresso, tap a till, lift a fry basket...).
 *
 * Each person is a hierarchy of empty Object3D joints (hips, spine, neck,
 * shoulders, elbows, hips, knees). The visible body parts of every person
 * share one InstancedMesh per part type, refreshed from the joints'
 * world matrices each frame, so a whole crew costs ~13 draw calls.
 * Props (cups, portafilters, baskets...) are real meshes held in a hand.
 * update() allocates nothing.
 */
import * as THREE from 'three';
import { brushedSteel, blackSteel, paint, label } from './finishes.js';

const PARTS = {
  torso: new THREE.CapsuleGeometry(0.17, 0.3, 6, 14).scale(1.1, 1, 0.7),
  apron: new THREE.BoxGeometry(0.34, 0.56, 0.02),
  neck: new THREE.CylinderGeometry(0.048, 0.055, 0.1, 10),
  head: new THREE.SphereGeometry(0.105, 18, 14).scale(0.92, 1.08, 1),
  hair: new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 1.05, 1.05),
  hat: new THREE.CylinderGeometry(0.112, 0.116, 0.07, 18),
  brim: new THREE.BoxGeometry(0.16, 0.012, 0.09),
  upper: new THREE.CapsuleGeometry(0.047, 0.2, 4, 10),
  fore: new THREE.CapsuleGeometry(0.04, 0.19, 4, 10),
  hand: new THREE.SphereGeometry(0.045, 10, 8).scale(0.9, 1.1, 0.7),
  thigh: new THREE.CapsuleGeometry(0.068, 0.3, 4, 10),
  shin: new THREE.CapsuleGeometry(0.056, 0.32, 4, 10),
  shoe: new THREE.BoxGeometry(0.095, 0.07, 0.24),
  badge: new THREE.CylinderGeometry(0.032, 0.032, 0.012, 5).rotateX(Math.PI / 2),   // star / logo badge on the chest
  lanyard: new THREE.BoxGeometry(0.022, 0.3, 0.006),
  band: new THREE.TorusGeometry(0.108, 0.016, 6, 22).rotateX(Math.PI / 2),           // visor headband
};
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

function makeProps() {
  const steel = brushedSteel(), black = blackSteel();
  const cupMat = label('cup', (c) => { c.fillStyle = '#fbfaf7'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#6b1d2f'; c.fillRect(0, 54, 128, 22); });
  const g = (geo, mat, x = 0, y = 0, z = 0, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; return m; };
  return {
    cup: () => g(new THREE.CylinderGeometry(0.04, 0.032, 0.11, 14), cupMat, 0, -0.03, 0.04),
    jug: () => { const o = new THREE.Group(); o.add(g(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 14), steel, 0, -0.02, 0.05)); o.add(g(new THREE.BoxGeometry(0.015, 0.07, 0.04), steel, 0, -0.02, 0.0)); return o; },
    portafilter: () => { const o = new THREE.Group(); o.add(g(new THREE.CylinderGeometry(0.045, 0.04, 0.035, 16), steel, 0, -0.02, 0.13)); o.add(g(new THREE.BoxGeometry(0.03, 0.025, 0.14), black, 0, -0.02, 0.04)); return o; },
    bag: () => g(new THREE.BoxGeometry(0.2, 0.26, 0.11), label('bag', (c) => { c.fillStyle = '#c69c6d'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#d6202a'; c.font = '900 64px sans-serif'; c.fillText('M', 40, 90); }), 0, -0.12, 0.05),
    pretbag: () => g(new THREE.BoxGeometry(0.2, 0.26, 0.11), label('pbag', (c) => { c.fillStyle = '#f6f2ea'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#6b1d2f'; c.fillRect(0, 44, 128, 30); }), 0, -0.12, 0.05),
    basket: () => { const o = new THREE.Group(); o.add(g(new THREE.BoxGeometry(0.2, 0.12, 0.26), steel, 0, -0.03, 0.2)); o.add(g(new THREE.BoxGeometry(0.03, 0.03, 0.22), black, 0, 0, 0.02)); o.add(g(new THREE.BoxGeometry(0.17, 0.05, 0.22), paint(0xf2c230, 0.6), 0, 0.02, 0.2)); return o; },
    spatula: () => { const o = new THREE.Group(); o.add(g(new THREE.BoxGeometry(0.02, 0.02, 0.18), black, 0, -0.01, 0.06)); o.add(g(new THREE.BoxGeometry(0.1, 0.005, 0.1), steel, 0, -0.02, 0.19)); return o; },
    tray: () => g(new THREE.BoxGeometry(0.36, 0.02, 0.27), paint(0x7a4a2a, 0.5), 0, -0.04, 0.13),
    scoop: () => { const o = new THREE.Group(); o.add(g(new THREE.BoxGeometry(0.03, 0.03, 0.12), black, 0, -0.01, 0.03)); o.add(g(new THREE.BoxGeometry(0.12, 0.1, 0.1), steel, 0, -0.02, 0.14)); return o; },
    cloth: () => g(new THREE.BoxGeometry(0.12, 0.02, 0.1), paint(0x2f7fd0, 0.9), 0, -0.04, 0.04),
    shopbasket: () => { const o = new THREE.Group(); o.add(g(new THREE.BoxGeometry(0.36, 0.2, 0.24), paint(0xc8102e, 0.55), 0, -0.2, 0.02)); o.add(g(new THREE.BoxGeometry(0.3, 0.06, 0.2), paint(0xf2c230, 0.6), 0, -0.1, 0.02)); o.add(g(new THREE.BoxGeometry(0.02, 0.1, 0.02), black, 0, -0.05, 0)); return o; },
    phone: () => g(new THREE.BoxGeometry(0.07, 0.012, 0.14), black, 0, -0.03, 0.05),
    mop: () => { const o = new THREE.Group(); o.add(g(new THREE.CylinderGeometry(0.013, 0.013, 1.4, 8), paint(0xd9c9a3, 0.6), 0, -0.3, 0.12)); o.add(g(new THREE.BoxGeometry(0.34, 0.05, 0.14), paint(0x3f7fb5, 0.9), 0, -1.0, 0.12)); return o; },
  };
}

/** Arm/leg/head poses per activity. r = right arm, l = left arm; s = shoulder pitch (negative = forward/up), e = elbow bend, z = shoulder roll. */
function pose(act, t, P) {
  const s = Math.sin, k = (v) => v;
  P.rs = -0.1; P.re = -0.15; P.rz = 0.08; P.ls = -0.1; P.le = -0.15; P.lz = -0.08; P.head = 0.08; P.spine = 0; P.wrist = 0; P.crouch = 0;
  switch (act) {
    case 'tap': P.rs = -0.85; P.re = -0.75 + s(t * 11) * 0.12; P.ls = -0.35; P.le = -0.5; P.head = 0.35; break;
    case 'grind': P.rs = -1.45; P.re = -0.35; P.ls = -0.75; P.le = -0.9; P.head = 0.05; break;
    case 'tamp': P.rs = -0.75 + s(t * 7) * 0.12; P.re = -1.05; P.ls = -0.7; P.le = -1.0; P.head = 0.45; P.spine = 0.12; break;
    case 'brew': P.rs = -1.2; P.re = -0.55; P.wrist = s(t * 2.4) * 0.5; P.ls = -0.4; P.le = -0.4; P.head = 0.2; break;
    case 'steam': P.rs = -1.0 + s(t * 9) * 0.04; P.re = -0.95; P.ls = -0.55; P.le = -0.8; P.head = 0.4; break;
    case 'pour': P.rs = -1.0; P.re = -0.85; P.wrist = 0.5 + s(t * 1.6) * 0.35; P.ls = -0.85; P.le = -1.1; P.head = 0.45; break;
    case 'handover': { const e = Math.min(1, (t % 2.4) / 0.8); P.rs = -0.4 - e * 0.95; P.re = -0.9 + e * 0.75; P.head = 0.15; break; }
    case 'restock': { const c = s(t * 1.8); P.rs = -1.0 + c * 0.6; P.re = -0.4; P.ls = -1.0 - c * 0.6; P.le = -0.4; P.spine = 0.1 + Math.max(0, -c) * 0.25; P.crouch = Math.max(0, -c) * 0.25; P.head = 0.2; break; }
    case 'fries': { const up = Math.max(0, s(t * 1.4)); P.rs = -0.75 - up * 0.45; P.re = -0.95 + up * 0.2 + s(t * 14) * 0.04 * up; P.ls = -0.3; P.head = 0.35; break; }
    case 'scoop': P.rs = -0.6; P.re = -0.7; P.rz = 0.2 + s(t * 3) * 0.25; P.ls = -0.55; P.le = -0.9; P.head = 0.45; P.spine = 0.12; break;
    case 'flip': { const f = Math.max(0, s(t * 3.2)); P.rs = -0.85 - f * 0.25; P.re = -0.8; P.wrist = -f * 1.1; P.ls = -0.3; P.head = 0.4; break; }
    case 'bag': P.rs = -0.8 + s(t * 4) * 0.15; P.re = -1.0; P.ls = -0.8 - s(t * 4) * 0.15; P.le = -1.0; P.head = 0.4; P.spine = 0.08; break;
    case 'wipe': P.rs = -0.85 + s(t * 3) * 0.12; P.re = -0.55; P.rz = 0.15 + Math.cos(t * 3) * 0.2; P.ls = -0.2; P.head = 0.4; P.spine = 0.15; break;
    case 'type': P.rs = -0.95; P.re = -1.05 + s(t * 13) * 0.07; P.ls = -0.95; P.le = -1.05 + s(t * 11 + 1) * 0.07; P.rz = 0.15; P.lz = -0.15; P.head = 0.38; break;
    case 'sip': { const c = (t % 4) / 4, up = c < 0.35 ? Math.sin(c / 0.35 * Math.PI) : 0; P.rs = -0.9 - up * 0.55; P.re = -1.1 - up * 0.75; P.ls = -0.85; P.le = -1.15; P.lz = -0.15; P.head = 0.25 - up * 0.3; break; }
    case 'eat': { const c = (t % 2.6) / 2.6, up = c < 0.4 ? Math.sin(c / 0.4 * Math.PI) : 0; P.rs = -0.9 - up * 0.5; P.re = -1.1 - up * 0.8; P.ls = -0.8; P.le = -1.1; P.lz = -0.12; P.head = 0.3 - up * 0.2; break; }
    case 'chat': P.rs = -0.55 + s(t * 2.3) * 0.32; P.re = -0.95 + s(t * 1.9) * 0.2; P.rz = 0.2 + s(t * 1.7) * 0.18; P.ls = -0.35 + s(t * 1.6 + 2) * 0.2; P.le = -0.7; P.head = 0.04 + s(t * 2.2) * 0.07; break;
    case 'browse': { const r = Math.max(0, s(t * 0.9)); P.rs = -0.55 - r * 0.75; P.re = -0.45 + r * 0.2; P.ls = -0.15; P.le = -0.95; P.head = 0.1 - r * 0.15; break; }
    case 'phone': P.rs = -0.75; P.re = -1.55; P.rz = -0.1; P.ls = -0.1; P.le = -0.3; P.head = 0.5 + s(t * 0.7) * 0.05; break;
    case 'wave': P.rs = -2.5; P.re = -0.5; P.rz = 0.35 + s(t * 9) * 0.3; P.ls = -0.1; P.head = 0.45; break;
    case 'drink': { const pr = Math.max(0, s(t * 1.2)); P.rs = -1.25; P.re = -0.45 - pr * 0.25; P.ls = -0.9; P.le = -1.0; P.head = 0.25; break; }
    default: P.rs = -0.05 + s(t * 1.3) * 0.03; P.ls = -0.05 - s(t * 1.3) * 0.03; P.head = 0.05 + s(t * 0.4) * 0.05; k(0);
  }
}

export function createStaff(parent) {
  const crew = [], props = makeProps();
  const P = {};
  const tmp = new THREE.Vector3();

  /**
   * spec: { at: (lx, lz) => [x, z], yaw: shop rotation, look: { uniform, apron, trousers, skin, hair, hat, hatColor },
   *         tasks: [{ to: [lx, lz], face: localAngle, act, dur, prop }] }   face 0 = towards local +z
   */
  function add(spec) {
    const root = new THREE.Object3D(); root.userData.dynamic = true; parent.add(root);
    const node = (par, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); par.add(o); return o; };
    const hips = node(root, 0, 0.95, 0), spine = node(hips, 0, 0.05, 0);
    const torso = node(spine, 0, 0.3, 0), apron = node(spine, 0, 0.17, 0.13), neck = node(spine, 0, 0.56, 0), head = node(neck, 0, 0.08, 0);
    const headC = node(head, 0, 0.1, 0.005), hair = node(head, 0, 0.12, -0.012), hat = node(head, 0, 0.19, 0), brim = node(head, 0, 0.16, 0.12), band = node(head, 0, 0.155, 0);
    const badge = node(spine, -0.085, 0.43, 0.125), lanyard = node(spine, 0, 0.33, 0.128);
    const arm = (side) => { const sh = node(spine, side * 0.215, 0.49, 0), up = node(sh, 0, -0.14, 0), el = node(sh, 0, -0.28, 0), fo = node(el, 0, -0.12, 0), wr = node(el, 0, -0.25, 0), ha = node(wr, 0, -0.03, 0); return { sh, up, el, fo, wr, ha }; };
    const leg = (side) => { const hp = node(hips, side * 0.095, 0, 0), th = node(hp, 0, -0.2, 0), kn = node(hp, 0, -0.43, 0), sn = node(kn, 0, -0.21, 0), sh = node(kn, 0, -0.47, 0.05); return { hp, th, kn, sn, sh }; };
    const R = arm(-1), L = arm(1), LL = leg(1), RL = leg(-1);
    // props held in the right hand
    const held = {};
    for (const task of spec.tasks) if (task.prop && !held[task.prop]) { const m = props[task.prop](); m.visible = false; R.ha.add(m); held[task.prop] = m; }
    for (const name of spec.props || []) if (!held[name]) { const m = props[name](); m.visible = false; R.ha.add(m); held[name] = m; }
    const yaw = spec.yaw || 0;
    const tasks = spec.tasks.map((tk) => { const [x, z] = spec.at(tk.to[0], tk.to[1]); return { ...tk, x, z, heading: yaw + (tk.face || 0) }; });
    root.position.set(tasks[0].x, 0, tasks[0].z); root.rotation.y = tasks[0].heading;
    const look = { apron: null, hat: null, trousers: 0x1d1f24, hair: 0x2a1c12, skin: 0xd9a07a, ...spec.look };
    const person = { root, hips, spine, torso, apron, neck, head, headC, hair, hat, brim, band, badge, lanyard, R, L, LL, RL, held, tasks, look, i: 0, phase: 'act', t: Math.random() * 2, gait: 0, prop: null, manual: !!spec.manual, walking: false, seated: false, act: 'idle', carry: false, lookYaw: null, lookPitch: null };
    crew.push(person);
    return person;
  }

  // instanced parts, created on flush() once the crew is known
  const meshes = {};
  function flush() {
    const n = crew.length; if (!n) return;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const counts = { torso: n, apron: n, neck: n, head: n, hair: n, hat: n, brim: n, badge: n, lanyard: n, band: n, upper: 2 * n, fore: 2 * n, hand: 2 * n, thigh: 2 * n, shin: 2 * n, shoe: 2 * n };
    const c = new THREE.Color();
    for (const k in counts) {
      const m = new THREE.InstancedMesh(PARTS[k], mat, counts[k]); m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(m); meshes[k] = m;
    }
    crew.forEach((p, i) => {
      const L = p.look, set = (k, j, hex) => meshes[k].setColorAt(j, c.set(hex));
      set('torso', i, L.uniform); set('apron', i, L.apron ?? L.uniform); set('neck', i, L.skin); set('head', i, L.skin); set('hair', i, L.hair);
      set('hat', i, L.hatColor ?? L.hair); set('brim', i, L.hatColor ?? L.hair); set('band', i, L.hatColor ?? L.hair);
      set('badge', i, L.badge ?? 0xffffff); set('lanyard', i, L.lanyard ?? 0xffffff);
      for (const s of [0, 1]) { set('upper', 2 * i + s, L.uniform); set('fore', 2 * i + s, L.sleeves === 'long' ? L.uniform : L.skin); set('hand', 2 * i + s, L.skin); set('thigh', 2 * i + s, L.trousers); set('shin', 2 * i + s, L.trousers); set('shoe', 2 * i + s, 0x111214); }
    });
    for (const k in meshes) meshes[k].instanceColor.needsUpdate = true;
    write();
  }

  let allBodies = false;
  function write(focus) {
    if (allBodies) return;
    crew.forEach((p, i) => {
      if (p.body) {                                                  // a real body has taken over (bodies.js): clear this person's parts once
        if (!p.cleared) { p.cleared = true; for (const k in meshes) { const two = meshes[k].count === 2 * crew.length; meshes[k].setMatrixAt(two ? 2 * i : i, HIDE); if (two) meshes[k].setMatrixAt(2 * i + 1, HIDE); } }
        return;
      }
      if (focus && p.far) return;                                    // frozen: its matrices are already in the buffers
      p.root.updateMatrixWorld(true);
      meshes.torso.setMatrixAt(i, p.torso.matrixWorld); meshes.neck.setMatrixAt(i, p.neck.matrixWorld); meshes.head.setMatrixAt(i, p.headC.matrixWorld);
      meshes.apron.setMatrixAt(i, p.look.apron != null ? p.apron.matrixWorld : HIDE);
      const hat = p.look.hat;
      meshes.hair.setMatrixAt(i, hat === 'cap' ? HIDE : p.hair.matrixWorld);          // a visor leaves the hair showing
      meshes.hat.setMatrixAt(i, hat === 'cap' ? p.hat.matrixWorld : HIDE);
      meshes.brim.setMatrixAt(i, hat ? p.brim.matrixWorld : HIDE);
      meshes.band.setMatrixAt(i, hat === 'visor' ? p.band.matrixWorld : HIDE);
      meshes.badge.setMatrixAt(i, p.look.badge != null ? p.badge.matrixWorld : HIDE);
      meshes.lanyard.setMatrixAt(i, p.look.lanyard != null ? p.lanyard.matrixWorld : HIDE);
      [p.R, p.L].forEach((a, s) => { meshes.upper.setMatrixAt(2 * i + s, a.up.matrixWorld); meshes.fore.setMatrixAt(2 * i + s, a.fo.matrixWorld); meshes.hand.setMatrixAt(2 * i + s, a.ha.matrixWorld); });
      [p.RL, p.LL].forEach((l, s) => { meshes.thigh.setMatrixAt(2 * i + s, l.th.matrixWorld); meshes.shin.setMatrixAt(2 * i + s, l.sn.matrixWorld); meshes.shoe.setMatrixAt(2 * i + s, l.sh.matrixWorld); });
    });
    for (const k in meshes) meshes[k].instanceMatrix.needsUpdate = true;
    if (crew.every((p) => p.cleared)) { allBodies = true; for (const k in meshes) meshes[k].visible = false; }
  }

  /** focus: {x, z} (the cat). Staff more than 30 m away hold their pose, so a big crew stays cheap. */
  function update(dt, time, focus) {
    for (let i = 0; i < crew.length; i++) {
      const p = crew[i], tk = p.tasks[p.i];
      if (p.manual) {                                                   // driven by a controller (shoppers): it moves the root and sets act/walking/seated
        p.far = false; p.t += dt;
        if (p.walking) p.gait += dt * 7.5 * (p.pace || 1); else p.gait *= 0.9;
      } else {
      p.far = !!focus && Math.abs(p.root.position.x - focus.x) + Math.abs(p.root.position.z - focus.z) > 30;
      if (p.far) continue;
      p.t += dt;
      if (p.phase === 'walk') {
        const dx = tk.x - p.root.position.x, dz = tk.z - p.root.position.z, d = Math.hypot(dx, dz);
        if (d < 0.05) { p.phase = 'act'; p.t = 0; }
        else {
          const step = Math.min(d, 1.05 * dt); p.root.position.x += dx / d * step; p.root.position.z += dz / d * step;
          turnTo(p, Math.atan2(dx, dz), dt * 7);
          p.gait += dt * 7.5;
        }
      } else {
        turnTo(p, tk.heading, dt * 5);
        p.gait *= 0.9;
        if (p.t > tk.dur) {
          if (p.prop) p.prop.visible = false;
          p.i = (p.i + 1) % p.tasks.length; p.phase = 'walk'; p.t = 0;
          const nx = p.tasks[p.i]; p.prop = nx.prop ? p.held[nx.prop] : null;
          if (p.prop && nx.carry) p.prop.visible = true;
        } else if (p.prop) p.prop.visible = true;
      }
      }
      if (p.body) continue;                                             // posed by its skinned body instead
      // pose: walking blends to a gait, otherwise the activity
      const walking = p.manual ? p.walking : p.phase === 'walk';
      pose(walking ? 'walk' : p.manual ? p.act : tk.act, p.t + i * 0.37, P);
      const g = Math.sin(p.gait), swing = walking ? 0.55 : 0;
      p.LL.hp.rotation.x = g * swing; p.RL.hp.rotation.x = -g * swing;
      p.LL.kn.rotation.x = walking ? Math.max(0, -g) * 0.7 : P.crouch * 1.6; p.RL.kn.rotation.x = walking ? Math.max(0, g) * 0.7 : P.crouch * 1.6;
      if (!walking && P.crouch) { p.LL.hp.rotation.x = -P.crouch * 0.8; p.RL.hp.rotation.x = -P.crouch * 0.8; }
      p.hips.position.y = 0.95 - P.crouch * 0.18 + (walking ? Math.abs(Math.cos(p.gait)) * 0.025 : Math.sin(time * 2 + i) * 0.004);
      p.R.sh.rotation.x = walking ? -g * 0.35 : P.rs; p.R.el.rotation.x = walking ? -0.25 : P.re; p.R.sh.rotation.z = walking ? 0.06 : P.rz; p.R.wr.rotation.z = walking ? 0 : P.wrist;
      p.L.sh.rotation.x = walking ? g * 0.35 : P.ls; p.L.el.rotation.x = walking ? -0.25 : P.le; p.L.sh.rotation.z = walking ? -0.06 : P.lz;
      p.spine.rotation.x = walking ? 0.04 : P.spine; p.head.rotation.x = walking ? 0.02 : P.head; p.head.rotation.y = walking ? 0 : Math.sin(time * 0.5 + i * 2) * 0.2;
      if (p.manual) {
        if (p.seated) {                                                 // thighs forward, shins down, hips on the seat
          p.hips.position.y = (p.seatH || 0.46) + 0.07; p.LL.hp.rotation.x = p.RL.hp.rotation.x = -1.5; p.LL.kn.rotation.x = p.RL.kn.rotation.x = (p.seatH || 0.46) > 0.6 ? 1.0 : 1.45;
        }
        if (walking && p.carry) { p.R.sh.rotation.x = -0.6; p.R.el.rotation.x = -1.0; }
        if (p.lookYaw != null) { p.head.rotation.y = p.lookYaw; p.head.rotation.x = p.lookPitch ?? p.head.rotation.x; }
      }
    }
    if (crew.length) write(focus);
  }

  function turnTo(p, target, k) {
    let d = target - p.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    p.root.rotation.y += d * Math.min(1, k);
  }

  return { add, flush, update, crew, tmp };
}
