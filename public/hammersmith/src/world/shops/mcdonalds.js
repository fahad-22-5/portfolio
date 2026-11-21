/**
 * McDonald's, Broadway Hammersmith: full fit-out from the plan outline.
 *
 * Local frame (shopkit): z = 0 is the main glazed front on the mall
 * (14.4 m wide, x -7.2..7.2), the shop runs back to z = -12.5, and a second
 * glazed front faces east (x ~ 10) towards the lift and the footbridge.
 *
 *   front of house: self-order kiosks, a 10 m counter, green booths
 *   behind the counter: drinks tower, bagging, heated holding cabinet
 *   kitchen line: two fryers, fry station under a heat lamp, flat grill, clamshell grill, extraction hood
 *   staff: two on tills, drinks, a runner, the fry cook and the grill cook
 */
import * as THREE from 'three';
import { addPlace, addSeat } from '../sim.js';
import { canvasTex, FONT, TAU } from '../../util.js';
import { shopFrame, kit } from '../shopkit.js';
import { brushedSteel, chrome, blackSteel, darkTile, slats, paint, glow, clearGlass, menuBoard, label, fascia } from '../finishes.js';

const CEIL_IN = 3.6;

export function buildMcDonalds(ctx, parent, unit, staff) {
  const F = shopFrame(unit, 7), K = kit(ctx, parent, F);
  const steel = brushedSteel(), dark = paint(0x2b2c2f, 0.6), black = blackSteel(), red = paint(0xd6202a, 0.45), yellow = paint(0xffc72c, 0.4);
  const wood = slats('#9a6b43'), seatGreen = paint(0x2f6b45, 0.55), table = paint(0x3a2b22, 0.4), cream = paint(0xefe9dd, 0.8);

  /* ---------- shell: floor, walls, glazing, ceiling ---------- */
  K.flat(F.local, darkTile('#3a3a3c'), 0.04);
  const kitchenFloor = [[-7.0, -6.6], [3.6, -6.6], [3.6, -12.3], [-7.0, -12.7]];
  K.flat(kitchenFloor, paint(0x8a3a2a, 0.5), 0.045);                          // red quarry tiles in the kitchen
  K.flat(F.local, paint(0x2b2c2f, 0.9), CEIL_IN, true);
  const L = F.local, n = L.length, LC = [L.reduce((s, p) => s + p[0], 0) / n, L.reduce((s, p) => s + p[1], 0) / n];
  for (let i = 0; i < n; i++) {
    const p = L[i], q = L[(i + 1) % n];
    const front = i === 7 || i === 4;                                          // main front (z = 0) and the east front
    if (!front) { K.seg(p, q, 0, 5.97, cream); continue; }
    // glazed front with a door pair; dark slatted fascia above
    const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, at = (t) => [p[0] + ux * t, p[1] + uz * t];
    const d0 = i === 7 ? len * 0.3 - 1 : len / 2 - 1, d1 = d0 + 2;
    for (const [a, b] of [[0, d0], [d1, len]]) { K.seg(at(a), at(b), 0, 3.0, clearGlass(), { t: 0.05, shadow: false }); K.solid((at(a)[0] + at(b)[0]) / 2, (at(a)[1] + at(b)[1]) / 2, b - a, 0.2, 5.97, { ry: Math.atan2(-dz, dx) }); }
    for (let t = 0; t <= len + 0.01; t += len / Math.max(2, Math.round(len / 1.8))) { const m = at(t); K.box(0.08, 3.0, 0.12, black, m[0], 1.5, m[1], Math.atan2(-dz, dx)); }
    K.seg(p, q, 3.0, 5.97, dark, { collide: false });
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(len - 0.4, 9), 0.95), fascia("McDonald's", Math.min(len - 0.4, 9), { bg: '#2e2f32', fg: '#ffffff', style: 'arches' }, 0.95));
    const mid = at(len / 2); let nrm = [uz, -ux];                                // outward normal: away from the shop's middle
    if (nrm[0] * (mid[0] - LC[0]) + nrm[1] * (mid[1] - LC[1]) < 0) nrm = [-nrm[0], -nrm[1]];
    fm.position.set(mid[0] + nrm[0] * 0.13, 3.55, mid[1] + nrm[1] * 0.13); fm.rotation.y = Math.atan2(nrm[0], nrm[1]); K.group.add(fm);
  }

  /* ---------- front of house ---------- */
  // self-order kiosks: slim black stands with portrait screens facing the door
  const kioskUI = new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(128, 224, (c) => {
    c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, 128, 224); c.fillStyle = '#da291c'; c.fillRect(0, 0, 128, 34); c.fillStyle = '#ffc72c'; c.font = `900 26px ${FONT}`; c.fillText('M', 8, 26);
    c.fillStyle = '#222'; c.font = `700 13px ${FONT}`; c.fillText('Order here', 40, 22);
    const cols = ['#c8873a', '#e8b04a', '#da291c', '#6d9c3a', '#f0d48a', '#8a5a33'];
    for (let i = 0; i < 6; i++) { const x = 10 + (i % 2) * 58, y = 46 + Math.floor(i / 2) * 56; c.fillStyle = '#efefe9'; c.fillRect(x, y, 50, 48); c.fillStyle = cols[i]; c.beginPath(); c.ellipse(x + 25, y + 22, 16, 11, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#ffc72c'; c.fillRect(10, 208, 108, 12);
  }) });
  for (const x of [-5.6, -4.4, -3.2, -2.0]) {
    K.box(0.06, 1.15, 0.06, black, x, 0.6, -2.0); K.box(0.42, 0.04, 0.32, black, x, 0.02, -2.0);
    K.box(0.5, 0.86, 0.06, black, x, 1.55, -2.0); K.single(new THREE.PlaneGeometry(0.44, 0.78), kioskUI, x, 1.55, -1.965);
    K.solid(x, -2.0, 0.5, 0.35, 2.0);
  }
  // counter: dark slatted front, quartz top, 10.6 m from the west wall to the kitchen partition
  K.box(10.6, 1.0, 0.7, wood, -1.7, 0.5, -6.2); K.box(10.7, 0.05, 0.85, paint(0x1e1e20, 0.2), -1.7, 1.02, -6.25);
  K.solid(-1.7, -6.2, 10.6, 0.8, 1.05);
  for (const x of [-4.6, -1.8]) { K.box(0.42, 0.3, 0.04, black, x, 1.26, -6.0, 0); K.single(new THREE.PlaneGeometry(0.36, 0.24), glow(0x9fd3ee), x, 1.27, -5.975); K.box(0.06, 0.2, 0.06, black, x, 1.1, -6.05); }
  K.box(0.5, 0.06, 0.38, paint(0x7a4a2a, 0.5), 1.2, 1.08, -6.1);                            // a tray waiting on the counter
  const ready = new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(256, 96, (c) => { c.fillStyle = '#141414'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#ffc72c'; c.font = `800 22px ${FONT}`; c.fillText('PREPARING', 12, 28); c.fillText('READY', 140, 28); c.fillStyle = '#fff'; c.font = `600 22px ${FONT}`; c.fillText('214  219', 14, 62); c.fillText('207  211', 140, 62); }) });
  K.single(new THREE.PlaneGeometry(1.4, 0.52), ready, 2.6, 2.75, -6.15);
  // partition between kitchen and seating, slatted on the seating side, with the golden arches
  K.seg([3.6, -6.2], [3.6, -12.4], 0, CEIL_IN, cream); K.box(0.04, 3.2, 6.0, wood, 3.73, 1.6, -9.3, 0);
  const arch = new THREE.TorusGeometry(0.42, 0.11, 10, 28, Math.PI);
  for (const dx of [-0.42, 0.42]) K.mesh(arch, glow(0xffc72c), 3.77, 2.1, -9.3 + dx, 0, Math.PI / 2, 0, 1, 1.9, 1, false);
  K.box(0.05, 0.22, 2.1, glow(0xffc72c), 3.77, 2.1 - 0.42 * 1.9, -9.3, 0, false);
  // seating: green booths along the east glazing, two-tops in the middle, pendants over them
  for (const z of [-3.4, -5.8, -8.2]) {
    K.box(0.55, 0.45, 1.6, seatGreen, 9.0, 0.23, z + 0.75); K.box(0.12, 0.6, 1.6, seatGreen, 9.32, 0.75, z + 0.75);
    K.box(0.55, 0.45, 1.6, seatGreen, 9.0, 0.23, z - 0.75); K.box(0.12, 0.6, 1.6, seatGreen, 9.32, 0.75, z - 0.75);
    K.box(0.75, 0.05, 0.75, table, 8.95, 0.74, z); K.cyl(0.04, 0.04, 0.72, 8, black, 8.95, 0.37, z);
    K.solid(9.05, z, 0.9, 3.4, 0.75);
    for (const s2 of [-1, 1]) addSeat("McDonald's", K.at(9.0, z + s2 * 0.75), K.at(8.95, z));
  }
  for (const [x, z] of [[5.7, -2.4], [5.7, -4.8], [5.7, -7.2], [-5.0, -4.2], [-1.6, -4.2]]) {
    K.cyl(0.38, 0.38, 0.04, 20, table, x, 0.74, z); K.cyl(0.04, 0.04, 0.72, 8, black, x, 0.37, z); K.cyl(0.2, 0.2, 0.03, 16, black, x, 0.015, z);
    for (const s of [-1, 1]) { K.cyl(0.19, 0.19, 0.05, 16, seatGreen, x + s * 0.62, 0.46, z); K.cyl(0.03, 0.03, 0.44, 8, black, x + s * 0.62, 0.22, z); }
    K.solid(x, z, 0.8, 0.8, 0.76);
    for (const s2 of [-1, 1]) addSeat("McDonald's", K.at(x + s2 * 0.62, z), K.at(x, z));
  }
  for (const x of [-4.6, -1.8, 0.6]) addPlace("McDonald's", 'food', 'order', K.at(x, -5.2), F.yaw + Math.PI);
  for (const [x, z] of [[5.7, -2.4], [5.7, -4.8], [5.7, -7.2], [8.9, -3.4], [8.9, -5.8], [8.9, -8.2]]) { K.cyl(0.006, 0.006, 1.0, 4, black, x, CEIL_IN - 0.5, z, 0, 0, false); K.cyl(0.11, 0.17, 0.2, 18, yellow, x, CEIL_IN - 1.05, z); K.cyl(0.15, 0.15, 0.01, 18, glow(0xfff0c8), x, CEIL_IN - 1.155, z, 0, 0, false); }

  /* ---------- behind the counter ---------- */
  // back counter with the drinks tower, bagging, heated holding cabinet and the McCafé machine
  K.box(10.4, 0.92, 0.7, steel, -1.8, 0.46, -8.0); K.box(10.5, 0.04, 0.75, steel, -1.8, 0.94, -8.0);
  K.solid(-1.8, -8.0, 10.4, 0.75, 0.95);
  // drinks tower: logo panel, a row of nozzles, ice chute, cups
  K.box(1.4, 0.95, 0.6, black, -5.7, 1.42, -8.05); K.single(new THREE.PlaneGeometry(1.3, 0.34), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(256, 64, (c) => { const gr = c.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#b3121b'); gr.addColorStop(1, '#e32b2b'); c.fillStyle = gr; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = `italic 700 30px ${FONT}`; c.fillText('Coca-Cola', 40, 42); }) }), -5.7, 1.68, -7.745);
  for (let i = 0; i < 6; i++) K.cyl(0.025, 0.02, 0.07, 8, chrome(), -6.3 + i * 0.24, 1.08, -7.85);
  K.box(1.4, 0.05, 0.3, steel, -5.7, 0.98, -7.83);
  const cupMat = label('mcup', (c) => { c.fillStyle = '#fdfdfb'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#da291c'; c.fillRect(0, 30, 128, 50); c.fillStyle = '#ffc72c'; c.font = '900 40px sans-serif'; c.fillText('M', 46, 70); });
  for (let i = 0; i < 4; i++) K.cyl(0.05, 0.04, 0.32, 14, cupMat, -4.7 + i * 0.12, 1.12, -8.15);
  // bagging station: stacks of bags and boxes
  for (let i = 0; i < 5; i++) K.box(0.22, 0.28, 0.12, label('mbag', (c) => { c.fillStyle = '#c69c6d'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#da291c'; c.font = '900 70px sans-serif'; c.fillText('M', 36, 92); }), -3.6 + i * 0.26, 1.1, -8.15);
  for (let i = 0; i < 6; i++) K.box(0.24, 0.07, 0.14, label('bigmac', (c) => { c.fillStyle = '#f2e7d2'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#da291c'; c.fillRect(0, 50, 128, 28); }), -2.2, 0.99 + i * 0.075, -8.1);
  // heated holding cabinet (UHC): steel box with glowing slots, the pass-through to the kitchen
  K.box(1.8, 1.0, 0.65, steel, 0.0, 1.45, -8.0);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { K.box(0.36, 0.16, 0.02, glow(0xff9a3c), -0.6 + k * 0.4, 1.15 + r * 0.28, -7.672, 0, false); K.box(0.34, 0.04, 0.4, paint(0x5a3a22, 0.6), -0.6 + k * 0.4, 1.12 + r * 0.28, -7.95); }
  // McCafé espresso machine on the end
  K.box(0.8, 0.55, 0.55, black, 2.4, 1.24, -8.05); K.box(0.82, 0.06, 0.57, chrome(), 2.4, 1.53, -8.05);
  for (const dx of [-0.18, 0.18]) { K.cyl(0.045, 0.045, 0.08, 14, chrome(), 2.4 + dx, 1.0, -7.78); K.box(0.03, 0.03, 0.14, black, 2.4 + dx, 0.98, -7.68); }
  // bulkhead over the back counter carrying four digital menu boards
  K.box(10.4, CEIL_IN - 2.15, 0.2, dark, -1.8, (CEIL_IN + 2.15) / 2, -8.45, 0, false);
  const boards = [
    menuBoard('Burgers', [['Big Mac', '£5.49'], ['Quarter Pounder', '£5.69'], ['McChicken', '£4.79'], ['Cheeseburger', '£1.89'], ['Double Cheese', '£2.99']], { bg: '#141414', accent: '#ffc72c', photo: '#c8873a' }),
    menuBoard('Meals', [['Big Mac Meal', '£7.89'], ['McNuggets 9', '£7.29'], ['Fillet-O-Fish', '£6.59'], ['Chicken Legend', '£7.49']], { bg: '#141414', accent: '#ffc72c', photo: '#d79b3a' }),
    menuBoard('Sides & Drinks', [['Fries M', '£1.99'], ['Fries L', '£2.29'], ['Coca-Cola', '£1.99'], ['McFlurry', '£2.19'], ['Apple Pie', '£1.29']], { bg: '#141414', accent: '#ffc72c', photo: '#e8b04a' }),
    menuBoard('McCafé', [['Latte', '£2.39'], ['Cappuccino', '£2.39'], ['Flat White', '£2.39'], ['Iced Coffee', '£2.49']], { bg: '#2a1b12', accent: '#e7c38a', photo: '#9a6b43' }),
  ];
  boards.forEach((m, i) => { K.box(2.3, 1.06, 0.06, black, -5.7 + i * 2.55, 2.7, -8.33); K.single(new THREE.PlaneGeometry(2.2, 0.98), m, -5.7 + i * 2.55, 2.7, -8.295); });

  /* ---------- kitchen line ---------- */
  K.box(10.4, 0.9, 0.9, steel, -1.8, 0.45, -10.4); K.solid(-1.8, -10.4, 10.4, 0.95, 1.0);
  // two fryers with golden oil and baskets hanging on the rail
  for (const fx of [-5.9, -4.9]) {
    K.box(0.85, 0.06, 0.6, black, fx, 0.93, -10.4); K.box(0.7, 0.01, 0.45, paint(0xb8862b, 0.15), fx, 0.88, -10.4);
    for (const dx of [-0.18, 0.18]) { K.box(0.3, 0.14, 0.38, steel, fx + dx, 1.0, -10.45); K.box(0.03, 0.03, 0.26, black, fx + dx, 1.1, -10.15); }
  }
  // fry station: a mound of fries in the dump under a heat lamp, cartons ready on the rack
  K.box(1.2, 0.12, 0.65, steel, -3.6, 0.96, -10.35); K.box(1.3, 0.12, 0.5, black, -3.6, 1.9, -10.35); K.box(1.2, 0.04, 0.4, glow(0xff6a2a), -3.6, 1.83, -10.35, 0, false);
  const fry = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  for (let i = 0; i < 90; i++) { const a = i * 2.39, r = 0.05 + (i % 9) * 0.03; K.mesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), fry, -3.6 + Math.cos(a) * r * 1.8, 1.04 + (8 - (i % 9)) * 0.006, -10.35 + Math.sin(a) * r, 0.3 * Math.sin(i), a, 0, 1, 1, 1, false); }
  const carton = label('fries', (c) => { c.fillStyle = '#da291c'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#ffc72c'; c.font = '900 64px sans-serif'; c.fillText('M', 40, 86); });
  for (let i = 0; i < 6; i++) { K.box(0.1, 0.13, 0.06, carton, -4.05 + i * 0.16, 1.1, -10.0); for (let k = 0; k < 5; k++) K.box(0.01, 0.07, 0.01, fry, -4.08 + i * 0.16 + k * 0.016, 1.19, -10.0, 0, false); }
  // flat grill with patties sizzling, clamshell grill beside it
  K.box(1.9, 0.08, 0.75, chrome(), -0.4, 0.94, -10.4); K.box(1.9, 0.03, 0.08, steel, -0.4, 0.98, -10.03);
  for (let i = 0; i < 8; i++) K.cyl(0.055, 0.055, 0.015, 16, paint(0x4a2c1c, 0.8), -1.1 + (i % 4) * 0.42, 0.985, -10.5 + Math.floor(i / 4) * 0.25);
  K.box(1.4, 0.1, 0.7, chrome(), 1.5, 0.94, -10.4); K.box(1.4, 0.18, 0.7, steel, 1.5, 1.33, -10.62, 0); K.box(0.06, 0.06, 0.6, black, 1.5, 1.35, -10.2);
  // prep fridge with buns, sauce guns
  K.box(1.0, 0.04, 0.6, steel, 2.9, 0.92, -10.4); for (let i = 0; i < 6; i++) K.cyl(0.05, 0.055, 0.04, 12, paint(0xd99a4a, 0.6), 2.55 + (i % 3) * 0.33, 0.97, -10.55 + Math.floor(i / 3) * 0.25);
  // back wall: stainless splashback and the extraction hood
  K.box(10.6, 2.0, 0.08, steel, -1.8, 1.9, -12.25); K.box(10.4, 0.55, 1.1, steel, -1.8, 2.75, -10.6); K.box(10.2, 0.04, 0.95, black, -1.8, 2.47, -10.6, 0, false);
  for (let x = -6.5; x < 3.4; x += 0.9) K.box(0.6, 0.04, 0.12, glow(0xfff2d8), x, 2.46, -10.15, 0, false);

  K.flush();

  /* ---------- staff ---------- */
  const at = (lx, lz) => F.toWorld(lx, lz), Y = F.yaw;
  const crew = { uniform: 0x3a3c41, apron: null, trousers: 0x1a1b1f, hat: 'visor', hatColor: 0x2b2d31, badge: 0xffc72c };   // dark grey polo and visor, golden arches badge
  const tones = [0xf1c8a8, 0xb07850, 0x7a4e30, 0xd9a07a, 0x5a3a24, 0xe8b896];
  // tills: tap, then hand over a tray or bag
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[0], hair: 0x3a2414 }, tasks: [
    { to: [-4.6, -6.95], face: 0, act: 'tap', dur: 4.5 }, { to: [-4.6, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'tray' }, { to: [-3.5, -7.25], face: Math.PI, act: 'bag', dur: 3.0, prop: 'bag' }, { to: [-4.6, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: true } ] });
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[2], hair: 0x111111 }, tasks: [
    { to: [-1.8, -6.95], face: 0, act: 'tap', dur: 5 }, { to: [-1.8, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'cup' }, { to: [-1.8, -6.95], face: 0, act: 'tap', dur: 3.5 } ] });
  // drinks: pull a drink at the tower, hand it over
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[3], hair: 0x5a3a24 }, tasks: [
    { to: [-5.7, -7.25], face: Math.PI, act: 'drink', dur: 4, prop: 'cup' }, { to: [-5.9, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'cup', carry: true }, { to: [-4.6, -7.25], face: Math.PI, act: 'wipe', dur: 2.5, prop: 'cloth' } ] });
  // runner: bag at the holding cabinet, hand over at the end of the counter
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[4], hair: 0x111111, hat: 'cap', hatColor: 0x1b1d22 }, tasks: [
    { to: [0.0, -7.25], face: Math.PI, act: 'bag', dur: 3.5, prop: 'bag' }, { to: [1.2, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: true }, { to: [-2.2, -7.25], face: Math.PI, act: 'bag', dur: 3, prop: 'bag' }, { to: [1.4, -6.95], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: true } ] });
  // fry cook: drop and lift the baskets, scoop into cartons, pass to the holding cabinet
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[1], hair: 0x2a1c12 }, tasks: [
    { to: [-5.4, -9.35], face: Math.PI, act: 'fries', dur: 5, prop: 'basket' }, { to: [-3.6, -9.35], face: Math.PI, act: 'scoop', dur: 4, prop: 'scoop' }, { to: [-0.6, -8.9], face: 0, act: 'bag', dur: 2.5 } ] });
  // grill cook: flip patties, work the clamshell, wrap at the cabinet
  staff.add({ at, yaw: Y, look: { ...crew, skin: tones[5], hair: 0x8a5a33 }, tasks: [
    { to: [-0.4, -9.35], face: Math.PI, act: 'flip', dur: 6, prop: 'spatula' }, { to: [1.5, -9.35], face: Math.PI, act: 'flip', dur: 4, prop: 'spatula' }, { to: [0.6, -8.9], face: 0, act: 'bag', dur: 3 } ] });

  return { frame: F };
}
