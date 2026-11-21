/**
 * Pret A Manger, Broadway Hammersmith: a narrow, deep unit (5.2 m front,
 * 20 m deep) on the main mall, between Unit 30 and Chopstix.
 *
 * Local frame (shopkit): z = 0 is the glazed front, the shop runs back to
 * z = -13 (the kitchen beyond is closed off). The unit widens slightly
 * towards the back, so x positions use the wall lines xl(z) / xr(z).
 *
 *   window bar with stools, grab-and-go chilled wall, crisps and snacks,
 *   counter with pastry case and tills, a three-group espresso machine with
 *   grinders and steam wands, back counter, tiled back wall with backlit menus.
 *   staff: two baristas, one on the till, one restocking the fridge.
 */
import * as THREE from 'three';
import { addPlace, addSeat } from '../sim.js';
import { readableBothSides, canvasTex, FONT, TAU } from '../../util.js';
import { shopFrame, kit } from '../shopkit.js';
import { brushedSteel, chrome, blackSteel, oak, metroTile, marble, paint, glow, clearGlass, menuBoard, label, fascia } from '../finishes.js';

const CEIL_IN = 3.5, BURGUNDY = 0x6b1d2f;

export function buildPret(ctx, parent, unit, staff) {
  const F = shopFrame(unit, 0), K = kit(ctx, parent, F), L = F.local;
  // the two long walls as lines x(z)
  const lineX = (p, q) => (z) => p[0] + (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]);
  const xl = lineX(L[1], L[2]), xr = lineX(L[0], L[5]);
  const steel = brushedSteel(), black = blackSteel(), burg = paint(BURGUNDY, 0.55), wood = oak('#b98a5a'), white = paint(0xf6f4ef, 0.85);
  const ZB = -13;                                                           // back wall of the shop floor

  /* ---------- shell ---------- */
  const room = [[xr(0), 0], [xl(0), 0], [xl(ZB), ZB], [xr(ZB), ZB]];
  K.flat(room, wood, 0.04);
  K.flat(room, white, CEIL_IN, true);
  // long walls: burgundy below a white upper; back wall in white metro tile with a kitchen door
  for (const [p, q] of [[[xl(0), 0], [xl(ZB), ZB]], [[xr(0), 0], [xr(ZB), ZB]]]) {
    K.seg(p, q, 0, 1.1, burg, { collide: false }); K.seg(p, q, 1.1, 5.97, white, { collide: false });
    K.solid((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.hypot(q[0] - p[0], q[1] - p[1]), 0.2, 5.97, { ry: Math.atan2(-(q[1] - p[1]), q[0] - p[0]) });
  }
  K.seg([xl(ZB), ZB], [xr(ZB), ZB], 0, CEIL_IN, metroTile());
  K.seg([xl(ZB), ZB - 0.15], [xr(ZB), ZB - 0.15], CEIL_IN, 5.97, white, { collide: false });
  K.box(0.95, 2.1, 0.06, paint(0x3a2a22, 0.5), 0.0, 1.05, ZB + 0.1); K.box(0.05, 0.3, 0.03, chrome(), 0.35, 1.05, ZB + 0.15);
  // front: glazing with a door on the right, burgundy fascia with the Pret stars
  const fx0 = xl(0), fx1 = xr(0);
  K.seg([fx0, 0], [0.5, 0], 0, 3.0, clearGlass(), { t: 0.05, shadow: false });
  K.seg([2.3, 0], [fx1, 0], 0, 3.0, clearGlass(), { t: 0.05, shadow: false });
  for (const x of [fx0 + 0.05, -1.0, 0.5, 2.3, fx1 - 0.05]) K.box(0.07, 3.0, 0.1, black, x, 1.5, 0);
  K.box(fx1 - fx0, 0.08, 0.1, black, (fx0 + fx1) / 2, 3.0, 0);
  K.seg([fx0, 0], [fx1, 0], 3.05, 5.97, burg, { collide: false });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0 - 0.3, 0.9), fascia('PRET A MANGER', fx1 - fx0 - 0.3, { bg: '#6b1d2f', fg: '#f6efe2', style: 'stars' }, 0.9));
  fm.position.set((fx0 + fx1) / 2, 3.55, 0.13); K.group.add(fm);
  const blade = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, map: canvasTex(128, 128, (c) => { c.fillStyle = '#6b1d2f'; c.beginPath(); c.arc(64, 64, 63, 0, TAU); c.fill(); c.fillStyle = '#f6efe2'; c.font = `700 30px ${FONT}`; c.textAlign = 'center'; c.fillText('PRET', 64, 60); c.font = `20px ${FONT}`; c.fillText('★', 64, 90); }) }));
  blade.position.set(fx1 - 0.3, 2.75, 0.8); blade.rotation.y = Math.PI / 2; K.group.add(blade); readableBothSides(blade.material);
  // glass door, ajar
  const door = new THREE.Group(); door.position.set(2.3, 0, 0); door.rotation.y = -1.0; K.group.add(door);
  { const g = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.8, 0.04), clearGlass()); g.position.set(-0.88, 1.4, 0); door.add(g); const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.05), chrome()); h.position.set(-1.6, 1.1, 0.04); door.add(h); }

  /* ---------- window bar and stools ---------- */
  K.box(2.6, 0.05, 0.45, wood, -1.1, 1.05, -0.4); K.box(2.6, 1.0, 0.06, burg, -1.1, 0.5, -0.6); K.solid(-1.1, -0.42, 2.6, 0.5, 1.07);
  for (const x of [-2.0, -1.1, -0.2]) { K.cyl(0.18, 0.18, 0.05, 18, burg, x, 0.75, -1.05); K.cyl(0.025, 0.025, 0.72, 8, black, x, 0.37, -1.05); K.cyl(0.16, 0.18, 0.02, 18, black, x, 0.01, -1.05); K.solid(x, -1.05, 0.38, 0.38, 0.77); addSeat('Pret A Manger', K.at(x, -1.05), K.at(x, -0.4), 0.77); }

  /* ---------- grab-and-go chilled wall (left) ---------- */
  const wallYaw = Math.atan2(L[2][0] - L[1][0], L[2][1] - L[1][1]) + Math.PI;           // along the left wall
  const fz0 = -2.4, fz1 = -8.6, fzc = (fz0 + fz1) / 2, flen = fz0 - fz1, fxc = xl(fzc) + 0.45;
  K.box(0.75, 2.1, flen, black, fxc, 1.05, fzc, wallYaw);
  K.box(0.05, 1.7, flen - 0.1, glow(0xf3f7fb), fxc - 0.33, 1.15, fzc, wallYaw, false);
  K.solid(fxc, fzc, 0.8, flen, 2.1, { ry: wallYaw });
  // packaging
  const sandwich = label('sand', (c) => { c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#6b1d2f'; c.fillRect(0, 70, 128, 22); c.fillStyle = '#e8c27a'; c.fillRect(20, 20, 88, 40); c.fillStyle = '#6aa14a'; c.fillRect(20, 40, 88, 8); });
  const salad = label('salad', (c) => { c.fillStyle = '#4f8a3a'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#e23d3d'; for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(10 + (i * 37) % 118, 12 + (i * 53) % 110, 7, 0, TAU); c.fill(); } c.fillStyle = '#f2c230'; c.fillRect(0, 100, 128, 28); });
  const baguette = paint(0xd9a35b, 0.6), wrap = paint(0xf3eee4, 0.8);
  const drinkCols = [0xe23d3d, 0xf08a3c, 0x6aa14a, 0xf2c230, 0x7a3fb0, 0xfbf6ea];
  const prism = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 3).rotateZ(Math.PI / 2);
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 0.35 + shelf * 0.42, s = shelf;
    K.box(0.5, 0.025, flen - 0.15, steel, fxc + 0.08, y, fzc, wallYaw);
    K.box(0.02, 0.04, flen - 0.15, glow(0xfff6e6), fxc + 0.33, y + 0.36, fzc, wallYaw, false);
    for (let t = -flen / 2 + 0.15; t < flen / 2 - 0.1; t += 0.16) {
      const sx = Math.sin(wallYaw), cz = Math.cos(wallYaw), px = fxc + 0.15 * Math.cos(wallYaw) + t * sx, pz = fzc + t * cz;
      if (s === 3) K.mesh(prism, sandwich, px, y + 0.07, pz, 0, wallYaw + Math.PI / 2, 0);                                  // sandwich wedges
      else if (s === 2) { if ((t * 10 | 0) % 2) K.cyl(0.035, 0.035, 0.32, 10, baguette, px, y + 0.06, pz, Math.PI / 2, 0); else K.box(0.16, 0.08, 0.14, salad, px, y + 0.045, pz, wallYaw); }
      else if (s === 1) K.box(0.14, 0.09, 0.14, sandwich, px, y + 0.05, pz, wallYaw);                                         // wraps, pots
      else K.cyl(0.035, 0.035, 0.2, 10, paint(drinkCols[Math.abs(Math.floor(t * 20)) % 6], 0.3), px, y + 0.11, pz);  // juices and water
    }
  }
  // crisps and snacks on the right wall
  const snack = [0x2f7fd0, 0xe23d3d, 0xf2c230, 0x1c8a7a, 0x6b1d2f];
  for (let z = -3.2; z > -7.6; z -= 1.4) {
    const x = xr(z) - 0.35;
    K.box(0.5, 1.5, 1.25, wood, x, 0.75, z, 0); K.solid(x, z, 0.55, 1.3, 1.5);
    for (let lv = 0; lv < 3; lv++) for (let k = 0; k < 5; k++) K.box(0.05, 0.18, 0.13, paint(snack[(k + lv) % 5], 0.4), x - 0.2, 0.62 + lv * 0.42, z - 0.45 + k * 0.22, 0);
  }

  /* ---------- counter: pastry case, tills, espresso machine, grinders ---------- */
  const zc = -9.6, cx0 = xl(zc) + 0.65, cx1 = xr(zc), ccx = (cx0 + cx1) / 2, cw = cx1 - cx0;
  K.box(cw, 1.0, 0.65, burg, ccx, 0.5, zc); K.box(cw + 0.06, 0.05, 0.72, marble(), ccx, 1.025, zc); K.box(cw, 0.08, 0.04, wood, ccx, 0.08, zc + 0.33);
  K.solid(ccx, zc, cw, 0.7, 1.05);
  for (const x of [ccx - cw * 0.25, ccx + cw * 0.15]) addPlace('Pret A Manger', 'cafe', 'order', K.at(x, zc + 0.85), F.yaw + Math.PI);
  // pastry case
  const px0 = cx0 + 0.15;
  K.box(1.3, 0.48, 0.5, clearGlass(), px0 + 0.65, 1.3, zc + 0.02, 0, false); K.box(1.3, 0.03, 0.5, black, px0 + 0.65, 1.545, zc + 0.02);
  K.box(1.25, 0.02, 0.45, glow(0xfff0d0), px0 + 0.65, 1.07, zc + 0.02, 0, false);
  const croissant = new THREE.TorusGeometry(0.045, 0.025, 8, 14, Math.PI * 1.2).rotateX(Math.PI / 2).scale(1.3, 1, 1);
  for (let i = 0; i < 7; i++) K.mesh(croissant, paint(0xc98a45, 0.55), px0 + 0.12 + i * 0.17, 1.09, zc + 0.1, 0, i * 0.3, 0);
  for (let i = 0; i < 5; i++) { K.cyl(0.04, 0.035, 0.05, 12, paint(0x7a4a2a, 0.6), px0 + 0.2 + i * 0.22, 1.3, zc - 0.05); K.mesh(new THREE.SphereGeometry(0.045, 10, 8, 0, TAU, 0, Math.PI / 2), paint(0x8a5a33, 0.6), px0 + 0.2 + i * 0.22, 1.325, zc - 0.05); }
  for (let i = 0; i < 6; i++) K.cyl(0.045, 0.045, 0.012, 14, paint(0xc9935a, 0.7), px0 + 0.15 + i * 0.19, 1.3, zc + 0.14);
  // till
  const tx = px0 + 1.6;
  K.box(0.34, 0.25, 0.04, black, tx, 1.22, zc - 0.1, 0); K.single(new THREE.PlaneGeometry(0.3, 0.2), glow(0x9fd3ee), tx, 1.225, zc - 0.075); K.single(new THREE.PlaneGeometry(0.3, 0.2), glow(0xffffff), tx, 1.225, zc - 0.125, Math.PI);
  K.box(0.08, 0.05, 0.12, black, tx + 0.3, 1.08, zc + 0.15);
  // espresso machine: brushed body, burgundy customer side with the star, two groups, steam wands, gauges, cup warmer
  const mx = cx1 - 0.85, mz = zc;
  K.box(1.0, 0.44, 0.52, steel, mx, 1.27, mz); K.box(1.02, 0.04, 0.54, chrome(), mx, 1.51, mz);
  K.box(0.96, 0.36, 0.02, burg, mx, 1.27, mz + 0.27); K.single(new THREE.CircleGeometry(0.07, 20), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(64, 64, (c) => { c.fillStyle = '#f6efe2'; c.beginPath(); c.arc(32, 32, 31, 0, TAU); c.fill(); c.fillStyle = '#6b1d2f'; c.font = '40px serif'; c.textAlign = 'center'; c.fillText('★', 32, 46); }) }), mx, 1.3, mz + 0.285);
  for (const gx of [-0.25, 0.25]) {
    K.cyl(0.05, 0.05, 0.09, 16, chrome(), mx + gx, 1.1, mz - 0.27); K.cyl(0.045, 0.04, 0.035, 16, steel, mx + gx, 1.04, mz - 0.3);
    K.box(0.03, 0.025, 0.15, black, mx + gx, 1.04, mz - 0.42);
    K.single(new THREE.CircleGeometry(0.035, 18), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(32, 32, (c) => { c.fillStyle = '#f8f8f4'; c.beginPath(); c.arc(16, 16, 15, 0, TAU); c.fill(); c.strokeStyle = '#c00'; c.lineWidth = 2; c.beginPath(); c.moveTo(16, 16); c.lineTo(25, 9); c.stroke(); }) }), mx + gx, 1.38, mz - 0.265, Math.PI);
  }
  K.box(0.9, 0.025, 0.2, black, mx, 1.065, mz - 0.33); K.box(0.86, 0.006, 0.16, steel, mx, 1.08, mz - 0.33);
  for (const sx of [-0.45, 0.45]) {                                                                     // steam wands
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sx, 1.38, -0.26), new THREE.Vector3(sx * 1.08, 1.34, -0.34), new THREE.Vector3(sx * 1.1, 1.18, -0.38), new THREE.Vector3(sx * 1.1, 1.1, -0.36)]);
    K.mesh(new THREE.TubeGeometry(curve, 12, 0.009, 6), chrome(), mx, 0, mz);
  }
  for (let i = 0; i < 8; i++) K.cyl(0.035, 0.03, 0.07, 12, paint(0xfbfaf6, 0.3), mx - 0.35 + (i % 4) * 0.23, 1.565 + Math.floor(i / 4) * 0.07, mz - 0.05 + Math.floor(i / 4) * 0.08);
  for (const gx of [-0.25, 0.25]) K.cyl(0.03, 0.026, 0.06, 12, paint(0xfbfaf6, 0.3), mx + gx, 1.11, mz - 0.33);
  // grinders either side
  for (const gx of [mx - 0.78, cx1 - 0.18]) {
    K.box(0.2, 0.34, 0.28, black, gx, 1.22, mz - 0.05); K.box(0.06, 0.05, 0.07, steel, gx, 1.12, mz - 0.22);
    K.cyl(0.11, 0.06, 0.24, 16, new THREE.MeshPhysicalMaterial({ color: 0x3a2618, transparent: true, opacity: 0.55, roughness: 0.1 }), gx, 1.51, mz - 0.05);
    K.cyl(0.095, 0.05, 0.16, 14, paint(0x3b2314, 0.8), gx, 1.47, mz - 0.05);
  }
  // pick-up point sign hanging over the end of the counter
  readableBothSides(K.single(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, map: canvasTex(256, 64, (c) => { c.fillStyle = '#6b1d2f'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#f6efe2'; c.font = `700 28px ${FONT}`; c.textAlign = 'center'; c.fillText('Collect here', 128, 42); }) }), mx - 1.03, 2.35, zc + 0.1).material);

  /* ---------- back counter and menus ---------- */
  const zb = -12.65, bx0 = xl(zb) + 0.1, bx1 = xr(zb) - 0.1;
  for (const [a, b] of [[bx0, -0.55], [0.55, bx1]]) { K.box(b - a, 0.9, 0.6, steel, (a + b) / 2, 0.45, zb); K.box(b - a + 0.04, 0.04, 0.64, marble(), (a + b) / 2, 0.92, zb); K.solid((a + b) / 2, zb, b - a, 0.65, 0.95); }
  for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) K.cyl(0.04, 0.032, 0.09, 12, label('pcup', (c) => { c.fillStyle = '#fbfaf7'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#6b1d2f'; c.fillRect(0, 54, 128, 22); }), bx0 + 0.3 + i * 0.12, 0.98 + k * 0.03, zb + 0.05);
  K.box(0.3, 0.45, 0.25, black, bx1 - 1.75, 1.17, zb); K.cyl(0.08, 0.07, 0.25, 14, clearGlass(), bx1 - 1.75, 1.5, zb);       // blender
  K.box(0.5, 0.06, 0.4, steel, bx1 - 0.5, 0.95, zb); K.cyl(0.006, 0.006, 0.3, 6, chrome(), bx1 - 0.5, 1.1, zb - 0.15);      // sink
  K.box(0.2, 0.18, 0.2, black, bx1 - 1.15, 1.02, zb);                                                                  // knock box
  const menus = [
    menuBoard('Coffee', [['Flat White', '£3.35'], ['Latte', '£3.45'], ['Cappuccino', '£3.45'], ['Americano', '£2.70'], ['Mocha', '£3.75']], { bg: '#6b1d2f', fg: '#f6efe2', accent: '#f2d9a8', photo: '#8a5a33' }),
    menuBoard('Breakfast', [['Croissant', '£1.95'], ['Pain au Chocolat', '£2.25'], ['Bacon Brioche', '£4.25'], ['Porridge', '£2.95']], { bg: '#1d1d1b', fg: '#f6efe2', accent: '#f2d9a8', photo: '#c98a45' }),
    menuBoard('Lunch', [['Classic Super Club', '£5.25'], ['Tuna Baguette', '£5.75'], ['Chicken Caesar', '£6.25'], ['Falafel Wrap', '£5.45']], { bg: '#6b1d2f', fg: '#f6efe2', accent: '#f2d9a8', photo: '#e8c27a' }),
  ];
  const mw = (xr(ZB) - xl(ZB) - 0.6) / 3;
  menus.forEach((m, i) => { const x = xl(ZB) + 0.3 + mw * (i + 0.5); K.box(mw - 0.08, 0.72, 0.05, black, x, 2.5, ZB + 0.06); K.single(new THREE.PlaneGeometry(mw - 0.16, 0.66), m, x, 2.5, ZB + 0.09); });

  /* ---------- lights ---------- */
  for (const z of [-1.2, -4, -6.8, -9.6, -11.6]) { const x = (xl(z) + xr(z)) / 2; K.cyl(0.006, 0.006, 0.6, 4, black, x, CEIL_IN - 0.3, z, 0, 0, false); K.mesh(new THREE.SphereGeometry(0.14, 18, 12, 0, TAU, 0, Math.PI / 2), paint(0x1b1b1b, 0.4), x, CEIL_IN - 0.62, z); K.cyl(0.11, 0.11, 0.01, 16, glow(0xfff0c8), x, CEIL_IN - 0.63, z, 0, 0, false); }
  for (const z of [-3.5, -6.5]) { const x = (xl(z) + xr(z)) / 2 - 0.4; K.box(1.4, 0.04, 0.12, glow(0xfff6e6), x, CEIL_IN - 0.02, z, 0, false); }

  K.flush();

  /* ---------- staff ---------- */
  const at = (lx, lz) => F.toWorld(lx, lz), Y = F.yaw, zs = zc - 0.62;
  const crew = { uniform: 0x2c2c2e, apron: 0x6b1d2f, trousers: 0x1b1c20, sleeves: 'long', hat: 'cap', hatColor: 0x6b1d2f, badge: 0xffffff };   // burgundy apron and cap, white star
  // barista A: grind, tamp, lock in and pull the shot, hand over the coffee
  staff.add({ at, yaw: Y, look: { ...crew, skin: 0xd9a07a, hair: 0x2a1c12 }, tasks: [
    { to: [mx - 0.78, zs], face: 0, act: 'grind', dur: 2.4, prop: 'portafilter' }, { to: [mx - 0.5, zs], face: 0, act: 'tamp', dur: 1.8, prop: 'portafilter' },
    { to: [mx - 0.25, zs], face: 0, act: 'brew', dur: 3.6 }, { to: [mx - 1.03, zs], face: 0, act: 'handover', dur: 2.4, prop: 'cup', carry: true } ] });
  // barista B: steam milk, pour latte art, grab cups from the back counter, wipe down
  staff.add({ at, yaw: Y, look: { ...crew, skin: 0x7a4e30, hair: 0x111111 }, tasks: [
    { to: [mx + 0.5, zs], face: 0, act: 'steam', dur: 3.6, prop: 'jug' }, { to: [mx + 0.3, zs], face: 0, act: 'pour', dur: 3, prop: 'jug' },
    { to: [bx1 - 1.0, zb + 0.6], face: Math.PI, act: 'restock', dur: 2.4 }, { to: [mx + 0.45, zs], face: 0, act: 'wipe', dur: 2.2, prop: 'cloth' } ] });
  // till
  staff.add({ at, yaw: Y, look: { ...crew, skin: 0xf1c8a8, hair: 0x8a5a33 }, tasks: [
    { to: [tx, zs], face: 0, act: 'tap', dur: 4.2 }, { to: [tx, zs], face: 0, act: 'handover', dur: 2.4, prop: 'pretbag', carry: true },
    { to: [bx0 + 0.55, zb + 0.6], face: Math.PI, act: 'restock', dur: 2 } ] });
  // restocker: from the kitchen door, through the counter gap, to the chilled wall and back
  const gapX = xl(zc) + 0.32;
  staff.add({ at, yaw: Y, look: { ...crew, skin: 0xb07850, hair: 0x3a2414 }, tasks: [
    { to: [0.0, ZB + 0.45], face: Math.PI, act: 'restock', dur: 1.6 }, { to: [gapX, zs], face: 0, act: 'idle', dur: 0.05 }, { to: [gapX, zc + 0.8], face: 0, act: 'idle', dur: 0.05 },
    { to: [xl(-7.4) + 1.25, -7.4], face: -Math.PI / 2, act: 'restock', dur: 4.5 }, { to: [xl(-4.4) + 1.25, -4.4], face: -Math.PI / 2, act: 'restock', dur: 4.5 },
    { to: [gapX, zc + 0.8], face: Math.PI, act: 'idle', dur: 0.05 }, { to: [gapX, zs], face: Math.PI, act: 'idle', dur: 0.05 } ] });

  return { frame: F };
}
