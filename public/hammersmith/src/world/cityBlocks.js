/**
 * The bigger buildings around the Bute Gardens corner, from the reference
 * photos looking south and east across Hammersmith Road:
 *   - glass office blocks on the south side of Hammersmith Rd (red-panelled,
 *     blue curtain wall, grey), two taller glass towers further east
 *   - the cream stone Broadway offices with their ochre panel motif
 *   - the Broadway Shopping Centre entrance (grey panels under white arched
 *     trusses) on the hub's east door, and the bus stop outside it
 */
import * as THREE from 'three';
import { TAU, FONT, canvasTex, sign, roundel, inst, box, brickMat, rng } from '../util.js';
import { FOOTBRIDGE, fbWorld, MAIN_DOOR } from './plan2024.js';
import { curtainWall, granite, travertine, galvanised, paint, sandstone } from './finishes.js';
import { entranceMat } from './clutter.js';

/** Tiling facade material; one tile = one bay x one storey (UVs are in metres). */
function facade(bayW, storeyH, draw, o = {}) {
  const t = canvasTex(128, 256, draw);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / bayW, 1 / storeyH);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.14, metalness: 0.55, ...o });
}
/** TfL station fascia: white roundel, the station name, then the lines and modes served. Drawn at 4096 px so the
 *  lettering stays crisp from the pavement. */
function tflFascia(w, h) {
  const W = 4096, H = Math.round(W * h / w);
  const t = canvasTex(W, H, (c) => {
    c.fillStyle = '#0019a8'; c.fillRect(0, 0, W, H);
    const cy = H / 2, R = H * 0.33, rx = H * 0.75;
    c.strokeStyle = '#fff'; c.lineWidth = R * 0.4; c.beginPath(); c.arc(rx, cy, R, 0, TAU); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(rx - R * 1.5, cy - R * 0.27, R * 3, R * 0.54);
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = `700 ${Math.round(H * 0.5)}px ${FONT}`;
    if ('letterSpacing' in c) c.letterSpacing = `${Math.round(H * 0.035)}px`;
    let x = rx + R * 2.3; c.fillText('HAMMERSMITH STATION', x, cy + H * 0.03); x += c.measureText('HAMMERSMITH STATION').width + H * 0.45;
    c.fillRect(x, H * 0.2, H * 0.025, H * 0.6); x += H * 0.4;
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    c.font = `600 ${Math.round(H * 0.27)}px ${FONT}`;
    const chip = (col, px, py) => { c.fillStyle = col; c.fillRect(px, py - H * 0.085, H * 0.3, H * 0.17); c.fillStyle = '#fff'; };
    chip('#00782a', x, H * 0.32); chip('#003688', x + H * 0.36, H * 0.32); c.fillText('District and Piccadilly lines', x + H * 0.82, H * 0.33);
    c.fillStyle = '#dc241f'; c.beginPath(); c.arc(x + H * 0.15, H * 0.7, H * 0.105, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(x + H * 0.01, H * 0.675, H * 0.28, H * 0.05); c.fillText('Buses', x + H * 0.82, H * 0.71);
  });
  t.anisotropy = 16;
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); m.color.setScalar(1.15);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
}

export function buildCityBlocks(ctx, g) {
  const { col, mats, foliage } = ctx;
  const rnd = rng(31);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const M = {
    // glass curtain walls: every pane its own tint, some with blinds down, mirror-smooth glass against satin spandrels
    red: curtainWall(1.8, 3.7, '#7fa9b8', '#3f6470', '#9c2f2c', '#e9ecef'),
    blue: curtainWall(1.8, 3.8, '#6aa3cf', '#2f5f8c', '#274a6e', '#b9c4cf'),
    grey: curtainWall(1.8, 3.7, '#93a7b5', '#55697a', '#b8bfc4', '#dfe3e6'),
    tower: curtainWall(1.6, 3.8, '#9cc8e6', '#4f86b3', '#5e93bd', '#d5e2ec'),
    stone: facade(3.6, 3.6, (c) => {                                    // cream stone with a punched window per bay
      c.fillStyle = '#e2d5b2'; c.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(120,100,60,${rnd() * 0.12})`; c.fillRect(rnd() * 128, rnd() * 256, 2, 2); }
      c.fillStyle = '#f0e8d0'; c.fillRect(30, 46, 68, 150); c.fillStyle = '#26323f'; c.fillRect(36, 52, 56, 138);
      c.fillStyle = '#f0e8d0'; c.fillRect(62, 52, 4, 138); c.fillRect(36, 118, 56, 4);
      c.fillStyle = '#cbbd96'; c.fillRect(0, 244, 128, 12);
    }, { roughness: 0.75, metalness: 0.05 }),
    motif: facade(3.6, 7.2, (c) => {                                    // blank bays with the ochre rectangle motif
      c.fillStyle = '#e6d9b4'; c.fillRect(0, 0, 128, 256);
      c.strokeStyle = '#c99a3c'; c.lineWidth = 7; c.strokeRect(30, 26, 68, 204);
      c.fillStyle = '#c9a66a'; c.fillRect(0, 248, 128, 8);
    }, { roughness: 0.8, metalness: 0 }),
    panel: facade(1.2, 1.2, (c) => {                                    // grey cladding panels
      c.fillStyle = '#aeb3b8'; c.fillRect(0, 0, 128, 256); c.strokeStyle = '#7d8388'; c.lineWidth = 5; c.strokeRect(0, 0, 128, 256);
    }, { roughness: 0.45, metalness: 0.5 }),
  };
  const columns = [], fins = [];

  /** Office block on a footprint; `north: true` adds a recessed ground-floor colonnade facing Hammersmith Rd. */
  function office(x0, x1, z0, z1, h, mat, { colonnade = false, plant = true, finned = false } = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, base = colonnade ? 4.4 : 0;
    box(g, w, h - base, d, mat, cx, base + (h - base) / 2, cz);
    box(g, w + 0.7, 0.55, d + 0.7, mats.concreteDark, cx, h + 0.27, cz);
    if (plant) box(g, w * 0.55, 3.2, d * 0.5, std(0xb9bec3, { roughness: 0.5, metalness: 0.4 }), cx + w * 0.1, h + 2.1, cz);
    if (colonnade) {
      box(g, w - 1.6, base, d - 1.6, std(0x1f2a36, { roughness: 0.08, metalness: 0.8 }), cx, base / 2, cz);
      for (let x = x0 + 0.6; x <= x1 - 0.5; x += (w - 1.2) / Math.round((w - 1.2) / 5.4)) columns.push({ x, y: base / 2, z: z0 + 0.6, sy: base }, { x, y: base / 2, z: z1 - 0.6, sy: base });
    }
    if (finned) for (let x = x0; x <= x1 + 0.01; x += 7.2) fins.push({ x, y: h / 2 + 2, z: z0 - 0.2, sy: h - 4 }, { x, y: h / 2 + 2, z: z1 + 0.2, sy: h - 4 });
    col.rect(cx, cz, w, d, { h, pad: 0.3 });
  }

  /* ---------- south side of Hammersmith Rd, east of Butterwick ---------- */
  office(132, 168, -88, -62, 30, M.red, { colonnade: true, finned: true });      // red spandrels, white fins
  office(172, 216, -88, -52, 38.5, M.blue, { colonnade: true });                 // blue curtain wall on columns
  office(134, 170, -56, -12, 33.5, M.grey);                                      // grey block behind
  office(176, 222, -46, -8, 26, M.grey, { plant: false });
  office(226, 252, -88, -56, 53, M.tower);                                       // the two glass towers further east
  office(258, 292, -86, -50, 65, M.tower);
  for (const [x, z, k] of [[129, -90, 1.1], [150, -90.2, 1.0], [170, -90, 1.2], [196, -90.2, 1.0], [221, -90, 1.1], [128, -52, 1.0], [129, -30, 1.1]]) foliage.tree(x, z, k);

  /* ---------- cream stone Broadway offices on the island, beyond the totem ---------- */
  office(-94, -68, 20, 58, 25, M.stone, { plant: false });

  inst(g, new THREE.CylinderGeometry(0.45, 0.45, 1, 14), std(0xd9d4c8, { roughness: 0.6 }), columns);
  inst(g, new THREE.BoxGeometry(0.3, 1, 0.55), mats.white, fins);

  broadwayEntrance();
  busStop();
  stationFront();

  /* ---------- Broadway Shopping Centre entrance on the hub's east door ---------- */
  function broadwayEntrance() {
    // local frame: +Z points out to the street along the footbridge axis, X runs along the frontage.
    // The building is the last PORCH metres of the footbridge itself: its passage is the corridor's continuation
    // and the street doors sit in its front face (Street View, Jul 2022).
    const rot = FOOTBRIDGE.yaw + Math.PI / 2, cr = Math.cos(rot), sr = Math.sin(rot), [ox, oz] = fbWorld(FOOTBRIDGE.length - 0.2, 0);
    const p = new THREE.Group(); p.position.set(ox, 0, oz); p.rotation.y = rot; g.add(p);
    const world = (lx, lz, w, d, h) => col.rect(ox + lx * cr + lz * sr, oz - lx * sr + lz * cr, w, d, { h, pad: 0.15, rot });
    for (const s of [-1, 1]) { box(p, 4.4, 3.7, 5, M.panel, s * 5.4, 1.85, 2.7); world(s * 5.4, 2.7, 4.4, 5, 5.7); }
    box(p, 15.2, 2.0, 5, M.panel, 0, 4.7, 2.7);
    box(p, 15.6, 0.2, 5.4, mats.concreteDark, 0, 5.8, 2.7);
    // the roof rises from the sign band back over the corridor, as a wedge
    const wedge = new THREE.Shape([new THREE.Vector2(5.2, 5.9), new THREE.Vector2(0.0, 5.9), new THREE.Vector2(0.0, 7.6)]);
    const wg = new THREE.ExtrudeGeometry(wedge, { depth: 15.2, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(7.6, 0, 0);
    const wm = new THREE.Mesh(wg, M.panel); wm.castShadow = true; p.add(wm);
    box(p, 15.6, 0.16, Math.hypot(5.2, 1.7) + 0.2, mats.concreteDark, 0, 6.82, 2.6).rotation.x = Math.atan2(1.7, 5.2);
    for (const s of [-1, 1]) { const leg = box(p, 0.5, 4.6, 3.4, std(0x8f959b, { roughness: 0.5, metalness: 0.5 }), s * 8.4, 2.0, 4.6); leg.rotation.x = -0.5; }       // raking side buttresses
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.85), new THREE.MeshBasicMaterial({
      toneMapped: false,
      map: canvasTex(512, 176, (c) => {
        c.fillStyle = '#fbfbf8'; c.fillRect(0, 0, 512, 176);
        const edge = c.createLinearGradient(0, 0, 512, 0); ['#7a3fb0', '#2f7fd0', '#3fa34d', '#f2b134', '#e4572e'].forEach((h, i) => edge.addColorStop(i / 4, h)); c.fillStyle = edge; c.fillRect(0, 170, 512, 6); c.fillRect(0, 0, 512, 3);
        ['#e4572e', '#f2b134', '#3fa34d', '#2f7fd0', '#7a3fb0'].forEach((hue, i) => { c.strokeStyle = hue; c.lineWidth = 11; c.beginPath(); c.arc(70, 66, 40, i * TAU / 5, (i + 1) * TAU / 5 - 0.12); c.stroke(); });
        c.fillStyle = '#1d2a44'; c.textBaseline = 'middle'; c.font = `800 50px ${FONT}`; c.fillText('BROADWAY', 134, 48);
        c.font = `600 27px ${FONT}`; c.fillText('SHOPPING CENTRE', 136, 94);
        // the row of tenant logos under the name
        [['#1b1b1b', '#fff', 'P'], ['#da291c', '#ffc72c', 'M'], ['#00539f', '#fff', 'T'], ['#6d1f37', '#fff', 'C'], ['#05054b', '#fff', 'B'], ['#00704a', '#fff', 'S'], ['#e5007d', '#fff', 'Sd'], ['#c8102e', '#fff', 'Ti']].forEach(([bg, fg, t], i) => {
          const x = 120 + i * 44; c.fillStyle = bg; c.beginPath(); c.arc(x, 142, 15, 0, TAU); c.fill(); c.fillStyle = fg; c.textAlign = 'center'; c.font = `800 14px ${FONT}`; c.fillText(t, x, 143); c.textAlign = 'left';
        });
      }),
    }));
    board.position.set(-1.2, 4.7, 5.23); p.add(board);
    const tube = roundel(1.2); tube.position.set(3.2, 4.7, 5.23); p.add(tube);
    const bus = sign('Buses  ·  Underground', { w: 4.4, h: 0.5, bg: '#0019a8', size: 0.55 }); bus.position.set(0, 3.45, 5.23); p.add(bus);

    // white arched roof trusses springing from steel posts either side
    const R = 11, arc = Math.PI * 0.62, steel = std(0xf2f4f5, { roughness: 0.35, metalness: 0.3 });
    const ribs = [], purlins = [], posts = [], cy = 9.2 - R, footX = R * Math.sin(arc / 2), footY = cy + R * Math.cos(arc / 2);
    for (const z of [0.9, 4.2, 7.5]) {
      ribs.push({ y: cy, z, rz: (Math.PI - arc) / 2 });
      for (const s of [-1, 1]) posts.push({ x: s * footX, y: footY / 2, z, sy: footY });
    }
    for (let i = 0; i <= 8; i++) {
      const a = -arc / 2 + arc * i / 8;
      purlins.push({ x: R * Math.sin(a), y: cy + R * Math.cos(a), z: 4.2, rx: Math.PI / 2 });
    }
    inst(p, new THREE.TorusGeometry(R, 0.16, 8, 48, arc), steel, ribs);
    inst(p, new THREE.CylinderGeometry(0.07, 0.07, 6.9, 8), steel, purlins);
    inst(p, new THREE.CylinderGeometry(0.14, 0.14, 1, 10), steel, posts);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.1, R - 0.1, 6.6, 40, 1, true, -arc / 2, arc).rotateX(-Math.PI / 2), mats.glass);
    roof.position.set(0, cy, 4.2); p.add(roof);
    posts.forEach((q) => world(q.x, q.z, 0.4, 0.4, footY));

    // brick wall with the two map boards, and guard rails along the kerb
    box(p, 8, 1.7, 0.45, brickMat(0x8d5a44), 13.4, 0.85, 4.6); world(13.4, 4.6, 8, 0.45, 1.7);
    for (const x of [11.6, 15.2]) {
      const map = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.7), new THREE.MeshBasicMaterial({
        toneMapped: false,
        map: canvasTex(256, 156, (c) => {
          c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 256, 156); c.fillStyle = '#0019a8'; c.fillRect(0, 0, 256, 26);
          c.fillStyle = '#fff'; c.font = `700 16px ${FONT}`; c.fillText('Hammersmith  ·  Buses from here', 8, 18);
          ['#dc241f', '#00782a', '#003688', '#f3a9bb', '#ffd300'].forEach((hue, i) => { c.strokeStyle = hue; c.lineWidth = 4; c.beginPath(); c.moveTo(14, 50 + i * 20); c.bezierCurveTo(90, 30 + i * 26, 160, 80 + i * 8, 244, 46 + i * 22); c.stroke(); });
        }),
      }));
      map.position.set(x, 2.0, 4.86); p.add(map);
    }
  }

  /* ---------- Hammersmith station front gate: stone block with a glazed bow, on the hub's north-west door ---------- */
  function stationFront() {
    // Modelled along -X (street facade at x0, inner end at x1), then turned so -X points out of the main door
    // and moved so the passage's inner end lands on the door opening.
    const [nx, nz] = MAIN_DOOR.n, turn = Math.atan2(nz, -nx), ct = Math.cos(turn), st = Math.sin(turn);
    const FX = MAIN_DOOR.m[0] - 57.5 * nx, FZ = MAIN_DOOR.m[1] - 57.5 * nz;
    const f = new THREE.Group(); f.position.set(FX, 0, FZ); f.rotation.y = turn; g.add(f);
    const rc = (x, z, w, d, o) => col.rect(FX + x * ct + z * st, FZ - x * st + z * ct, w, d, { ...o, rot: turn });
    const x0 = -74, x1 = -57.5, half = 15, gap = 4.2, clear = 5.6, h = 31, w = x1 - x0, cx = (x0 + x1) / 2;
    const pierStone = granite('brown'), redGranite = granite('red'), plinth = granite('grey'), lintel = travertine();   // polished granite slabs under a travertine lintel
    const dark = std(0x1a2230, { roughness: 0.08, metalness: 0.8 });
    // 36 Hammersmith Broadway (Street View, Jul 2025): seven office storeys of sand-coloured stone over the glazed
    // ground floor. The stone is real depth: piers and spandrel bands standing 0.45 m in front of a recessed glass
    // wall, with aluminium mullions in each window, full-height glazed strips, and open frames on the roof.
    const sand = sandstone(), alu = std(0xb9bfc6, { roughness: 0.35, metalness: 0.75 }), wallGlass = std(0x1b2836, { roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 });
    for (const s of [-1, 1]) {                                               // same footprint and collision as before
      rc(cx, s * (gap + half) / 2, w, half - gap, { h, pad: 0.3 });
      box(f, w - 0.5, clear, half - gap - 0.5, dark, cx + 0.25, clear / 2, s * (gap + half) / 2);   // the shops behind the ground-floor glazing
      box(f, 0.3, 4.6, half - gap - 1.6, dark, x0 - 0.1, 2.6, s * (gap + half) / 2);            // double-height shopfront glazing
    }
    rc(cx, 0, w, gap * 2, { h, thick: h - clear });
    const F0 = clear + 0.7, SH = 3.5, NS = 7, top = F0 + NS * SH;          // first floor line, storey height, storeys, roof line
    box(f, w - 0.45, top - clear, half * 2 - 0.9, wallGlass, cx + 0.225, clear + (top - clear) / 2, 0);   // the glass wall behind the stone
    box(f, 0.4, top - 6.5, half * 2, sand, x1, 6.5 + (top - 6.5) / 2, 0);                               // plain back, above the mall roof
    const mull = [];
    /** One stone-framed face from u0 to u1. at(u, out) -> local [x, z]. strips: bay indices left as full-height glazing. */
    const face = (at, alongZ, u0, u1, bay, strips) => {
      const put = (wd, hh, dp, u, y, out) => { const [x, z] = at(u, out); return alongZ ? box(f, dp, hh, wd, sand, x, y, z) : box(f, wd, hh, dp, sand, x, y, z); };
      const n = Math.max(1, Math.round((u1 - u0) / bay)), bw = (u1 - u0) / n;
      for (let i = 0; i <= n; i++) { const u = u0 + i * bw; put(1.0, top - SH - F0, 0.5, u, (F0 + top - SH) / 2, 0.15); put(0.5, SH, 0.5, u, top - SH / 2, 0.15); }   // piers; slimmer posts at the top-floor loggia
      for (let i = 0; i < n; i++) {
        const mid = u0 + (i + 0.5) * bw, strip = strips.includes(i);
        for (let k = 0; k <= NS; k++) {
          const y = F0 + k * SH;
          if (!strip || k === 0 || k === NS) put(bw - 1.0, k === NS ? 0.6 : 1.2, 0.42, mid, y + (k === NS ? -0.3 : 0.25), 0.11);       // spandrel band (parapet at the top)
          if (k === NS) continue;
          const [x, z] = at(mid, -0.38);
          mull.push({ x, y: y + 2.0, z, sx: alongZ ? 0.05 : 0.06, sy: 2.3, sz: alongZ ? 0.06 : 0.05 }, { x, y: y + 2.45, z, sx: alongZ ? 0.05 : bw - 1.0, sy: 0.05, sz: alongZ ? bw - 1.0 : 0.05 });
        }
      }
    };
    face((u, o) => [x0 - o, u], true, -half, -5, 3.33, [1]);               // street front, left of the glazed tower
    face((u, o) => [x0 - o, u], true, 5, half, 3.33, [1]);                 // and right of it
    for (const s of [-1, 1]) face((u, o) => [u, s * (half + o)], false, x0, x1, 3.3, [2]);   // the two flanks
    inst(f, new THREE.BoxGeometry(1, 1, 1), alu, mull, { shadow: false });
    // roof slab, and the open pergola frames at either end of the roofline
    box(f, w, 0.3, half * 2, mats.concreteDark, cx, top + 0.15, 0);
    const frame = std(0xd9cdb3, { roughness: 0.7 });
    for (const [za, zb] of [[-half + 0.3, -half + 7.3], [half - 7.3, half - 0.3]]) {
      for (const x of [x0 + 0.4, x0 + 6.4]) { for (const z of [za, zb]) box(f, 0.35, 3.2, 0.35, frame, x, top + 1.9, z); box(f, 0.3, 0.3, zb - za + 0.35, frame, x, top + 3.6, (za + zb) / 2); }
      for (let z = za; z <= zb + 0.01; z += (zb - za) / 3) box(f, 6.35, 0.25, 0.25, frame, x0 + 3.4, top + 3.6, z);
    }
    const one = sign('one', { w: 1.7, h: 0.7, bg: '#15171a', fg: '#c9a35a', weight: 600, size: 0.7 }); one.position.set(x0 - 0.27, 4.35, -6.7); one.rotation.y = -Math.PI / 2; f.add(one);   // the offices' own entrance
    // polished granite piers framing the entrance and shopfronts
    const piers = [-13.2, -8.7, -gap - 0.5, gap + 0.5, 8.7, 13.2];
    for (const z of piers) {
      box(f, 1.0, clear - 0.5, 1.0, pierStone, x0 - 0.3, 0.3 + (clear - 0.5) / 2, z);
      box(f, 1.12, 0.3, 1.12, plinth, x0 - 0.3, 0.15, z); box(f, 1.1, 0.2, 1.1, lintel, x0 - 0.3, clear - 0.1, z);     // dark plinth, travertine capital
      rc(x0 - 0.3, z, 1.0, 1.0, { h: clear });
    }
    box(f, 1.2, 0.7, half * 2 + 0.4, lintel, x0 - 0.3, clear + 0.35, 0);
    for (const s of [-1, 1]) box(f, 0.34, 0.5, half - gap - 1.6, pierStone, x0 - 0.1, 0.25, s * (gap + half) / 2);            // granite stall riser under the shop windows

    // glazed bow rising from above the entrance to the roof, on a dark lit soffit
    const bowMat = curtainWall(1 / 40, 1 / 24, '#8fb6d6', '#3d6788', '#cfd6dc', '#e8ecef');             // cylinder UVs run 0-1: 10 bays round, 6 storeys up
    const towerTop = top + 2.4;                                             // the round tower stands a storey proud of the roofline
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, towerTop - 8.6, 28, 1, false, Math.PI, Math.PI), bowMat);
    bow.position.set(x0, 8.6 + (towerTop - 8.6) / 2, 0); bow.castShadow = true; f.add(bow);
    for (let k = 0; k <= NS; k++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.69, 4.69, 0.32, 28, 1, true, Math.PI, Math.PI), alu); ring.position.set(x0, F0 + k * SH + 0.2, 0); f.add(ring); }   // aluminium band at every floor
    inst(f, new THREE.BoxGeometry(0.09, towerTop - 8.6, 0.09), alu, Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i + 0.5) / 9; return { x: x0 - Math.sin(a) * 4.66, y: 8.6 + (towerTop - 8.6) / 2, z: Math.cos(a) * 4.66 }; }), { shadow: false });
    // the clock, near the top of the tower, facing the street
    const clock = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(256, 256, (c) => {
      c.fillStyle = '#f6f3ea'; c.beginPath(); c.arc(128, 128, 126, 0, TAU); c.fill(); c.strokeStyle = '#23262b'; c.lineWidth = 9; c.beginPath(); c.arc(128, 128, 121, 0, TAU); c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12, r0 = i % 3 ? 100 : 90; c.lineWidth = i % 3 ? 5 : 9; c.beginPath(); c.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); c.lineTo(128 + Math.sin(a) * 112, 128 - Math.cos(a) * 112); c.stroke(); }
      c.lineCap = 'round'; c.lineWidth = 10; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 - 50, 128 - 36); c.stroke(); c.lineWidth = 7; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + 34, 128 - 86); c.stroke();
      c.fillStyle = '#23262b'; c.beginPath(); c.arc(128, 128, 9, 0, TAU); c.fill();
    }) }));
    clock.position.set(x0 - 4.86, top + 0.7, 0); clock.rotation.y = -Math.PI / 2; f.add(clock);
    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.2, 40).rotateZ(Math.PI / 2), std(0x23262b, { roughness: 0.4, metalness: 0.6 })); bezel.position.set(x0 - 4.72, top + 0.7, 0); f.add(bezel);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.3, 1.0, 28, 1, false, Math.PI, Math.PI), std(0x5b2c3c, { roughness: 0.5 }));
    drum.position.set(x0, 8.1, 0); f.add(drum);
    inst(f, new THREE.SphereGeometry(0.11, 8, 6), mats.warm, Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (i + 0.5) / 9; return { x: x0 - Math.sin(a) * 3.9, y: 7.58, z: Math.cos(a) * 3.9 }; }), { shadow: false });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.3, 0.4, 32, 1, false, Math.PI, Math.PI), std(0x3a3f46, { roughness: 0.5, metalness: 0.5 })); cap.position.set(x0, towerTop + 0.2, 0); cap.castShadow = true; f.add(cap);

    // station sign band, roundels, and the advertising screen over the doors
    const WEST = -Math.PI / 2;
    const band = tflFascia(11.6, 0.66); band.position.set(x0 - 0.95, clear + 0.35, 0); band.rotation.y = WEST; f.add(band);
    box(f, 0.06, 0.74, 11.72, std(0x0b1470, { roughness: 0.4, metalness: 0.4 }), x0 - 0.915, clear + 0.35, 0).castShadow = false;       // the fascia's enamel tray
    for (const z of [-7.0, 7.0]) { const r = roundel(1.15); r.position.set(x0 - 0.95, clear + 0.4, z); r.rotation.y = WEST; f.add(r); }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.9), new THREE.MeshBasicMaterial({
      toneMapped: false,
      map: canvasTex(448, 152, (c) => {
        const gr = c.createLinearGradient(0, 0, 448, 0); gr.addColorStop(0, '#e2462f'); gr.addColorStop(1, '#f08a3c'); c.fillStyle = gr; c.fillRect(0, 0, 448, 152);
        c.fillStyle = '#fff'; c.font = '800 46px ' + FONT; c.fillText('WHAT IS ON', 24, 66); c.font = '600 26px ' + FONT; c.fillText('in Hammersmith this week', 26, 112);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(380, 76, 52, 0, TAU); c.fill();
      }),
    }));
    screen.position.set(x0 - 0.3, clear + 1.75, 0); screen.rotation.y = WEST; f.add(screen);

    // the lobby (first minute of the tour): polished red granite walls, white ceiling with downlights,
    // a pink poster by the doors and the flower stall on the way to the station gates
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w + 3.5, gap * 2).rotateX(-Math.PI / 2), std(0xd9cfb8, { roughness: 0.25 })); floor.position.set(cx + 1.2, 0.03, 0); floor.receiveShadow = true; f.add(floor);
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(w, gap * 2).rotateX(Math.PI / 2), mats.white); lid.position.set(cx, clear - 0.02, 0); f.add(lid);
    const doormat = entranceMat(gap * 2 - 1.0, 2.6); doormat.position.set(x0 + 2.0, 0.036, 0); doormat.rotation.y = -Math.PI / 2; f.add(doormat);   // just inside the doors, BROADWAY read walking in
    const spots = [];
    for (let x = x0 + 1.5; x < x1; x += 2.6) for (const z of [-2.2, 2.2]) spots.push({ x, y: clear - 0.05, z, sy: 0.3 });
    inst(f, new THREE.SphereGeometry(0.16, 10, 6), mats.warm, spots, { shadow: false });
    // left wall entering: Wahaca (yellow glazed tiles) then Pure. (royal blue fascia, timber counter); right wall stays granite
    box(f, w, clear, 0.14, redGranite, cx, clear / 2, gap - 0.07).castShadow = false;
    const tileMat = new THREE.MeshStandardMaterial({ roughness: 0.15, map: canvasTex(128, 128, (c) => { c.fillStyle = '#f7c81e'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#d9a90a'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, 128); c.moveTo(0, i * 32); c.lineTo(128, i * 32); c.stroke(); } }) });
    tileMat.map.wrapS = tileMat.map.wrapT = THREE.RepeatWrapping; tileMat.map.repeat.set(1 / 1.2, 1 / 1.2);
    box(f, 8.2, clear, 0.16, tileMat, x0 + 4.1, clear / 2, -gap + 0.08).castShadow = false;
    box(f, w - 8.2, clear, 0.16, std(0xf2efe8), x0 + 8.2 + (w - 8.2) / 2, clear / 2, -gap + 0.08).castShadow = false;
    const shopfront = (text, bg, fg, at, wd, lit) => {
      const fa = sign(text, { w: wd - 0.4, h: 0.8, bg, fg, size: 0.62 }); fa.position.set(at, 3.6, -gap + 0.18); f.add(fa);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(wd - 1.2, 2.6), new THREE.MeshBasicMaterial({ color: lit, toneMapped: false })); win.position.set(at, 1.55, -gap + 0.17); f.add(win);
    };
    shopfront('WAHACA', '#f7c81e', '#1b1b1b', x0 + 4.1, 7.6, 0xffe9a8);
    shopfront('Pure.', '#1f3fa8', '#ffffff', x0 + 8.2 + (w - 8.2) / 2, w - 8.8, 0xffd9a8);
    box(f, w - 10.4, 1.0, 0.5, std(0x9a6b42, { roughness: 0.5 }), x0 + 8.2 + (w - 8.2) / 2, 0.5, -gap + 0.5); rc(x0 + 8.2 + (w - 8.2) / 2, -gap + 0.5, w - 10.4, 0.5, { h: 1.0 });
    const poster = sign('LOOK UP  ·  LOOK OUT', { w: 4.6, h: 2.6, bg: '#e8a8c8', fg: '#1b1b1b', size: 0.2 }); poster.position.set(x0 + 3.2, 2.5, gap - 0.16); poster.rotation.y = Math.PI; f.add(poster);
    const banner = sign('HAMMERSMITH BROADWAY', { w: 7.4, h: 0.6, bg: '#1d2a44', size: 0.6 }); banner.position.set(x0 + 0.4, 4.85, 0); banner.rotation.y = WEST; f.add(banner);
    // outside: Starbucks roundel on the left wing, Wheelers of Chiswick's tiered flower stall on the right
    const sb = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshBasicMaterial({
      toneMapped: false,
      map: canvasTex(256, 256, (c) => { c.fillStyle = '#00704a'; c.beginPath(); c.arc(128, 128, 128, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 96, 0, TAU); c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 30px ' + FONT; c.fillText('STARBUCKS', 128, 122); c.font = '700 22px ' + FONT; c.fillText('COFFEE', 128, 156); }),
    }));
    sb.position.set(x0 - 0.28, 3.4, -10.9); sb.rotation.y = WEST; f.add(sb);
    // Wheelers' stall: four stepped green shelves of galvanised buckets, each with foliage and a bunch of blooms
    const stall = new THREE.Group(); stall.position.set(x0 - 2.3, 0, 10.9); stall.rotation.y = WEST; f.add(stall);
    const shelfM = paint(0x26352a, 0.6);
    for (const [y, d, z] of [[0.25, 1.5, 0], [0.75, 1.1, -0.22], [1.25, 0.65, -0.45], [1.75, 0.3, -0.62]]) box(stall, 6.4, 0.5, d, shelfM, 0, y, z);
    const buckets = [], water = [], leaves = [], blooms = [], hues = [0xe84a8a, 0xf2c230, 0xf7f3ee, 0xd43f3f, 0x9b59b6, 0xf28a30, 0x5bb8d6, 0xff7fa8], greens = [0x3f6b2b, 0x4f7d32, 0x2f5a2a];
    const stepZ = [0.54, 0.1, -0.3, -0.62], sr = rng(77);
    for (let r = 0; r < 4; r++) {
      const n = r === 3 ? 16 : 13, k0 = r === 3 ? 0.7 : 1;                                   // top shelf: a row of small pots
      for (let k = 0; k < n; k++) {
        const bx = -2.95 + k * 5.9 / (n - 1), by = 0.5 * (r + 1), bz = stepZ[r], hue = hues[(k * 3 + r * 5) % hues.length];
        buckets.push({ x: bx, y: by + 0.15 * k0, z: bz, sx: k0, sy: k0, sz: k0 }); water.push({ x: bx, y: by + 0.27 * k0, z: bz, sx: k0, sz: k0 });
        for (let j = 0; j < 4; j++) { const a = j * 1.57 + k, q = 0.07 * k0; leaves.push({ x: bx + Math.cos(a) * q, y: by + 0.4 * k0, z: bz + Math.sin(a) * q, rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35, sx: k0, sy: k0, sz: k0, c: greens[(j + k) % 3] }); }
        for (let j = 0; j < 5; j++) { const a = j * 1.256 + k * 0.7, q = (j ? 0.1 : 0) * k0, sc = (0.085 + sr() * 0.035) * k0; blooms.push({ x: bx + Math.cos(a) * q, y: by + (0.55 + (j ? sr() * 0.08 : 0.1)) * k0, z: bz + Math.sin(a) * q, sx: sc, sy: sc, sz: sc, c: j === 4 && k % 3 === 0 ? 0xf7f3ee : hue }); }
      }
    }
    inst(stall, new THREE.CylinderGeometry(0.15, 0.11, 0.3, 14, 1, true), galvanised(0xb4b9bf, 0.36), buckets);
    inst(stall, new THREE.CircleGeometry(0.14, 14).rotateX(-Math.PI / 2), std(0x1c2a22, { roughness: 0.1 }), water, { shadow: false });
    inst(stall, new THREE.ConeGeometry(0.1, 0.34, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), leaves, { shadow: false });
    inst(stall, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), blooms, { shadow: false });
    const fl = sign('Wheelers of Chiswick  ·  Flowers', { w: 5.6, h: 0.45, bg: '#2f3a2c', fg: '#f3e9c9' }); fl.position.set(0, 3.0, -0.7); stall.add(fl);
    for (const sx of [-2.9, 2.9]) box(stall, 0.05, 3.2, 0.05, shelfM, sx, 1.6, -0.74);
    rc(x0 - 2.3, 10.9, 1.6, 6.5, { h: 1.6, pad: 0.1 });
    // planters flanking the doors
    for (const z of [-gap + 0.9, gap - 0.9]) {
      box(f, 0.9, 1.0, 0.9, std(0xb9805a, { roughness: 0.8 }), x0 - 1.6, 0.5, z); rc(x0 - 1.6, z, 0.9, 0.9, { h: 1.0 });
      foliage.blob(FX + (x0 - 1.6) * ct + z * st, 1.6, FZ - (x0 - 1.6) * st + z * ct, 0.75, 0.9, 0.75);
    }
  }

  /* ---------- bus stop on Butterwick: the east side of the gyratory, on its outer pavement ---------- */
  // (It used to stand on open paving 30 m from any road, with a bus parked beside it. The buses are traffic now: cars.js.)
  function busStop() {
    // local frame: +x faces the kerb, z runs along it
    const steel = std(0xb9bfc6, { roughness: 0.3, metalness: 0.8 }), ox = 78.9, oz = -10.4, rot = Math.PI + 0.424, cr = Math.cos(rot), sr = Math.sin(rot);
    const p = new THREE.Group(); p.position.set(ox, 0, oz); p.rotation.y = rot; g.add(p);
    const world = (lx, lz) => [ox + lx * cr + lz * sr, oz - lx * sr + lz * cr];
    const solid = (lx, lz, w, d, h) => { const [x, z] = world(lx, lz); col.rect(x, z, w, d, { h, pad: 0.06, rot }); };
    // shelter: glass roof and back on a steel frame, red perch bench
    box(p, 2.0, 0.1, 7, mats.glass, 0, 2.65, 0).castShadow = false;
    box(p, 2.1, 0.12, 0.12, steel, 0, 2.58, -3.4); box(p, 2.1, 0.12, 0.12, steel, 0, 2.58, 3.4); box(p, 0.12, 0.12, 7, steel, -0.95, 2.58, 0);
    box(p, 0.06, 2.1, 6.8, mats.glass, -0.95, 1.4, 0).castShadow = false;
    inst(p, new THREE.BoxGeometry(0.1, 2.6, 0.1), steel, [-3.4, 0, 3.4].map((dz) => ({ x: -0.95, y: 1.3, z: dz })));
    box(p, 0.4, 0.08, 4.6, mats.red, -0.6, 0.6, 0); inst(p, new THREE.BoxGeometry(0.08, 0.6, 0.08), steel, [-2, 2].map((dz) => ({ x: -0.6, y: 0.3, z: dz })));
    solid(-0.95, 0, 0.2, 6.9, 2.6); solid(-0.6, 0, 0.4, 4.6, 0.62);
    { const [rx, rz] = world(0, 0); col.rect(rx, rz, 2.0, 7, { h: 2.7, thick: 0.12, rot }).perch = 'the bus shelter roof'; }   // the glass roof: up there via the seat
    // bus stop flag: roundel over route tiles, timetable case on the post
    box(p, 0.12, 3.6, 0.12, steel, 1.7, 1.8, 4.6);
    const flag = roundel(0.85, { text: 'BUS STOP' }); flag.position.set(1.7, 3.2, 4.68); p.add(flag);
    const tiles = sign('9   27   190   H91   N9', { w: 0.9, h: 0.5, bg: '#fff', fg: '#111', size: 0.34 }); tiles.position.set(1.7, 2.45, 4.68); p.add(tiles);
    box(p, 0.5, 0.75, 0.08, std(0x20242a), 1.7, 1.45, 4.66);
    solid(1.7, 4.6, 0.16, 0.16, 3.6);
    // where people wait: a row under the roof, looking out at the road
    if (ctx.napSpots) { const [bx, bz] = world(-0.6, -1.2); ctx.napSpots.push({ name: 'the bus shelter seat', x: bx, y: 0.64, z: bz, r: 1.2, heading: rot }); }
    ctx.busStop = { spots: [-2.4, -1.2, 0, 1.2, 2.4].map((lz) => world(0.45, lz)), face: Math.atan2(cr, -sr) };
  }
}
