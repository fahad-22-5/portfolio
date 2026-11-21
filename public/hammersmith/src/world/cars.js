/**
 * Cars with contoured bodies. Each body is a side-profile Shape (sloped
 * bonnet, raked pillars, wheel-arch cut-outs) extruded across the car's
 * width with bevels; the cabin is a second extrusion with window openings
 * and a tinted glass core set in behind the pillars.
 *
 * Every vehicle, parked or moving, lives in the same set of InstancedMeshes.
 * Parked cars are written once. Moving traffic is a pool of cars, vans,
 * black cabs and buses: each drives a route (in along one road, round the
 * gyratory, out along another; the buses go in and out of the ramp portal),
 * keeps its distance from whatever is ahead, gives way where a road joins,
 * stops at red lights and for the cat, and goes back to the pool at the end.
 * Two signalled crossings run on timers; ctx.signals tells the rest of the
 * world (pedestrians, later) which way each one is showing.
 */
import * as THREE from 'three';
import { addContact } from './sim.js';
import { canvasTex, FONT, TAU } from '../util.js';
import { BUTE_X } from '../mapData.js';
import { P } from './stationStreet.js';
import { BUS, ROUTES, busParts, busLabels, busNight } from './bus.js';

const W = 1.72, WHEEL_R = 0.31, ARCH_R = 0.38;

// [body, roof/pillars] - two-tone where they differ
const LIVERY = [
  [0x1b4332, 0x111111], [0xb9bec5, 0xb9bec5], [0x3b3f45, 0x3b3f45], [0x1e3a6e, 0x1e3a6e],
  [0x8c1f1f, 0xf1f1ee], [0xe8e8e4, 0x111111], [0x202328, 0x202328], [0x6f7f8c, 0x6f7f8c], [0x1b4332, 0x1b4332],
];

const TYPES = {
  // green-Mini-like hatchback
  hatch: {
    L: 3.85, wx: 1.25, tail: 0.9, deck: [[0.72, 0.94], [1.7, 0.8]],
    cab: [[-1.78, 0.92], [-1.52, 1.4], [0.12, 1.43], [0.8, 0.93]],
    wins: [[[0.56, 1.0], [0.1, 1.34], [-0.42, 1.34], [-0.42, 1.0]], [[-0.54, 1.0], [-0.54, 1.34], [-1.4, 1.33], [-1.58, 1.0]]],
  },
  // longer three-box saloon
  saloon: {
    L: 4.5, wx: 1.42, tail: 0.88, deck: [[-2.1, 0.99], [-1.3, 1.0], [0.95, 0.97], [2.02, 0.82]],
    cab: [[-1.42, 0.98], [-0.9, 1.4], [0.3, 1.43], [1.04, 0.96]],
    wins: [[[0.8, 1.03], [0.3, 1.35], [-0.2, 1.35], [-0.2, 1.03]], [[-0.32, 1.03], [-0.32, 1.35], [-0.86, 1.34], [-1.18, 1.03]]],
  },
  // London black cab: a tall cabin on a saloon floor
  cab: {
    L: 4.6, wx: 1.42, tail: 0.95, deck: [[-2.2, 1.02], [-1.45, 1.04], [1.05, 1.0], [2.2, 0.86]],
    cab: [[-1.9, 1.02], [-1.72, 1.8], [0.4, 1.82], [1.1, 1.0]],
    wins: [[[0.86, 1.08], [0.36, 1.72], [-0.3, 1.72], [-0.3, 1.08]], [[-0.42, 1.08], [-0.42, 1.72], [-1.6, 1.71], [-1.72, 1.08]]],
  },
  // Transit-size panel van: the body is the full height, so the cab's glazing sits a hair proud of the sides
  van: {
    L: 5.3, W: 1.96, wx: 1.72, tail: 1.95, deck: [[-2.45, 2.05], [0.95, 2.05], [1.72, 1.22], [2.5, 1.05]], mirrorY: 1.35, proud: true,
    cab: [[0.15, 1.2], [0.3, 1.97], [1.0, 2.02], [1.8, 1.21]],
    wins: [[[1.62, 1.27], [1.02, 1.92], [0.5, 1.92], [0.45, 1.27]]],
  },
};

/** Extrude a side profile (x = along the car, y = up) across `width`, then turn it so +Z is the front. */
function extrudeAcross(shape, width, bevel) {
  const depth = width - (bevel ? bevel.bevelThickness * 2 : 0);
  return new THREE.ExtrudeGeometry(shape, { depth, curveSegments: 10, bevelEnabled: !!bevel, bevelSegments: 2, ...bevel })
    .translate(0, 0, -depth / 2).rotateY(-Math.PI / 2);
}

function carGeometry(t) {
  const h = t.L / 2, a = Math.asin((0.2 - WHEEL_R) / ARCH_R), reach = ARCH_R * Math.cos(a);
  const body = new THREE.Shape();
  body.moveTo(-h + 0.04, 0.34); body.lineTo(-h, 0.55); body.lineTo(-h + 0.03, t.tail);
  t.deck.forEach(([x, y]) => body.lineTo(x, y));
  body.lineTo(h, 0.62); body.lineTo(h - 0.03, 0.34); body.lineTo(h - 0.14, 0.2);
  body.lineTo(t.wx + reach, 0.2); body.absarc(t.wx, WHEEL_R, ARCH_R, a, Math.PI - a, false);       // front arch
  body.lineTo(-t.wx + reach, 0.2); body.absarc(-t.wx, WHEEL_R, ARCH_R, a, Math.PI - a, false);     // rear arch
  body.lineTo(-h + 0.16, 0.2); body.closePath();

  const poly = (pts, Cls) => { const p = new Cls(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
  const shell = poly(t.cab, THREE.Shape);
  t.wins.forEach((w) => shell.holes.push(poly(w, THREE.Path)));
  // glass core: same outline, a touch longer so the screens stand proud of the shell, and narrower so it sits behind the pillars
  const cx = (t.cab[0][0] + t.cab[3][0]) / 2, base = t.cab[0][1];
  const glass = poly(t.cab.map(([x, y]) => [cx + (x - cx) * 1.045, base + (y - base) * 0.985]), THREE.Shape);

  return {
    body: extrudeAcross(body, t.W || W, { bevelThickness: 0.08, bevelSize: 0.06 }),
    shell: extrudeAcross(shell, t.proud ? (t.W || W) + 0.03 : (t.W || W) - 0.22, { bevelThickness: 0.03, bevelSize: 0.02 }),
    glass: extrudeAcross(glass, t.proud ? (t.W || W) + 0.01 : (t.W || W) - 0.34, null),
  };
}

function alloyTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#0c0c0d'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#c9ccd1'; g.lineWidth = 9; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke();
    g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const an = i * TAU / 5 - Math.PI / 2;
      g.lineWidth = 15; g.strokeStyle = '#b4b8be';
      g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(an) * 50, 64 + Math.sin(an) * 50); g.stroke();
      g.lineWidth = 5; g.strokeStyle = '#e4e6e9';
      g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(an) * 48, 64 + Math.sin(an) * 48); g.stroke();
    }
    g.fillStyle = '#8d9197'; g.beginPath(); g.arc(64, 64, 13, 0, TAU); g.fill();
    g.fillStyle = '#2a2b2e'; g.beginPath(); g.arc(64, 64, 5, 0, TAU); g.fill();
  });
}

const plateTexture = (bg, text) => canvasTex(256, 60, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, 256, 60);
  g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, 252, 56);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 44px ${FONT}`; g.fillText(text, 128, 33);
});

export function buildCars(ctx, g, loop, roads = []) {
  const { col } = ctx;
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1 });
  const tint = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.05, metalness: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95 });
  const black = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.12, metalness: 1 });
  const alloy = new THREE.MeshStandardMaterial({ map: alloyTexture(), roughness: 0.3, metalness: 0.6 });
  const head = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0cf, emissiveIntensity: 0.6, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: 0xb3120e, emissive: 0x7a0a08, emissiveIntensity: 0.6, roughness: 0.25 });
  const plate = (bg, text) => new THREE.MeshStandardMaterial({ map: plateTexture(bg, text), roughness: 0.5 });

  // part registry: key -> { geo, mat, items: [{ car, local, color }] }
  const parts = {};
  const def = (key, geo, mat) => { parts[key] = { geo, mat, items: [] }; };
  for (const [name, t] of Object.entries(TYPES)) {
    const geo = carGeometry(t);
    def(`body_${name}`, geo.body, paint); def(`shell_${name}`, geo.shell, paint); def(`glass_${name}`, geo.glass, tint);
  }
  def('tyre', new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.21, 18).rotateZ(Math.PI / 2), rubber);
  def('hub', new THREE.CircleGeometry(0.215, 20).rotateY(Math.PI / 2), alloy);
  def('liner', new THREE.BoxGeometry(W - 0.34, 0.44, 0.78), black);
  def('head', new THREE.SphereGeometry(0.115, 12, 8).scale(1.15, 0.85, 0.5), head);
  def('tail', new THREE.BoxGeometry(0.34, 0.15, 0.05), tail);
  def('trim', new THREE.BoxGeometry(0.39, 0.2, 0.04), chrome);
  def('grille', new THREE.BoxGeometry(0.86, 0.13, 0.05), black);
  def('mirror', new THREE.BoxGeometry(0.17, 0.1, 0.09), paint);
  def('plateF', new THREE.PlaneGeometry(0.52, 0.12), plate('#f8f9fa', 'LD25 CAT'));
  def('plateR', new THREE.PlaneGeometry(0.52, 0.12).rotateY(Math.PI), plate('#facc15', 'LD25 CAT'));
  // bus parts (unit boxes, sized per instance), its destination blind, and the cab's roof light
  def('boxRed', new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc8121a, roughness: 0.45, envMapIntensity: 0.45 }));
  def('boxTint', new THREE.BoxGeometry(1, 1, 1), tint);
  def('boxBlack', new THREE.BoxGeometry(1, 1, 1), black);
  def('blind', new THREE.PlaneGeometry(1.9, 0.42), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(256, 56, (c) => { c.fillStyle = '#0b0b0c'; c.fillRect(0, 0, 256, 56); c.fillStyle = '#ffb020'; c.font = `700 34px ${FONT}`; c.textBaseline = 'middle'; c.fillText('9   Hammersmith', 8, 30); }) }));
  def('taxi', new THREE.BoxGeometry(0.46, 0.14, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.1, 0.35), toneMapped: false }));

  // lamps the traffic switches on and off: brake lights, and indicators front and back
  def('brakeLit', new THREE.BoxGeometry(0.34, 0.15, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.18, 0.12), toneMapped: false }));
  def('indLit', new THREE.BoxGeometry(0.13, 0.09, 0.03), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.05, 0.08), toneMapped: false }));
  const all = [];
  function addCar(type, x, z, ry, livery, moving = false, colors = null) {
    const t = TYPES[type], h = t.L / 2, [bodyC, roofC] = colors || LIVERY[livery % LIVERY.length], WW = t.W || W;
    const car = { x, z, ry, t, moving, matrix: new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z), refs: [] };
    const put = (key, px, py, pz, r = 0, color) => parts[key].items.push({ car, color, local: new THREE.Matrix4().makeRotationY(r).setPosition(px, py, pz) });
    put(`body_${type}`, 0, 0, 0, 0, bodyC); put(`shell_${type}`, 0, 0, 0, 0, roofC); put(`glass_${type}`, 0, 0, 0);
    for (const sz of [-1, 1]) {
      put('liner', 0, 0.44, sz * t.wx);
      for (const sx of [-1, 1]) {
        put('tyre', sx * (WW / 2 - 0.1), WHEEL_R, sz * t.wx);
        put('hub', sx * (WW / 2 + 0.008), WHEEL_R, sz * t.wx, sx > 0 ? 0 : Math.PI);
      }
    }
    for (const sx of [-1, 1]) {
      put('head', sx * 0.6, 0.63, h + 0.02);
      put('trim', sx * 0.58, 0.72, -h - 0.045); put('tail', sx * 0.58, 0.72, -h - 0.062);
      put('mirror', sx * (WW / 2 + 0.03), t.mirrorY || 0.99, t.cab[3][0] - 0.12, 0, bodyC);
    }
    put('grille', 0, 0.5, h + 0.045); put('plateF', 0, 0.38, h + 0.075); put('plateR', 0, 0.6, -h - 0.075);
    if (moving) {
      const lamp = (key, px, py, pz, tag) => parts[key].items.push({ car, lamp: tag, local: new THREE.Matrix4().setPosition(px, py, pz) });
      for (const sx of [-1, 1]) { const side = sx > 0 ? 'indL' : 'indR'; lamp('brakeLit', sx * 0.58, 0.72, -h - 0.085, 'brake'); lamp('indLit', sx * (WW / 2 - 0.1), 0.72, -h - 0.08, side); lamp('indLit', sx * (WW / 2 - 0.14), 0.62, h + 0.065, side); }
    }
    all.push(car);
    return car;
  }

  /* ---------- parked, kerb-side ---------- */
  const row = (x, z0, z1, gapEvery, seed) => {
    for (let z = z0, i = 0; z > z1; z -= 5.7, i++) {
      if ((i + seed) % gapEvery === gapEvery - 1) continue;                       // leave the odd empty bay
      const type = (i + seed) % 3 === 1 ? 'saloon' : 'hatch', ry = (i + seed) % 5 === 0 ? Math.PI : 0;
      const car = addCar(type, x + ((i * 7 + seed) % 3 - 1) * 0.05, z, ry, i * 4 + seed * 3);
      addContact(car.x, z, 1.15, car.t.L * 0.55, ry);                   // soft shadow pooled under the body
      const c = Math.cos(ry), s = Math.sin(ry), t = car.t, cabZ = (t.cab[0][0] + t.cab[3][0]) / 2, cabL = t.cab[3][0] - t.cab[0][0] - 0.5;
      col.rect(car.x, z, W, t.L, { rot: ry, h: 0.95, pad: 0.1 });                 // flat bonnet/boot: hop-on height
      col.rect(car.x + cabZ * s, z + cabZ * c, 1.5, cabL, { rot: ry, h: 1.43 }).perch = 'a parked car';  // flat roof
    }
  };
  row(BUTE_X + 3.4, -124, -216, 4, 0);         // Bute Gardens, east kerb
  row(BUTE_X + 77.4, -118, -250, 3, 2);        // Wolverton Gardens
  row(BUTE_X + 160.6, -120, -270, 3, 1);       // Rowan Rd

  /* ---------- moving traffic: the gyratory and the roads in and out of it ---------- */
  // the pool: every vehicle is a set of instances in the meshes built below, kept out of sight until a route needs it
  const pool = [];
  const mk = (type, n, liveries) => { for (let i = 0; i < n; i++) { const car = addCar(type, 0, 0, 0, 0, true, liveries[i % liveries.length]); car.kind = type; car.len = TYPES[type].L; car.wid = TYPES[type].W || W; pool.push(car); } };
  mk('hatch', 11, LIVERY); mk('saloon', 10, LIVERY.slice(1));
  mk('van', 7, [[0xf1f2f3, 0xf1f2f3], [0xf1f2f3, 0xf1f2f3], [0xb9bec5, 0xb9bec5], [0x1e3a6e, 0x1e3a6e]]);
  mk('cab', 7, [[0x0e0f11, 0x0e0f11]]);
  for (const car of pool) if (car.kind === 'cab') parts.taxi.items.push({ car, local: new THREE.Matrix4().setPosition(0, 1.87, 0.5) });
  const busKinds = {};
  for (const type of ['dd', 'dd', 'dd', 'dd', 'dd', 'dd', 'dd', 'sd', 'sd', 'sd']) {   // enough for the road and the deck at once
    const kit = busKinds[type] || (busKinds[type] = busParts(type));
    const car = { x: 0, z: 0, ry: 0, moving: true, matrix: new THREE.Matrix4(), refs: [], kind: 'bus', btype: type, len: BUS[type].L, wid: BUS[type].W };
    for (const pt of kit) { if (!parts[pt.key]) def(pt.key, pt.geo, pt.mat); parts[pt.key].items.push({ car, lamp: pt.lamp, local: new THREE.Matrix4() }); }
    car.labels = busLabels(type); car.labels.group.matrixAutoUpdate = false; g.add(car.labels.group);
    pool.push(car);
  }

  // build the InstancedMeshes; moving vehicles remember which instances are theirs
  const _m = new THREE.Matrix4(), _c = new THREE.Color(), _s = new THREE.Vector3(1, 1, 1), meshes = [];
  for (const p of Object.values(parts)) {
    if (!p.items.length) continue;
    const mesh = new THREE.InstancedMesh(p.geo, p.mat, p.items.length);
    p.items.forEach((it, i) => {
      mesh.setMatrixAt(i, _m.multiplyMatrices(it.car.matrix, it.local));
      if (it.color !== undefined) mesh.setColorAt(i, _c.set(it.color));
      if (it.car.moving) it.car.refs.push({ mesh, i, local: it.local, lamp: it.lamp || null });
    });
    mesh.castShadow = p.mat !== alloy && !p.mat.transparent && !p.mat.isMeshBasicMaterial; mesh.receiveShadow = true;
    mesh.frustumCulled = false;                       // instances are spread across the whole map
    g.add(mesh); meshes.push(mesh);
  }
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const write = (car) => {                                        // every part of a vehicle follows its matrix; a lamp that is off folds away to nothing
    const lit = car.lit;
    for (let r = 0; r < car.refs.length; r++) { const f = car.refs[r]; f.mesh.setMatrixAt(f.i, f.lamp && !(lit && lit[f.lamp]) ? ZERO : _m.multiplyMatrices(car.matrix, f.local)); }
    if (car.labels) { car.labels.group.matrix.copy(car.matrix); car.labels.group.matrixWorldNeedsUpdate = true; }
  };
  const hide = (car) => { car.matrix.makeTranslation(0, -80, 0); write(car); };
  pool.forEach(hide);

  /* ---------- routes ---------- */
  // UK rules: keep left. On the one-way gyratory (clockwise) the outer lane is on the left of travel; roads leave and join on that side.
  const N = loop.length;
  const lanePt = (i, lane) => { const a = loop[(i - 1 + N) % N], b = loop[(i + 1) % N], q = loop[(i + N) % N], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [q[0] + dz / L * lane, q[1] - dx / L * lane]; };
  const nearest = (x, z) => { let bi = 0, bd = Infinity; for (let i = 0; i < N; i++) { const d = (loop[i][0] - x) ** 2 + (loop[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  const section = (i0, i1, lane) => { const out = []; let i = (i0 + N) % N; const end = (i1 + N) % N; for (let k = 0; k <= N; k++) { out.push(lanePt(i, lane)); if (i === end) break; i = (i + 1) % N; } return out; };
  /** One carriageway of a road: its centre line from the junction outwards (cut to `reach` m), moved to the left of travel. */
  const side = (road, outward, reach = 300) => {
    const cut = [road.pts[0]]; let left = reach;
    for (let i = 1; i < road.pts.length && left > 0; i++) { const a = road.pts[i - 1], b = road.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.min(1, left / L); cut.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); left -= L; }
    const line = outward ? cut : cut.slice().reverse(), off = road.w / 4, n = line.length;
    return line.map((q, i) => { const a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [q[0] + dz / L * off, q[1] - dx / L * off]; });
  };
  const toward = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.min(1, d / L); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  /** End an approach where a waiting vehicle's nose is clear of the gyratory's outer lane (roads join at a slant, so a fixed distance is not enough). */
  const holdBack = (A) => {
    const e = A[A.length - 1], q = A[A.length - 2];
    for (let d = 9; d <= 40; d++) { const c = toward(e, q, d); let m = Infinity; for (const o of loop) m = Math.min(m, (o[0] - c[0]) ** 2 + (o[1] - c[1]) ** 2); if (m > 7.2 * 7.2 || d === 40) { A[A.length - 1] = c; return; } }
  };
  /** The turn between two lanes: a curve that leaves the first along its direction and joins the second along its own,
   *  instead of a straight line that cuts across the corner of the pavement. */
  const bend = (p0, q0, p1, q1) => {
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), u = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const d0 = u(q0, p0), d1 = u(p1, q1), c1 = [p0[0] + d0[0] * L * 0.45, p0[1] + d0[1] * L * 0.45], c2 = [p1[0] - d1[0] * L * 0.45, p1[1] - d1[1] * L * 0.45], out = [];
    for (let k = 1; k < 6; k++) { const t = k / 6, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3; out.push([a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]]); }
    return out;
  };
  const routes = [], CARS = ['hatch', 'hatch', 'saloon', 'saloon', 'van', 'cab', 'hatch', 'cab', 'saloon', 'van'];
  const mkRoute = (pts, o = {}) => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); const r = { pts, cum, len: cum[cum.length - 1], vmax: 9, kinds: CARS, every: 11, timer: 2 + routes.length * 1.7, loopFrom: 0, loopTo: 0, ...o }; routes.push(r); return r; };
  const R = Object.fromEntries(roads.map((r) => [r.name, r]));
  // coming in, Hammersmith Road traffic turns left down the junction arm to the north-east corner; Rin is the roads as driven inbound
  const Rin = { ...R }; if (R['Broadway junction'] && R['Hammersmith Rd']) Rin['Hammersmith Rd'] = { ...R['Hammersmith Rd'], pts: [R['Broadway junction'].pts[0], ...R['Hammersmith Rd'].pts.slice(1)] };
  if (R['Fulham Palace Rd']) R['Fulham Palace Rd'] = { ...R['Fulham Palace Rd'], pts: [[-25.6, 113], [-24, 128], [-15.2, 300]] };   // from where it meets the gyratory's south side
  const inOut = (nameIn, nameOut, o = {}) => {
    const rin = Rin[nameIn], rout = R[nameOut]; if (!rin || !rout) return null;
    const A = side(rin, false), B = side(rout, true), lane = 3.2;
    holdBack(A);                        // hold back from the junction, in lane
    B[0] = toward(B[0], B[1], 9);
    const mid = section(nearest(...rin.pts[0]) + 4, nearest(...rout.pts[0]) - 3, lane), n = mid.length;
    const b1 = bend(A[A.length - 1], A[A.length - 2], mid[0], mid[1]), b2 = bend(mid[n - 1], mid[n - 2], B[0], B[1]), m0 = A.length + b1.length;
    const r = mkRoute([...A, ...b1, ...mid, ...b2, ...B], o);
    r.yieldS = r.cum[A.length - 1] - 1.5; r.merge = mid[0]; r.mergeDist = r.cum[m0] - r.cum[A.length - 1]; r.loopFrom = r.cum[m0]; r.loopTo = r.cum[m0 + n - 1];
    return r;
  };
  for (const [a, b] of [['Hammersmith Rd', 'Fulham Palace Rd'], ['Hammersmith Rd', 'King St'], ['Fulham Palace Rd', 'King St'], ['Fulham Palace Rd', 'Hammersmith Rd'], ['King St', 'Hammersmith Rd'], ['King St', 'Fulham Palace Rd'],
    ["Shepherd's Bush Rd", 'Hammersmith Rd'], ["Shepherd's Bush Rd", 'Fulham Palace Rd'], ['Beadon Rd', 'Hammersmith Rd'], ['Beadon Rd', 'King St']]) inOut(a, b);
  // round and round on the inner lane
  { const pts = section(0, N - 1, -3.2); pts.push(pts[0]); const r = mkRoute(pts, { cyclic: true, every: 1e9 }); r.loopTo = r.len; }
  // buses: in from Hammersmith Road, right round the gyratory on the inner lane and up the ramp; and out of the ramp to Hammersmith Road
  // two lanes through the arch: in on the west side, out on the east (the side with the no-entry plates), so the paths never cross
  const portalIn = [P(27, 17.5), P(23.4, 20.4), P(19.5, 21.4), P(13, 21.4), P(5.4, 21.4)], portalOut = [P(5.4, 25.6), P(13, 25.6), P(19.5, 25.6), P(23.6, 26.6), P(26.2, 29.5)];
  // every road the routes use: in along it, round the gyratory on the inner lane and up the ramp; and out of the ramp,
  // round on the outer lane, and away along it. Each bus is given a route that really leaves by that road.
  [...new Set(ROUTES.map((e) => e.road))].forEach((road, ri) => {
    const rd = R[road], rdIn = Rin[road]; if (!rd || !rdIn) return;
    const A = side(rdIn, false), B = side(rd, true);
    holdBack(A); B[0] = toward(B[0], B[1], 9);
    const mid = section(nearest(...rdIn.pts[0]) + 4, nearest(...P(31, 13)), -3.2);
    const b1 = bend(A[A.length - 1], A[A.length - 2], mid[0], mid[1]), bp = bend(mid[mid.length - 1], mid[mid.length - 2], portalIn[0], portalIn[1]), m0 = A.length + b1.length;
    const rin = mkRoute([...A, ...b1, ...mid, ...bp, ...portalIn], { kinds: ['bus'], road, every: 100, timer: 6 + ri * 21, vmax: 7.5, portalEnd: true });
    rin.yieldS = rin.cum[A.length - 1] - 1.5; rin.merge = mid[0]; rin.mergeDist = rin.cum[m0] - rin.cum[A.length - 1]; rin.loopFrom = rin.cum[m0]; rin.loopTo = rin.cum[m0 + mid.length - 1];
    const out = portalOut;
    const mid2 = section(nearest(...P(27.6, 33)) + 1, nearest(...rd.pts[0]) - 3, 3.2);   // out on the outer lane: it gives way once, pulling out, and never cuts across to its exit
    const bo = bend(out[out.length - 1], out[out.length - 2], mid2[0], mid2[1]), b2 = bend(mid2[mid2.length - 1], mid2[mid2.length - 2], B[0], B[1]), m2 = out.length + bo.length;
    const rout = mkRoute([...out, ...bo, ...mid2, ...b2, ...B], { kinds: ['bus'], road, every: 1e9, timer: 1e9, vmax: 7.5, portalStart: true });   // only buses that have been up to the deck come out
    rout.yieldS = rout.cum[1] + 3; rout.merge = mid2[0]; rout.mergeDist = rout.cum[m2] - rout.yieldS;   // it waits with its nose just out of the arch
    rout.loopFrom = rout.cum[m2]; rout.loopTo = rout.cum[m2 + mid2.length - 1];
    rout.stopS = Math.min(rout.cum[m2 + mid2.length + b2.length] + 85, rout.len - 40); rout.stopName = road;   // the first stop out along the road
  });

  /* ---------- signals: two crossings on timers ---------- */
  // front: the crossing outside the station entrance (heads registered by stationStreet.js). bute: Hammersmith Road by B&K.
  const sig = ctx.signals = { front: { state: 'G', walk: false, cycle: 44, offset: 0 }, bute: { state: 'G', walk: false, cycle: 46, offset: 21 } };
  const heads = ctx.signalHeads || (ctx.signalHeads = []);
  const stopLines = [];
  const dirE = (() => { const a = P(31, 0), b = P(31, 10), L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; })();   // the way the traffic runs past the station
  { const [x, z] = P(31, 3.4); stopLines.push({ x, z, hx: dirE[0], hz: dirE[1], half: 7.6, site: sig.front, len: 14.6 }); }
  stopLines.push({ x: 80.6, z: -102.7, hx: 1, hz: 0, half: 3.6, site: sig.bute, len: 6.6 }, { x: 87.4, z: -95.7, hx: -1, hz: 0, half: 3.6, site: sig.bute, len: 6.6 });
  {
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 }), poleM = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5 }), headM = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.6 });
    for (const L of stopLines) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.012, L.len), white); bar.position.set(L.x, 0.046, L.z); bar.rotation.y = Math.atan2(L.hz, -L.hx); bar.receiveShadow = true; g.add(bar); }
    // the Hammersmith Road crossing: a pole and head on each kerb, studs across the carriageway
    for (const [x, z, fx] of [[81.4, -106.75, -1], [86.6, -91.65, 1]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.5, 10), poleM); pole.position.set(x, 1.75, z); pole.castShadow = true; g.add(pole);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.0, 0.34), headM); hd.position.set(x, 3.0, z); g.add(hd);
      heads.push({ site: 'bute', x: x + fx * 0.14, y: 3.3, z });
      col.rect(x, z, 0.14, 0.14, { h: 3.4, pad: 0.04 });
    }
    const studs = []; for (const x of [82.6, 85.4]) for (let z = -105.6; z <= -92.7; z += 0.9) studs.push([x, z]);
    const sm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.012, 0.12), white, studs.length); studs.forEach(([x, z], i) => sm.setMatrixAt(i, _m.makeTranslation(x, 0.046, z))); sm.receiveShadow = true; g.add(sm);
  }
  // three lamps per head, lit by the state of its crossing
  const lampMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.max(1, heads.length * 3));
  heads.forEach((h, i) => { for (let k = 0; k < 3; k++) lampMesh.setMatrixAt(i * 3 + k, _m.makeTranslation(h.x, h.y - k * 0.3, h.z)); });
  lampMesh.frustumCulled = false; lampMesh.userData.dynamic = true; g.add(lampMesh);
  const LAMP = { on: [new THREE.Color(2.0, 0.22, 0.16), new THREE.Color(2.0, 1.25, 0.2), new THREE.Color(0.25, 1.9, 0.5)], off: [new THREE.Color(0.16, 0.03, 0.03), new THREE.Color(0.14, 0.1, 0.03), new THREE.Color(0.03, 0.12, 0.05)] };
  const LIT = { G: [0, 0, 1], A: [0, 1, 0], R: [1, 0, 0], RA: [1, 1, 0] };
  const paintLamps = () => { heads.forEach((h, i) => { const lit = LIT[sig[h.site].state]; for (let k = 0; k < 3; k++) lampMesh.setColorAt(i * 3 + k, lit[k] ? LAMP.on[k] : LAMP.off[k]); }); if (lampMesh.instanceColor) lampMesh.instanceColor.needsUpdate = true; };
  paintLamps();

  /* ---------- driving ---------- */
  const walkers = ctx.walkers || (ctx.walkers = { n: 0, x: new Float32Array(64), z: new Float32Array(64) });   // people on the carriageway (pedestrians.js)
  const act = [], MAX = 34; let seq = 0, nCars = 0;      // MAX counts cars, vans and cabs; the three buses always have a slot
  const place = (v) => {                                         // where the vehicle is on its route, and which way it points
    const r = v.route; if (v.s < r.cum[v.i]) v.i = 0; while (v.i < r.pts.length - 2 && v.s >= r.cum[v.i + 1]) v.i++;
    const a = r.pts[v.i], b = r.pts[v.i + 1], L = r.cum[v.i + 1] - r.cum[v.i] || 1, f = (v.s - r.cum[v.i]) / L;
    v.x = a[0] + (b[0] - a[0]) * f; v.z = a[1] + (b[1] - a[1]) * f; v.fx = (b[0] - a[0]) / L; v.fz = (b[1] - a[1]) / L;
  };
  /** The way the route points at distance s along it (for indicators: a turn coming up). */
  const headingAt = (r, s) => { if (r.cyclic) s = ((s % r.len) + r.len) % r.len; else s = Math.min(Math.max(0, s), r.len - 0.01); let i = 0; while (i < r.pts.length - 2 && s >= r.cum[i + 1]) i++; const a = r.pts[i], b = r.pts[i + 1]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const spawn = (r, s) => {
    if (r.kinds[0] !== 'bus' && nCars >= MAX) return false;
    const kind = r.kinds[(Math.random() * r.kinds.length) | 0], line = r.road ? (() => { const o = ROUTES.filter((e) => e.road === r.road); return o[(Math.random() * o.length) | 0]; })() : null;
    const k = pool.findIndex((c) => c.kind === kind && (!line || c.btype === line.type)); if (k < 0) return false;
    const v = { id: ++seq, wait: 0, car: pool[k], route: r, s, v: r.vmax * 0.8, i: 0, x: 0, z: 0, fx: 0, fz: 1, len: pool[k].len, wid: pool[k].wid, cruise: r.vmax * (0.85 + Math.random() * 0.3) };
    place(v);
    for (const o of act) if ((o.x - v.x) ** 2 + (o.z - v.z) ** 2 < 15 * 15) return false;      // not on top of something
    pool.splice(k, 1); v.car.ry = Math.atan2(v.fx, v.fz); act.push(v); if (kind !== 'bus') nCars++;
    if (line) { v.line = line; v.car.labels.set(line.n, r.portalEnd ? 'Hammersmith' : line.dest, line.op); }   // arriving buses show Hammersmith
    return true;
  };
  // the street starts busy: a couple of vehicles already on every route, and four going round
  for (const r of routes) { if (r.cyclic) for (let k = 0; k < 4; k++) spawn(r, r.len * (k + 0.3) / 4); else if (r.portalEnd) spawn(r, r.len * 0.7); else if (!r.portalStart) for (const f of [0.22, 0.62]) spawn(r, r.len * f); }   // and a bus already on its way round to the ramp

  ctx.updaters.push((dt, t) => {
    if (ctx.zones) busNight(ctx.zones.uniforms.uNight.value);
    const cat = ctx.catPos;
    // signal phases: green, amber, red while people cross, red and amber
    let changed = false;
    for (const key of ['front', 'bute']) { const S = sig[key], ph = (t + S.offset) % S.cycle, st = ph < S.cycle - 19 ? 'G' : ph < S.cycle - 16 ? 'A' : ph < S.cycle - 2 ? 'R' : 'RA'; if (st !== S.state) { S.state = st; changed = true; } S.walk = st === 'R' && ph > S.cycle - 15 && ph < S.cycle - 9; }   // walk: when people may step off the kerb; they have the rest of the red to get across
    if (changed) paintLamps();
    // new arrivals
    for (const r of routes) { r.timer -= dt; if (r.timer <= 0) { r.timer = spawn(r, r.portalStart ? -3.3 : 0.5) ? r.every * (0.7 + Math.random() * 0.6) : 2.5; } }

    for (let k = 0; k < act.length; k++) place(act[k]);
    for (let k = act.length - 1; k >= 0; k--) {
      const v = act[k], r = v.route, half = v.len / 2;
      let gap = 60;                                                // clear road ahead, in metres from my front bumper
      // What is on my path ahead: points every 2.5 m along the route (so it sees round bends), against the front, middle
      // and back of every other vehicle, and against anyone on a crossing. Where two vehicles are both waiting at give-way lines
      // whose paths cross, the older one goes first.
      scan: for (let d = half + 1, i = v.i; d < half + 37; d += 2.5) {
        let s = v.s + d; if (s >= r.len) { if (!r.cyclic) break; s -= r.len; i = 0; }
        while (i < r.pts.length - 2 && s >= r.cum[i + 1]) i++;
        const a = r.pts[i], b = r.pts[i + 1], L = r.cum[i + 1] - r.cum[i] || 1, f = (s - r.cum[i]) / L, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f;
        for (let q = 0; q < walkers.n; q++) { const ex = walkers.x[q] - px, ez = walkers.z[q] - pz, R = v.wid / 2 + 1.0; if (ex * ex + ez * ez < R * R) { gap = d - half - 1.5; break scan; } }
        for (let j = 0; j < act.length; j++) {
          if (j === k) continue; const o = act[j], along = o.fx * ux + o.fz * uz; if (along < -0.3) continue;
          if (along < 0.7 && o.v < 0.3 && v.v < 0.3 && v.id < o.id && o.route.yieldS !== undefined && o.s < o.route.yieldS + 2 && o.s > o.route.yieldS - 16) continue;
          const R = (v.wid + o.wid) / 2 + 0.3, e = Math.max(0, o.len / 2 - 1), nq = o.len > 6 ? 2 : 1;
          for (let q = -nq; q <= nq; q++) { const ex = o.x + o.fx * e * q / nq - px, ez = o.z + o.fz * e * q / nq - pz; if (ex * ex + ez * ez < R * R) { gap = d - half - 1.2; break scan; } }
          // and where it will be in a second or so, if it is closing on my path from the side (two roads joining side by side)
          if (along < 0.95 && (o.x - v.x) * v.fx + (o.z - v.z) * v.fz > 0) { const ex = o.x + o.fx * o.v * 1.2 - px, ez = o.z + o.fz * o.v * 1.2 - pz; if (ex * ex + ez * ez < R * R) { gap = d - half - 1.2; break scan; } }
        }
      }
      for (const L of stopLines) {                                 // a red light (or an amber I can stop for)
        if (L.site.state === 'G' || L.hx * v.fx + L.hz * v.fz < 0.8) continue;
        const dx = L.x - v.x, dz = L.z - v.z, fd = dx * v.fx + dz * v.fz - half;
        if (fd < -1 || fd > 45 || Math.abs(dx * v.fz - dz * v.fx) > L.half) continue;
        if (L.site.state !== 'A' || fd > v.v * 1.1) gap = Math.min(gap, fd + 1.4);
      }
      if (r.yieldS !== undefined && v.s < r.yieldS && v.s > r.yieldS - 16) {      // give way to what is already on the gyratory
        // Room needed: how far the other vehicle travels while I get from the line into the lane. Waiting wears the margin
        // down, so nothing sits at a busy junction for ever; whoever I pull out in front of sees me on its path and slows.
        const tOut = 1 + r.mergeDist / 7 * (v.len > 6 ? 1.4 : 1), patience = Math.max(0.6, 1 - v.wait / 20); let held = false;   // a tighter gap after a long wait, but never one that makes others swerve
        for (let j = 0; j < act.length; j++) {
          if (j === k) continue; const o = act[j]; if (o.route === r && o.s < r.loopFrom) continue;
          const dx = r.merge[0] - o.x, dz = r.merge[1] - o.z, dd = dx * dx + dz * dz;
          const reach = (8 + Math.max(o.v, 4) * tOut) * patience;      // a queue that is crawling now may be moving by the time I am out
          if (dd < reach * reach && o.s > (o.route.yieldS === undefined ? -1 : o.route.yieldS) && o.s <= o.route.loopTo + 4 && dx * o.fx + dz * o.fz > -3) { gap = Math.min(gap, r.yieldS - v.s - half + 2); held = true; break; }
        }
        if (held && v.v < 0.5) v.wait += dt;
      } else v.wait = 0;
      if (cat && cat.y < 2 && !ctx.catRiding) { const dx = cat.x - v.x, dz = cat.z - v.z, fd = dx * v.fx + dz * v.fz; if (fd > 0 && fd < 14 + half && Math.abs(dx * v.fz - dz * v.fx) < v.wid / 2 + 1.2) gap = Math.min(gap, fd - half - 0.6); }
      for (let q = 0; q < walkers.n; q++) { const dx = walkers.x[q] - v.x, dz = walkers.z[q] - v.z, fd = dx * v.fx + dz * v.fz; if (fd > 0 && fd < 13 + half && Math.abs(dx * v.fz - dz * v.fx) < v.wid / 2 + 1.1) gap = Math.min(gap, fd - half - 1.0); }
      if (r.stopS !== undefined && !v.stopDone && v.s < r.stopS + 1) gap = Math.min(gap, r.stopS - v.s + 2.05);   // pull up at the stop
      // speed: as fast as leaves room to stop two metres short
      const want = gap < 2.2 ? 0 : Math.min(v.cruise, Math.sqrt(5 * (gap - 2)));
      v.v += Math.max(-7 * dt, Math.min(1.7 * dt, want - v.v)); if (v.v < 0) v.v = 0;
      v.s += v.v * dt;
      if (r.stopS !== undefined && !v.stopDone && Math.abs(r.stopS - v.s) < 1.2 && v.v < 0.1) { v.stopT = (v.stopT || 0) + dt; if (v.stopT > (v.rider ? 10 : 7)) v.stopDone = true; }
      v.atStop = !!v.stopT && !v.stopDone && v.stopT > 1.2;
      if (r.cyclic) { if (v.s >= r.len) { v.s -= r.len; v.i = 0; } }
      else if (v.s >= r.len - (r.portalEnd ? -half : 0.5) || (r.portalEnd && v.s - half > r.len - 1.2)) { hide(v.car); act.splice(k, 1); if (v.car.kind !== 'bus') nCars--; if (!(r.portalEnd && traffic.onPortal && traffic.onPortal(v.car, v.line))) pool.push(v.car); continue; }   // up the ramp: the deck takes the bus over
      // pose: ease the heading so vehicles sweep round corners; buses squeeze into, and out of, the dark of the ramp
      const car = v.car; let sc = 1, cs = v.s, y = 0.03;
      if (r.portalEnd && v.s + half > r.len) { sc = Math.max(0.05, (r.len - (v.s - half)) / v.len); cs = (v.s - half + r.len) / 2; }
      if (r.portalStart && v.s - half < 0) { sc = Math.max(0.05, (v.s + half) / v.len); cs = (v.s + half) / 2; }
      if (sc < 1) { const s0 = v.s; v.s = Math.max(0, Math.min(r.len - 0.01, cs)); place(v); v.s = s0; }
      if (r.portalEnd) y += Math.max(0, Math.min(1, (cs - (r.len - 7.8)) / 7.8)) * 0.9; else if (r.portalStart) y += Math.max(0, Math.min(1, (7.8 - cs) / 7.8)) * 0.9;
      let turn = Math.atan2(v.fx, v.fz) - car.ry; if (turn > Math.PI) turn -= TAU; else if (turn < -Math.PI) turn += TAU;
      car.ry += turn * Math.min(1, dt * 5); car.x = v.x; car.z = v.z;
      car.matrix.makeRotationY(car.ry); if (sc < 1) car.matrix.scale(_s.set(1, 1, sc)); car.matrix.setPosition(v.x, y, v.z);
      const lit = car.lit || (car.lit = { brake: false, indL: false, indR: false, shut: true, open: false }), dv = (v.v - (v.pv ?? v.v)) / Math.max(dt, 1e-3); v.pv = v.v;
      lit.brake = v.v < 0.35 || dv < -1.2; lit.shut = !v.atStop; lit.open = !!v.atStop;
      if ((v.lampT = (v.lampT || 0) - dt) <= 0) { v.lampT = 0.25; let ah = headingAt(r, v.s + half + 14) - Math.atan2(v.fx, v.fz); ah = Math.atan2(Math.sin(ah), Math.cos(ah)); v.turn = Math.abs(ah) > 0.42 ? Math.sign(ah) : 0; }
      const blink = (t * 1.5) % 1 < 0.55; lit.indL = v.turn > 0 && blink; lit.indR = v.turn < 0 && blink;
      write(car);
    }
    for (let i = 0; i < meshes.length; i++) meshes[i].instanceMatrix.needsUpdate = true;
  });

  /* ---------- the hand-over with the bus station deck (deckops.js) ---------- */
  const traffic = ctx.traffic = {
    cars: act, routes, signals: sig, pool, write, hide,
    /** set by the deck: given a bus that has just gone into the arch; true if the deck takes it */
    onPortal: null,
    /** a bus of this type from the pool, for the deck's first arrivals */
    take(type) { const k = pool.findIndex((c) => c.kind === 'bus' && c.btype === type); return k < 0 ? null : pool.splice(k, 1)[0]; },
    give(car) { hide(car); pool.push(car); },
    /** send a bus back out of the arch on its route's way out; false if the mouth is not clear yet */
    depart(car, line) {
      const r = routes.find((q) => q.portalStart && q.road === line.road); if (!r) { this.give(car); return true; }
      const v = { id: ++seq, wait: 0, car, route: r, s: -3.3, v: 0, i: 0, x: 0, z: 0, fx: 0, fz: 1, len: car.len, wid: car.wid, cruise: r.vmax * (0.85 + Math.random() * 0.3), line };
      place(v); for (const o of act) if (!o.route.portalEnd && (o.x - v.x) ** 2 + (o.z - v.z) ** 2 < 12 * 12) return false;   // its own lane clear (the arch's in-lane is separate)
      car.ry = Math.atan2(v.fx, v.fz); act.push(v); car.labels.set(line.n, line.dest, line.op); return true;
    },
  };
  return traffic;
}
