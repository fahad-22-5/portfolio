/**
 * London buses: a double-decker on the lines of an Enviro400 and a single-decker on the lines of an Enviro200.
 *
 * busParts(type) builds one bus in its own frame (origin on the ground at the middle, +z forward, doors on the
 * nearside, +x) as a short list of { key, geo, mat }: every piece that shares a material is merged into one
 * geometry. The traffic draws all its buses of a type through one InstancedMesh per key, and the deck's parked
 * buses use the same pieces as plain meshes, so a bus costs the same few draw calls wherever it is.
 *
 * Lamps are separate keys tagged lamp: 'brake' | 'indL' | 'indR', so the traffic can switch them per bus.
 *
 * busLabels(type) is what differs from bus to bus: the LED destination blinds (front, side, rear; amber on
 * black, bright enough to bloom) and the fleet name and roundel on the sides. One canvas each, redrawn when a
 * bus is given a new route.
 *
 * ROUTES are services that serve Hammersmith bus station (TfL and bustimes.org stop listings, 2025-26), with the
 * road each one leaves by. The fleet names are illustrative: who runs which route was not checked.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex, FONT, TAU } from '../util.js';

export const BUS = {
  dd: { L: 10.9, W: 2.55, H: 4.3, fa: 3.0, ra: -2.75, wheel: 0.5, deck: 2.32 },   // deck: the upper floor (about 1.7 m of headroom on each deck)     // fa / ra: front and rear axle (z)
  sd: { L: 10.4, W: 2.45, H: 3.05, fa: 2.7, ra: -2.3, wheel: 0.47, deck: 0 },
};
export const ROUTES = [
  { n: '9', dest: 'Aldwych', road: 'Hammersmith Rd', type: 'dd', op: 'RATP' },
  { n: '27', dest: 'Chalk Farm', road: 'Hammersmith Rd', type: 'dd', op: 'Metroline' },
  { n: '211', dest: 'Battersea Power Station', road: 'Fulham Palace Rd', type: 'dd', op: 'Go-Ahead London' },
  { n: '220', dest: 'Wandsworth', road: 'Fulham Palace Rd', type: 'dd', op: 'RATP' },
  { n: '295', dest: 'Clapham Junction', road: 'Fulham Palace Rd', type: 'dd', op: 'RATP' },
  { n: '306', dest: 'Fulham, Sands End', road: 'Fulham Palace Rd', type: 'sd', op: 'RATP' },
  { n: '190', dest: 'Richmond', road: 'King St', type: 'dd', op: 'RATP' },
  { n: '267', dest: 'Fulwell', road: 'King St', type: 'dd', op: 'RATP' },
  { n: 'H91', dest: 'Hounslow West', road: 'King St', type: 'dd', op: 'RATP' },
  { n: '110', dest: 'Hounslow', road: 'King St', type: 'sd', op: 'RATP' },
  { n: '72', dest: 'East Acton', road: "Shepherd's Bush Rd", type: 'dd', op: 'RATP' },
  { n: '218', dest: 'North Acton', road: "Shepherd's Bush Rd", type: 'sd', op: 'RATP' },
];

/* ---------- materials, shared by every bus ---------- */
let M = null;
function materials() {
  if (M) return M;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
  const basic = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
  // moquette: a dark blue ground with small blocks of red, ochre and sky blue (a pattern of its own, not TfL's)
  const moq = canvasTex(64, 64, (c) => {
    c.fillStyle = '#1d2a52'; c.fillRect(0, 0, 64, 64);
    const cols = ['#b8283a', '#d9a02a', '#4f9bd6', '#2b6b5a'];
    for (let i = 0; i < 26; i++) { c.fillStyle = cols[i % 4]; const x = (i * 23) % 64, y = (i * 37) % 64; c.fillRect(x, y, 6 + (i % 3) * 3, 3 + (i % 2) * 3); }
  });
  moq.wrapS = moq.wrapT = THREE.RepeatWrapping; moq.repeat.set(5, 5);
  M = {
    red: std(0xc20f1a, { roughness: 0.38, envMapIntensity: 0.5 }),
    black: std(0x111214, { roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0e151c, roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.66, depthWrite: false }),
    screen: new THREE.MeshStandardMaterial({ color: 0x0e151c, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false }),
    seat: std(0xffffff, { roughness: 0.95, map: moq }),
    pole: std(0xf2c200, { roughness: 0.35, metalness: 0.2 }),
    floor: std(0x4a4d52, { roughness: 0.9 }),
    ceiling: std(0xdcdedf, { roughness: 0.8 }),
    light: basic(1.25, 1.22, 1.12),
    uniform: std(0x26324d, { roughness: 0.85 }), skin: std(0xc68e64, { roughness: 0.7 }),
    rubber: std(0x141416, { roughness: 0.95 }), hub: std(0x6f747a, { roughness: 0.4, metalness: 0.5 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff0cf, emissiveIntensity: 0.7, roughness: 0.1 }),
    tail: std(0x5a0a0a, { roughness: 0.3 }), amber: std(0x6a3a06, { roughness: 0.3 }),
    brakeLit: basic(2.4, 0.18, 0.12), indLit: basic(2.2, 1.05, 0.08),
  };
  return M;
}

/** After dark (night 0-1): the saloons glow through the glass and the tail lamps burn. Called once a frame by the traffic. */
export function busNight(night) {
  const mt = materials(); if (Math.abs((mt._night ?? -1) - night) < 0.01) return; mt._night = night;
  mt.glass.emissive.setRGB(1.0, 0.93, 0.78); mt.glass.emissiveIntensity = 0.1 * night;          // a faint warmth in the glass
  mt.seat.emissive.setRGB(1, 1, 1); mt.seat.emissiveMap = mt.seat.map; mt.seat.emissiveIntensity = 0.45 * night;   // and the saloon lit from inside
  mt.ceiling.emissive.setRGB(1.0, 0.97, 0.9); mt.ceiling.emissiveIntensity = 0.6 * night; mt.floor.emissive.setRGB(0.3, 0.3, 0.32); mt.floor.emissiveIntensity = night;
  mt.pole.emissive.setRGB(0.9, 0.7, 0); mt.pole.emissiveIntensity = 0.5 * night;
  if (!mt._compiled) { mt._compiled = true; mt.seat.needsUpdate = true; }                 // the emissive map changes the shader once
  mt.tail.emissive.setRGB(0.9, 0.05, 0.03); mt.tail.emissiveIntensity = 0.15 + 1.6 * night;
}

/** One bus of a type, as [{ key, geo, mat, lamp? }] in the bus's own frame. */
export function busParts(type) {
  const T = BUS[type], dd = type === 'dd', { L, W, H } = T, hl = L / 2, hw = W / 2, mt = materials();
  const bins = {};
  const put = (bin, geo) => { (bins[bin] || (bins[bin] = [])).push(geo); };
  const box = (bin, w, h, d, x, y, z) => put(bin, new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  const zb = (bin, z0, z1, y0, y1, x0, x1) => box(bin, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);   // a box from its extents

  const sill = 1.1, winTop = dd ? 2.08 : 2.42, roofY = dd ? 3.92 : 2.45, a = 0.62;           // window band; arch half-length
  const fa = T.fa, ra = T.ra;
  // lower body, with the wheel arches left open
  for (const [z0, z1] of [[fa + a, hl], [ra + a, fa - a], [-hl, ra - a]]) zb('red', z0, z1, 0.28, sill, -hw, hw);
  for (const z of [fa, ra]) { zb('red', z - a, z + a, 0.98, sill, -hw, hw); zb('black', z - a + 0.05, z + a - 0.05, 0.3, 0.98, -hw + 0.08, hw - 0.08); }
  zb('black', -hl - 0.02, hl + 0.02, 0.26, 0.42, -hw - 0.01, hw + 0.01);                     // rubbing strip and skirt
  // window bands: tinted glass, a hair proud, with black pillars between the panes
  zb('glass', -hl + 0.5, hl - 0.25, sill, winTop, -hw - 0.004, hw + 0.004);
  if (dd) {
    zb('red', -hl, hl, winTop, 2.3, -hw, hw);                                                  // between the decks
    zb('glass', -hl + 0.25, hl - 0.15, 2.3, roofY, -hw - 0.004, hw + 0.004);
  }
  zb('red', -hl, hl, roofY, H - 0.06, -hw, hw); zb('red', -hl + 0.1, hl - 0.1, H - 0.06, H, -hw + 0.14, hw - 0.14);   // roof, softened at the edge
  if (!dd) zb('red', -hl + 2.0, -hl + 4.6, H, H + 0.2, -0.8, 0.8);                            // the single-decker's roof pod
  for (let z = -hl + 1.1; z < hl - 0.6; z += 1.22) for (const s of [-1, 1]) {
    zb('black', z - 0.04, z + 0.04, sill, winTop, s * hw - 0.012, s * hw + 0.012);
    if (dd) zb('black', z - 0.04, z + 0.04, 2.3, roofY, s * hw - 0.012, s * hw + 0.012);
  }
  // front: big windscreen over a black bumper, the blind box, the upper front window
  const scr0 = 0.88, scr1 = dd ? 1.95 : 2.42;
  zb('red', hl - 0.06, hl, 0.28, scr0, -hw, hw); zb('black', hl, hl + 0.06, 0.28, 0.55, -hw + 0.05, hw - 0.05);
  zb('screen', hl - 0.02, hl + 0.01, scr0, scr1, -hw + 0.08, hw - 0.08);
  zb('black', hl - 0.06, hl + 0.02, scr1, scr1 + 0.36, -hw + 0.06, hw - 0.06);               // destination box
  if (dd) { zb('screen', hl - 0.02, hl + 0.01, 2.38, roofY - 0.04, -hw + 0.1, hw - 0.1); zb('red', hl - 0.05, hl, roofY - 0.04, H - 0.08, -hw, hw); }
  for (const s of [-1, 1]) { zb('red', hl - 0.06, hl, scr0, dd ? roofY : scr1 + 0.36, s * hw - s * 0.08 - 0.04, s * hw - s * 0.08 + 0.04); }
  put('head', new THREE.BoxGeometry(0.34, 0.12, 0.05).translate(0.85, 0.66, hl + 0.025)); put('head', new THREE.BoxGeometry(0.34, 0.12, 0.05).translate(-0.85, 0.66, hl + 0.025));
  for (const s of [-1, 1]) { box('black', 0.05, 0.05, 0.5, s * (hw + 0.2), 2.05, hl - 0.15); box('black', 0.08, 0.32, 0.18, s * (hw + 0.42), 1.85, hl + 0.05); }   // mirrors on stalks
  // rear: engine grille, rear window, tail lamps up the corners, the route number box
  zb('red', -hl, -hl + 0.06, 0.28, roofY, -hw, hw); zb('black', -hl - 0.02, -hl, 0.5, 1.1, -0.85, 0.85);
  if (dd) zb('glass', -hl - 0.01, -hl + 0.01, 2.4, roofY - 0.1, -hw + 0.25, hw - 0.25); else zb('glass', -hl - 0.01, -hl + 0.01, 1.3, 2.3, -hw + 0.3, hw - 0.3);
  zb('black', -hl - 0.03, -hl, roofY + 0.02, roofY + 0.3, -0.42, 0.42);
  for (const s of [-1, 1]) {
    zb('tail', -hl - 0.03, -hl, 0.6, 1.55, s * hw - s * 0.2 - 0.09, s * hw - s * 0.2 + 0.09);
    zb('amber', -hl - 0.03, -hl, 1.58, 1.75, s * hw - s * 0.2 - 0.09, s * hw - s * 0.2 + 0.09);
    zb('amber', hl, hl + 0.03, 0.6, 0.74, s * hw - s * 0.32 - 0.1, s * hw - s * 0.32 + 0.1);
  }
  // doors on the nearside (+x): glazed leaves in black frames, ahead of the front axle and between the axles
  for (const [z0, z1] of dd ? [[fa + 0.75, hl - 0.25], [-0.45, 0.9]] : [[fa + 0.8, hl - 0.25], [-0.4, 0.95]]) {
    zb('black', z0 - 0.05, z1 + 0.05, 0.34, winTop + 0.04, hw - 0.002, hw + 0.012);
    zb('door', z0, z1, 0.4, winTop - 0.02, hw + 0.012, hw + 0.02);                         // the leaves, shut
    zb('door', (z0 + z1) / 2 - 0.02, (z0 + z1) / 2 + 0.02, 0.4, winTop - 0.02, hw + 0.02, hw + 0.026);
    for (const zz of [z0 + 0.06, z1 - 0.06]) zb('doorOpen', zz - 0.025, zz + 0.025, 0.4, winTop - 0.02, hw + 0.02, hw + 0.36);   // and swung out, open
  }
  // wheels
  for (const z of [fa, ra]) for (const s of [-1, 1]) {
    put('rubber', new THREE.CylinderGeometry(T.wheel, T.wheel, 0.3, 18).rotateZ(Math.PI / 2).translate(s * (hw - 0.17), T.wheel, z));
    put('hub', new THREE.CylinderGeometry(T.wheel * 0.36, T.wheel * 0.36, 0.02, 14).rotateZ(Math.PI / 2).translate(s * (hw - 0.01), T.wheel, z));
  }
  // lamps the traffic switches
  for (const s of [-1, 1]) {
    put('brake', new THREE.BoxGeometry(0.2, 0.95, 0.02).translate(s * (hw - 0.2), 1.08, -hl - 0.04));
    put(s > 0 ? 'indL' : 'indR', new THREE.BoxGeometry(0.2, 0.17, 0.02).translate(s * (hw - 0.2), 1.665, -hl - 0.04));
    put(s > 0 ? 'indL' : 'indR', new THREE.BoxGeometry(0.2, 0.14, 0.02).translate(s * (hw - 0.32), 0.67, hl + 0.04));
  }

  /* ---------- inside ---------- */
  const fl = 0.36, aisle = 0.32;
  zb('floor', -hl + 0.15, hl - 0.15, 0.3, fl, -hw + 0.07, hw - 0.07);
  zb('ceiling', -hl + 0.15, hl - 0.15, winTop - 0.02, winTop, -hw + 0.07, hw - 0.07);
  zb('light', -hl + 0.6, hl - 1.2, winTop - 0.04, winTop - 0.02, -0.06, 0.06);
  const seat = (x, y, z, ry = 0) => {                               // a double seat: cushion and back, facing +z unless turned
    const c = new THREE.BoxGeometry(0.86, 0.12, 0.42).translate(0, 0.44, 0), b = new THREE.BoxGeometry(0.86, 0.55, 0.08).translate(0, 0.74, -0.2);
    for (const gg of [c, b]) put('seat', gg.rotateY(ry).translate(x, y, z));
  };
  const stairZ0 = dd ? fa - 1.2 : 0, stairZ1 = dd ? fa + 0.6 : 0;
  // lower deck: forward-facing pairs, a clear bay opposite the centre door for wheelchairs and buggies, the stairs behind the cab
  for (let z = -hl + 0.9; z < fa - 0.8; z += 0.78) {
    if (!(z > -0.6 && z < 1.05)) seat(hw - 0.52, fl, z);
    const stair = dd && z > stairZ0 - 0.4 && z < stairZ1 + 0.4, bay = z > -0.9 && z < 1.4;
    if (!stair && !bay) seat(-hw + 0.52, fl, z);
  }
  // poles and rails, yellow
  for (let z = -hl + 1.2; z < hl - 1.0; z += 1.55) for (const s of [-1, 1]) put('pole', new THREE.CylinderGeometry(0.02, 0.02, winTop - fl, 8).translate(s * aisle, (fl + winTop) / 2, z));
  for (const s of [-1, 1]) put('pole', new THREE.CylinderGeometry(0.018, 0.018, L - 1.6, 8).rotateX(Math.PI / 2).translate(s * aisle, winTop - 0.14, -0.3));
  if (dd) {
    const up = T.deck;
    zb('floor', -hl + 0.15, hl - 0.15, up - 0.05, up, -hw + 0.07, hw - 0.07);
    zb('ceiling', -hl + 0.15, hl - 0.15, roofY - 0.02, roofY, -hw + 0.07, hw - 0.07);
    zb('light', -hl + 0.5, hl - 0.6, roofY - 0.04, roofY - 0.02, -0.06, 0.06);
    for (let z = -hl + 0.7; z < hl - 0.5; z += 0.78) {
      seat(hw - 0.52, up, z);
      if (!(z > stairZ0 - 0.5 && z < stairZ1 + 0.3)) seat(-hw + 0.52, up, z);
    }
    for (let z = -hl + 1.5; z < hl - 1.0; z += 2.2) for (const s of [-1, 1]) put('pole', new THREE.CylinderGeometry(0.018, 0.018, roofY - up, 8).translate(s * aisle, (up + roofY) / 2, z));
    // the stairs: up from behind the cab towards the back, on the offside
    for (let i = 0; i < 9; i++) { const y = fl + (i + 1) * (up - fl) / 9; zb('floor', stairZ1 - (i + 1) * 0.2, stairZ1 - i * 0.2, y - 0.05, y, -hw + 0.1, -hw + 0.75); }
    put('pole', new THREE.CylinderGeometry(0.02, 0.02, Math.hypot(1.8, up - fl), 8).rotateX(Math.atan2(1.8, up - fl)).translate(-hw + 0.8, (fl + up) / 2 + 0.8, (stairZ0 + stairZ1) / 2));
  }
  // the cab: the driver on the offside, at the wheel, behind a screen
  const dz = hl - 1.05, dx = -hw + 0.62;
  box('black', 0.5, 0.5, 0.5, dx, fl + 0.25, dz - 0.15);
  box('uniform', 0.42, 0.55, 0.26, dx, fl + 0.88, dz - 0.12);
  put('skin', new THREE.SphereGeometry(0.11, 10, 8).translate(dx, fl + 1.3, dz - 0.08));
  for (const s of [-1, 1]) box('uniform', 0.09, 0.09, 0.42, dx + s * 0.17, fl + 0.95, dz + 0.12);
  put('black', new THREE.TorusGeometry(0.21, 0.025, 6, 18).rotateX(-1.1).translate(dx, fl + 0.95, dz + 0.38));
  zb('screen', dz - 0.5, dz - 0.46, fl, winTop - 0.2, dx - 0.45, dx + 0.45);

  const out = [];
  for (const [bin, geos] of Object.entries(bins)) {
    const geo = mergeGeometries(geos.map((gg) => (gg.index ? gg : gg))); geos.forEach((gg) => gg.dispose());
    const LAMP = { brake: 'brake', indL: 'indL', indR: 'indR', door: 'shut', doorOpen: 'open' }, MAT = { brake: 'brakeLit', indL: 'indLit', indR: 'indLit', door: 'screen', doorOpen: 'screen' };
    out.push({ key: `bus_${type}_${bin}`, geo, mat: mt[MAT[bin] || bin], lamp: LAMP[bin] || null });
  }
  return out;
}

/** What differs from bus to bus: the destination blinds and the fleet name. set(route, dest, operator) redraws them. */
export function busLabels(type) {
  const T = BUS[type], dd = type === 'dd', hl = T.L / 2, hw = T.W / 2, scr1 = dd ? 1.95 : 2.42;
  const region = (geo, x0, y0, x1, y1, Wc, Hc) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / Wc, 1 - (y1 - uv.getY(i) * (y1 - y0)) / Hc); return geo; };
  // blinds: front (512 x 64), side (256 x 48) and rear (128 x 48), all on one canvas
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 128;
  const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace; btex.anisotropy = 4;
  const front = region(new THREE.PlaneGeometry(T.W - 0.3, 0.3).translate(0, scr1 + 0.18, hl + 0.025), 0, 0, 512, 64, 512, 128);
  const side = region(new THREE.PlaneGeometry(0.9, 0.2).rotateY(Math.PI / 2).translate(hw + 0.014, winTopOf(type) - 0.2, T.fa + 0.25), 0, 72, 256, 120, 512, 128);
  const rear = region(new THREE.PlaneGeometry(0.8, 0.26).rotateY(Math.PI).translate(0, (dd ? 3.92 : 2.45) + 0.16, -hl - 0.035), 272, 72, 400, 120, 512, 128);
  const blind = new THREE.Mesh(mergeGeometries([front, side, rear]), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false }));
  blind.material.color.setScalar(1.55);
  // fleet name and roundel on both sides, behind the front door
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 96;
  const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 4;
  const fz = T.fa - 1.6, fy = 0.72;
  const fl = new THREE.PlaneGeometry(1.7, 0.32).rotateY(Math.PI / 2).translate(hw + 0.013, fy, fz), fr = new THREE.PlaneGeometry(1.7, 0.32).rotateY(-Math.PI / 2).translate(-hw - 0.013, fy, fz);
  const fleet = new THREE.Mesh(mergeGeometries([fl, fr]), new THREE.MeshStandardMaterial({ map: ftex, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
  const group = new THREE.Group(); group.add(blind, fleet); group.userData.dynamic = true; blind.userData.dynamic = fleet.userData.dynamic = true;
  for (const m of [blind, fleet]) { m.castShadow = false; m.receiveShadow = false; }

  function set(n, dest, op) {
    const c = bc.getContext('2d');
    c.fillStyle = '#060607'; c.fillRect(0, 0, 512, 128);
    c.fillStyle = '#ffb020'; c.textBaseline = 'middle';
    const dot = () => { c.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 128; y += 3) c.fillRect(0, y, 512, 1); for (let x = 0; x < 512; x += 3) c.fillRect(x, 0, 1, 128); c.fillStyle = '#ffb020'; };
    c.font = `800 46px ${FONT}`; c.textAlign = 'left'; c.fillText(n, 14, 34);
    const nw = c.measureText(n).width; let size = 40; c.font = `700 ${size}px ${FONT}`;
    while (c.measureText(dest).width > 512 - nw - 44 && size > 18) { size -= 2; c.font = `700 ${size}px ${FONT}`; }
    c.fillText(dest, nw + 34, 34);
    c.font = `800 30px ${FONT}`; c.fillText(n, 10, 96); let s2 = 26; c.font = `700 ${s2}px ${FONT}`; const nw2 = c.measureText(n).width + 30;
    while (c.measureText(dest).width > 246 - nw2 && s2 > 12) { s2 -= 1; c.font = `700 ${s2}px ${FONT}`; }
    c.fillText(dest, nw2, 96);
    c.font = `800 34px ${FONT}`; c.textAlign = 'center'; c.fillText(n, 336, 96);
    dot(); btex.needsUpdate = true;
    const f = fc.getContext('2d'); f.clearRect(0, 0, 512, 96);
    f.fillStyle = '#ffffff'; f.font = `700 40px ${FONT}`; f.textAlign = 'left'; f.textBaseline = 'middle'; f.fillText(op, 16, 50);
    const rx = 452, ry = 48; f.strokeStyle = '#ffffff'; f.lineWidth = 9; f.beginPath(); f.arc(rx, ry, 26, 0, TAU); f.stroke(); f.fillRect(rx - 40, ry - 7, 80, 14);   // the roundel, in white
    ftex.needsUpdate = true;
  }
  return { group, set, dispose() { btex.dispose(); ftex.dispose(); blind.geometry.dispose(); fleet.geometry.dispose(); blind.material.dispose(); fleet.material.dispose(); } };
}
const winTopOf = (type) => (type === 'dd' ? 2.08 : 2.42);

/** A parked bus as a group of plain meshes (the deck, the stand by the station): same pieces, same look. */
export function parkedBus(type, line, arriving = false) {
  const g = new THREE.Group();
  for (const pt of busParts(type)) { if (pt.lamp && pt.lamp !== 'shut') continue; const m = new THREE.Mesh(pt.geo, pt.mat); m.castShadow = !pt.mat.transparent && !pt.mat.isMeshBasicMaterial; m.receiveShadow = true; g.add(m); }
  const lab = busLabels(type); lab.set(line.n, arriving ? 'Hammersmith' : line.dest, line.op); lab.group.userData.dynamic = false; lab.group.children.forEach((c) => { c.userData.dynamic = false; }); g.add(lab.group);
  return g;
}
