/**
 * Hammersmith bus station on the mall roof (level 1, y = ROOF). The tarmac is
 * the roof slab itself (mall.js); this adds the walkable deck surface, a
 * parapet round the edge, and the stands as Street View shows them (Jul 2022):
 * long glazed shelters with red frames on islands of paving, stainless
 * guardrails, tall twin-arm lamp columns, yellow bay boxes, double-deckers
 * and a single-decker on the 218. The beige stone block with its ochre
 * panels rises beside the deck at the north-east corner.
 */
import * as THREE from 'three';
import { sign, box, inst, canvasTex, FONT } from '../util.js';
import { ENVELOPE, ENV_BOX, ROOF, SKYLIGHT, inEnvelope, inLiftShaft, inSkylight, LIFTS } from './plan2024.js';
import { brushedSteel, paint, glow } from './finishes.js';

export function buildBusDeck(ctx, parent) {
  const { col, mats } = ctx;
  const g = new THREE.Group(); parent.add(g);

  // the deck you walk on: everywhere on the roof except the skylight and the lift shafts
  col.add({ minX: ENV_BOX.minX, maxX: ENV_BOX.maxX, minZ: ENV_BOX.minZ, maxZ: ENV_BOX.maxZ, h: ROOF, thick: 0.45, test: (x, z) => inEnvelope(x, z) && !inSkylight(x, z, 0.2) && !inLiftShaft(x, z, -0.05) });
  // the skylight frame stands up out of the deck
  col.rect(SKYLIGHT.c[0], SKYLIGHT.c[1], SKYLIGHT.hw * 2 + 0.5, SKYLIGHT.hl * 2 + 0.5, { rot: SKYLIGHT.yaw, h: ROOF + 3.2, thick: 3.2 });

  // parapet round the edge
  const parapet = paint(0xb9bcc0, 0.8);
  ENVELOPE.forEach((a, i) => {
    const b = ENVELOPE[(i + 1) % ENVELOPE.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2;
    box(g, len + 0.3, 1.1, 0.3, parapet, cx, ROOF + 0.55, cz, ry);
    box(g, len + 0.3, 0.06, 0.4, brushedSteel(), cx, ROOF + 1.13, cz, ry);
    col.rect(cx, cz, len + 0.3, 0.3, { rot: ry, h: ROOF + 1.1, thick: 1.1 });
  });

  // the beige stone block over the centre's north-east corner: blank bays, each with an ochre rectangle
  const BE = { x: 21, z: -45, w: 18, d: 14, h: 23 };
  {
    const tex = canvasTex(128, 256, (cx) => { cx.fillStyle = '#e6d9b4'; cx.fillRect(0, 0, 128, 256); for (let i = 0; i < 500; i++) { cx.fillStyle = `rgba(120,100,60,${((i * 37) % 10) / 100})`; cx.fillRect((i * 53) % 128, (i * 97) % 256, 2, 2); } cx.strokeStyle = '#c99a3c'; cx.lineWidth = 7; cx.strokeRect(30, 26, 68, 204); cx.fillStyle = '#c9a66a'; cx.fillRect(0, 248, 128, 8); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / 3.6, 1 / 7.2); tex.anisotropy = 8;
    box(g, BE.w, BE.h, BE.d, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), BE.x, ROOF + BE.h / 2, BE.z);
    box(g, BE.w + 0.6, 0.5, BE.d + 0.6, mats.concreteDark, BE.x, ROOF + BE.h + 0.25, BE.z);
    box(g, BE.w * 0.5, 2.6, BE.d * 0.5, paint(0xb9bec3, 0.5), BE.x + 1, ROOF + BE.h + 1.8, BE.z);
    col.rect(BE.x, BE.z, BE.w, BE.d, { h: ROOF + BE.h, thick: BE.h, pad: 0.2 });
  }
  // Stands: a row of five drive-through stands, parallel to the skylight. Buses come up the ramp (its head is on the
  // north edge, over the arch), round behind the row, forward into a stand, and on out round the east end and back down.
  const yaw = SKYLIGHT.yaw, c = Math.cos(yaw), s = Math.sin(yaw), fwd = [s, c], lat = [c, -s];
  const STAND_ROUTES = [['218'], ['72', '306', '110'], ['190', '267', 'H91'], ['211', '220', '295'], ['9', '27']];
  const R0 = [-6.9, -15.9], stands = [];
  STAND_ROUTES.forEach((routes, k) => {
    const x = R0[0] + lat[0] * (k - 2) * 8, z = R0[1] + lat[1] * (k - 2) * 8;
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 13).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, map: canvasTex(64, 256, (cx) => { cx.clearRect(0, 0, 64, 256); cx.strokeStyle = '#f2c230'; cx.lineWidth = 4; cx.strokeRect(3, 3, 58, 250); cx.fillStyle = '#f2c230'; cx.font = `800 22px ${FONT}`; cx.save(); cx.translate(40, 128); cx.rotate(-Math.PI / 2); cx.textAlign = 'center'; cx.fillText('BUS STAND ' + 'ABCDE'[k], 0, 0); cx.restore(); }) }));
    mark.position.set(x, ROOF + 0.02, z); mark.rotation.y = yaw; g.add(mark);
    const [sx, sz] = at(3.3, 0); shelter(sx, sz, yaw, routes.join('  '));
    stands.push({ k, x, z, routes, at });
  });
  // the ramp head: a covered top to the ramp up from the arch, open to the south, dark inside
  const RH = { x0: -10, x1: 1, z0: -57, z1: -45, h: 5 };
  {
    const conc = paint(0xb7b2a8, 0.85), dark = paint(0x0d0e10, 1), cx = (RH.x0 + RH.x1) / 2, cz = (RH.z0 + RH.z1) / 2, w = RH.x1 - RH.x0, d = RH.z1 - RH.z0;
    box(g, 0.45, RH.h, d, conc, RH.x0, ROOF + RH.h / 2, cz); box(g, 0.45, RH.h, d, conc, RH.x1, ROOF + RH.h / 2, cz); box(g, w + 0.45, RH.h, 0.45, conc, cx, ROOF + RH.h / 2, RH.z0);
    box(g, w + 0.9, 0.5, d + 0.5, mats.concreteDark, cx, ROOF + RH.h + 0.25, cz - 0.2);
    box(g, w + 0.45, 0.8, 0.5, conc, cx, ROOF + RH.h - 0.4, RH.z1);                                  // lintel over the mouth
    box(g, w - 0.5, RH.h - 0.85, 0.05, dark, cx, ROOF + (RH.h - 0.85) / 2, RH.z0 + 1.2);             // the dark at the back
    box(g, 0.05, RH.h - 0.85, d - 1.4, dark, RH.x0 + 0.3, ROOF + (RH.h - 0.85) / 2, cz - 0.6); box(g, 0.05, RH.h - 0.85, d - 1.4, dark, RH.x1 - 0.3, ROOF + (RH.h - 0.85) / 2, cz - 0.6);
    box(g, w - 0.5, 0.05, d - 1.4, dark, cx, ROOF + RH.h - 0.85, cz - 0.6);
    for (const xx of [RH.x0, RH.x1]) col.rect(xx, cz, 0.5, d, { h: ROOF + RH.h, thick: RH.h });
    col.rect(cx, RH.z0, w, 0.5, { h: ROOF + RH.h, thick: RH.h });
    col.rect(cx, (RH.z0 + RH.z1 - 4) / 2, w, d - 4, { h: ROOF + RH.h, thick: RH.h });                 // the cat stops at the mouth: buses only beyond
    const only = sign('Buses only', { w: 2.2, h: 0.42, bg: '#dc241f', fg: '#fff', size: 0.55 }); only.position.set(cx, ROOF + RH.h - 0.4, RH.z1 + 0.27); g.add(only);
    // lane arrows on the deck: up out of the ramp on the west side, back down on the east
    const arrow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, map: canvasTex(64, 128, (cc) => { cc.clearRect(0, 0, 64, 128); cc.fillStyle = '#f2f2ee'; cc.beginPath(); cc.moveTo(32, 4); cc.lineTo(60, 44); cc.lineTo(42, 44); cc.lineTo(42, 124); cc.lineTo(22, 124); cc.lineTo(22, 44); cc.lineTo(4, 44); cc.closePath(); cc.fill(); }) });
    for (const [x, ry] of [[-6.5, Math.PI], [-2.5, 0]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.6).rotateX(-Math.PI / 2), arrow); m.position.set(x, ROOF + 0.02, -41); m.rotation.y = ry; g.add(m); }
  }
  ctx.deck = { yaw, fwd, lat, stands, roof: ROOF, mouthOut: [-6.5, -45.5], mouthIn: [-2.5, -45.5], inside: -55.2, lift: LIFTS[0] ? [LIFTS[0].x, LIFTS[0].z] : [10, 26] };
  const [tx, tz] = LIFTS[0] ? [LIFTS[0].x, LIFTS[0].z] : [0, 0];
  const totem = sign('Hammersmith Bus Station', { w: 4.2, h: 0.6, bg: '#dc241f', size: 0.5 }); totem.position.set(tx + 3.5, ROOF + 3.2, tz + 3.5); totem.rotation.y = yaw; g.add(totem);

  /** A stand: an island of paving with a long glazed shelter in red frames, a guardrail along its back, a lamp column at one end. */
  function shelter(x, z, ry, route) {
    const sh = new THREE.Group(); sh.position.set(x, ROOF, z); sh.rotation.y = ry; g.add(sh);
    const L = 9, red = paint(0xdc241f, 0.45), steel = brushedSteel(), cs = Math.cos(ry), sn = Math.sin(ry), at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    box(sh, 3.0, 0.12, L + 3.2, mats.flag || mats.concrete, 0.2, 0.06, 0).castShadow = false;
    const posts = []; for (let zz = -L / 2; zz <= L / 2 + 0.01; zz += L / 3) for (const xx of [-0.62, 0.62]) posts.push({ x: xx, y: 1.37, z: zz });
    inst(sh, new THREE.BoxGeometry(0.08, 2.5, 0.08), red, posts);
    box(sh, 1.7, 0.07, L + 0.3, mats.glass, 0, 2.66, 0).castShadow = false;                            // glazed roof
    for (const xx of [-0.8, 0.8]) box(sh, 0.1, 0.24, L + 0.4, red, xx, 2.58, 0);                         // red fascia all round
    for (const zz of [-L / 2 - 0.15, L / 2 + 0.15]) box(sh, 1.7, 0.24, 0.1, red, 0, 2.58, zz);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.0), mats.glass); back.position.set(0.62, 1.4, 0); back.rotation.y = Math.PI / 2; sh.add(back);
    for (const zz of [-L / 2, L / 2]) { const end = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), mats.glass); end.position.set(0.17, 1.4, zz); sh.add(end); }
    for (const y of [0.42, 1.25]) box(sh, 0.06, 0.08, L, red, 0.62, y, 0);
    box(sh, 0.36, 0.06, L - 3, red, 0.36, 0.6, 0);                                                     // perch bench
    const flag = sign(route, { w: 0.6, h: 0.6, bg: '#dc241f', size: 0.6 }); flag.position.set(-0.72, 2.2, L / 2 - 0.4); flag.rotation.y = Math.PI / 2; sh.add(flag);
    // stainless guardrail behind the shelter: capped posts, three tubes
    const gp = []; for (let zz = -L / 2 - 1.2; zz <= L / 2 + 1.21; zz += 1.9) gp.push({ x: 1.45, y: 0.67, z: zz });
    inst(sh, new THREE.CylinderGeometry(0.05, 0.05, 1.1, 10), steel, gp); inst(sh, new THREE.CylinderGeometry(0.065, 0.065, 0.03, 10), steel, gp.map((q) => ({ ...q, y: 1.235 })), { shadow: false });
    for (const y of [0.42, 0.74, 1.06]) box(sh, 0.045, 0.045, L + 2.4, steel, 1.45, y, 0);
    // lamp column: tall, grey, two arms
    const lz = L / 2 + 1.2, grey = paint(0x8f959b, 0.5);
    box(sh, 0.16, 9, 0.16, grey, 0.9, 4.5, lz); box(sh, 2.6, 0.08, 0.1, grey, 0.9, 8.95, lz);
    for (const s of [-1, 1]) box(sh, 0.55, 0.1, 0.24, ctx.streetLampMat || mats.warm, 0.9 + s * 1.15, 8.88, lz).castShadow = false;
    col.rect(...at(0.2, 0), 3.0, L + 3.2, { rot: ry, h: ROOF + 0.12, thick: 0.12 });
    col.rect(...at(0.62, 0), 0.14, L, { rot: ry, h: ROOF + 2.5, thick: 2.5 });
    col.rect(...at(1.45, 0), 0.1, L + 2.4, { rot: ry, h: ROOF + 1.2, thick: 1.2 });
    col.rect(...at(0.9, lz), 0.2, 0.2, { rot: ry, h: ROOF + 9, thick: 9 });
  }

  return { group: g, stands };
}
