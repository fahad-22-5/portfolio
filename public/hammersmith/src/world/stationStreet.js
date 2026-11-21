/**
 * The street in front of the station entrance, after Street View (Jul and
 * Oct 2025): Hammersmith Broadway where the A219 (Shepherd's Bush Road) and
 * the A315 meet.
 *
 * Everything is placed in the entrance's own frame: P(d, o) is the point d
 * metres straight out of the main door and o metres along the frontage
 * (positive = east, the way the traffic flows past the door).
 *
 *   - the three side roads now join the gyratory (JOIN, used by surroundings.js); west of the door the carriageway
 *     sweeps round the building's corner (radius 14 m, centre P(17, -13.5)) and runs south along o = -27.5
 *   - on the wedge between them, the white stucco corner block with its
 *     curved nose, shop fascias and roller shutters
 *   - east of Shepherd's Bush Road, the red-brick gabled building and its
 *     neighbour under scaffolding and white sheeting
 *   - west along the road, the office block with horizontal red brick bands
 *   - lane lettering (A219, A315, A4, Hammersmith Broadway) and arrows
 *   - guardrails, traffic lights, a roundel totem, no-entry signs, keep-left
 *     bollards on a refuge, cycle stands and hire bikes, plane trees
 *   - a bus at the kerb, a black cab and a white van
 */
import * as THREE from 'three';
import { TAU, FONT, canvasTex, roundel, inst, box, readableBothSides } from '../util.js';
import { MAIN_DOOR, inPoly } from './plan2024.js';
import { BLOCKS } from '../mapData.js';
import { paint, blackSteel, brushedSteel } from './finishes.js';
import { ROUTES, parkedBus } from './bus.js';
import { addContact } from './sim.js';

const D = MAIN_DOOR, T = [-D.n[1], D.n[0]];
/** d metres out of the main door, o metres along the frontage -> world [x, z]. */
export const P = (d, o) => [D.m[0] + D.n[0] * d + T[0] * o, D.m[1] + D.n[1] * d + T[1] * o];
/** Generic map blocks that a building here replaces (the white block where the stucco terrace stands). */
export const REPLACED = (B) => B[0] === 50 && B[1] === -132;
/** Where the kerb is dropped: [x, z, radius]. The bus ramp's mouth crosses the pavement east of the entrance. */
export const KERB_GAPS = [[...P(22.4, 23.5), 5.6]];
const ROAD = 31, HALF = 7.5;                   // the carriageway's centre line and half width, in front of the door
/** Where the side roads meet the gyratory: prepended to their centre lines. (Hammersmith Road is the way in from Bute Gardens.) */
export const JOIN = { 'Beadon Rd': P(38.9, -0.9), "Shepherd's Bush Rd": P(38.3, 16.4), 'King St': P(33, -22), 'Hammersmith Rd': P(12, 44) };   // King Street runs straight on into the outside of the corner

/** Facade material that tiles one bay x one storey (UVs in metres), with a matching roughness / metalness map. v starts `lift` metres up. */
function tile(bayW, storeyH, px, py, color, orm, lift = 0) {
  const map = canvasTex(px, py, color), o = canvasTex(px, py, orm); o.colorSpace = THREE.NoColorSpace;
  for (const t of [map, o]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / bayW, 1 / storeyH); t.offset.y = -lift / storeyH; t.anisotropy = 8; }
  return new THREE.MeshStandardMaterial({ map, roughnessMap: o, metalnessMap: o, roughness: 1, metalness: 1 });
}
const WALL = 'rgb(0,220,0)', GLASS = 'rgb(0,28,150)', SATIN = 'rgb(0,120,60)';
const sash = (c, x, y, w, h, frame, glass = '#27323d') => {
  c.fillStyle = frame; c.fillRect(x - 5, y - 5, w + 10, h + 10); c.fillStyle = glass; c.fillRect(x, y, w, h);
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, 'rgba(160,190,215,0.35)'); g.addColorStop(0.6, 'rgba(160,190,215,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
  c.fillStyle = frame; c.fillRect(x, y + h / 2 - 2, w, 5); c.fillRect(x + w / 2 - 1.5, y, 3, h);
};
const sashOrm = (c, x, y, w, h) => { c.fillStyle = SATIN; c.fillRect(x - 5, y - 5, w + 10, h + 10); c.fillStyle = GLASS; c.fillRect(x, y, w, h); };
const speckle = (c, w, h, n, a) => { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${i % 2 ? 0 : 255},${i % 2 ? 0 : 255},${i % 2 ? 0 : 255},${a * ((i * 37) % 10) / 10})`; c.fillRect((i * 97) % w, (i * 61) % h, 2, 2); } };

export function buildStationStreet(ctx, g, gyratory) {
  const { col, mats, foliage } = ctx;
  const black = blackSteel(), steel = brushedSteel();
  const along = Math.atan2(T[0], T[1]);                        // heading of the traffic past the door
  const facing = Math.atan2(-D.n[0], -D.n[1]);                 // heading of something that looks back at the entrance
  const lat = Math.atan2(-T[1], T[0]);                         // turns an object's own x axis to run along the frontage

  /* ---------- buildings ---------- */
  /** A block on a footprint given in the entrance frame: walls with metre UVs (u runs round the perimeter), flat roof, collision. */
  function block(pts, h, upper, ground, gh = 4.2) {
    const W = pts.map(([d, o]) => P(d, o)), n = W.length;
    let area = 0; for (let i = 0; i < n; i++) { const a = W[i], b = W[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area > 0) W.reverse();                                 // so the outward normal is on the same side all the way round
    const minX = Math.min(...W.map((p) => p[0])), maxX = Math.max(...W.map((p) => p[0])), minZ = Math.min(...W.map((p) => p[1])), maxZ = Math.max(...W.map((p) => p[1]));
    const hits = (B) => {
      const x0 = B[0] - B[2] / 2, x1 = B[0] + B[2] / 2, z0 = B[1] - B[3] / 2, z1 = B[1] + B[3] / 2;
      if (minX > x1 || maxX < x0 || minZ > z1 || maxZ < z0) return false;
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [B[0], B[1]]]) if (inPoly(x, z, W)) return true;
      for (let i = 0; i < n; i++) { const a = W[i], b = W[(i + 1) % n], m = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let k = 0; k <= m; k++) { const x = a[0] + (b[0] - a[0]) * k / m, z = a[1] + (b[1] - a[1]) * k / m; if (x > x0 && x < x1 && z > z0 && z < z1) return true; } }
      return false;
    };
    if (BLOCKS.some((B) => !REPLACED(B) && hits(B))) { console.warn('stationStreet: a new building overlaps an existing block and was left out'); return null; }
    const wall = (y0, y1, mat) => {
      const pos = [], uv = [], nor = []; let u = 0;
      for (let i = 0; i < n; i++) {
        const a = W[i], b = W[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;   // the way the triangles below face
        pos.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y0, a[1], b[0], y1, b[1], a[0], y1, a[1]);
        uv.push(u, y0, u + len, y0, u + len, y1, u, y0, u + len, y1, u, y1); for (let k = 0; k < 6; k++) nor.push(nx, 0, nz);
        u += len;
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m);
    };
    if (ground) { wall(0, gh, ground); wall(gh, h, upper); } else wall(0, h, upper);
    const s = new THREE.Shape(); W.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    const roof = new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), paint(0x5c6068, 0.9)); roof.position.y = h; g.add(roof);
    col.add({ minX, maxX, minZ, maxZ, h, test: (x, z) => inPoly(x, z, W) });
    return W;
  }
  // white-painted Victorian stucco: one sash window a bay, hood mould over it, a string course at each floor
  const stucco = tile(3.2, 3.4, 256, 272, (c) => {
    c.fillStyle = '#eeebe3'; c.fillRect(0, 0, 256, 272); speckle(c, 256, 272, 500, 0.05);
    c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(64, 40, 128, 8); c.fillStyle = '#f8f6f0'; c.fillRect(60, 30, 136, 12);
    sash(c, 80, 56, 96, 150, '#fbfaf6'); c.fillStyle = '#f8f6f0'; c.fillRect(66, 212, 124, 10); c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(66, 222, 124, 5);
    c.fillStyle = '#f8f6f0'; c.fillRect(0, 256, 256, 12); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 268, 256, 4);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 256, 272); sashOrm(c, 80, 56, 96, 150); }, 4.2);
  // shopfronts, three to a 15 m tile: red fascia over a roller shutter, a dark glazed front, a cream fascia over a shutter
  const shops = tile(15, 4.2, 960, 270, (c) => {
    c.fillStyle = '#e9e6de'; c.fillRect(0, 0, 960, 270);
    [['#c8102e', 'shutter'], ['#1f2328', 'glass'], ['#e6dcc3', 'shutter']].forEach(([fa, kind], i) => {
      const x = i * 320; c.fillStyle = fa; c.fillRect(x + 14, 8, 292, 52); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 14, 60, 292, 5);
      if (kind === 'shutter') { c.fillStyle = '#9da2a8'; c.fillRect(x + 22, 66, 276, 190); c.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 70; y < 256; y += 7) c.fillRect(x + 22, y, 276, 2); c.fillStyle = '#6f747a'; c.fillRect(x + 22, 248, 276, 8); }
      else { c.fillStyle = '#1c2530'; c.fillRect(x + 22, 66, 276, 174); const gr = c.createLinearGradient(x, 66, x + 300, 240); gr.addColorStop(0, 'rgba(150,180,205,0.4)'); gr.addColorStop(0.5, 'rgba(150,180,205,0)'); c.fillStyle = gr; c.fillRect(x + 22, 66, 276, 174); c.fillStyle = '#2b2f35'; c.fillRect(x + 196, 66, 5, 190); c.fillRect(x + 22, 240, 276, 16); c.fillRect(x + 22, 96, 276, 4); }
      c.fillStyle = '#d9d5cc'; c.fillRect(x, 0, 12, 270); c.fillRect(x + 308, 0, 12, 270);
    });
    c.fillStyle = '#55595f'; c.fillRect(0, 258, 960, 12);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 960, 270); c.fillStyle = SATIN; for (const i of [0, 2]) c.fillRect(i * 320 + 22, 66, 276, 190); c.fillStyle = GLASS; c.fillRect(320 + 22, 66, 276, 174); });
  // red brick with stone-dressed sash windows
  const brick = tile(3, 3.3, 256, 280, (c) => {
    c.fillStyle = '#96493a'; c.fillRect(0, 0, 256, 280);
    for (let r = 0; r < 40; r++) for (let k = -1; k < 9; k++) { const x = k * 32 + (r % 2 ? 16 : 0), y = r * 7; c.fillStyle = `rgba(${r * k % 2 ? 60 : 255},${r * k % 2 ? 30 : 200},${r * k % 2 ? 20 : 170},${0.06 + ((r * 7 + k * 13) % 9) * 0.012})`; c.fillRect(x, y, 30, 6); }
    c.fillStyle = 'rgba(225,215,200,0.5)'; for (let r = 0; r < 40; r++) c.fillRect(0, r * 7 + 6, 256, 1);
    c.fillStyle = '#e9e2d2'; c.fillRect(70, 44, 116, 14); sash(c, 82, 62, 92, 150, '#f4f1e8'); c.fillStyle = '#e9e2d2'; c.fillRect(70, 218, 116, 10);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 256, 280); sashOrm(c, 82, 62, 92, 150); }, 0);
  // scaffolding wrapped in white sheeting
  const sheet = tile(2.4, 2, 192, 160, (c) => {
    c.fillStyle = '#f1f1ee'; c.fillRect(0, 0, 192, 160); const gr = c.createLinearGradient(0, 0, 192, 0); gr.addColorStop(0, 'rgba(0,0,0,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.07)'); c.fillStyle = gr; c.fillRect(0, 0, 192, 160);
    c.fillStyle = 'rgba(95,105,115,0.55)'; c.fillRect(0, 0, 5, 160); c.fillRect(0, 150, 192, 5); c.fillStyle = 'rgba(95,105,115,0.3)'; c.fillRect(0, 70, 192, 3);
  }, (c) => { c.fillStyle = 'rgb(0,235,0)'; c.fillRect(0, 0, 192, 160); }, 3);
  // office block: a band of red brick and a ribbon of glazing on every floor
  const bands = tile(6, 3.6, 384, 230, (c) => {
    c.fillStyle = '#a3452f'; c.fillRect(0, 122, 384, 108); c.fillStyle = 'rgba(230,215,200,0.35)'; for (let y = 124; y < 230; y += 7) c.fillRect(0, y, 384, 1);
    const gr = c.createLinearGradient(0, 0, 0, 122); gr.addColorStop(0, '#5f7f99'); gr.addColorStop(1, '#22313f'); c.fillStyle = gr; c.fillRect(0, 0, 384, 122);
    c.fillStyle = '#c7ccd1'; for (let x = 0; x < 384; x += 96) c.fillRect(x, 0, 5, 122); c.fillRect(0, 0, 384, 4); c.fillRect(0, 118, 384, 5);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 122, 384, 108); c.fillStyle = GLASS; c.fillRect(0, 0, 384, 122); }, 0);

  // the corner block on the wedge between Beadon Road and Shepherd's Bush Road: its edges follow the two kerbs
  const L = (d) => 42.37 - 0.83 * d, R = (d) => -6.67 + 0.33 * d, nose = [];
  for (let k = 0; k <= 6; k++) { const a = Math.PI * k / 6; nose.push([46.6 - Math.sin(a) * 2.5, 6.2 - Math.cos(a) * 2.5]); }
  block([...nose, [70, R(70)], [70, L(70)]], 15, stucco, shops);
  // cornice and chimney stacks, so the roofline reads at a distance
  { const [x, z] = P(57, 2.5); box(g, 15, 1.3, 1.1, paint(0x9a4a3a, 0.9), x, 15.6, z, lat).castShadow = true; }
  // North side of the A315 east of Shepherd's Bush Road (Street View, Oct 2025): the building under scaffolding and white
  // sheeting faces "one"; then the ornate white building with the shaped gable; then the long white terrace under a
  // red-tiled mansard, which runs on to the white neighbour of B&K Newsagent.
  const ornate = tile(3.2, 3.6, 256, 288, (c) => {
    c.fillStyle = '#f2efe8'; c.fillRect(0, 0, 256, 288); speckle(c, 256, 288, 500, 0.04);
    c.fillStyle = '#e4e0d6'; c.fillRect(0, 0, 22, 288); c.fillRect(234, 0, 22, 288);                                   // pilasters
    c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, 256, 14); c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(0, 14, 256, 5);  // cornice
    const arch = (x0, x1, top, r, bottom) => { c.beginPath(); c.moveTo(x0, bottom); c.lineTo(x0, top); c.arc((x0 + x1) / 2, top, r, Math.PI, 0); c.lineTo(x1, bottom); c.closePath(); c.fill(); };
    c.fillStyle = '#fbfaf6'; arch(70, 186, 110, 58, 252); c.fillStyle = '#27323d'; arch(80, 176, 110, 48, 244);
    c.fillStyle = '#fbfaf6'; c.fillRect(126, 62, 4, 182); c.fillRect(80, 150, 96, 4); c.fillRect(80, 108, 96, 4);
    c.fillStyle = '#dedad0'; c.fillRect(118, 42, 20, 24); c.fillStyle = '#fbfaf6'; c.fillRect(62, 250, 132, 10);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 256, 288); c.fillStyle = GLASS; c.beginPath(); c.moveTo(80, 244); c.lineTo(80, 110); c.arc(128, 110, 48, Math.PI, 0); c.lineTo(176, 244); c.closePath(); c.fill(); }, 4.2);
  // cafe and shop fronts under dark awnings, three to a 12 m tile
  const cafes = tile(12, 4.2, 768, 270, (c) => {
    c.fillStyle = '#e9e6de'; c.fillRect(0, 0, 768, 270);
    ['#1f3b2c', '#17181b', '#e8dfc8'].forEach((fa, i) => {
      const x = i * 256; c.fillStyle = fa; c.fillRect(x + 10, 8, 236, 46);
      c.fillStyle = '#1c2530'; c.fillRect(x + 18, 60, 220, 182); const gr = c.createLinearGradient(x, 60, x + 240, 242); gr.addColorStop(0, 'rgba(150,180,205,0.4)'); gr.addColorStop(0.5, 'rgba(150,180,205,0)'); c.fillStyle = gr; c.fillRect(x + 18, 60, 220, 182);
      c.fillStyle = 'rgba(255,214,150,0.16)'; c.fillRect(x + 18, 150, 220, 92);                                         // lit interior low down
      c.fillStyle = '#2b2f35'; c.fillRect(x + 150, 60, 5, 198); c.fillRect(x + 18, 242, 220, 16);
      if (i < 2) { c.fillStyle = '#15161a'; c.fillRect(x + 12, 54, 232, 30); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 12, 84, 232, 8); }   // awning
      c.fillStyle = '#d9d5cc'; c.fillRect(x, 0, 8, 270); c.fillRect(x + 248, 0, 8, 270);
    });
    c.fillStyle = '#55595f'; c.fillRect(0, 258, 768, 12);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 768, 270); c.fillStyle = GLASS; for (let i = 0; i < 3; i++) c.fillRect(i * 256 + 18, 92, 220, 150); });
  // the shops under the scaffolding: the dental practice, a coffee shop, then site hoarding
  const dental = tile(16, 4.2, 1024, 270, (c) => {
    c.fillStyle = '#d9d9d6'; c.fillRect(0, 0, 1024, 270);
    c.fillStyle = '#1d5fa8'; c.fillRect(8, 10, 304, 50); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 34px ${FONT}`; c.fillText('DENTAL CARE', 160, 37);
    c.fillStyle = '#c96a1d'; c.fillRect(328, 10, 240, 50); c.fillStyle = '#fff'; c.font = `700 30px ${FONT}`; c.fillText('COFFEE', 448, 37);
    for (const [x, w] of [[16, 288], [336, 224]]) { c.fillStyle = '#1c2530'; c.fillRect(x, 66, w, 176); c.fillStyle = 'rgba(150,180,205,0.25)'; c.fillRect(x, 66, w * 0.45, 176); c.fillStyle = '#2b2f35'; c.fillRect(x + w * 0.62, 66, 5, 192); c.fillRect(x, 242, w, 16); }
    c.fillStyle = '#1f4f9c'; c.fillRect(584, 30, 432, 228); c.fillStyle = 'rgba(255,255,255,0.14)'; for (let x = 584; x < 1016; x += 54) c.fillRect(x, 30, 2, 228);   // hoarding
    c.fillStyle = '#8a9099'; for (let x = 0; x < 1024; x += 146) c.fillRect(x, 0, 6, 270);                              // scaffold standards in front
    c.fillStyle = '#55595f'; c.fillRect(0, 258, 1024, 12);
  }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 1024, 270); c.fillStyle = GLASS; c.fillRect(16, 66, 288, 176); c.fillRect(336, 66, 224, 176); });
  const whiteTrim = paint(0xf2efe8, 0.8), redTile = paint(0xa8482f, 0.85), stack = paint(0x8f5a45, 0.9);
  const wrapped = block([[43, 29.5], [38.5, 33], [35.5, 36.5], [34, 38.5], [34, 43], [47, 43], [47, 29.5]], 17, sheet, dental, 4.2);   // set back from Shepherd's Bush Road and cut back at the corner, so the pavement round it is a good 2.5 m
  if (wrapped) {                                               // scaffold standards and ledgers standing off the sheeting
    const tubes = [];
    for (let o = 38.6; o <= 43.01; o += 2.2) { const [x, z] = P(33.55, o); tubes.push({ x, y: 8.5, z, sy: 17 }); }
    for (const [d, o] of [[34.9, 37.0], [37.0, 34.6], [39.6, 31.8], [42.5, 29.2]]) { const [x, z] = P(d, o); tubes.push({ x, y: 8.5, z, sy: 17 }); }   // along the cut corner
    for (let y = 4.6; y < 17; y += 2) { const [x, z] = P(33.55, 40.8); tubes.push({ x, y, z, sy: 4.6, rz: Math.PI / 2, ry: lat }); }
    inst(g, new THREE.CylinderGeometry(0.03, 0.03, 1, 6), paint(0x8a9099, 0.4), tubes, { shadow: false });
  }
  const gabled = block([[34, 45], [34, 60], [46, 60], [46, 45]], 15, ornate, cafes);
  if (gabled) {                                                // the shaped gable over its street front, with finials and a round window
    const sh = new THREE.Shape([[-5.5, 0], [5.5, 0], [5.5, 1.0], [3.6, 1.3], [2.6, 3.2], [1.2, 3.6], [0, 4.8], [-1.2, 3.6], [-2.6, 3.2], [-3.6, 1.3], [-5.5, 1.0]].map(([x, y]) => new THREE.Vector2(x, y)));
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }), whiteTrim), [x, z] = P(34.3, 52.5);
    ped.position.set(x, 15, z); ped.rotation.y = facing; ped.castShadow = true; g.add(ped);
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), paint(0x27323d, 0.2)); eye.position.set(0, 2.1, -0.02); eye.rotation.y = Math.PI; ped.add(eye);
    for (const [fx, fy] of [[-5.2, 1.5], [5.2, 1.5], [0, 5.3]]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 8), whiteTrim); f.position.set(fx, fy, 0.25); ped.add(f); }
    const [cx, cz] = P(34.0, 52.5); box(g, 15.3, 0.45, 0.6, whiteTrim, cx, 15.1, cz, lat);                       // cornice under it
  }
  const terrace = block([[33, 62], [33, 104], [44, 104], [44, 62]], 14.4, stucco, cafes);
  if (terrace) {                                               // red-tiled mansard with white dormers, brick stacks on the ridge
    const prism = new THREE.Shape([[-5.5, 0], [5.5, 0], [4.3, 2.6], [-4.3, 2.6]].map(([x, y]) => new THREE.Vector2(x, y)));
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(prism, { depth: 42, bevelEnabled: false }), redTile), [x, z] = P(38.5, 62);
    roof.position.set(x, 14.4, z); roof.rotation.y = along; roof.castShadow = true; g.add(roof);
    const dormers = [], panes = [], stacks = [];
    for (let o = 63.6; o < 104; o += 3.2) { const [dx, dz] = P(33.75, o), [px, pz] = P(33.22, o); dormers.push({ x: dx, y: 15.65, z: dz, ry: lat }); panes.push({ x: px, y: 15.65, z: pz, ry: lat }); }
    for (const o of [66, 78.5, 91, 101.5]) { const [sx, sz] = P(38.5, o); stacks.push({ x: sx, y: 18.3, z: sz, ry: lat }); }
    inst(g, new THREE.BoxGeometry(1.3, 1.5, 1.0), whiteTrim, dormers); inst(g, new THREE.BoxGeometry(0.9, 1.0, 0.06), paint(0x27323d, 0.15), panes, { shadow: false });
    inst(g, new THREE.BoxGeometry(1.7, 2.8, 0.9), stack, stacks);
    const [cx, cz] = P(32.9, 83); box(g, 42.2, 0.4, 0.5, whiteTrim, cx, 14.4, cz, lat);                          // eaves cornice
  }
  // looking west from the gate: the red-banded office stands left of the trees, south of the mouth of King Street,
  // and a stucco terrace closes the view on the street's north side
  block([[9, -78], [9, -50], [30, -50], [30, -78]], 22, bands, null);
  block([[54, -76], [54, -54], [70, -54], [70, -76]], 14, stucco, shops);

  /* ---------- lettering and arrows on the carriageway ---------- */
  const paintMat = (w, h, draw) => new THREE.MeshStandardMaterial({ map: canvasTex(w, h, (c) => { c.clearRect(0, 0, w, h); c.fillStyle = '#f2f2ee'; c.strokeStyle = '#f2f2ee'; draw(c); }), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  /** Road paint at (d, o), `across` wide and `ahead` long, read by a driver travelling with the traffic. */
  const marking = (d, o, across, ahead, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(across, ahead).rotateX(-Math.PI / 2), mat), [x, z] = P(d, o); m.position.set(x, 0.045, z); m.rotation.y = Math.atan2(-T[0], -T[1]); m.receiveShadow = true; g.add(m); };
  const word = (text, size = 200) => paintMat(512, 256, (c) => { c.font = `800 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 138); });
  const arrow = (bend) => paintMat(128, 256, (c) => { c.lineWidth = 26; c.lineCap = 'butt'; c.beginPath(); c.moveTo(64, 250); c.lineTo(64, 110); if (bend) c.lineTo(34, 70); c.stroke(); c.beginPath(); if (bend) { c.moveTo(4, 90); c.lineTo(14, 20); c.lineTo(72, 62); } else { c.moveTo(20, 112); c.lineTo(64, 14); c.lineTo(108, 112); } c.closePath(); c.fill(); });
  const left = ROAD + 3.2, right = ROAD - 3.2;                 // the two lanes: the driver's left is the far side from the station
  marking(left, -6, 2.6, 4.2, word('A219')); marking(right, -6, 2.6, 4.2, word('A315')); marking(right, 1, 1.8, 4.2, word('A4'));
  marking(left, 2, 1.1, 4.4, arrow(true)); marking(right, 8, 1.1, 4.4, arrow(false));
  { // "Hammersmith Broadway", written lengthwise between the lanes
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.0).rotateX(-Math.PI / 2), paintMat(1024, 96, (c) => { c.font = `700 80px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Hammersmith Broadway', 512, 52); })), [x, z] = P(ROAD + 0.95, -8.5);
    m.position.set(x, 0.045, z); m.rotation.y = lat; g.add(m);
  }

  /* ---------- street furniture ---------- */
  const posts = [], rails = [], lightPoles = [], heads = [], signPoles = [];
  // guardrail along the near kerb east of the crossing; the bus stand to the west has none
  for (const [a, b] of [[11.5, 18.2]]) {                                // stops short of the bus ramp's mouth
    for (let o = a; o <= b + 0.01; o += 1.8) { const [x, z] = P(ROAD - HALF - 0.45, o); posts.push({ x, y: 0.55, z }); }
    const [x, z] = P(ROAD - HALF - 0.45, (a + b) / 2); for (const y of [0.55, 1.05]) rails.push({ x, y, z, sz: b - a, ry: along });
    col.rect(x, z, 0.1, b - a, { rot: along, h: 1.1, pad: 0.05 });
  }
  inst(g, new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8), steel, posts); inst(g, new THREE.BoxGeometry(0.05, 0.05, 1), steel, rails);
  // signal-controlled crossing in front of the corner block: a pole each side of each kerb, red showing to the traffic
  for (const d of [ROAD - HALF - 0.5, ROAD + HALF + 0.5]) for (const o of [5.0, 9.6]) {
    const [x, z] = P(d, o); lightPoles.push({ x, y: 1.75, z }); heads.push({ x, y: 3.0, z, ry: along });
    (ctx.signalHeads || (ctx.signalHeads = [])).push({ site: 'front', x: x - T[0] * 0.14, y: 3.3, z: z - T[1] * 0.14 });   // lamps are lit by the traffic system (cars.js)
    col.rect(x, z, 0.14, 0.14, { h: 3.4, pad: 0.04 });
  }
  inst(g, new THREE.CylinderGeometry(0.055, 0.055, 3.5, 10), paint(0x2a2d31, 0.5), lightPoles);
  inst(g, new THREE.BoxGeometry(0.34, 1.0, 0.26), black, heads);
  // Underground roundel on a post by the kerb
  { const [x, z] = P(22.4, 6.2); signPoles.push({ x, y: 2.2, z }); const r = roundel(1.3); r.position.set(x, 4.3, z); r.rotation.y = along; g.add(r); col.rect(x, z, 0.14, 0.14, { h: 4.4, pad: 0.04 }); }
  // no-entry signs at the mouths of the two side roads
  const noEntry = readableBothSides(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, toneMapped: false, map: canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); c.fillStyle = '#d6202a'; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(18, 52, 92, 24); }) }));
  for (const [d, o] of [[40.6, -8.6], [40.4, 25.6]]) { const [x, z] = P(d, o); signPoles.push({ x, y: 1.5, z, sy: 0.7 }); const m = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), noEntry); m.position.set(x, 2.5, z); m.rotation.y = facing; g.add(m); }
  inst(g, new THREE.CylinderGeometry(0.04, 0.04, 4.3, 8), paint(0x8a9099, 0.4), signPoles);
  // a refuge in the middle of the crossing, with a keep-left bollard at each end
  {
    const [x, z] = P(ROAD, 7.3); box(g, 1.5, 0.14, 5.6, mats.granite, x, 0.1, z, along); col.rect(x, z, 1.5, 5.6, { rot: along, h: 0.17 });
    const keep = new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTex(64, 128, (c) => { c.fillStyle = '#f2c230'; c.fillRect(0, 0, 64, 128); c.fillStyle = '#111'; c.fillRect(0, 84, 64, 20); c.fillStyle = '#1f4f9c'; c.beginPath(); c.arc(32, 40, 22, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.moveTo(42, 30); c.lineTo(24, 48); c.moveTo(24, 48); c.lineTo(24, 34); c.moveTo(24, 48); c.lineTo(38, 48); c.stroke(); }) });
    keep.map.wrapS = keep.map.wrapT = THREE.RepeatWrapping; keep.map.repeat.set(1 / 0.3, 1 / 1.0);
    for (const s of [-1, 1]) { const [bx, bz] = P(ROAD, 7.3 + s * 2.35); box(g, 0.3, 1.0, 0.22, keep, bx, 0.67, bz, along); col.rect(bx, bz, 0.3, 0.22, { rot: along, h: 1.2, pad: 0.05 }); }
  }
  // cycle stands on the pavement, with hire bikes in them; more left on the far pavement
  const stands = [], wheels = [], frames = [];
  const bike = (d, o, ry, colour, lean = 0.1) => {
    const [x, z] = P(d, o), m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationZ(lean)).setPosition(x, 0.03, z);
    const part = (list, px, py, pz, rx, sx, sy, sz, c) => { const q = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0))); const v = new THREE.Vector3(px, py, pz).applyMatrix4(m); list.push({ x: v.x, y: v.y, z: v.z, q, sx, sy, sz, c }); };
    part(wheels, 0, 0.34, 0.52, 0, 1, 1, 1); part(wheels, 0, 0.34, -0.52, 0, 1, 1, 1);
    part(frames, 0, 0.62, 0.02, 0.5, 0.05, 0.05, 0.9, colour); part(frames, 0, 0.5, -0.24, -0.95, 0.05, 0.05, 0.62, colour); part(frames, 0, 0.72, -0.22, 0, 0.04, 0.5, 0.04, colour);
    part(frames, 0, 0.98, -0.24, 0, 0.14, 0.05, 0.26, 0x1b1b1d); part(frames, 0, 0.72, 0.42, -0.3, 0.04, 0.72, 0.04, colour); part(frames, 0, 1.06, 0.34, 0, 0.5, 0.04, 0.04, 0x1b1b1d);
    part(frames, 0, 0.62, 0.02, 0, 0.3, 0.22, 0.34, colour);
    addContact(x, z, 0.5, 0.9, ry);
  };
  for (let i = 0; i < 5; i++) { const o = -13.2 + i * 1.05, [x, z] = P(21.2, o); stands.push({ x, y: 0.4, z, ry: along + Math.PI / 2 }); col.rect(x, z, 0.08, 0.8, { rot: along + Math.PI / 2, h: 0.8, pad: 0.04 }); if (i !== 2) bike(21.2, o + 0.22, along + Math.PI / 2, [0x8fd400, 0xe2231a, 0x8fd400, 0x1a8f5a, 0xe2231a][i]); }
  for (let i = 0; i < 4; i++) { const o = 9.9 + i * 1.05, [x, z] = P(20.6, o); stands.push({ x, y: 0.4, z, ry: along + Math.PI / 2 }); col.rect(x, z, 0.08, 0.8, { rot: along + Math.PI / 2, h: 0.8, pad: 0.04 }); if (i % 2 === 0) bike(20.6, o + 0.22, along + Math.PI / 2, [0x22262b, 0x1f4f9c][i >> 1], -0.1); }   // the racks in front of "one"
  for (let i = 0; i < 6; i++) bike(49.5 + i * 1.0, R(49.5 + i * 1.0) + 1.3, facing + 1.25 + (i % 3) * 0.08, [0x8fd400, 0x8fd400, 0x1a8f5a, 0x8fd400, 0xe2231a, 0x8fd400][i], 0.14);
  inst(g, new THREE.TorusGeometry(0.4, 0.025, 6, 20, Math.PI).rotateY(Math.PI / 2), steel, stands);
  inst(g, new THREE.TorusGeometry(0.33, 0.03, 6, 20).rotateY(Math.PI / 2), paint(0x141416, 0.8), wheels);
  inst(g, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), frames);
  // mature plane trees on the pavements
  for (const [d, o, k] of [[20.6, -5.6, 1.5], [21.8, 16.8, 1.45], [41.4, 7.2, 1.6], [26, -38, 1.5], [47, -40, 1.35], [10, -42, 1.4], [27.5, 70, 1.0], [28.5, 84, 1.05], [29.5, 98, 1.0], [19.4, 12.4, 0.75]]) { const [x, z] = P(d, o); foliage.tree(x, z, k); col.rect(x, z, 0.5, 0.5, { h: 3, pad: 0.05 }); }

  /* ---------- the east wing of the stone block: the bus ramp goes up through an arch in its base ---------- */
  {
    // The wing stops short of the gyratory's kerb at its east end, leaving a pavement round the corner (the kerb curves in to 12 m out by o = 31).
    const O0 = 15.2, O1 = 28.4, DF = 13, DB = 5, len = O1 - O0, dep = DF - DB, base = 7, top = 27.3, mid = (O0 + O1) / 2, dm = (DF + DB) / 2, AW = 4.5, AS = 3.3, AR = 1.9, AM = 23.1, ao = AM - mid;   // arch: half width, springing, rise; AM its centre
    const bandStone = tile(2, 1.2, 128, 96, (c) => { c.fillStyle = '#cdb690'; c.fillRect(0, 0, 128, 96); speckle(c, 128, 96, 260, 0.06); c.fillStyle = 'rgba(70,50,20,0.35)'; c.fillRect(0, 0, 128, 3); c.fillRect(0, 48, 128, 3); c.fillRect(0, 0, 2, 48); c.fillRect(64, 48, 2, 48); }, (c) => { c.fillStyle = 'rgb(0,215,0)'; c.fillRect(0, 0, 128, 96); });
    // cream stone above, with the two-storey window groups in blue-grey frames
    const oneStone = tile(4, 7, 256, 448, (c) => {
      c.fillStyle = '#e8dfc8'; c.fillRect(0, 0, 256, 448); speckle(c, 256, 448, 700, 0.05);
      c.fillStyle = 'rgba(90,70,40,0.25)'; c.fillRect(0, 444, 256, 4); c.fillRect(0, 0, 2, 448);
      c.fillStyle = '#8f9aa6'; c.fillRect(34, 44, 188, 372);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) { const x = 42 + k * 90, y = 52 + r * 92 + (r > 1 ? 4 : 0), gr = c.createLinearGradient(0, y, 0, y + 78); gr.addColorStop(0, '#5d7a96'); gr.addColorStop(1, '#2c3d52'); c.fillStyle = gr; c.fillRect(x, y, 82, 78); }
      c.fillStyle = '#b3bcc4'; c.fillRect(34, 222, 188, 18);
    }, (c) => { c.fillStyle = WALL; c.fillRect(0, 0, 256, 448); c.fillStyle = SATIN; c.fillRect(34, 44, 188, 372); c.fillStyle = GLASS; for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) c.fillRect(42 + k * 90, 52 + r * 92 + (r > 1 ? 4 : 0), 82, 78); }, 0);
    const dark = paint(0x16171a, 1), trim = paint(0xd9cdb3, 0.7);
    const s = new THREE.Shape(); s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(len / 2, base); s.lineTo(-len / 2, base); s.closePath();
    const rad = (AW * AW + AR * AR) / (2 * AR), cy = AS + AR - rad, hole = new THREE.Path();
    hole.moveTo(ao - AW, 0); hole.lineTo(ao - AW, AS); hole.absarc(ao, cy, rad, Math.atan2(AS - cy, -AW), Math.atan2(AS - cy, AW), true); hole.lineTo(ao + AW, 0); hole.closePath(); s.holes.push(hole);
    const lower = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: false, curveSegments: 16 }), [bandStone, dark]);   // caps in stone; the tunnel's lining dark
    { const [x, z] = P(DF, mid); lower.position.set(x, 0, z); lower.rotation.y = facing; lower.castShadow = lower.receiveShadow = true; lower.userData.dynamic = true; g.add(lower); }
    const put = (w, h, d, mat, dd, o, y) => { const [x, z] = P(dd, o); return box(g, w, h, d, mat, x, y, z, lat); };   // w along the frontage, d across it
    put(0.08, base, dep, bandStone, dm, O1 + 0.03, base / 2);                                    // the wing's end wall, in stone
    put(AW * 2 + 0.4, AS + AR + 0.2, 0.1, dark, DB + 0.12, AM, (AS + AR) / 2);                  // the dark at the back of the tunnel
    put(len, top - base, dep, oneStone, dm, mid, (top + base) / 2);
    put(len + 0.3, 0.35, dep + 0.3, trim, dm, mid, base);
    put(len + 0.4, 0.3, dep + 0.4, mats.concreteDark, dm, mid, top + 0.15);
    for (const o of [O0 + 0.8, O0 + 6.2]) { for (const dd of [DF - 0.5, DB + 0.5]) put(0.35, 3.0, 0.35, trim, dd, o, top + 1.8); put(0.3, 0.3, dep - 0.6, trim, dm, o, top + 3.4); }   // open frames on the roof
    for (const dd of [DF - 0.5, DB + 0.5]) put(5.75, 0.25, 0.25, trim, dd, O0 + 3.5, top + 3.4);
    col.rect(...P(dm, mid), dep, len, { rot: along, h: top });                                    // buses only: the cat stays out
    // the ramp's apron across the pavement, the ramp itself rising into the dark, and double yellow lines round the mouth
    put(AW * 2 - 0.3, 0.05, 22.6 - DF, mats.asphalt, (22.6 + DF) / 2, AM, 0.03).castShadow = false;
    { const L = Math.hypot(dep, 0.9), ramp = new THREE.Mesh(new THREE.PlaneGeometry(AW * 2 - 0.1, L).rotateX(-Math.PI / 2), mats.asphalt), [x, z] = P(dm, AM);
      ramp.rotation.order = 'YXZ'; ramp.rotation.y = lat; ramp.rotation.x = -Math.atan2(0.9, dep); ramp.position.set(x, 0.5, z); ramp.receiveShadow = true; g.add(ramp); }
    const yellow = paint(0xe2b21e, 0.7);
    for (const sgn of [-1, 1]) for (const off of [0.2, 0.42]) put(0.1, 0.012, 22.2 - DF, yellow, (22.2 + DF) / 2, AM + sgn * (AW + off), 0.05).castShadow = false;
    // LOOK RIGHT / LOOK LEFT where the pavement crosses the mouth, read by someone about to step off
    const look = (text, o, flip) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.62).rotateX(-Math.PI / 2), paintMat(512, 122, (c) => { c.font = `800 78px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 66); })), [x, z] = P(18.6, o); m.position.set(x, 0.062, z); m.rotation.y = Math.atan2(-T[0], -T[1]) + Math.PI / 2 + (flip ? Math.PI : 0); g.add(m); };
    look('LOOK RIGHT', AM - AW + 0.75, false); look('LOOK LEFT', AM + AW - 0.75, true);
    // signs, as you face the arch: two no-entry plates on the left (east) pier, give way and 10 mph on the right; a black guardrail beyond
    const disc = (draw, r, dd, o, y) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), readableBothSides(new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.5, toneMapped: false, map: canvasTex(128, 128, (c) => { c.clearRect(0, 0, 128, 128); draw(c); }) }))), [x, z] = P(dd, o); m.position.set(x, y, z); m.rotation.y = facing + Math.PI; g.add(m); };
    const stop = (c) => { c.fillStyle = '#d6202a'; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(18, 52, 92, 24); };
    disc(stop, 0.34, DF + 0.5, AM + AW + 0.45, 2.6); disc(stop, 0.34, DF + 0.5, AM + AW + 0.45, 1.75);
    disc((c) => { c.fillStyle = '#d6202a'; c.beginPath(); c.arc(64, 64, 62, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 46, 0, TAU); c.fill(); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 58px ${FONT}`; c.fillText('10', 64, 68); }, 0.3, DF + 0.5, AM - AW - 1.0, 2.75);
    disc((c) => { c.fillStyle = '#d6202a'; c.beginPath(); c.moveTo(4, 12); c.lineTo(124, 12); c.lineTo(64, 120); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(26, 26); c.lineTo(102, 26); c.lineTo(64, 94); c.closePath(); c.fill(); }, 0.42, DF + 0.5, AM - AW - 1.0, 1.95);
    const poles = [AM - AW - 1.0, AM + AW + 0.45].map((o) => { const [x, z] = P(DF + 0.56, o); return { x, y: 1.5, z }; });
    inst(g, new THREE.CylinderGeometry(0.04, 0.04, 3.0, 8), paint(0x8a9099, 0.4), poles);
    const bars = []; {                                                                       // along the kerb past the wing's corner, keeping people off the road
      const a = P(13.0, 30.9), b = P(9.6, 34.0), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, L = Math.hypot(b[0] - a[0], b[1] - a[1]), dirx = (b[0] - a[0]) / L, dirz = (b[1] - a[1]) / L, ry = Math.atan2(-dirz, dirx);   // past the corner, so the way round it stays open
      for (const y of [0.18, 1.08]) box(g, L, 0.05, 0.05, black, x, y, z, ry);
      for (let k = 0; k <= 14; k++) bars.push({ x: a[0] + dirx * L * k / 14, y: 0.63, z: a[1] + dirz * L * k / 14 });
      col.rect(x, z, L, 0.1, { rot: -ry, h: 1.1, pad: 0.05 });
    }
    inst(g, new THREE.BoxGeometry(0.03, 0.9, 0.03), black, bars, { shadow: false });
  }

  /* ---------- Hammersmith Road: cycle lane on the north side, the island and the one-way sign at Bute Gardens ---------- */
  {
    const line = [P(12, 44), P(18.5, 111), [180, -99.2]], dashes = [], syms = [], wands = [];
    let run = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, ry = Math.atan2(ux, uz);
      let nx = uz, nz = -ux; if (nz > 0) { nx = -nx; nz = -nz; }                                    // the side of the road that is north
      for (let t = i === 0 ? 12 : 0; t < L; t += 3) {
        const k = Math.round((run + t) / 3);
        dashes.push({ x: a[0] + ux * t + nx * 5.0, y: 0.046, z: a[1] + uz * t + nz * 5.0, ry });
        if (k % 10 === 5) syms.push({ x: a[0] + ux * t + nx * 6.0, y: 0.05, z: a[1] + uz * t + nz * 6.0, ry: ry + Math.PI });
        if (i === 0 && t < 30 && k % 2 === 0) wands.push({ x: a[0] + ux * t + nx * 5.0, y: 0.42, z: a[1] + uz * t + nz * 5.0 });
      }
      run += L;
    }
    inst(g, new THREE.BoxGeometry(0.12, 0.012, 1.6), mats.white, dashes, { shadow: false });
    inst(g, new THREE.PlaneGeometry(1.0, 1.8).rotateX(-Math.PI / 2), paintMat(64, 115, (c) => {
      c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(32, 26, 13, 0, TAU); c.stroke(); c.beginPath(); c.arc(32, 88, 13, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(32, 26); c.lineTo(22, 58); c.lineTo(32, 88); c.moveTo(22, 58); c.lineTo(40, 62); c.lineTo(32, 26); c.moveTo(40, 62); c.lineTo(48, 66); c.moveTo(22, 58); c.lineTo(14, 52); c.stroke();
    }), syms, { shadow: false });
    inst(g, new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), paint(0x1a1b1e, 0.6), wands, { shadow: false });
    inst(g, new THREE.CylinderGeometry(0.048, 0.048, 0.16, 8), mats.white, wands.map((w) => ({ ...w, y: 0.62 })), { shadow: false });
    // the island in the middle of the road east of the junction, with its black and yellow keep-left bollard
    box(g, 5, 0.14, 1.4, mats.granite, 108, 0.1, -99.2); col.rect(108, -99.2, 5, 1.4, { h: 0.17 });
    box(g, 0.3, 0.95, 0.3, paint(0x16171a, 0.6), 106, 0.64, -99.2); box(g, 0.32, 0.22, 0.32, paint(0xf2c230, 0.5), 106, 0.86, -99.2); col.rect(106, -99.2, 0.32, 0.32, { h: 1.15, pad: 0.04 });
    // Bute Gardens is one way: the blue arrow plate on the corner, and black bollards round it
    const arrowPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), readableBothSides(new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(96, 96, (c) => { c.fillStyle = '#1f5bb5'; c.fillRect(0, 0, 96, 96); c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(3, 3, 90, 90); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(48, 12); c.lineTo(76, 46); c.lineTo(58, 46); c.lineTo(58, 84); c.lineTo(38, 84); c.lineTo(38, 46); c.lineTo(20, 46); c.closePath(); c.fill(); }) })));
    arrowPlate.position.set(90.4, 2.5, -107.0); arrowPlate.rotation.y = -Math.PI / 2; g.add(arrowPlate);
    inst(g, new THREE.CylinderGeometry(0.04, 0.04, 2.9, 8), paint(0x8a9099, 0.4), [{ x: 90.46, y: 1.45, z: -107.0 }]);
    const bollards = [[89.6, -107.4], [88.2, -107.4], [90.8, -108.8], [101.2, -107.4], [102.6, -107.4]];
    inst(g, new THREE.CylinderGeometry(0.07, 0.085, 0.95, 10), paint(0x16171a, 0.5), bollards.map(([x, z]) => ({ x, y: 0.475, z })));
    for (const [x, z] of bollards) col.rect(x, z, 0.18, 0.18, { h: 0.95, pad: 0.03 });
  }

  /* ---------- the advertising totem at the junction of Hammersmith Road and Butterwick ---------- */
  // (Street View from Bute Gardens, Jul 2025: the corner opposite is open junction, with the view through to the
  // Broadway centre. The totem stands on the pavement in front of the glass office east of it.)
  {
    // totem: a grey monolith carrying a tall screen, facing the junction
    const tg = new THREE.Group(); tg.position.set(124.5, 0, -89.4); tg.rotation.y = Math.atan2(-0.9, -0.44); g.add(tg);
    box(tg, 1.5, 6.2, 0.45, new THREE.MeshStandardMaterial({ color: 0x8d9399, roughness: 0.5, metalness: 0.4 }), 0, 3.1, 0);
    box(tg, 2.5, 3.9, 0.3, paint(0x1b1c1f, 0.5), 0.9, 4.2, 0.12);
    const ad = (bg0, bg1, lines) => canvasTex(256, 400, (c) => {
      const gr = c.createLinearGradient(0, 0, 256, 400); gr.addColorStop(0, bg0); gr.addColorStop(1, bg1); c.fillStyle = gr; c.fillRect(0, 0, 256, 400);
      c.fillStyle = 'rgba(255,255,255,0.16)'; c.beginPath(); c.arc(200, 320, 150, 0, TAU); c.fill(); c.beginPath(); c.arc(40, 90, 70, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'top'; lines.forEach(([t, size, y]) => { c.font = `800 ${size}px ${FONT}`; c.fillText(t, 22, y); });
    });
    const ads = [ad('#1b6fe0', '#0b3d91', [['WALK THE', 40, 40], ['THAMES', 54, 86], ['PATH', 54, 142], ['Ten minutes from here', 17, 350]]), ad('#0d8a6a', '#07513f', [['CYCLE', 54, 40], ['TO WORK', 44, 100], ['Hire bikes at the station', 17, 350]])];
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 3.6), new THREE.MeshBasicMaterial({ toneMapped: false, map: ads[0] })); screen.material.color.setScalar(1.15); screen.position.set(0.9, 4.2, 0.28); tg.add(screen);
    let showing = 0; ctx.updaters.push((dt, t) => { const k = Math.floor(t / 9) % 2; if (k !== showing) { showing = k; screen.material.map = ads[k]; } });
    col.rect(124.5, -89.4, 0.9, 2.2, { rot: 0.45, h: 6.2, pad: 0.05 });
  }

  /* ---------- vehicles at the kerb ---------- */
  // flat body panels mirror one patch of sky each, so a glossy clearcoat turns the whole side white: keep the paint satin
  const gloss = (hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0, envMapIntensity: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.06, metalness: 0.85 }), tyre = paint(0x111113, 0.95);
  const vehicle = (d, o, len, wid, hgt, build) => { const [x, z] = P(d, o), v = new THREE.Group(); v.position.set(x, 0.03, z); v.rotation.y = along; g.add(v); build(v); col.rect(x, z, wid + 0.1, len + 0.1, { rot: along, h: hgt, pad: 0.1 }); addContact(x, z, wid * 0.62, len * 0.55, along); return v; };
  const wheelsOf = (v, r, xs, zs) => inst(v, new THREE.CylinderGeometry(r, r, 0.26, 16).rotateZ(Math.PI / 2), tyre, xs.flatMap((sx) => zs.map((wz) => ({ x: sx, y: r, z: wz }))));
  vehicle(ROAD - 5.9, -8, 10.9, 2.55, 4.3, (v) => { v.add(parkedBus('dd', ROUTES.find((e) => e.n === '9'))); });   // a 9 on the stand west of the entrance, short of the corner
  vehicle(ROAD - 5.95, 15.5, 4.6, 1.8, 1.85, (v) => {          // black cab pulled in east of the crossing
    const body = gloss(0x0d0e10);
    box(v, 1.8, 0.75, 4.6, body, 0, 0.72, 0); box(v, 1.7, 0.75, 2.9, body, 0, 1.42, -0.35); box(v, 1.72, 0.5, 2.6, glass, 0, 1.45, -0.3); box(v, 1.5, 0.45, 0.06, glass, 0, 1.42, 1.12);
    const lit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.4), toneMapped: false })); lit.position.set(0, 1.87, 0.6); v.add(lit);
    wheelsOf(v, 0.33, [-0.82, 0.82], [-1.45, 1.5]);
  });
  vehicle(ROAD + 5.95, -12.3, 5.6, 2.0, 2.5, (v) => {             // white panel van, west of the Beadon Road mouth
    const body = gloss(0xf2f3f4);
    box(v, 2.0, 1.95, 3.6, body, 0, 1.45, -0.95); box(v, 2.0, 1.15, 2.0, body, 0, 1.0, 1.8); box(v, 1.9, 0.75, 1.3, body, 0, 1.95, 1.25); box(v, 1.92, 0.62, 1.0, glass, 0, 1.98, 1.42); box(v, 1.7, 0.6, 0.06, glass, 0, 1.95, 1.92);
    wheelsOf(v, 0.36, [-0.9, 0.9], [-1.9, 1.75]);
  });
}
