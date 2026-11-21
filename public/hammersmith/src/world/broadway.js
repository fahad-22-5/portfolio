/**
 * Hammersmith Broadway: the shopping centre (mall.js) and the District &
 * Piccadilly line ticket hall, stairs and platforms inside the station block.
 *
 * The two glass lifts on the plan run up to the bus station on the roof deck.
 */
import * as THREE from 'three';
import { sign, roundel, inst, box } from '../util.js';
import { createGateLine } from '../gates.js';
import { buildMall } from './mall.js';
import { buildBusDeck } from './busdeck.js';
import { createElevator } from '../elevator.js';
import { HALL_ROT, HALL_O, hallX, hallZ, hallLocalX, HALL, STAIR, PLAT, LIFTS } from './plan2024.js';

export function buildBroadway(ctx) {
  const { scene, col, mats } = ctx;
  const g = new THREE.Group();
  scene.add(g);

  const mall = buildMall(ctx, g);

  /* ---------- Tube ticket hall, stairs, platforms (gateline faces the north lobby) ---------- */
  const hg = new THREE.Group(); hg.position.set(HALL_O[0], 0, HALL_O[1]); hg.rotation.y = HALL_ROT; g.add(hg);
  const hr = (x, z, w, d, o) => col.rect(hallX(x, z), hallZ(x, z), w, d, { ...o, rot: HALL_ROT });
  const gates = createGateLine(ctx, { x: hallX(15, 5), z: hallZ(15, 5), rot: Math.PI / 2 + HALL_ROT, count: 6 });
  for (const [x, z, w, d] of [[(HALL.x0 + HALL.x1) / 2, HALL.z0, HALL.x1 - HALL.x0, 0.25], [(HALL.x0 + HALL.x1) / 2, HALL.z1, HALL.x1 - HALL.x0, 0.25], [HALL.x1, (HALL.z0 + HALL.z1) / 2, 0.25, HALL.z1 - HALL.z0]]) {
    box(hg, w, 3.4, d, mats.tile, x, 1.7, z); hr(x, z, w, d, { h: 3.4, thick: 3.4, pad: 0.1 });
  }
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0).rotateX(Math.PI / 2), mats.white); lid.position.set((HALL.x0 + HALL.x1) / 2, 3.42, 5); hg.add(lid);
  box(hg, 0.5, 0.9, HALL.z1 - HALL.z0 + 0.3, mats.dark, HALL.x0, 3.0, 5);
  const band = sign('HAMMERSMITH STATION', { w: 8.4, h: 0.5, bg: '#0019a8', size: 0.6 }); band.position.set(HALL.x0 - 0.3, 3.75, 5); band.rotation.y = -Math.PI / 2; hg.add(band);
  const lines = sign('District and Piccadilly lines', { w: 5.6, h: 0.6, bg: '#fff', fg: '#0019a8', stripe: ['#003688', '#00782a'] }); lines.position.set(HALL.x0 - 0.27, 3.0, 5); lines.rotation.y = -Math.PI / 2; hg.add(lines);
  for (const z of [1.6, 8.4]) { const r = roundel(1.1); r.position.set(HALL.x0 - 0.28, 3.0, z); r.rotation.y = -Math.PI / 2; hg.add(r); }
  const big = roundel(2.2, { text: 'HAMMERSMITH' }); big.position.set(HALL.x1 - 0.15, 2.1, 5); big.rotation.y = -Math.PI / 2; hg.add(big);
  const slats = []; for (let x = HALL.x0 + 0.5; x < HALL.x1; x += 0.55) slats.push({ x, y: 3.32, z: 5 });
  inst(hg, new THREE.BoxGeometry(0.16, 0.12, HALL.z1 - HALL.z0 - 0.3), mats.white, slats, { shadow: false });
  inst(hg, new THREE.BoxGeometry(HALL.x1 - HALL.x0 - 1, 0.05, 0.14), mats.cool, [2.4, 5, 7.6].map((z) => ({ x: (HALL.x0 + HALL.x1) / 2, y: 3.24, z })), { shadow: false });
  const tvm = [13.6, 12.2];
  inst(hg, new THREE.BoxGeometry(1.1, 2.0, 0.7), new THREE.MeshStandardMaterial({ color: 0x0019a8, roughness: 0.35, metalness: 0.2 }), tvm.map((x) => ({ x, y: 1.0, z: 0.6 })));
  inst(hg, new THREE.PlaneGeometry(0.6, 0.5), mats.cool, tvm.map((x) => ({ x, y: 1.35, z: 0.96 })), { shadow: false });
  tvm.forEach((x) => hr(x, 0.6, 1.1, 0.7, { h: 2.0, thick: 2.0, pad: 0.1 }));
  const tickets = sign('Tickets', { w: 2.4, h: 0.4, bg: '#0019a8', size: 0.6 }); tickets.position.set(12.9, 2.35, 0.97); hg.add(tickets);
  // stairs down 4 m
  const treads = []; for (let i = 0; i < 16; i++) treads.push({ x: STAIR.x0 + 0.25 + i * 0.5, y: -0.25 * i - 0.25, z: 5 });
  inst(hg, new THREE.BoxGeometry(0.5, 0.5, STAIR.z1 - STAIR.z0), mats.concrete, treads);
  hr((STAIR.x0 + STAIR.x1) / 2, 5, 8, 4, { hf: (wx, wz) => -Math.min(4, Math.max(0, (hallLocalX(wx, wz) - STAIR.x0) / 2)) });
  for (const z of [STAIR.z0, STAIR.z1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.2), mats.tile); w.position.set((STAIR.x0 + STAIR.x1) / 2, -2.1, z); hg.add(w); }
  // platforms
  const X = (v) => v - 1.5;
  hr((PLAT.x0 + PLAT.x1) / 2, 5, PLAT.x1 - PLAT.x0, PLAT.z1 - PLAT.z0, { h: PLAT.y });
  box(hg, 18, 0.4, 20, mats.concrete, X(37), PLAT.y - 0.2, 5);
  box(hg, 0.25, 0.02, 20, mats.yellow, X(45.5), PLAT.y + 0.01, 5);
  box(hg, 6.5, 0.4, 20, mats.dark, X(49.2), PLAT.y - 1.1, 5);
  for (const [x, z, w, ry] of [[40, -5, 24.5, 0], [40, 15, 24.5, 0], [52.3, 5, 20, Math.PI / 2], [28, -1, 8, Math.PI / 2], [28, 11, 8, Math.PI / 2]]) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.2), mats.tile); wall.position.set(X(x), -2.1, z); wall.rotation.y = ry; hg.add(wall); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24.5, 20).rotateX(Math.PI / 2), mats.concreteDark); ceil.position.set(X(40.2), -0.06, 5); hg.add(ceil);
  inst(hg, new THREE.BoxGeometry(0.3, 0.05, 6), mats.cool, [32, 37, 42].flatMap((x) => [{ x: X(x), y: -0.12, z: -1 }, { x: X(x), y: -0.12, z: 9 }]), { shadow: false });
  const pr = roundel(2, { text: 'HAMMERSMITH' }); pr.position.set(X(37), -1.9, -4.95); hg.add(pr);
  const way = sign('Way out ↑', { w: 2.6, h: 0.5, bg: '#ffd329', fg: '#111' }); way.position.set(X(28.05), -1.2, 9.5); way.rotation.y = Math.PI / 2; hg.add(way);
  box(hg, 2.7, 2.5, 19.6, mats.white, X(49.2), PLAT.y + 1.05, 5);
  box(hg, 2.74, 0.7, 19.6, new THREE.MeshStandardMaterial({ color: 0x0019a8 }), X(49.2), PLAT.y - 0.35, 5);
  box(hg, 2.76, 0.9, 18.8, mats.dark, X(49.2), PLAT.y + 1.45, 5);
  inst(hg, new THREE.BoxGeometry(0.06, 2.0, 1.4), mats.red, [-6.5, -2.2, 2.2, 6.5].map((dz) => ({ x: X(47.83), y: PLAT.y + 0.95, z: 5 + dz })));

  // bus station on the roof, and the glass lifts up to it (one shared interface for the game loop)
  const deck = buildBusDeck(ctx, g);
  const lifts = LIFTS.map((L) => createElevator(ctx, L));
  const lift = {
    update(dt, p) { for (let i = 0; i < lifts.length; i++) lifts[i].update(dt, p); },
    prompt(p) { for (let i = 0; i < lifts.length; i++) { const t = lifts[i].prompt(p); if (t) return t; } return null; },
    interact(p) { for (let i = 0; i < lifts.length; i++) if (lifts[i].interact(p)) return true; return false; },
    lifts, deck,
  };
  return { lift, gates, staff: mall.staff };
}
