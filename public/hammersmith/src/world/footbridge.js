/**
 * The footbridge: the mural corridor from video 2 (3:00-4:24), running 36 m
 * north-east from the mall (between McDonald's and the east station building)
 * to the doors at the Bute Gardens gate. Positions of the lockers and the
 * Fourex machine come straight off the 2024 plan.
 *
 * Built in a local frame: +x along the corridor (0 at the mall, L at the far
 * doors), z across (-3 north wall, +3 south wall).
 */
import * as THREE from 'three';
import { canvasTex, sign, inst, box, rng, FONT, TAU } from '../util.js';
import { FOOTBRIDGE, PORCH, fbWorld } from './plan2024.js';
import { brushedSteel, blackSteel, paint, glow, clearGlass } from './finishes.js';
import { addContact } from './sim.js';

/** Bold flat-colour mural (jazz saxophonist, dancers, hands) in the spirit of the real one. */
function mural(seed) {
  const r = rng(seed), pal = ['#2447a8', '#e23d3d', '#f2c230', '#f3b7c8', '#1c8a7a', '#f08a3c', '#fbf6ea', '#5bb8d6'];
  const t = canvasTex(2048, 256, (c) => {
    let x = 0, k = Math.floor(r() * 8);
    while (x < 2048) { const w = 90 + r() * 200; c.fillStyle = pal[k++ % 8]; c.fillRect(x, 0, w + 2, 256); x += w; }
    for (let i = 0; i < 14; i++) {                               // figures: head, swinging body, limbs
      const fx = 70 + i * 140 + r() * 40, body = pal[(i * 3 + 2) % 8], ink = '#18245e';
      c.fillStyle = body; c.beginPath(); c.ellipse(fx, 150, 26, 62, (r() - 0.5) * 0.6, 0, TAU); c.fill();
      c.fillStyle = pal[(i * 5 + 1) % 8]; c.beginPath(); c.arc(fx + (r() - 0.5) * 16, 70, 22, 0, TAU); c.fill();
      c.strokeStyle = ink; c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx - 10, 110); c.quadraticCurveTo(fx - 60, 80 + r() * 40, fx - 70, 30 + r() * 40); c.stroke();
      c.beginPath(); c.moveTo(fx + 10, 110); c.quadraticCurveTo(fx + 60, 130, fx + 50 + r() * 30, 70 + r() * 40); c.stroke();
      if (i % 3 === 0) { c.strokeStyle = '#f2c230'; c.lineWidth = 12; c.beginPath(); c.moveTo(fx + 30, 100); c.bezierCurveTo(fx + 70, 130, fx + 40, 200, fx + 80, 210); c.stroke(); }   // saxophone
    }
    c.strokeStyle = '#18245e'; c.lineWidth = 4;
    for (let i = 0; i < 70; i++) { const px = r() * 2048, py = r() * 256; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 12, py - 14, px + 24, py); c.quadraticCurveTo(px + 36, py + 14, px + 48, py); c.stroke(); }
  });
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
}

export function buildFootbridge(ctx, parent) {
  const { col } = ctx, L = FOOTBRIDGE.length, H = FOOTBRIDGE.half, yaw = FOOTBRIDGE.yaw;
  const g = new THREE.Group(); const [ox, oz] = FOOTBRIDGE.origin; g.position.set(ox, 0, oz); g.rotation.y = yaw; parent.add(g);
  const colR = (lx, lz, w, d, o = {}) => { const [x, z] = fbWorld(lx, lz); return col.rect(x, z, w, d, { ...o, rot: yaw }); };
  const hi = 3.7, lo = 3.3;                                         // ceiling falls towards the far doors
  const wallMat = paint(0xf4f3ee, 0.8), steel = brushedSteel(), black = blackSteel();

  // floor: light grey with darker bands, tactile corduroy at both ends
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.6, 2 * H).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({
    roughness: 0.3, map: (() => { const t = canvasTex(1024, 64, (c) => { c.fillStyle = '#e1ddd2'; c.fillRect(0, 0, 1024, 64); for (let i = 0; i < 64; i++) { c.fillStyle = i % 2 ? '#3b3a38' : '#8a8478'; c.fillRect(i * 16 + 3, 0, i % 2 ? 6 : 2, 64); } }); return t; })(),
  }));
  floor.position.set(L / 2, 0.03, 0); floor.receiveShadow = true; g.add(floor);
  const tact = new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(64, 64, (c) => { c.fillStyle = '#4a4c50'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#6a6d72'; for (let x = 0; x < 64; x += 8) c.fillRect(x, 0, 3, 64); }) });
  for (const x of [1.0, L - 1.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2 * H - 0.4).rotateX(-Math.PI / 2), tact); m.position.set(x, 0.035, 0); g.add(m); }

  // walls with murals both sides
  for (const s of [-1, 1]) {
    box(g, L, hi, 0.24, wallMat, L / 2, hi / 2, s * (H + 0.12));
    colR(L / 2, s * (H + 0.12), L, 0.24, { h: hi, pad: 0.05 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.6, lo - 0.25), mural(s > 0 ? 19 : 7));
    m.position.set(L / 2, (lo - 0.25) / 2 + 0.1, s * (H - 0.005)); m.rotation.y = s > 0 ? Math.PI : 0; g.add(m);
    box(g, L, 0.12, 0.05, black, L / 2, 0.06, s * (H - 0.03)).castShadow = false;           // skirting
  }
  // sloping ceiling: white, pink recessed centre panel between two continuous LED lines
  const tilt = Math.atan2(hi - lo, L), lidL = Math.hypot(L, hi - lo), midY = (hi + lo) / 2;
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(lidL, 2 * H + 0.5).rotateX(Math.PI / 2), paint(0xf6f5f1, 0.9)); lid.position.set(L / 2, midY, 0); lid.rotation.z = tilt; g.add(lid);
  const pink = new THREE.Mesh(new THREE.PlaneGeometry(lidL - 0.4, 2.5).rotateX(Math.PI / 2), glow(0xf0b3ae)); pink.position.set(L / 2, midY - 0.06, 0); pink.rotation.z = tilt; g.add(pink);
  for (const z of [-1.45, 1.45]) { const l = box(g, lidL - 0.6, 0.04, 0.12, glow(0xfff6e6), L / 2, midY - 0.05, z); l.rotation.z = tilt; l.castShadow = false; }
  const roof = box(g, L + 0.5, 0.35, 2 * H + 0.7, paint(0x9aa0a6, 0.6), L / 2, hi + 0.2, 0); roof.castShadow = true;

  // mall end: black header over the opening
  box(g, 0.3, 0.8, 2 * H + 0.5, paint(0x0d0d0f, 0.4), 0, hi - 0.4, 0);
  const hdr = sign('HAMMERSMITH BROADWAY', { w: 2 * H - 0.5, h: 0.6, bg: '#0d0d0f', size: 0.55 }); hdr.position.set(-0.16, hi - 0.4, 0); hdr.rotation.y = -Math.PI / 2; g.add(hdr);
  // far end: the corridor runs on through the Broadway entrance building (cityBlocks) to the street doors in its face
  const PW = 3.2, DX = L + PORCH - 0.45, frame = paint(0x141416, 0.4);
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(PORCH + 0.3, 2 * PW).rotateX(-Math.PI / 2), floor.material); pf.position.set(L + PORCH / 2 - 0.15, 0.03, 0); pf.receiveShadow = true; g.add(pf);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2 * PW - 0.6).rotateX(-Math.PI / 2), paint(0x2c2e31, 0.95)); mat.position.set(DX - 1.0, 0.04, 0); g.add(mat);
  const plid = new THREE.Mesh(new THREE.PlaneGeometry(PORCH, 2 * PW).rotateX(Math.PI / 2), paint(0xf6f5f1, 0.9)); plid.position.set(L + PORCH / 2, hi - 0.02, 0); g.add(plid);
  box(g, 0.12, hi - lo + 0.45, 2 * PW, wallMat, L + 0.06, (hi + lo) / 2 + 0.2, 0).castShadow = false;        // closes the step between the sloping lid and the porch ceiling
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(PORCH - 0.9, lo - 0.25), mural(s > 0 ? 23 : 11)); m.position.set(L + (PORCH - 0.9) / 2 + 0.1, (lo - 0.25) / 2 + 0.1, s * (PW - 0.01)); m.rotation.y = s > 0 ? Math.PI : 0; g.add(m); }
  for (const z of [-1.45, 1.45]) box(g, PORCH - 0.4, 0.04, 0.12, glow(0xfff6e6), L + PORCH / 2, hi - 0.05, z).castShadow = false;
  // black-framed glass double doors in the front face, standing open
  box(g, 0.25, hi, 0.3, frame, DX, hi / 2, -PW + 0.15); box(g, 0.25, hi, 0.3, frame, DX, hi / 2, PW - 0.15); box(g, 0.25, 0.5, 2 * PW, frame, DX, hi - 0.25, 0);
  for (const s of [-1, 1]) { box(g, 0.08, 2.95, 0.5, clearGlass(), DX, 1.5, s * (PW - 0.55)).castShadow = false;                     // fixed side lights
    const leaf = new THREE.Group(); leaf.position.set(DX, 0, s * (PW - 0.8)); leaf.rotation.y = s * 1.25; g.add(leaf);
    box(leaf, 0.05, 2.9, 1.25, clearGlass(), 0, 1.45, -s * 0.62).castShadow = false; box(leaf, 0.07, 2.9, 0.06, frame, 0, 1.45, -s * 1.24); box(leaf, 0.07, 0.08, 1.25, frame, 0, 2.88, -s * 0.62); box(leaf, 0.05, 0.7, 0.04, steel, 0.06, 1.1, -s * 1.1); }
  const out = sign('Way out  ·  Bute Gardens  ·  Hammersmith Road', { w: 4.6, h: 0.4, bg: '#0d0d0f', size: 0.45 }); out.position.set(DX - 0.15, hi - 0.25, 0); out.rotation.y = -Math.PI / 2; g.add(out);

  // Amazon lockers: north wall 19.7-23.6 m, south wall 22.7-26.7 m (from the plan)
  const lockerTex = canvasTex(128, 256, (c) => {
    c.fillStyle = '#f29a1f'; c.fillRect(0, 0, 128, 256); c.strokeStyle = '#b86a05'; c.lineWidth = 2;
    for (let j = 0; j < 6; j++) for (let i = 0; i < 2; i++) { c.strokeRect(4 + i * 62, 4 + j * 42, 58, 38); c.fillStyle = '#d9840f'; c.fillRect(52 + i * 62, 18 + j * 42, 5, 10); }
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `700 15px ${FONT}`; c.fillText('amazon locker', 8, 250);
  });
  const lockerMat = new THREE.MeshStandardMaterial({ map: lockerTex, roughness: 0.35, metalness: 0.25 });
  const lockers = [];
  for (let x = 19.9; x < 23.5; x += 0.95) lockers.push({ x, y: 1.1, z: -H + 0.3 });
  for (let x = 22.9; x < 26.6; x += 0.95) lockers.push({ x, y: 1.1, z: H - 0.3, ry: Math.PI });
  inst(g, new THREE.BoxGeometry(0.93, 2.2, 0.55), lockerMat, lockers);
  const screenM = glow(0x9fd3ee);
  for (const [x, z, ry] of [[21.6, -H + 0.585, 0], [24.8, H - 0.585, Math.PI]]) { box(g, 0.55, 0.85, 0.04, black, x, 1.35, z, ry).castShadow = false; const sc = box(g, 0.42, 0.3, 0.02, screenM, x, 1.5, z + (z < 0 ? 0.02 : -0.02), ry); sc.castShadow = false; }
  colR(21.7, -H + 0.3, 3.9, 0.6, { h: 2.2, thick: 2.2, pad: 0.05 }); colR(24.75, H - 0.3, 3.9, 0.6, { h: 2.2, thick: 2.2, pad: 0.05 });
  // Fourex currency machine (south wall, 16.6 m)
  box(g, 1.1, 1.9, 0.7, paint(0xf4f4f2, 0.4), 16.6, 0.95, H - 0.36); box(g, 1.1, 0.32, 0.72, paint(0x1d4f9c, 0.4), 16.6, 1.78, H - 0.36);
  const fx = sign('fourex · currency', { w: 1.0, h: 0.26, bg: '#1d4f9c', size: 0.5 }); fx.position.set(16.6, 1.78, H - 0.72); fx.rotation.y = Math.PI; g.add(fx);
  box(g, 0.5, 0.36, 0.03, screenM, 16.6, 1.25, H - 0.725).castShadow = false; colR(16.6, H - 0.36, 1.1, 0.7, { h: 1.9, thick: 1.9, pad: 0.05 });
  // photo booth (north) and Pop Mart vending (south)
  box(g, 1.5, 2.15, 1.15, paint(0xf3f3f0, 0.5), 12.2, 1.08, -H + 0.6); box(g, 0.05, 1.6, 0.85, paint(0x3a3c40, 0.8), 11.43, 1.0, -H + 0.6);
  const pb = sign('PHOTO BOOTH', { w: 1.3, h: 0.3, bg: '#f3f3f0', fg: '#111', size: 0.6 }); pb.position.set(12.2, 1.9, -H + 1.18); g.add(pb); colR(12.2, -H + 0.6, 1.5, 1.15, { h: 2.15, thick: 2.15, pad: 0.05 });
  box(g, 1.3, 2.0, 0.9, paint(0xf6c61e, 0.35), 13.0, 1.0, H - 0.46); box(g, 1.0, 1.0, 0.03, clearGlass(), 13.0, 1.25, H - 0.92).castShadow = false;
  const pm = sign('POP MART  ROBOSHOP', { w: 1.1, h: 0.3, bg: '#f6c61e', fg: '#111', size: 0.42 }); pm.position.set(13.0, 1.88, H - 0.925); pm.rotation.y = Math.PI; g.add(pm);
  const toys = []; for (let i = 0; i < 12; i++) toys.push({ x: 12.6 + (i % 4) * 0.27, y: 0.9 + Math.floor(i / 4) * 0.3, z: H - 0.6, c: ['#f3b7c8', '#5bb8d6', '#ffffff', '#e23d3d'][i % 4] });
  inst(g, new THREE.BoxGeometry(0.16, 0.2, 0.16), paint(0xffffff, 0.5), toys, { shadow: false }); colR(13.0, H - 0.46, 1.3, 0.9, { h: 2.0, thick: 2.0, pad: 0.05 });
  // black tiered planters with spiky dracaena (north wall)
  const tiers = [], spikes = [], greens = [0x4f7d32, 0x3f6b2b, 0x6a9450];
  for (const px of [28.4, 31.4]) { for (let t = 0; t < 3; t++) tiers.push({ x: px, y: 0.2 + t * 0.4, z: -H + 0.75, sx: 2.2 - t * 0.6, sy: 0.4, sz: 1.2 - t * 0.3 });
    for (let k = 0; k < 11; k++) { const a = k * 0.57; spikes.push({ x: px + Math.cos(a) * 0.1, y: 1.75, z: -H + 0.75 + Math.sin(a) * 0.1, rx: 0.55 * Math.cos(a), rz: 0.55 * Math.sin(a), c: greens[k % 3] }); }
    colR(px, -H + 0.75, 2.2, 1.2, { h: 1.2, pad: 0.05 }); { const [wx, wz] = fbWorld(px, -H + 0.75); addContact(wx, wz, 1.4, 0.8, yaw); } }
  inst(g, new THREE.BoxGeometry(1, 1, 1), paint(0x18191b, 0.6), tiers);
  inst(g, new THREE.ConeGeometry(0.06, 1.4, 5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), spikes, { shadow: false });
  // curved commuter benches on the centre line: steel frame, black timber slats
  const slat = [];
  for (const [bx, bend] of [[7.5, 1], [33.6, -1]]) {
    for (let i = 0; i < 12; i++) { const t = (i - 5.5) / 5.5; slat.push({ x: bx + t * 1.6, y: 0.47, z: bend * (0.5 - t * t * 0.5), ry: -bend * t * 0.55 }); }
    inst(g, new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), steel, [-1.4, 0, 1.4].map((o) => ({ x: bx + o, y: 0.21, z: bend * 0.2 })));
    box(g, 3.4, 0.06, 0.08, steel, bx, 0.4, bend * 0.2); colR(bx, bend * 0.25, 3.5, 0.9, { h: 0.5 });
    { const [wx, wz] = fbWorld(bx, bend * 0.25); addContact(wx, wz, 2.0, 0.6, yaw); }
  }
  inst(g, new THREE.BoxGeometry(0.24, 0.05, 0.62), paint(0x1b1b1d, 0.6), slat);
  // the ramped section (video 1, 4:27): a glass balustrade with a steel handrail down the middle for the last stretch
  box(g, 6, 0.05, 0.05, steel, 26.6, 1.0, 0.0); box(g, 6, 0.9, 0.03, clearGlass(), 26.6, 0.5, 0.0).castShadow = false;
  inst(g, new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), steel, [23.6, 25.1, 26.6, 28.1, 29.6].map((x) => ({ x, y: 0.5, z: 0 })));
  colR(26.6, 0, 6.1, 0.1, { h: 1.0, pad: 0.04 });
  // ring of downlights along the LED lines
  return { group: g };
}
