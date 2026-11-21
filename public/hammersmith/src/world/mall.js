/**
 * Broadway Hammersmith ground floor at true scale (plan2024.js).
 *
 * Detailed: the footbridge, McDonald's and Pret (their own modules).
 * Everything else is a simple shopfront for now: walls to the ceiling,
 * glazing over a lit interior, the brand's fascia, hoardings on the empty
 * units. Static geometry is merged per material, so the whole mall is a
 * modest number of draw calls.
 */
import * as THREE from 'three';
import { canvasTex, rng, FONT, TAU, sign } from '../util.js';
import { kit, metreBox } from './shopkit.js';
import { concourseFloor, floorUV } from '../render/floor.js';
import { paint, glow, lamp, clearGlass, heroGlass, fascia, blackSteel, brushedSteel, travertine, pillarPaint, slats, marble, curtainWall } from './finishes.js';
import { pilaster, glazingFrame } from './trim.js';
import { buildCeiling, WARM } from './ceiling.js';
import { buildClutter, entranceMat } from './clutter.js';
import {
  ENVELOPE, OPEN, ENV_BOX, UNITS, CEIL, ROOF, SKYLIGHT, STAIR, hallX, hallZ, isMallSolid, unitFronts, streetFronts, floorSamples, unitNamed, inPoly, LIFTS, liftSquare,
} from './plan2024.js';
import { buildFootbridge } from './footbridge.js';
import { buildMcDonalds } from './shops/mcdonalds.js';
import { buildPret } from './shops/pret.js';
import { createStaff } from './staff.js';
import { buildGenericShop } from './shops/generic.js';

export function buildMall(ctx, parent) {
  const { col } = ctx;
  const W0 = { origin: [0, 0], yaw: 0, toWorld: (x, z) => [x, z] };            // world-frame kit
  const K = kit(ctx, parent, W0);
  const cream = pillarPaint(), stone = travertine(), black = blackSteel();          // warm painted plaster inside, travertine slabs on the outside wall

  /* ---------- floor (with the Tube stairwell cut out), soffit, roof, skylight ---------- */
  const shapeOf = (P, k) => { const s = new THREE.Shape(); P.forEach(([x, z], i) => (i ? s.lineTo(x, k * z) : s.moveTo(x, k * z))); return s; };
  const pathOf = (P, k) => { const p = new THREE.Path(); P.forEach(([x, z], i) => (i ? p.lineTo(x, k * z) : p.moveTo(x, k * z))); return p; };
  const well = [[STAIR.x0, STAIR.z0], [STAIR.x1, STAIR.z0], [STAIR.x1, STAIR.z1], [STAIR.x0, STAIR.z1]].map(([x, z]) => [hallX(x, z), hallZ(x, z)]);
  const sk = SKYLIGHT, skc = Math.cos(sk.yaw), sks = Math.sin(sk.yaw);
  const SKY = [[-sk.hw, -sk.hl], [sk.hw, -sk.hl], [sk.hw, sk.hl], [-sk.hw, sk.hl]].map(([lx, lz]) => [sk.c[0] + lx * skc + lz * sks, sk.c[1] - lx * sks + lz * skc]);
  {
    const s = shapeOf(ENVELOPE, -1); s.holes.push(pathOf(well, -1));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), concourseFloor(ctx.floorRefl));   // diagonal cream tiles, terracotta borders, mirror reflections
    const uv = m.geometry.attributes.uv, pos = m.geometry.attributes.position; for (let i = 0; i < uv.count; i++) { const [fu, fv] = floorUV(pos.getX(i), pos.getZ(i)); uv.setXY(i, fu, fv); }
    if (ctx.floorRefl) ctx.floorRefl.hide.push(m);
    m.position.y = 0.02; m.receiveShadow = true; parent.add(m);
    const sof = shapeOf(ENVELOPE, 1); sof.holes.push(pathOf(SKY, 1)); LIFTS.forEach((L) => sof.holes.push(pathOf(liftSquare(L), 1)));   // lift shafts run up through the roof
    const ceil = new THREE.Mesh(new THREE.ShapeGeometry(sof).rotateX(Math.PI / 2), paint(0x141416, 0.95)); ceil.position.y = CEIL; parent.add(ceil);
    const roofS = shapeOf(ENVELOPE, -1); roofS.holes.push(pathOf(SKY, -1)); LIFTS.forEach((L) => roofS.holes.push(pathOf(liftSquare(L), -1)));
    const roofGeo = new THREE.ExtrudeGeometry(roofS, { depth: ROOF - CEIL, bevelEnabled: false }).rotateX(-Math.PI / 2);
    { const uv = roofGeo.attributes.uv, pos = roofGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.25, pos.getZ(i) * 0.25); }   // deck tarmac in world metres
    const roof = new THREE.Mesh(roofGeo, ctx.mats.asphalt);
    roof.position.y = CEIL; roof.castShadow = true; roof.receiveShadow = true; roof.userData.keepShadow = true; parent.add(roof);
  }
  // skylight: white frame, glass clerestory and a pitched glass roof on white trusses
  {
    const sg = new THREE.Group(); sg.position.set(sk.c[0], 0, sk.c[1]); sg.rotation.y = sk.yaw; parent.add(sg);
    const white = paint(0xf4f5f6, 0.4), eaves = ROOF + 1.6, ridge = eaves + 1.4;
    const add = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = mat !== clearGlass(); sg.add(m); return m; };
    for (const [x, z, w, d] of [[0, -sk.hl, sk.hw * 2, 0.25], [0, sk.hl, sk.hw * 2, 0.25], [-sk.hw, 0, 0.25, sk.hl * 2], [sk.hw, 0, 0.25, sk.hl * 2]]) {
      add(new THREE.BoxGeometry(w + 0.25, ROOF - CEIL + 0.4, d + 0.25), white, x, (CEIL + ROOF) / 2, z);
      add(new THREE.BoxGeometry(w, eaves - ROOF, d), heroGlass(), x, (eaves + ROOF) / 2, z);
      add(new THREE.BoxGeometry(w + 0.2, 0.16, d + 0.2), white, x, eaves, z);
    }
    const slope = Math.hypot(sk.hw, ridge - eaves), pitch = Math.atan2(ridge - eaves, sk.hw);
    for (const s of [-1, 1]) {
      add(new THREE.PlaneGeometry(slope, sk.hl * 2).rotateX(-Math.PI / 2), heroGlass(), s * sk.hw / 2, (eaves + ridge) / 2, 0, s * -pitch);
      for (let z = -sk.hl; z <= sk.hl + 0.01; z += 2.25) add(new THREE.BoxGeometry(slope, 0.14, 0.1), white, s * sk.hw / 2, (eaves + ridge) / 2 - 0.07, z, s * -pitch);
    }
    for (let z = -sk.hl; z <= sk.hl + 0.01; z += 2.25) add(new THREE.BoxGeometry(sk.hw * 2, 0.12, 0.1), white, 0, eaves, z);
    add(new THREE.BoxGeometry(0.18, 0.18, sk.hl * 2), white, 0, ridge - 0.05, 0);
    for (const [z, ry] of [[-sk.hl + 0.4, 0], [sk.hl - 0.4, Math.PI]]) { const wb = sign('WELCOME TO HAMMERSMITH', { w: 5.6, h: 0.6, bg: '#1e5a8c', size: 0.55 }); wb.position.set(0, CEIL - 0.45, z); wb.rotation.y = ry; sg.add(wb); }
  }

  /* ---------- outside wall, with a portal at each exit ---------- */
  ENVELOPE.forEach((a, i) => {
    const b = ENVELOPE[(i + 1) % ENVELOPE.length], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ry = Math.atan2(-dz, dx);
    if (OPEN[i]) {
      K.seg(a, b, 3.6, ROOF, stone, { collide: false, t: 0.35 });
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      // sign facing out: outward = away from the envelope's middle
      let nx = dz / len, nz = -dx / len; if (inPoly(m[0] + nx * 0.8, m[1] + nz * 0.8, ENVELOPE)) { nx = -nx; nz = -nz; }
      const s = sign(OPEN[i] === 'footbridge' ? '' : 'BROADWAY', { w: Math.min(len - 0.6, 6), h: 0.6, bg: '#1d2a44', size: 0.55 });
      if (OPEN[i] !== 'footbridge') { s.position.set(m[0] + nx * 0.2, 4.5, m[1] + nz * 0.2); s.rotation.y = Math.atan2(nx, nz); parent.add(s); }
      const mat = entranceMat(len - 0.3, 2.4); mat.position.set(m[0] - nx * 1.3, 0.035, m[1] - nz * 1.3); mat.rotation.y = Math.atan2(nx, nz); parent.add(mat);   // ribbed BROADWAY mat, read as you walk in
      return;
    }
    // street-facing shopfronts on this edge: leave the wall open below the ceiling line there
    const gaps = [];
    for (const u of UNITS) for (const f of streetFronts(u)) {
      const s = (p) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len, off = (p) => Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / len;
      if (off(f.a) < 0.4 && off(f.b) < 0.4) gaps.push([Math.min(s(f.a), s(f.b)), Math.max(s(f.a), s(f.b))]);
    }
    if (!gaps.length) { K.seg(a, b, 0, ROOF, stone, { t: 0.35 }); return; }
    gaps.sort((p, q) => p[0] - q[0]);
    const at = (s) => [a[0] + dx * s / len, a[1] + dz * s / len];
    let t = 0;
    for (const [g0, g1] of gaps) { if (g0 > t + 0.05) K.seg(at(t), at(g0), 0, ROOF, stone, { t: 0.35 }); K.seg(at(g0), at(g1), CEIL, ROOF, stone, { collide: false, t: 0.35 }); t = g1; }
    if (t < len - 0.05) K.seg(at(t), b, 0, ROOF, stone, { t: 0.35 });
  });

  /* ---------- units ---------- */
  const staff = createStaff(parent);
  const lit = { food: 0xffe2b8, shop: 0xf4f6fb, kiosk: 0xfff0d8 };
  for (const u of UNITS) {
    if (u.kind === 'walkin') continue;
    const P = u.poly, fronts = u.kind === 'service' || u.kind === 'station' || u.kind === 'lift' ? [] : unitFronts(u);
    const frontSet = new Set(fronts.map((f) => f.a));
    if (u.kind === 'kiosk') { kiosk(u); continue; }
    if (u.name === 'Station building') { officeBlock(u); continue; }
    if ((u.kind === 'shop' || u.kind === 'food') && buildGenericShop(K, u, staff, UNITS.indexOf(u) + 1)) continue;
    const walkIn = u.kind === 'shop' || u.kind === 'food';   // a walk-in unit with no mall frontage: keep it sealed
    if (u.kind === 'lift') continue;                       // the glass lifts are built in broadway.js
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (u.name === 'Hammersmith station' && i === 22) { stationFace(a, b); continue; }   // the gateline opening (edge 504,361 -> 603,297)
      if (!frontSet.has(a) || walkIn) K.seg(a, b, 0, CEIL, u.kind === 'station' ? stone : cream, { collide: walkIn });
    }
    if (!walkIn) for (const f of fronts) shopfront(u, f);
  }

  function shopfront(u, f) {
    const { a, b, len, nx, nz, ry } = f, mid = (t, o = 0) => [a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + nz * o];
    const faceY = Math.atan2(nx, nz);
    K.seg(a, b, 3.0, CEIL, cream, { collide: false });
    if (u.kind === 'vacant' || u.kind === 'unit30') {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.1, 3.0), new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(Math.max(64, Math.round(len * 40)), 120, (c, w, hh) => {
        c.fillStyle = u.kind === 'unit30' ? '#ffe14d' : '#ece9e2'; c.fillRect(0, 0, w, hh); c.fillStyle = '#1b1b1b'; c.textAlign = 'center'; c.font = `800 ${Math.min(34, w / 8)}px ${FONT}`;
        c.fillText(u.kind === 'unit30' ? 'UNIT 30 · TO LET' : 'TO LET', w / 2, hh / 2 + 4); c.font = `500 14px ${FONT}`; c.fillText('Broadway Hammersmith', w / 2, hh / 2 + 28);
      }) }));
      const p = mid(0.5, 0.03); h.position.set(p[0], 1.5, p[1]); h.rotation.y = faceY; parent.add(h);
      K.seg(a, b, 0, 3.0, cream, { collide: false });
      return;
    }
    // lit interior behind glass, mullions, a white band, the fascia
    const back = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.3, 2.8), new THREE.MeshBasicMaterial({ toneMapped: false, map: interiorTex(u) }));
    const p = mid(0.5, -0.6); back.position.set(p[0], 1.45, p[1]); back.rotation.y = faceY; parent.add(back);
    K.seg(mid(0, -0.05), mid(1, -0.05), 0, 3.0, clearGlass(), { collide: false, t: 0.04, shadow: false });
    for (let t = 0; t <= 1.001; t += 1 / Math.max(1, Math.round(len / 2))) { const m = mid(t, -0.02); K.box(0.07, 3.0, 0.1, black, m[0], 1.5, m[1], ry); }
    glazingFrame(K, mid(0, -0.02), mid(1, -0.02), [[mid(0, -0.02), mid(1, -0.02)]]);
    for (const t of [0, 1]) { const m = mid(t, 0.12); pilaster(K, m[0], m[1], ry); }
    const fw = Math.min(len - 0.5, 8);
    if (fw > 1) { const fm = new THREE.Mesh(new THREE.PlaneGeometry(fw, 0.85), fascia(u.name, fw, { bg: u.bg, fg: u.fg, style: u.style }, 0.85)); const q = mid(0.5, 0.125); fm.position.set(q[0], 3.55, q[1]); fm.rotation.y = faceY; parent.add(fm); }
  }

  function interiorTex(u) {
    return canvasTex(256, 128, (c) => {
      const base = new THREE.Color(lit[u.kind] || 0xf4f6fb); c.fillStyle = '#' + base.getHexString(); c.fillRect(0, 0, 256, 128);
      const r = rng(u.name.length * 31 + u.name.charCodeAt(0));
      c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, 100, 256, 28);
      const brand = new THREE.Color(u.bg);
      for (let i = 0; i < 9; i++) {                                         // shelving / counters silhouettes
        const x = 8 + i * 28, h = 30 + r() * 50; c.fillStyle = `rgba(${brand.r * 255 | 0},${brand.g * 255 | 0},${brand.b * 255 | 0},${0.18 + r() * 0.2})`; c.fillRect(x, 100 - h, 22, h);
        for (let k = 0; k < 4; k++) { c.fillStyle = `hsla(${r() * 360},55%,55%,0.55)`; c.fillRect(x + 2, 100 - h + 6 + k * (h / 4), 18, 4); }
      }
      c.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 6; i++) c.fillRect(10 + i * 44, 4, 30, 4);
    });
  }

  /** Island kiosk: a brand-coloured carcass on a recessed toe-kick, slatted timber fronts washed by an LED strip under the
   *  worktop lip, a stone top carrying a glass display case lit from its base, and a canopy with downlights on steel posts. */
  function kiosk(u) {
    const [cx, cz] = u.c, e = u.poly, ang = Math.atan2(-(e[1][1] - e[0][1]), e[1][0] - e[0][0]);
    const w = Math.max(1.6, Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1])), d = Math.max(1.6, Math.hypot(e[2][0] - e[1][0], e[2][1] - e[1][1]));
    const grp = new THREE.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = ang; parent.add(grp);
    const brand = paint(new THREE.Color(u.bg).getHex(), 0.45), timber = slats('#a9764a'), stoneTop = marble(), led = lamp(WARM, 4), steelM = brushedSteel();
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); grp.add(m); return m; };
    add(metreBox(w - 0.14, 0.1, d - 0.14), paint(0x121314, 0.6), 0, 0.05, 0);                                  // recessed toe-kick
    add(metreBox(w, 0.9, d), brand, 0, 0.55, 0);                                                              // carcass
    for (const s of [-1, 1]) {
      add(metreBox(w - 0.24, 0.72, 0.03), timber, 0, 0.53, s * (d / 2 + 0.014));                               // slatted fronts
      add(metreBox(w - 0.2, 0.014, 0.02), led, 0, 0.975, s * (d / 2 + 0.035));                                 // LED strip under the lip
    }
    for (const s of [-1, 1]) add(metreBox(0.03, 0.72, d - 0.24), timber, s * (w / 2 + 0.014), 0.53, 0);
    add(metreBox(w + 0.1, 0.045, d + 0.1), stoneTop, 0, 1.022, 0);                                             // worktop, oversailing 50 mm
    // glass display case on half the top: steel plinth, lit base, a shelf, black cap
    const cw = w * 0.46, cd = Math.min(0.62, d * 0.42), ccx = -w / 2 + cw / 2 + 0.12;
    add(metreBox(cw, 0.03, cd), steelM, ccx, 1.06, 0);
    for (const s of [-1, 1]) add(metreBox(cw - 0.06, 0.012, 0.02), led, ccx, 1.082, s * (cd / 2 - 0.03));
    add(metreBox(cw - 0.02, 0.36, cd - 0.02), clearGlass(), ccx, 1.255, 0);
    add(metreBox(cw - 0.06, 0.008, cd - 0.08), clearGlass(), ccx, 1.26, 0);
    add(metreBox(cw + 0.01, 0.02, cd + 0.01), black, ccx, 1.445, 0);
    // canopy
    add(metreBox(w + 0.25, 0.4, d + 0.25), brand, 0, 2.7, 0);
    add(metreBox(w + 0.05, 0.02, d + 0.05), paint(0xf3f1ec, 0.8), 0, 2.49, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(new THREE.CylinderGeometry(0.03, 0.03, 1.46, 10), steelM, sx * (w / 2 - 0.1), 1.77, sz * (d / 2 - 0.1)); add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12), led, sx * (w / 2 - 0.45), 2.476, sz * (d / 2 - 0.3)); }
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.34), fascia(u.name, w, { bg: u.bg, fg: u.fg }, 0.34)); f.position.set(0, 2.7, s * (d / 2 + 0.13)); f.rotation.y = s > 0 ? 0 : Math.PI; grp.add(f); }
    // stock: a row inside the case and a row on the open counter
    const goods = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.1, 0.1), paint(0xffffff, 0.5), 12), o2 = new THREE.Object3D(), cl = new THREE.Color(), pal = [0xe23d3d, 0xf2c230, 0x2f7fd0, 0xf3b7c8, 0x3fa34d, 0xfbf6ea];
    for (let k = 0; k < 12; k++) {
      if (k < 6) o2.position.set(ccx - cw / 2 + 0.12 + k * (cw - 0.24) / 5, 1.135 + (k % 2) * 0.18, (k % 2 ? -1 : 1) * cd * 0.16);
      else o2.position.set(ccx + cw / 2 + 0.25 + (k - 6) * Math.max(0.16, (w - cw - 0.6) / 5), 1.1, (k % 2 ? -1 : 1) * d * 0.18);
      o2.updateMatrix(); goods.setMatrixAt(k, o2.matrix); goods.setColorAt(k, cl.set(pal[(k + u.name.length) % 6]));
    }
    grp.add(goods);
    const ca = Math.cos(ang), sa = Math.sin(ang), at = (lx, lz) => [cx + lx * ca + lz * sa, cz - lx * sa + lz * ca];
    // something to climb: the worktop, the display case's cap, and the canopy (a slab you can sit under)
    col.rect(cx, cz, w + 0.1, d + 0.1, { rot: ang, h: 1.045 });
    { const [qx, qz] = at(ccx, 0); col.rect(qx, qz, cw + 0.01, cd + 0.01, { rot: ang, h: 1.455 }); }
    const roof = col.rect(cx, cz, w + 0.25, d + 0.25, { rot: ang, h: 2.9, thick: 0.4 }); roof.perch = 'a kiosk roof';
    staff.add({ at, yaw: ang, look: { uniform: new THREE.Color(u.bg).getHSL({}).l < 0.4 ? new THREE.Color(u.bg).getHex() : 0x2b2c2f, skin: [0xf1c8a8, 0xb07850, 0x7a4e30][u.name.length % 3], hair: 0x2a1c12 },
      tasks: [{ to: [0, -(d / 2 + 0.45)], face: 0, act: 'tap', dur: 4 }, { to: [0.3, -(d / 2 + 0.45)], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: true }, { to: [-0.3, -(d / 2 + 0.45)], face: 0, act: 'wipe', dur: 2.5, prop: 'cloth' }] });
  }

  /** The east station building (offices over the station): mostly outside the mall wall, so it gets its own solid block. */
  function officeBlock(u) {
    const H = 24, glassF = curtainWall(1.8, 3.8, '#9cc0dc', '#4d7596', '#c9cfd4', '#e4e8eb');
    const P = u.poly;
    for (let i = 0; i < P.length; i++) K.seg(P[i], P[(i + 1) % P.length], 0, H, glassF, { collide: false, t: 0.3 });
    const s = shapeOf(P, -1), top = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), paint(0x6f747a, 0.8)); top.position.y = H; parent.add(top);
    col.add({ minX: u.box.minX, maxX: u.box.maxX, minZ: u.box.minZ, maxZ: u.box.maxZ, h: H, test: (x, z) => inPoly(x, z, P) });
  }

  /** Station block face with the opening into the ticket hall (gateline is built in broadway.js). */
  function stationFace(a, b) {
    const p0 = [hallX(15, 0.4), hallZ(15, 0.4)], p1 = [hallX(15, 9.6), hallZ(15, 9.6)];
    const t = (p) => ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
    const [q0, q1] = t(p0) < t(p1) ? [p0, p1] : [p1, p0];
    K.seg(a, q0, 0, CEIL, stone, { collide: false }); K.seg(q1, b, 0, CEIL, stone, { collide: false }); K.seg(q0, q1, 3.4, CEIL, stone, { collide: false });
  }

  /* ---------- exposed ceiling, bulkheads, halo rings and the light they cast; then the furniture ---------- */
  buildCeiling(ctx, parent);
  buildClutter(ctx, parent);

  /* ---------- the detailed pieces ---------- */
  buildFootbridge(ctx, parent);
  buildMcDonalds(ctx, parent, unitNamed("McDonald's"), staff);
  buildPret(ctx, parent, unitNamed('Pret A Manger'), staff);
  staff.flush();
  ctx.updaters.push((dt, t) => staff.update(dt, t, ctx.catPos));

  K.flush();

  // under the roof nothing gets direct sun, so interiors needn't render into the shadow map (big saving)
  parent.traverse((o) => { if (o.isMesh && !o.userData.keepShadow) o.castShadow = false; });

  // only the plan is walkable: inside the envelope, everything that is not mall floor is solid
  // the kiosks are carved out of the walk mask's solid: they carry their own worktop, display case and canopy (kiosk())
  const kioskZones = UNITS.filter((u) => u.kind === 'kiosk').map((u) => {
    const e = u.poly, ang = Math.atan2(-(e[1][1] - e[0][1]), e[1][0] - e[0][0]);
    return { cx: u.c[0], cz: u.c[1], c: Math.cos(ang), s: Math.sin(ang), hw: Math.max(1.6, Math.hypot(e[1][0] - e[0][0], e[1][1] - e[0][1])) / 2 + 0.6, hd: Math.max(1.6, Math.hypot(e[2][0] - e[1][0], e[2][1] - e[1][1])) / 2 + 0.6 };
  });
  const inKiosk = (x, z) => kioskZones.some((k) => { const dx = x - k.cx, dz = z - k.cz; return Math.abs(dx * k.c - dz * k.s) <= k.hw && Math.abs(dx * k.s + dz * k.c) <= k.hd; });
  col.add({ minX: ENV_BOX.minX, maxX: ENV_BOX.maxX, minZ: ENV_BOX.minZ, maxZ: ENV_BOX.maxZ, h: CEIL, thick: CEIL, test: (x, z) => isMallSolid(x, z) && !inKiosk(x, z) });
  return { staff };
}
