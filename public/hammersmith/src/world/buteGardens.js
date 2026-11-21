/**
 * Bute Gardens, modelled from the street-level reference photos.
 *
 *   West side (south -> north): red-brick corner block with the newsagent,
 *     then three cream-rendered semi-detached villas behind a picket fence
 *     and an overgrown hedge.
 *   East side: yellow stock-brick corner building, yellow-brick flats with
 *     two-storey bay windows and railed front yards, a buff three-storey
 *     block with a recessed corner balcony, orange-brick flats, Abercorn House.
 *
 * Windows, railings, pickets, kerbs etc. are InstancedMeshes; hedges come
 * from the shared foliage batcher (ctx.foliage).
 */
import * as THREE from 'three';
import { readableBothSides, TAU, FONT, canvasTex, sign, inst, box, brickMat, rng } from '../util.js';
import { ABERCORN, BUTE_X } from '../mapData.js';

const E = Math.PI / 2, W = -Math.PI / 2;          // rotation.y for things facing east / west
const GLASS = [0x1c2836, 0x26384c, 0x1c2836, 0x34485c, 0x5d7a94];
const K = BUTE_X, KERB_W = K - 4.5, KERB_E = K + 4.5, PAVE = 0.12;
const FENCE_X = K - 6.9, YARD_X = K + 6.9;        // west picket line / east railing line
const Z_N = -218, Z_S = -112;                     // extent of the detailed street

export function buildButeGardens(ctx, g) {
  const { col, mats, foliage } = ctx;
  const rnd = rng(96);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const cream = std(0xe8e2d5), stoneCream = std(0xefe8d6), slate = std(0x474c56, { roughness: 0.6 });
  const frames = [], panes = [], sills = [], ao = [], bars = [], pickets = [], pots = [], pipes = [];

  /**
   * Row(s) of windows along one wall. (x, z): first window; (ux, uz): unit
   * step along the wall; (nx, nz): outward normal; ys: window-centre heights.
   * Frames are open grids, so the glass sits recessed behind them.
   */
  function windows({ x, z, ux, uz, nx, nz, n, gap, ys, fw = 1.3, fh = 1.9, skip, out, seed = 0, stone = false }) {
    const ry = Math.atan2(nx, nz);
    ys.forEach((y, f) => {
      for (let i = 0; i < n; i++) {
        if (skip && skip(i, f)) continue;
        const o = out ? out(i) : 0.02, wx = x + ux * gap * i + nx * o, wz = z + uz * gap * i + nz * o;
        const h = Array.isArray(fh) ? fh[f] : fh;
        frames.push({ x: wx + nx * 0.03, y, z: wz + nz * 0.03, ry, sx: fw, sy: h });
        panes.push({ x: wx, y, z: wz, ry, sx: fw - 0.08, sy: h - 0.08, c: GLASS[(i * 3 + f * 5 + seed) % GLASS.length] });
        if (stone) {
          sills.push({ x: wx + nx * 0.08, y: y - h / 2 - 0.07, z: wz + nz * 0.08, ry, sx: fw + 0.3, sy: 0.14, sz: 0.3 });
          sills.push({ x: wx + nx * 0.04, y: y + h / 2 + 0.11, z: wz + nz * 0.04, ry, sx: fw + 0.24, sy: 0.22, sz: 0.2 });
        }
      }
    });
  }
  /** Soft contact shadow on the ground around a rectangular footprint. */
  function skirt(x0, x1, z0, z1, y = 0.02) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = 1.3;
    ao.push({ x: cx, y, z: z1 + d / 2, sx: x1 - x0, sz: d }, { x: cx, y, z: z0 - d / 2, ry: Math.PI, sx: x1 - x0, sz: d },
      { x: x1 + d / 2, y, z: cz, ry: E, sx: z1 - z0, sz: d }, { x: x0 - d / 2, y, z: cz, ry: W, sx: z1 - z0, sz: d });
  }
  const hedge = (x, z, w, d, h, wild) => { foliage.hedge(x, z, w, d, h, wild); const r = col.rect(x, z, w, d, { h, pad: 0.05 }); if (h >= 2.2) r.perch = 'the top of a hedge'; };
  const wall = (x, z, w, d, h, mat) => { box(g, w, h, d, mat, x, h / 2, z); col.rect(x, z, w, d, { h, pad: 0.08 }); };
  /** Iron railing running north-south at x between z0 and z1 (z0 < z1). */
  function railing(x, z0, z1, alongX = false) {
    const len = z1 - z0, mid = (z0 + z1) / 2;
    for (let s = z0 + 0.07; s < z1; s += 0.13) bars.push(alongX ? { x: s, y: 0.65, z: x } : { x, y: 0.65, z: s });
    for (const y of [0.2, 1.12]) box(g, alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, mats.iron, alongX ? mid : x, y, alongX ? x : mid);
    if (alongX) col.rect(mid, x, len, 0.1, { h: 1.2, pad: 0.05 }); else col.rect(x, mid, 0.1, len, { h: 1.2, pad: 0.05 });
  }

  abercornHouse();
  cornerNewsagent();
  yellowCorner();
  bayFlats();
  buffBlock();
  orangeFlats();
  villas();
  streetSurface();
  dressing();

  /* ---------- shared instanced detail ---------- */
  // open 2x2 casement grid: outer frame + glazing bars, glass shows through the four openings
  const grid = new THREE.Shape(); grid.moveTo(-0.5, -0.5); grid.lineTo(0.5, -0.5); grid.lineTo(0.5, 0.5); grid.lineTo(-0.5, 0.5); grid.closePath();
  for (const cx of [-0.235, 0.235]) for (const cy of [-0.235, 0.235]) {
    const o = new THREE.Path(); o.moveTo(cx - 0.195, cy - 0.195); o.lineTo(cx - 0.195, cy + 0.195); o.lineTo(cx + 0.195, cy + 0.195); o.lineTo(cx + 0.195, cy - 0.195); o.closePath();
    grid.holes.push(o);
  }
  inst(g, new THREE.ExtrudeGeometry(grid, { depth: 0.14, bevelEnabled: false }).translate(0, 0, -0.07), std(0xf6f6f2, { roughness: 0.5 }), frames);
  inst(g, new THREE.BoxGeometry(1, 1, 0.04), mats.pane, panes, { shadow: false });
  inst(g, new THREE.BoxGeometry(1, 1, 1), stoneCream, sills);
  inst(g, new THREE.BoxGeometry(0.03, 1.0, 0.03), mats.iron, bars, { shadow: false });
  inst(g, new THREE.BoxGeometry(0.03, 1, 0.1), mats.white, pickets);
  inst(g, new THREE.CylinderGeometry(0.13, 0.16, 0.45, 8), std(0xb4623f), pots);
  inst(g, new THREE.CylinderGeometry(0.04, 0.04, 1, 8), mats.iron, pipes);
  const aoMat = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    map: canvasTex(4, 64, (c) => { const gr = c.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 4, 64); }),
  });
  inst(g, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoMat, ao, { shadow: false }).renderOrder = 1;

  /* ---------- Abercorn House: brown brick, white bands, set-back attic, white porch ---------- */
  function abercornHouse() {
    const A = ABERCORN, face = A.x - A.w / 2, brick = brickMat(0x7b5438), red = std(0xb4573a);
    const wing = (z) => Math.abs(z - A.z) > 12.5;
    // The reception sits in the south end bay, so the block is built round it: everything north of it full height, the
    // storeys above it, and the ground floor to its south and east. The joints hide behind the white band at 4.15 m.
    const L = A.lobby, LH = 3.9, north = A.z - A.d / 2, south = A.z + A.d / 2, dz = A.doorZ, DW = 1.0, DH = 2.5;
    box(g, A.w, A.h, L.z0 - north, brick, A.x, A.h / 2, (north + L.z0) / 2);
    box(g, A.w, A.h - LH, south - L.z0, brick, A.x, (A.h + LH) / 2, (L.z0 + south) / 2);
    box(g, A.w, LH, south - L.z1, brick, A.x, LH / 2, (L.z1 + south) / 2);
    box(g, face + A.w - L.x1, LH, L.z1 - L.z0, brick, (L.x1 + face + A.w) / 2, LH / 2, (L.z0 + L.z1) / 2);
    box(g, 0.7, A.h, 9.5, brick, face - 0.35, A.h / 2, A.z - 17.25);                                   // projecting end bays: north...
    const wz0 = A.z + 17.25 - 4.75, wz1 = A.z + 17.25 + 4.75;                                           // ...and south, with the doorway through it
    box(g, 0.7, A.h - LH, 9.5, brick, face - 0.35, (A.h + LH) / 2, A.z + 17.25);
    box(g, 0.7, LH, dz - DW - wz0, brick, face - 0.35, LH / 2, (wz0 + dz - DW) / 2);
    box(g, 0.7, LH, wz1 - dz - DW, brick, face - 0.35, LH / 2, (dz + DW + wz1) / 2);
    box(g, 0.7, LH - DH, DW * 2, brick, face - 0.35, (LH + DH) / 2, dz);
    for (const [y, h] of [[4.15, 0.55], [14.3, 0.6], [A.h, 0.35]]) {                                // white stone bands + coping
      box(g, A.w + 0.4, h, A.d + 0.4, mats.white, A.x, y, A.z);
      for (const s of [-1, 1]) box(g, 0.9, h, 9.9, mats.white, face - 0.45, y, A.z + s * 17.25);
    }
    box(g, A.w - 3, 3, A.d - 4, brick, A.x + 0.4, A.h + 1.5, A.z);                                  // set-back attic
    box(g, A.w - 2.4, 0.3, A.d - 3.4, slate, A.x + 0.4, A.h + 3.1, A.z);
    for (const s of [-1, 1]) box(g, 1.8, 6.5, 1.8, brick, face + 0.7, A.h + 0.4, A.z + s * 12.4);   // brick stacks
    const bx0 = face - 1.0, bx1 = face + A.w + 0.3, solid = (xa, xb, za, zb, o = {}) => col.rect((xa + xb) / 2, (za + zb) / 2, xb - xa, zb - za, { h: A.h, ...o });
    solid(bx0, bx1, north - 0.3, L.z0);                                    // north of the reception
    solid(bx0, bx1, L.z1, south + 0.3);                                    // south of it
    solid(L.x1, bx1, L.z0, L.z1);                                          // behind it
    solid(bx0, face, L.z0, dz - DW); solid(bx0, face, dz + DW, L.z1);      // the front wall either side of the doorway
    solid(bx0, L.x1, L.z0, L.z1, { thick: A.h - 3.5 });                    // the storeys above
    reception(L, dz, face);
    skirt(face - 0.7, A.x + A.w / 2, A.z - A.d / 2, A.z + A.d / 2);

    const n = 12, gap = 3.5, start = A.z - gap * (n - 1) / 2;
    const out = (i) => (wing(start + i * gap) ? 0.72 : 0.02), door = (i) => i === 10;                         // entrance bay: second from the south end
    windows({ x: face, z: start, ux: 0, uz: 1, nx: -1, nz: 0, n, gap, ys: [2.25, 6.3, 9.3, 12.3, 15.9], fh: [2.7, 1.9, 1.9, 1.9, 1.5], fw: 1.5, out, skip: (i, f) => f === 0 && door(i) });
    windows({ x: face + 1.9, z: start + gap, ux: 0, uz: 1, nx: -1, nz: 0, n: n - 2, gap, ys: [A.h + 1.6], fh: 1.3, fw: 1.3, seed: 2 });
    windows({ x: A.x + A.w / 2, z: start, ux: 0, uz: 1, nx: 1, nz: 0, n, gap, ys: [2.4, 6.3, 9.3, 12.3, 15.9], fh: 1.7, seed: 1 });
    for (const s of [-1, 1]) windows({ x: A.x - 4, z: A.z + s * A.d / 2, ux: 1, uz: 0, nx: 0, nz: s, n: 3, gap: 4, ys: [6.3, 9.3, 12.3, 15.9], fh: 1.7, seed: 3 });
    const guard = [], arches = [];                              // ground floor: white bars + red-brick flat arches
    for (let i = 0; i < n; i++) {
      if (door(i)) continue;
      const z = start + i * gap, x = face - out(i);
      arches.push({ x: x - 0.02, y: 3.72, z });
      for (const dz of [-0.36, 0, 0.36]) guard.push({ x: x - 0.14, y: 2.25, z: z + dz });
    }
    inst(g, new THREE.BoxGeometry(0.04, 2.4, 0.05), mats.white, guard, { shadow: false });
    inst(g, new THREE.BoxGeometry(0.1, 0.4, 1.9), red, arches, { shadow: false });
    for (const z of [A.z - 12.4 - 1.3, A.z + 12.4 + 1.3]) pipes.push({ x: face - 0.08, y: A.h / 2, z, sy: A.h });

    // white porch in the south end bay: flat canopy on piers, double doors, plaque beside them
    const pf = face - 0.72;
    box(g, 1.75, 0.26, 3.7, mats.white, pf - 0.85, 3.15, dz);
    for (const s of [-1, 1]) box(g, 0.4, 3, 0.4, mats.white, pf - 1.5, 1.5, dz + s * 1.55);
    for (const s of [-1, 1]) box(g, 0.3, 3, 0.65, mats.white, pf - 0.1, 1.5, dz + s * 1.325);        // door surround: jambs with sidelights, and a header
    box(g, 0.3, 0.5, 2.0, mats.white, pf - 0.1, 2.75, dz);
    for (const s of [-1, 1]) box(g, 0.05, 2.3, 0.85, std(0xf4f4f0, { roughness: 0.4 }), face + 0.115, 1.33, dz + s * 1.44);   // both leaves folded right back against the wall inside, clear of the camera
    for (const o of [-1.2, 1.2]) panes.push({ x: pf - 0.32, y: 1.75, z: dz + o, ry: W, sx: 0.5, sy: 1.5, c: GLASS[0] });
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(300, 160, (c) => {
      c.fillStyle = '#3b2f24'; c.fillRect(0, 0, 300, 160); for (let i = 0; i < 900; i++) { c.fillStyle = i % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(150,120,90,0.25)'; c.fillRect((i * 53) % 300, (i * 29) % 160, 2, 3); }
      c.strokeStyle = '#c9b48a'; c.lineWidth = 4; c.strokeRect(10, 10, 280, 140); c.fillStyle = '#c9b48a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 30px ${FONT}`; c.fillText('ABERCORN HOUSE', 150, 82);
    }) }));
    mat.position.set(pf - 0.95, 0.19, dz); mat.rotation.y = W; mat.receiveShadow = true; g.add(mat);       // read by someone walking in
    box(g, 1.9, 0.18, 3.2, mats.concrete, pf - 0.95, 0.09, dz); col.rect(pf - 0.95, dz, 1.9, 3.2, { h: 0.18 });
    const plaque = sign('ABERCORN HOUSE', { w: 1.3, h: 0.7, bg: '#5a3b22', fg: '#ead9ae', size: 0.3 });
    plaque.position.set(face - 0.03, 2.0, dz - 3.1); plaque.rotation.y = W; g.add(plaque);
    const no = sign('28 – 30', { w: 1.1, h: 0.3, bg: '#f4f4f0', fg: '#222' });
    no.position.set(pf - 1.74, 3.15, dz); no.rotation.y = W; g.add(no);
    foliage.tree(KERB_E + 1.5, dz + 2.4, 1.3);                                     // the big plane tree by the door

    // boundary: hedge and low wall north of the gate; taller wall with a timber moon gate to the south
    const line = face - 2.6, gate = 1.15, wallBrick = brickMat(0x6b4a36);
    wall(line, (north + dz - gate) / 2, 0.35, dz - gate - north, 0.9, wallBrick);
    hedge(line + 1, (north + dz - 3) / 2, 1.3, dz - 3 - north - 1, 1.4, 0.3);
    wall(line, (dz + gate + south + 0.6) / 2, 0.35, south + 0.6 - dz - gate, 1.5, wallBrick);
    for (const s of [-1, 1]) { box(g, 0.6, 1.6, 0.6, mats.white, line, 0.8, dz + s * gate); col.rect(line, dz + s * gate, 0.6, 0.6, { h: 1.6 }); }
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24, 0, Math.PI), new THREE.MeshStandardMaterial({
      roughness: 0.9, side: THREE.DoubleSide,
      map: canvasTex(128, 64, (c) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#7a4f30' : '#8a5c38'; c.fillRect(i * 8, 0, 7, 64); c.fillStyle = '#3a2516'; c.fillRect(i * 8 + 7, 0, 1, 64); } }),
    }));
    moon.position.set(line - 0.19, 0.12, dz + gate + 3.0); moon.rotation.y = W; g.add(moon);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 6, 24, Math.PI), wallBrick); ring.position.copy(moon.position); ring.rotation.y = W; g.add(ring);
    // grey utility cabinets at the end of the wall
    for (const o of [0, 0.86]) box(g, 0.7, 1.25, 0.82, std(0x9aa0a6, { roughness: 0.5, metalness: 0.3 }), line + 0.55, 0.63 + PAVE, south + 1.1 + o);
    col.rect(line + 0.55, south + 1.5, 0.7, 1.7, { h: 1.4 });

    fireEscape(face - 1.3, south + 0.12);          // stands proud of the gable so it reads from the street
  }

  /** The hostel reception behind the front doors: where the cat lives, and where the game starts. */
  function reception(L, dz, face) {
    const fy = 0.18, top = 3.5, cx = (L.x0 + L.x1) / 2, w = L.x1 - L.x0, d = L.z1 - L.z0;
    // The room is outside the mall's lighting mask, so the sky would fill it like a courtyard. Each surface instead takes
    // less from the sky and carries its own share of warm lamp light.
    const lampLight = new THREE.Color(0xffe2bd);
    const glow = (m, k = 0.3) => { m.userData.dry = true; m.emissive = m.map ? lampLight.clone() : m.color.clone().multiply(lampLight); m.emissiveMap = m.map || null; m.emissiveIntensity = k; m.envMapIntensity = 0.4; return m; };
    const wallM = glow(std(0xe6dcc8)), dado = glow(std(0x5f7f72, { roughness: 0.7 })), timber = glow(std(0x7a5234, { roughness: 0.55 })), dark = glow(std(0x2b2622, { roughness: 0.5 })), fabric = glow(std(0x2f6f78, { roughness: 0.95 }));
    const panel = (pw, ph, cw, ch, draw, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), glow(new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(cw, ch, draw) }))); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
    // black-and-cream chequered tiles, 30 cm
    const tiles = glow(new THREE.MeshStandardMaterial({ roughness: 0.45, map: canvasTex(64, 64, (c) => { c.fillStyle = '#e9e2d0'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2f3437'; c.fillRect(0, 0, 32, 32); c.fillRect(32, 32, 32, 32); }) }));
    tiles.map.wrapS = tiles.map.wrapT = THREE.RepeatWrapping; tiles.map.repeat.set(1 / 0.6, 1 / 0.6);
    box(g, w, 0.04, d, tiles, cx, fy - 0.02, dz).castShadow = false; col.rect(cx, dz, w, d, { h: fy });
    box(g, w, 0.1, d, glow(std(0xf2efe8)), cx, top + 0.05, dz);
    // walls: cream above a green dado
    const walls = [[cx, L.z0 + 0.04, w, 0.08], [cx, L.z1 - 0.04, w, 0.08], [L.x1 - 0.04, dz, 0.08, d], [face + 0.04, (L.z0 + dz - 1) / 2, 0.08, dz - 1 - L.z0], [face + 0.04, (dz + 1 + L.z1) / 2, 0.08, L.z1 - dz - 1]];
    for (const [x, z, sx, sz] of walls) { box(g, sx, top - fy, sz, wallM, x, (top + fy) / 2, z); box(g, sx + 0.03, 0.95, sz + 0.03, dado, x, fy + 0.475, z); }
    box(g, 0.08, top - 2.5, 2, wallM, face + 0.04, (top + 2.5) / 2, dz);
    inst(g, new THREE.CircleGeometry(0.22, 20).rotateX(Math.PI / 2), mats.warm, [L.x0 + 2.2, L.x0 + 5.6].map((x) => ({ x, y: top - 0.01, z: dz })), { shadow: false });

    // reception desk on the north side, with the key rack and a sign on the wall behind it
    const dx = L.x1 - 3.1, dzz = L.z0 + 1.05;
    box(g, 2.6, 1.0, 0.7, timber, dx, fy + 0.5, dzz); box(g, 2.7, 0.06, 0.82, dark, dx, fy + 1.03, dzz); col.rect(dx, dzz, 2.6, 0.7, { h: fy + 1.06, pad: 0.05 });
    box(g, 0.5, 0.34, 0.04, dark, dx + 0.6, fy + 1.3, dzz - 0.1).rotation.y = 0.3;                      // monitor
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, TAU, 0, Math.PI / 2), std(0xc9a24a, { roughness: 0.25, metalness: 0.9 })); bell.position.set(dx - 0.8, fy + 1.06, dzz + 0.15); g.add(bell);
    panel(2.2, 1.0, 440, 200, (c) => {
      c.fillStyle = '#6a4528'; c.fillRect(0, 0, 440, 200);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) {
        const x = 12 + k * 53, y = 10 + r * 62; c.fillStyle = '#2a1a10'; c.fillRect(x, y, 46, 52);
        c.fillStyle = '#e8dcc0'; c.font = `600 13px ${FONT}`; c.textAlign = 'center'; c.fillText(String(r * 8 + k + 1), x + 23, y + 14);
        if ((r * 5 + k * 3) % 4) { c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(x + 23, y + 28, 6, 0, TAU); c.fill(); c.fillRect(x + 21, y + 32, 4, 15); c.fillRect(x + 25, y + 40, 5, 3); }
      }
    }, dx, fy + 1.95, L.z0 + 0.1, 0);
    const rs = sign('Reception', { w: 1.7, h: 0.32, bg: '#5a3b22', fg: '#ead9ae', size: 0.62 }); rs.position.set(dx, fy + 2.75, L.z0 + 0.1); g.add(rs);

    // a sofa on the south side under the noticeboard, a rug, and the way up to the rooms
    const sx = L.x0 + 3.6, sz = L.z1 - 0.52;
    box(g, 2.0, 0.42, 0.8, fabric, sx, fy + 0.21, sz); box(g, 2.0, 0.5, 0.18, fabric, sx, fy + 0.67, sz + 0.33); for (const s of [-1, 1]) box(g, 0.18, 0.6, 0.8, fabric, sx + s * 1.09, fy + 0.3, sz);
    col.rect(sx, sz, 2.36, 0.8, { h: fy + 0.42 });
    panel(1.7, 1.0, 340, 200, (c) => {
      c.fillStyle = '#b08a5a'; c.fillRect(0, 0, 340, 200); c.strokeStyle = '#5a3b22'; c.lineWidth = 10; c.strokeRect(0, 0, 340, 200);
      const notes = [['#fff8dc', 22, 22, 'Breakfast', '7 – 10'], ['#dff0ff', 128, 18, 'Wi-Fi', 'abercorn-guest'], ['#ffe1e1', 236, 26, 'Quiet', 'after 11 pm'], ['#e6ffe0', 30, 112, 'Tube', '3 min walk'], ['#fff', 132, 106, 'Luggage', 'ask at desk'], ['#fff3b0', 236, 114, 'Please do not', 'feed the cat']];
      for (const [bg, x, y, a, b] of notes) { c.fillStyle = bg; c.fillRect(x, y, 84, 66); c.fillStyle = '#c0392b'; c.beginPath(); c.arc(x + 42, y + 7, 4, 0, TAU); c.fill(); c.fillStyle = '#2a2a2a'; c.textAlign = 'center'; c.font = `700 14px ${FONT}`; c.fillText(a, x + 42, y + 32); c.font = `500 12px ${FONT}`; c.fillText(b, x + 42, y + 50); }
    }, sx, fy + 1.75, L.z1 - 0.1, Math.PI);
    const rug = glow(new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(130, 90, (c) => { c.fillStyle = '#7a2e2a'; c.fillRect(0, 0, 130, 90); c.strokeStyle = '#d9b77a'; c.lineWidth = 3; c.strokeRect(6, 6, 118, 78); c.strokeRect(14, 14, 102, 62); c.fillStyle = '#1f3d4a'; c.fillRect(24, 24, 82, 42); c.fillStyle = '#d9b77a'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(33 + i * 16, 45, 5, 0, TAU); c.fill(); } }) }));
    const rugM = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8).rotateX(-Math.PI / 2), rug); rugM.position.set(L.x0 + 4.2, fy + 0.012, dz); rugM.receiveShadow = true; g.add(rugM);
    box(g, 0.06, 2.1, 0.9, timber, L.x1 - 0.1, fy + 1.05, dz - 1.4);                                    // door to the stairs
    const rooms = sign('Rooms 1 – 40', { w: 1.0, h: 0.24, bg: '#f4f4f0', fg: '#222', size: 0.6 }); rooms.position.set(L.x1 - 0.1, fy + 2.4, dz - 1.4); rooms.rotation.y = W; g.add(rooms);

    // the cat's corner: a bed and two bowls
    const bx = L.x1 - 0.8, bz = L.z1 - 0.8;
    if (ctx.napSpots) ctx.napSpots.push({ name: 'your bed', home: true, x: bx, y: fy + 0.1, z: bz, r: 1.1, heading: -Math.PI / 2 }, { name: 'the sofa', x: sx, y: fy + 0.42, z: sz - 0.08, r: 1.4, heading: -Math.PI / 2 });
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.14, 20), std(0xa5372f, { roughness: 1 })); bed.position.set(bx, fy + 0.07, bz); bed.castShadow = true; g.add(bed);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 20), std(0xefe3cc, { roughness: 1 })); cushion.position.set(bx, fy + 0.13, bz); g.add(cushion);
    inst(g, new THREE.CylinderGeometry(0.09, 0.07, 0.05, 14), std(0xb9bfc6, { roughness: 0.3, metalness: 0.8 }), [0, 0.24].map((o) => ({ x: bx - 0.75 - o, y: fy + 0.025, z: L.z1 - 0.3 })));
  }

  /** External steel fire escape on the south gable: four landings, scissor flights, slatted treads. */
  function fireEscape(x0, z0) {
    const run = 5.6, wide = 2.2, x1 = x0 + run, levels = [0, 4.2, 7.3, 10.3, 13.4], steel = mats.iron;
    const posts = [], treads = [];
    for (const x of [x0 - 0.5, x1 + 0.5]) for (const z of [z0, z0 + wide]) posts.push({ x, y: 7.3, z });
    inst(g, new THREE.BoxGeometry(0.1, 14.6, 0.1), steel, posts);
    for (let i = 0; i < 4; i++) {
      const up = i % 2 === 0, xa = up ? x0 : x1, xb = up ? x1 : x0, ya = levels[i], yb = levels[i + 1];
      const zl = z0 + (up ? 0.55 : wide - 0.55), len = Math.hypot(run, yb - ya), tilt = Math.atan2(yb - ya, xb - xa);
      for (const o of [-0.45, 0.45]) {                                            // stringers + handrails
        const s = box(g, len, 0.16, 0.04, steel, (xa + xb) / 2, (ya + yb) / 2, zl + o); s.rotation.z = tilt;
        const h = box(g, len, 0.04, 0.04, steel, (xa + xb) / 2, (ya + yb) / 2 + 1.0, zl + o); h.rotation.z = tilt;
      }
      for (let k = 1; k < 14; k++) treads.push({ x: xa + (xb - xa) * k / 14, y: ya + (yb - ya) * k / 14, z: zl });
      // landing at the top of the flight, spanning both lanes, with a guard rail on the street side
      box(g, 1.0, 0.06, wide, steel, xb + (up ? 0.5 : -0.5), yb, z0 + wide / 2);
      box(g, 1.0, 0.04, 0.04, steel, xb + (up ? 0.5 : -0.5), yb + 1.0, z0 + wide);
      box(g, 0.04, 0.04, wide, steel, xb + (up ? 1.0 : -1.0), yb + 1.0, z0 + wide / 2);
    }
    inst(g, new THREE.BoxGeometry(0.28, 0.03, 0.86), steel, treads);
    col.rect((x0 + x1) / 2, z0 + wide / 2, run + 1.2, wide, { h: 14 });
  }

  /* ---------- red-brick corner block with the wrap-around newsagent ---------- */
  function cornerNewsagent() {
    const cx = 81, cz = -117, S = 14, h = 15, south = cz + S / 2, east = cx + S / 2, brick = brickMat(0xa5432f);
    box(g, S, h, S, brick, cx, h / 2, cz);
    box(g, S + 0.3, 3.3, S + 0.3, std(0x15161b, { roughness: 0.35 }), cx, 1.65, cz);            // dark shopfront
    box(g, S + 0.5, 0.4, S + 0.5, mats.stone, cx, h, cz); box(g, S + 0.3, 0.3, S + 0.3, mats.stone, cx, 4.6, cz);
    box(g, 1.2, 2.2, 1.2, brick, cx - 4, h + 1.1, cz - 4);
    for (const dx of [-0.3, 0.3]) pots.push({ x: cx - 4 + dx, y: h + 2.4, z: cz - 4 });
    col.rect(cx, cz, S, S, { h, pad: 0.35 });
    skirt(cx - S / 2 - 13.8, east, cz - S / 2, south);

    const fasciaTex = canvasTex(1024, 96, (c, w, hh) => {
      c.fillStyle = '#1a2a8f'; c.fillRect(0, 0, w, hh);
      const hues = [320, 30, 190, 280, 110, 50, 0, 210];               // paint-burst ends, like the real fascia
      for (let i = 0; i < 90; i++) {
        const x = i % 2 ? rnd() * 200 : w - rnd() * 200;
        c.fillStyle = `hsla(${hues[i % 8]}, 95%, 58%, 0.75)`;
        c.beginPath(); c.ellipse(x, rnd() * hh, 20 + rnd() * 50, 6 + rnd() * 14, rnd() * TAU, 0, TAU); c.fill();
      }
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 60px ${FONT}`;
      c.fillText('B&K NEWSAGENT LTD', w / 2, hh / 2 + 3);
    });
    const fasciaMat = new THREE.MeshBasicMaterial({ map: fasciaTex, toneMapped: false });
    const poster = std(0x1c4fd6, { roughness: 0.15, metalness: 0.2 }), shopGlass = std(0x2a3442, { roughness: 0.05, metalness: 0.8 });
    const awning = std(0x1b1b1f, { roughness: 0.7 });
    const dental = sign('DENTAL PRACTICE', { w: 1.0, h: 0.8, bg: '#4a2a8a', size: 0.26 });
    for (const [ry, fx, fz, ax, az] of [[0, cx, south + 0.2, 1, 0], [E, east + 0.2, cz, 0, -1]]) {     // Hammersmith Rd face, Bute Gardens face
      const f = new THREE.Mesh(new THREE.PlaneGeometry(S - 0.4, 1.05), fasciaMat);
      f.position.set(fx, 3.85, fz); f.rotation.y = ry; g.add(f);
      const nx = ry ? 1 : 0, nz = ry ? 0 : 1;
      for (const [o, w] of [[-4.2, 3.6], [0.2, 1.6], [4.2, 3.6]]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.3), o === 0.2 ? shopGlass : poster);
        p.position.set(fx + ax * o + nx * 0.01, 1.5, fz + az * o + nz * 0.01); p.rotation.y = ry; g.add(p);
      }
      for (const o of [-3.6, 3.6]) {
        const a = box(g, ry ? 1.3 : 6.4, 0.1, ry ? 6.4 : 1.3, awning, fx + ax * o + nx * 0.6, 3.05, fz + az * o + nz * 0.6);
        a.rotation.set(ry ? 0 : 0.35, 0, ry ? -0.35 : 0);
      }
      const mt = sign('Money transfer', { w: 3.4, h: 0.4, bg: '#1b1b1f', size: 0.55 });
      mt.position.set(fx + ax * 3.6 + nx * 1.3, 2.75, fz + az * 3.6 + nz * 1.3); mt.rotation.y = ry; g.add(mt);
      const first = { x: fx + ax * -4 - nx * 0.2, z: fz + az * -4 - nz * 0.2 };
      windows({ ...first, ux: ax, uz: az, nx, nz, n: 3, gap: 4, ys: [6.6, 9.9, 12.9], fh: [2.4, 2.1, 1.7], fw: 1.6, seed: ry ? 1 : 0, stone: true });
      for (let i = 0; i < 3; i++) {
        const d = dental.clone(); d.position.set(first.x + ax * 4 * i + nx * 0.16, 6.2, first.z + az * 4 * i + nz * 0.16); d.rotation.y = ry; g.add(d);
      }
    }
    // white stucco neighbour along Hammersmith Rd
    box(g, 13.6, 12, S, mats.white, cx - 14, 6, cz); col.rect(cx - 14, cz, 13.6, S, { h: 12, pad: 0.3 });
    windows({ x: cx - 18, z: south, ux: 1, uz: 0, nx: 0, nz: 1, n: 3, gap: 4, ys: [2.2, 5.6, 9], fh: [2.4, 2, 1.7], seed: 2, skip: (i, f) => f === 0 && i === 1, stone: true });
    box(g, 1.3, 2.6, 0.12, std(0x5b6e8c), cx - 14, 1.3, south + 0.05);
  }

  /* ---------- yellow stock-brick corner building with red arches ---------- */
  function yellowCorner() {
    const x0 = K + 7, w = 14, z0 = -128, z1 = -110, h = 11, cx = x0 + w / 2, cz = (z0 + z1) / 2, red = std(0xb24a35);
    box(g, w, h, z1 - z0, brickMat(0xb39558), cx, h / 2, cz);
    for (const [y, t] of [[4.5, 0.4], [7.9, 0.25], [h, 0.45]]) box(g, w + 0.35, t, z1 - z0 + 0.35, mats.stone, cx, y, cz);
    box(g, w + 0.2, 0.5, z1 - z0 + 0.2, mats.white, cx, 0.25, cz);
    col.rect(cx, cz, w, z1 - z0, { h, pad: 0.3 });
    skirt(x0, x0 + w, z0, z1);
    const n = 4, gap = 4.4, start = z0 + 2.4, gateBay = (i, f) => f === 0 && i === n - 1;
    windows({ x: x0, z: start, ux: 0, uz: 1, nx: -1, nz: 0, n, gap, ys: [2.5, 6.3, 9.4], fh: [2.3, 1.7, 1.4], fw: 1.4, skip: gateBay, seed: 1 });
    windows({ x: x0 + 3, z: z1, ux: 1, uz: 0, nx: 0, nz: 1, n: 3, gap: 4, ys: [2.5, 6.3, 9.4], fh: [2.3, 1.7, 1.4], fw: 1.4, seed: 2 });
    const lintels = [], arcs = [];
    for (let i = 0; i < n; i++) {
      const z = start + i * gap;
      for (const y of [7.33, 10.27]) lintels.push({ x: x0 - 0.04, y, z });
      if (!gateBay(i, 0)) arcs.push({ x: x0 - 0.05, y: 3.6, z, ry: E });
    }
    for (let i = 0; i < 3; i++) arcs.push({ x: x0 + 3 + i * 4, y: 3.6, z: z1 + 0.05 });
    // The same building runs on east along Hammersmith Road (Street View, Jul 2025): a long yellow-brick range with red
    // arched heads, white stone bands, quoins and cornice, a gabled bay in the middle and chimney stacks.
    {
      const e0 = x0 + w, e1 = 146, ez0 = -124, ecx = (e0 + e1) / 2, ecz = (ez0 + z1) / 2, yb = brickMat(0xb39558);
      box(g, e1 - e0, h, z1 - ez0, yb, ecx, h / 2, ecz);
      for (const [y, t] of [[4.5, 0.4], [7.9, 0.25], [h, 0.45]]) box(g, e1 - e0 + 0.35, t, z1 - ez0 + 0.35, mats.stone, ecx, y, ecz);
      box(g, e1 - e0 + 0.2, 0.5, z1 - ez0 + 0.2, mats.white, ecx, 0.25, ecz);
      col.rect(ecx, ecz, e1 - e0, z1 - ez0, { h, pad: 0.3 });
      skirt(e0, e1, ez0, z1);
      windows({ x: e0 + 2.5, z: z1, ux: 1, uz: 0, nx: 0, nz: 1, n: 7, gap: 4, ys: [2.5, 6.3, 9.4], fh: [2.3, 1.7, 1.4], fw: 1.4, seed: 4, skip: (i) => i === 3 });
      for (let i = 0; i < 7; i++) if (i !== 3) for (const y of [3.6, 7.2]) arcs.push({ x: e0 + 2.5 + i * 4, y, z: z1 + 0.05 });
      const gx = e0 + 2.5 + 12;                                                   // the gabled bay stands a little proud
      box(g, 5.2, h + 0.6, 0.5, yb, gx, (h + 0.6) / 2, z1 + 0.25);
      windows({ x: gx, z: z1 + 0.5, ux: 1, uz: 0, nx: 0, nz: 1, n: 1, gap: 4, ys: [2.5, 6.3, 9.4], fh: [2.3, 1.9, 1.4], fw: 2.0, seed: 5, stone: true });
      const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-3.0, 0), new THREE.Vector2(3.0, 0), new THREE.Vector2(0, 2.6)]), { depth: 0.5, bevelEnabled: false }), yb);
      gable.position.set(gx, h + 0.6, z1); gable.castShadow = true; g.add(gable);
      const quoins = [];                                                          // alternating long and short stones up both street corners
      for (let y = 0.9; y < h - 0.4; y += 0.7) { const long = Math.round(y / 0.7) % 2 === 0, wq = long ? 0.6 : 0.4; quoins.push({ x: x0 + wq / 2, y, z: z1 + 0.03, sx: wq }, { x: e1 - wq / 2, y, z: z1 + 0.03, sx: wq }); }
      inst(g, new THREE.BoxGeometry(1, 0.34, 0.1), mats.white, quoins, { shadow: false });
      box(g, e1 - x0 + 0.7, 0.45, 0.5, mats.white, (x0 + e1) / 2, h + 0.15, z1 + 0.2);                   // cornice
      for (const cxk of [e0 + 4, gx + 6, e1 - 4]) box(g, 1.6, 2.6, 0.9, brickMat(0x9a5a44), cxk, h + 1.3, ecz);
    }
    inst(g, new THREE.BoxGeometry(0.12, 0.36, 1.7), red, lintels, { shadow: false });
    inst(g, new THREE.TorusGeometry(0.78, 0.15, 6, 14, Math.PI), red, arcs, { shadow: false });
    box(g, 0.14, 2.9, 3.6, std(0x17181c, { roughness: 0.4, metalness: 0.4 }), x0 - 0.05, 1.45, start + (n - 1) * gap);   // black yard gate
    pipes.push({ x: x0 - 0.07, y: h / 2, z: z0 + 0.3, sy: h });
    const plate = sign('BUTE GARDENS  W6', { w: 2.2, h: 0.42, bg: '#f7f5ee', fg: '#111', size: 0.5 });
    plate.position.set(x0 - 0.06, 3.5, z1 - 3.4); plate.rotation.y = W; g.add(plate);
  }

  /* ---------- yellow stock-brick flats with two-storey bay windows and railed yards ---------- */
  function bayFlats() {
    const face = K + 9.2, z0 = -144, z1 = -130, h = 9.3, d = 11, door = -137;
    box(g, d, h, z1 - z0, brickMat(0xc8a97e), face + d / 2, h / 2, (z0 + z1) / 2);
    box(g, d + 1.1, 0.22, z1 - z0 + 1.1, slate, face + d / 2, h + 0.11, (z0 + z1) / 2);                         // eaves
    const hip = new THREE.Mesh(new THREE.ConeGeometry(9.2, 1.9, 4).rotateY(Math.PI / 4), slate); hip.scale.set(0.9, 1, 1.1);
    hip.position.set(face + d / 2, h + 1.15, (z0 + z1) / 2); hip.castShadow = true; g.add(hip);
    col.rect(face + d / 2, (z0 + z1) / 2, d, z1 - z0, { h, pad: 0.3 });
    skirt(face, face + d, z0, z1, PAVE - 0.01);

    // trapezoidal bay: 3 m wide at the wall, 1.6 m at the front, 0.9 m deep; local -Z is "out"
    const trap = new THREE.Shape(); trap.moveTo(-1.5, 0); trap.lineTo(1.5, 0); trap.lineTo(0.8, 0.9); trap.lineTo(-0.8, 0.9); trap.closePath();
    const bayGeo = new THREE.ExtrudeGeometry(trap, { depth: 1, bevelEnabled: false }).rotateX(-Math.PI / 2);
    const bodies = [], bands = [];
    for (const bz of [-140.5, -133.5]) {
      bodies.push({ x: face, y: 0, z: bz, ry: E, sy: 5.9 });
      for (const y of [0, 2.75, 5.75]) bands.push({ x: face, y, z: bz, ry: E, sx: 1.07, sy: 0.2, sz: 1.09 });
      bands.push({ x: face, y: 5.95, z: bz, ry: E, sx: 1.12, sy: 0.1, sz: 1.14, c: 0x474c56 });
      for (const y of [1.65, 4.45]) {
        windows({ x: face - 0.9, z: bz, ux: 0, uz: 1, nx: -1, nz: 0, n: 1, gap: 0, ys: [y], fw: 1.4, fh: 1.55, seed: y | 0 });
        for (const s of [-1, 1]) windows({ x: face - 0.45, z: bz + s * 1.15, ux: 0, uz: 1, nx: -0.61, nz: s * 0.79, n: 1, gap: 0, ys: [y], fw: 0.95, fh: 1.55, seed: 2 });
      }
      windows({ x: face, z: bz, ux: 0, uz: 1, nx: -1, nz: 0, n: 1, gap: 0, ys: [7.75], fw: 1.7, fh: 1.3, stone: true, seed: 1 });
    }
    inst(g, bayGeo, cream, bodies);
    inst(g, bayGeo, mats.blockWhite, bands.map((b) => ({ c: 0xefe8d6, ...b })));
    // front door with cream surround, stair windows above
    box(g, 0.1, 2.15, 1.0, std(0x2c5a8f, { roughness: 0.4 }), face - 0.04, 1.2, door);
    box(g, 0.2, 2.5, 0.22, stoneCream, face - 0.08, 1.25, door - 0.65); box(g, 0.2, 2.5, 0.22, stoneCream, face - 0.08, 1.25, door + 0.65);
    box(g, 0.26, 0.26, 1.7, stoneCream, face - 0.1, 2.6, door);
    box(g, 1.1, 0.14, 1.5, mats.concrete, face - 0.55, PAVE + 0.07, door);
    windows({ x: face, z: door, ux: 0, uz: 1, nx: -1, nz: 0, n: 1, gap: 0, ys: [4.5, 7.5], fw: 0.9, fh: 1.3, stone: true, seed: 3 });
    for (const z of [z0 + 0.35, door + 1.0, z1 - 0.35]) { pipes.push({ x: face - 0.07, y: h / 2, z, sy: h }); box(g, 0.2, 0.22, 0.24, mats.iron, face - 0.1, h - 0.2, z); }

    // front yards: railings with a gate gap, wheelie bins, bike pod
    railing(YARD_X, z0, door - 0.6); railing(YARD_X, door + 0.6, z1);
    railing(z0, YARD_X, face, true); railing(z1, YARD_X, face, true);
    bins([[YARD_X + 0.75, -142.9, 0x3f7a35], [YARD_X + 0.75, -142.1, 0x1d1f22], [YARD_X + 0.75, -131.0, 0x3f7a35]]);
    const pod = new THREE.Group(), canvas = std(0x1f4a35, { roughness: 0.8, side: THREE.DoubleSide });
    pod.position.set(YARD_X + 0.78, PAVE, -133.5); g.add(pod);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(E), canvas);
    shell.castShadow = true; pod.add(shell);
    for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CircleGeometry(0.62, 14, 0, Math.PI), canvas); cap.position.z = s * 0.95; pod.add(cap); }
    inst(pod, new THREE.TorusGeometry(0.63, 0.028, 6, 14, Math.PI), std(0x163828), [-0.8, -0.4, 0, 0.4, 0.8].map((z) => ({ z })));
    col.rect(YARD_X + 0.78, -133.5, 1.24, 1.9, { h: 0.74 });
  }

  /* ---------- buff three-storey block: white ground floor, recessed corner balcony ---------- */
  function buffBlock() {
    const face = K + 8.6, z0 = -156, z1 = -146, d = 11, notch = 3.5, inset = 1.8, buff = brickMat(0xc9b183);
    box(g, d, 3.1, z1 - z0, cream, face + d / 2, 1.55, (z0 + z1) / 2);
    box(g, d + 0.2, 0.18, z1 - z0 + 0.2, mats.white, face + d / 2, 3.1, (z0 + z1) / 2);
    box(g, d, 6.3, z1 - z0 - notch, buff, face + d / 2, 6.25, (z0 + z1 - notch) / 2);
    box(g, d - inset, 6.3, notch, buff, face + inset + (d - inset) / 2, 6.25, z1 - notch / 2);
    box(g, d + 1.6, 0.25, z1 - z0 + 1.6, slate, face + d / 2, 9.5, (z0 + z1) / 2);                     // wide eaves
    box(g, inset, 0.15, notch, mats.concrete, face + inset / 2, 6.25, z1 - notch / 2);                // upper balcony slab
    col.rect(face + d / 2, (z0 + z1) / 2, d, z1 - z0, { h: 9.5, pad: 0.3 });
    skirt(face, face + d, z0, z1, PAVE - 0.01);
    windows({ x: face, z: z0 + 1.7, ux: 0, uz: 1, nx: -1, nz: 0, n: 3, gap: 3.1, ys: [1.7], fw: 1.5, fh: 1.6, seed: 1 });
    windows({ x: face, z: z0 + 1.7, ux: 0, uz: 1, nx: -1, nz: 0, n: 2, gap: 3.1, ys: [4.75, 7.85], fw: 1.5, fh: 1.6, stone: true, seed: 2 });
    windows({ x: face + inset, z: z1 - notch / 2, ux: 0, uz: 1, nx: -1, nz: 0, n: 1, gap: 0, ys: [4.4, 7.5], fw: 1.9, fh: 2.1, seed: 4 });
    // dark metal balcony railings on both floors (west edge + south return)
    const rails = [];
    for (const y of [3.2, 6.33]) {
      for (let z = z1 - notch + 0.06; z < z1; z += 0.13) rails.push({ x: face + 0.04, y: y + 0.5, z });
      for (let x = face + 0.1; x < face + inset; x += 0.13) rails.push({ x, y: y + 0.5, z: z1 - 0.04 });
      box(g, 0.06, 0.06, notch, mats.iron, face + 0.04, y + 1.0, z1 - notch / 2); box(g, inset, 0.06, 0.06, mats.iron, face + inset / 2, y + 1.0, z1 - 0.04);
    }
    inst(g, new THREE.BoxGeometry(0.025, 1.0, 0.025), mats.iron, rails, { shadow: false });
    pipes.push({ x: face - 0.07, y: 4.7, z: z0 + 0.3, sy: 9.4 });
    railing(YARD_X, z0, -151.6); railing(YARD_X, -150.4, z1);
    bins([[YARD_X + 0.7, -155.2, 0x1d1f22], [YARD_X + 0.7, -154.4, 0x3f7a35]]);
  }

  /* ---------- orange-brick flats next to Abercorn House ---------- */
  function orangeFlats() {
    const face = K + 8, z0 = -165.2, z1 = -157.5, d = 12, h = 13, cz = (z0 + z1) / 2, balc = [];
    box(g, d, h, z1 - z0, brickMat(0xb8643c), face + d / 2, h / 2, cz); box(g, d + 0.3, 0.3, z1 - z0 + 0.3, mats.concreteDark, face + d / 2, h + 0.1, cz);
    col.rect(face + d / 2, cz, d, z1 - z0, { h, pad: 0.3 });
    skirt(face, face + d, z0, z1, PAVE - 0.01);
    windows({ x: face, z: cz - 1.9, ux: 0, uz: 1, nx: -1, nz: 0, n: 2, gap: 3.8, ys: [2, 5.2, 8.4, 11.4], fh: 1.9, fw: 1.6, seed: 3 });
    for (const y of [4.2, 7.4, 10.4]) for (const z of [cz - 1.9, cz + 1.9]) balc.push({ x: face - 0.45, y, z });
    inst(g, new THREE.BoxGeometry(0.9, 1.0, 2.2), std(0x25282f, { roughness: 0.4, metalness: 0.5 }), balc);
    railing(YARD_X, z0, cz - 0.6); railing(YARD_X, cz + 0.6, z1);
  }

  function bins(list) {
    const k = PAVE, wheels = [];
    inst(g, new THREE.BoxGeometry(0.56, 0.95, 0.66), mats.blockWhite, list.map(([x, z, c]) => ({ x, y: k + 0.56, z, c })));
    inst(g, new THREE.BoxGeometry(0.6, 0.07, 0.72), mats.blockWhite, list.map(([x, z, c]) => ({ x: x - 0.01, y: k + 1.07, z, c })));
    inst(g, new THREE.BoxGeometry(0.06, 0.05, 0.6), mats.blockWhite, list.flatMap(([x, z, c]) => [{ x: x - 0.28, y: k + 1.12, z, c }, { x: x + 0.27, y: k + 1.13, z, c }]));   // lid lip + hinge ridge
    list.forEach(([x, z]) => { for (const s of [-1, 1]) wheels.push({ x: x + 0.24, y: k + 0.1, z: z + s * 0.27, rx: E }); col.rect(x, z, 0.58, 0.68, { h: k + 1.1 }); });
    inst(g, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 10), std(0x0c0c0d), wheels);
  }

  /* ---------- west side: cream semi-detached villas, picket fence, overgrown hedge ---------- */
  function villas() {
    const face = K - 9.5, d = 11, len = 18, h = 7.4, cx = face - d / 2;
    const gable = new THREE.Shape(); gable.moveTo(-d / 2 - 0.5, 0); gable.lineTo(d / 2 + 0.5, 0); gable.lineTo(0, 3.1); gable.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(gable, { depth: len + 0.8, bevelEnabled: false }).translate(0, 0, -(len + 0.8) / 2);
    const stack = brickMat(0xa8553a), plinth = brickMat(0x8a4b3a), doors = [0x1f2b3a, 0x7a1f1f, 0x1f3a2c, 0x24252a, 0x2c4a6b, 0x4a2b1b];
    const hedges = [[2.5, 1], [1.55, 0.35], [2.0, 0.75]];
    [-141, -165, -189].forEach((zc, v) => {
      box(g, d, h, len, cream, cx, h / 2, zc);
      box(g, d + 0.15, 0.5, len + 0.15, std(0xcfc8b8), cx, 0.25, zc); box(g, d + 0.2, 0.16, len + 0.2, stoneCream, cx, 3.75, zc);
      const roof = new THREE.Mesh(roofGeo, slate); roof.position.set(cx, h, zc); roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
      for (const [dz, tall] of [[0, 2.6], [-len / 2 + 0.6, 2.2], [len / 2 - 0.6, 2.2]]) {                 // terracotta stacks + pots
        box(g, 0.75, tall, 1.3, stack, cx, h + 3.1 + tall / 2 - 0.9, zc + dz);
        box(g, 0.9, 0.12, 1.45, stoneCream, cx, h + 3.1 + tall - 0.9, zc + dz);
        for (const p of [-0.42, 0, 0.42]) pots.push({ x: cx, y: h + 3.1 + tall - 0.62, z: zc + dz + p });
      }
      col.rect(cx, zc, d, len, { h, pad: 0.3 });
      skirt(face - d, face, zc - len / 2, zc + len / 2);
      const isDoor = (i) => i === 1 || i === 2;
      windows({ x: face, z: zc - 6.4, ux: 0, uz: 1, nx: 1, nz: 0, n: 4, gap: 4.267, ys: [2.05, 5.5], fh: [2.2, 2.0], fw: 1.25, stone: true, seed: v, skip: (i, f) => f === 0 && isDoor(i) });
      for (const s of [-1, 1]) {                                                                           // paired front doors
        const dz = zc + s * 2.13;
        box(g, 0.1, 2.2, 1.0, std(doors[(v * 2 + (s > 0 ? 1 : 0)) % 6], { roughness: 0.35 }), face + 0.04, 1.3, dz);
        box(g, 0.24, 0.26, 1.7, stoneCream, face + 0.1, 2.62, dz); box(g, 0.5, 0.1, 1.9, stoneCream, face + 0.25, 2.8, dz);
        for (const e of [-0.68, 0.68]) box(g, 0.2, 2.5, 0.2, stoneCream, face + 0.1, 1.25, dz + e);
        box(g, 0.9, 0.2, 1.6, mats.concrete, face + 0.45, 0.1, dz); col.rect(face + 0.45, dz, 0.9, 1.6, { h: 0.2 });
        panes.push({ x: face + 0.05, y: 2.2, z: dz, ry: E, sx: 0.8, sy: 0.35, c: GLASS[1] });
      }
      // boundary: brick plinth + jittered pickets + white gate piers, hedge billowing over the top
      const gates = [zc - 2.13, zc + 2.13], runs = [[zc - 12, gates[0] - 0.55], [gates[0] + 0.55, gates[1] - 0.55], [gates[1] + 0.55, zc + 12]];
      for (const [a, b] of runs) {
        wall(FENCE_X, (a + b) / 2, 0.3, b - a, 0.55, plinth);
        for (let z = a + 0.1; z < b; z += 0.19 + rnd() * 0.03) {
          const ph = 0.86 + rnd() * 0.1;
          pickets.push({ x: FENCE_X + (rnd() - 0.5) * 0.02, y: 0.55 + ph / 2, z, sy: ph, ry: (rnd() - 0.5) * 0.25, rx: (rnd() - 0.5) * 0.05 });
        }
        for (const y of [0.78, 1.22]) box(g, 0.035, 0.07, b - a, mats.white, FENCE_X - 0.03, y, (a + b) / 2);
        col.rect(FENCE_X, (a + b) / 2, 0.2, b - a, { h: 1.5, pad: 0.05 });
        const [hh, wild] = hedges[v];
        if (b - a > 2) hedge(FENCE_X - 0.85, (a + b) / 2, 1.5, b - a - 0.4, hh, wild);
      }
      for (const gz of gates) for (const s of [-1, 1]) {
        box(g, 0.42, 1.55, 0.42, mats.white, FENCE_X, 0.78, gz + s * 0.55); box(g, 0.52, 0.1, 0.52, mats.white, FENCE_X, 1.6, gz + s * 0.55);
        col.rect(FENCE_X, gz + s * 0.55, 0.42, 0.42, { h: 1.6 });
      }
    });
  }

  /* ---------- kerbs, flagstone pavements, markings, ironwork ---------- */
  function streetSurface() {
    const len = Z_S - Z_N, mid = (Z_S + Z_N) / 2;
    // raised pavements either side
    for (const [x0, x1] of [[FENCE_X + 0.15, KERB_W - 0.15], [KERB_E + 0.15, YARD_X]]) {
      const p = box(g, x1 - x0, PAVE, len, mats.flag, (x0 + x1) / 2, PAVE / 2, mid); p.castShadow = false;
    }
    col.rect((FENCE_X + KERB_W) / 2, mid, KERB_W - FENCE_X, len, { h: PAVE });
    col.rect((KERB_E + YARD_X + 2.4) / 2, mid, YARD_X + 2.4 - KERB_E, len, { h: PAVE });
    // red block-paved forecourts behind the railings
    const fore = box(g, 2.4, PAVE, 37.5, std(0x8f5f4c, { roughness: 0.95 }), YARD_X + 1.2, PAVE / 2, -148.75); fore.castShadow = false;

    // granite kerb stones with a chamfered top edge
    const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.lineTo(0.15, 0); prof.lineTo(0.15, PAVE - 0.03); prof.lineTo(0.12, PAVE); prof.lineTo(0, PAVE); prof.closePath();
    const kerbs = [];
    for (let z = Z_N; z < Z_S - 0.5; z += 0.915) {
      kerbs.push({ x: KERB_W - 0.15, z, c: 0xffffff - (Math.floor(rnd() * 3) * 0x080808) });
      kerbs.push({ x: KERB_E + 0.15, z: z + 0.9, ry: Math.PI, c: 0xffffff - (Math.floor(rnd() * 3) * 0x080808) });
    }
    inst(g, new THREE.ExtrudeGeometry(prof, { depth: 0.9, bevelEnabled: false }), mats.granite, kerbs);

    // darker utility-trench reinstatements in the paving
    const patches = [[KERB_W - 1.1, -133, 0.6, 4.2], [KERB_W - 1.4, -171, 1.2, 1.2], [KERB_E + 1.2, -150, 0.6, 6], [KERB_E + 1.3, -196, 1.2, 1.8], [KERB_W - 0.9, -205, 0.6, 3]];
    inst(g, new THREE.BoxGeometry(1, 0.012, 1), std(0x55575a, { roughness: 0.95 }), patches.map(([x, z, w, d]) => ({ x, y: PAVE + 0.006, z, sx: w, sz: d })), { shadow: false });

    // wear along the crown and darker, damp gutters
    const wear = new THREE.Mesh(new THREE.PlaneGeometry(9, len).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      map: canvasTex(256, 8, (c) => {
        const gr = c.createLinearGradient(0, 0, 256, 0);
        gr.addColorStop(0, 'rgba(8,9,11,0.42)'); gr.addColorStop(0.1, 'rgba(8,9,11,0.08)'); gr.addColorStop(0.3, 'rgba(210,210,205,0.07)');
        gr.addColorStop(0.5, 'rgba(10,10,12,0.12)'); gr.addColorStop(0.7, 'rgba(210,210,205,0.07)'); gr.addColorStop(0.9, 'rgba(8,9,11,0.08)'); gr.addColorStop(1, 'rgba(8,9,11,0.42)');
        c.fillStyle = gr; c.fillRect(0, 0, 256, 8);
      }),
    }));
    wear.position.set(K, 0.036, mid); g.add(wear);

    // double yellows (west), dashed bays with T-bars (east)
    for (const dx of [0.3, 0.5]) { const y = box(g, 0.1, 0.008, len - 8, mats.lineYellow, KERB_W + dx, 0.042, mid - 4); y.castShadow = false; }
    const dashes = [], tees = [];
    for (let z = -121.2; z > Z_N + 1; z -= 5.7) { tees.push({ x: KERB_E - 1.05, y: 0.042, z, sx: 2.0 }); tees.push({ x: KERB_E - 2.1, y: 0.042, z, sx: 0.1, sz: 9 }); }
    for (let z = -122; z > Z_N + 1; z -= 1.9) dashes.push({ x: KERB_E - 2.1, y: 0.042, z });
    inst(g, new THREE.BoxGeometry(0.1, 0.008, 0.95), mats.white, dashes, { shadow: false });
    inst(g, new THREE.BoxGeometry(1, 0.008, 0.1), mats.white, tees, { shadow: false });

    // cast-iron manhole covers and gutter gratings
    const iron = new THREE.MeshStandardMaterial({
      roughness: 0.55, metalness: 0.7,
      map: canvasTex(64, 64, (c) => { c.fillStyle = '#2c2d30'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#17181a'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) c.fillRect(i * 8 + 1, j * 8 + 1, 6, 6); }),
    });
    inst(g, new THREE.CylinderGeometry(0.33, 0.33, 0.014, 20), iron, [[K - 1.2, -139], [K + 0.6, -172], [K - 0.8, -201]].map(([x, z]) => ({ x, y: 0.04, z })), { shadow: false });
    const grates = [];
    for (let z = -126; z > Z_N; z -= 23) grates.push({ x: KERB_W + 0.17, y: 0.04, z }, { x: KERB_E - 0.17, y: 0.04, z: z - 9 });
    inst(g, new THREE.BoxGeometry(0.3, 0.014, 0.46), iron, grates, { shadow: false });
  }

  /* ---------- street furniture ---------- */
  function dressing() {
    const iron = mats.iron, paint = (w, h, draw, x, z, sw, sh) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, map: canvasTex(w, h, draw) }));
      if (ctx.daylit) ctx.daylit.push(m.material);                 // unlit paint: dims with the daylight
      m.position.set(x, 0.05, z); m.rotation.y = E; g.add(m);
    };
    paint(512, 96, (c, w, h) => { c.fillStyle = '#e9e9e4'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 74px ${FONT}`; c.fillText('Bute Gardens', w / 2, h / 2 + 4); }, K - 1, -117, 8.4, 1.5);
    paint(128, 128, (c) => { c.strokeStyle = c.fillStyle = '#e9e9e4'; c.lineWidth = 9; c.beginPath(); c.arc(64, 64, 54, 0, TAU); c.stroke(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 56px ${FONT}`; c.fillText('20', 64, 68); }, K - 1, -134, 2.6, 2.6);
    // block-paved entry table
    const table = new THREE.Mesh(new THREE.PlaneGeometry(9, 5).rotateX(-Math.PI / 2), brickMat(0x7a6658)); table.position.set(K, 0.04, -109.5); table.receiveShadow = true; g.add(table);

    inst(g, new THREE.CylinderGeometry(0.1, 0.13, 1, 10), iron,
      [[K - 6, -107.2], [K - 5, -109.2], [K + 5.2, -108.2], [K + 6, -109.8], [K - 9, -106.8]].map(([x, z]) => ({ x, y: 0.5, z })));
    // lamp post with hanging flower baskets outside the newsagent
    const lx = K - 13, lz = -106.9;
    box(g, 0.16, 6.5, 0.16, iron, lx, 3.25, lz); box(g, 2.2, 0.08, 0.08, iron, lx, 3.9, lz);
    const petals = [];
    for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
      const a = i * 0.9, r = i ? 0.3 : 0;
      petals.push({ x: lx + s + Math.cos(a) * r, y: 3.5 + (i % 3) * 0.12, z: lz + Math.sin(a) * r, sx: 0.3, sy: 0.24, sz: 0.3, c: [0xd43f8d, 0xc62f6f, 0x7a3fb0, 0xe4572e, 0xf2a7c8][(i + (s > 0 ? 2 : 0)) % 5] });
    }
    inst(g, new THREE.IcosahedronGeometry(1, 1), mats.leaf, petals, { shadow: false });
    for (const s of [-1, 1]) foliage.blob(lx + s, 3.28, lz, 0.42, 0.26, 0.42);

    // 20 zone + ahead-only signs on the east corner
    const px = K + 5.4, pz = -111.2;
    box(g, 0.1, 4.2, 0.1, mats.steel, px, 2.1, pz);
    const disc = (draw, y, s) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, draw), transparent: true, alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide }));
      m.position.set(px, y, pz + 0.07); g.add(m); readableBothSides(m.material);
    };
    disc((c) => {
      c.fillStyle = '#fff'; c.fillRect(8, 0, 112, 128);
      c.beginPath(); c.arc(64, 46, 36, 0, TAU); c.lineWidth = 10; c.strokeStyle = '#d5201c'; c.stroke();
      c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 38px ${FONT}`; c.fillText('20', 64, 48);
      c.font = `700 22px ${FONT}`; c.fillText('ZONE', 64, 108);
    }, 3.7, 0.95);
    disc((c) => {
      c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.fillStyle = '#1763c6'; c.fill();
      c.fillStyle = '#fff'; c.fillRect(56, 44, 16, 56); c.beginPath(); c.moveTo(64, 18); c.lineTo(94, 54); c.lineTo(34, 54); c.closePath(); c.fill();
    }, 2.7, 0.7);

    // junction towards the station: advertising totem + signals on the island's NE tip
    const totem = new THREE.Group(); totem.position.set(74, 0, -72); totem.rotation.set(0, 0.5, 0.06); g.add(totem);
    box(totem, 3.2, 13, 0.9, std(0x8a8f96, { roughness: 0.3, metalness: 0.6 }), 0, 7.5, 0); box(totem, 1.6, 1.4, 1, mats.concreteDark, 0, 0.7, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 9), new THREE.MeshBasicMaterial({ color: 0x2f6fe0, toneMapped: false }));
    screen.position.set(0, 8.4, 0.47); totem.add(screen);
    col.rect(74, -72, 3.4, 1.4, { rot: 0.5, h: 14 });
    const sig = [[66, -80], [84, -66], [70, -106], [K + 6.2, -106.6], [58, -84]], lamps = [];
    inst(g, new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8), iron, sig.map(([x, z]) => ({ x, y: 1.7, z })));
    inst(g, new THREE.BoxGeometry(0.34, 1.0, 0.3), iron, sig.map(([x, z]) => ({ x, y: 3.5, z })));
    sig.forEach(([x, z], i) => [0xff3b30, 0x4a3a10, 0x16401f].forEach((c, j) => lamps.push({ x, y: 3.8 - j * 0.3, z: z + 0.16, c: i % 2 && j === 2 ? 0x35ff6a : i % 2 && j === 0 ? 0x4a1512 : c })));
    inst(g, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), lamps, { shadow: false });
  }
}
