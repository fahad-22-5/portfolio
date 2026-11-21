/**
 * Fit-outs for every other shop on the plan, by type, with working staff.
 *
 * Each shop: glazed front(s) with a door on the main front, walls with
 * collision, its own floor and ceiling, then a type template laid out in a
 * rectangle fitted inside the outline (local frame: x along the front,
 * z = 0 at the glass, z = -d at the back). Nothing is placed in the door
 * lane. All static pieces go into the mall's shared batches.
 */
import * as THREE from 'three';
import { canvasTex, FONT, TAU } from '../../util.js';
import { frameFromEdge } from '../shopkit.js';
import { addPlace, addSeat } from '../sim.js';
import { unitFronts, streetFronts, inPoly, CEIL } from '../plan2024.js';
import { brushedSteel, chrome, blackSteel, oak, metroTile, marble, darkTile, slats, paint, glow, lamp, clearGlass, menuBoard, label, fascia, shade } from '../finishes.js';
import { pilaster, glazingFrame } from '../trim.js';

/** Which template each shop gets. */
const TYPE = {
  Starbucks: ['cafe', 'starbucks'], PAUL: ['cafe', 'paul'], 'Pure.': ['cafe', 'pure'], COSTA: ['cafe', 'costa'], 'Café de Nata': ['cafe', 'nata'], 'Joe & the Juice': ['cafe', 'juice'],
  'Chez Maiss': ['cafe', 'bistro'], 'Great Scotts': ['cafe', 'bistro'], Kindred: ['cafe', 'bistro'], 'Green Mosaic': ['cafe', 'bistro'], Simya: ['cafe', 'bistro'], "Harriet's": ['cafe', 'bistro'],
  Chopstix: ['food', 'noodle'], LEON: ['food', 'leon'], Wasabi: ['food', 'sushi'], Pelicana: ['food', 'chicken'], Sprigs: ['food', 'noodle'], Greggs: ['food', 'bakery'],
  TESCO: ['grocery', 'tesco'], Oseyo: ['grocery', 'oseyo'], Boots: ['grocery', 'pharmacy'], Superdrug: ['grocery', 'beauty'],
  Scribbler: ['retail', 'cards'], 'Cards Galore': ['retail', 'cards'], TEC: ['retail', 'tech'], Lovisa: ['retail', 'jewellery'], Accessorize: ['retail', 'jewellery'], 'Hotel Chocolat': ['retail', 'chocolate'], 'Oliver Bonas': ['retail', 'lifestyle'],
  Timpson: ['service', 'timpson'], Hays: ['service', 'travel'], Betfred: ['service', 'bookies'], SUPERCUTS: ['service', 'salon'],
  'CRAFT BEER CO.': ['pub', 'craft'],
};
/** Outlet uniforms (polo/shirt, apron, headwear, badge, lanyard). */
const UNIFORM = {
  TESCO: { uniform: 0x00539f, apron: null, badge: 0xffffff, lanyard: 0xee1c2e },
  COSTA: { uniform: 0x1b1b1d, apron: 0x6d1f37, badge: 0xffffff },
  Greggs: { uniform: 0x00264d, apron: 0x00264d, hat: 'cap', hatColor: 0x00264d, badge: 0xfdb913 },
  Wasabi: { uniform: 0x1b1b1d, apron: 0x9cc33b, hat: 'cap', hatColor: 0x1b1b1d, badge: 0xffffff },
  Pelicana: { uniform: 0xe2231a, apron: 0x1b1b1d, hat: 'visor', hatColor: 0x1b1b1d, badge: 0xffffff },
  Starbucks: { uniform: 0x1b1b1d, apron: 0x00704a, badge: 0xffffff },
  PAUL: { uniform: 0x141414, apron: 0xf2efe8, badge: 0xd8b25a },
  Chopstix: { uniform: 0x1b1b1d, apron: 0x1f7a3a, hat: 'cap', hatColor: 0x1f7a3a, badge: 0xffffff },
  LEON: { uniform: 0x1b1b1d, apron: 0x7a5a3a, badge: 0xffffff },
  Boots: { uniform: 0xf4f6fb, apron: null, badge: 0x05054b, lanyard: 0x05054b },
  Superdrug: { uniform: 0x1b1b1d, apron: null, badge: 0xe5007d, lanyard: 0xe5007d },
  'Joe & the Juice': { uniform: 0x1b1b1d, apron: 0xe5007e, badge: 0xffffff },
  Oseyo: { uniform: 0xd6202a, apron: null, badge: 0xffffff, lanyard: 0x1b1b1b },
};
const FLOOR = { cafe: () => oak('#a77a4e'), food: () => darkTile('#4a4744'), grocery: () => paint(0xdcdcd8, 0.35), retail: () => oak('#c9a77c'), service: () => paint(0xbfc3c8, 0.5), pub: () => oak('#6b4a30') };
const GOODS = [0xe23d3d, 0xf2c230, 0x2f7fd0, 0x3fa34d, 0xf08a3c, 0x7a3fb0, 0xf3b7c8, 0xfbf6ea, 0x1c8a7a, 0xd43f8d, 0x8fc1e3, 0xc7a34a];
const SKIN = [0xf1c8a8, 0xd9a07a, 0xb07850, 0x7a4e30, 0x5a3a24, 0xe8b896], HAIR = [0x111111, 0x2a1c12, 0x5a3a24, 0x8a5a33, 0x3a2414, 0xc9a26a];

export function buildGenericShop(K, u, staff, seed) {
  const [type, variant] = TYPE[u.name] || ['retail', 'lifestyle'];
  let fronts = unitFronts(u); if (!fronts.length) fronts = streetFronts(u); if (!fronts.length) return false;
  const main = fronts.reduce((p, q) => (q.len > p.len ? q : p));
  const F = frameFromEdge(main.a, main.b, u.c), S = K.sub(F);
  const cream = paint(0xf4f1ea, 0.85), black = blackSteel(), white = paint(0xf6f4ef, 0.9);
  const brand = new THREE.Color(u.bg), dark = brand.getHSL({}).l < 0.35, brandM = paint(brand.getHex(), 0.5);
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  /* ---------- shell: walls, glazed fronts, door, fascia, floor, ceiling ---------- */
  const P = u.poly, frontSet = new Set(fronts.map((f) => f.a));
  let doorWorld = null;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    if (!frontSet.has(a)) { K.seg(a, b, 0, CEIL, u.kind === 'food' || type === 'cafe' ? cream : white); continue; }
    const f = fronts.find((x) => x.a === a), len = f.len, at = (t, o = 0) => [a[0] + (b[0] - a[0]) * t / len + f.nx * o, a[1] + (b[1] - a[1]) * t / len + f.nz * o];
    K.seg(a, b, 3.0, CEIL, cream, { collide: false });
    const isMain = f === main, dw = Math.min(1.9, len - 0.4), dc = isMain ? (len > 7 ? len * 0.28 : len / 2) : -10;
    const spans = isMain ? [[0, dc - dw / 2], [dc + dw / 2, len]] : [[0, len]];
    if (isMain) doorWorld = at(dc);
    for (const [s0, s1] of spans) if (s1 - s0 > 0.1) K.seg(at(s0), at(s1), 0, 3.0, clearGlass(), { t: 0.05, shadow: false });
    glazingFrame(K, at(0, -0.02), at(len, -0.02), spans.filter(([s0, s1]) => s1 - s0 > 0.1).map(([s0, s1]) => [at(s0, -0.02), at(s1, -0.02)]));
    for (let t = 0; t <= len + 0.01; t += len / Math.max(1, Math.round(len / 2))) { const m = at(t, -0.02); K.box(0.07, 3.0, 0.1, black, m[0], 1.5, m[1], f.ry); }
    for (const t of [0, len]) { const m = at(t, 0.12); pilaster(K, m[0], m[1], f.ry); }
    const fw = Math.min(len - 0.5, 9);
    if (fw > 1) { const fm = new THREE.Mesh(new THREE.PlaneGeometry(fw, 0.85), fascia(u.name, fw, { bg: u.bg, fg: u.fg, style: u.style }, 0.85)); const q = at(len / 2, 0.125); fm.position.set(q[0], 3.55, q[1]); fm.rotation.y = Math.atan2(f.nx, f.nz); K.group.add(fm); }
    if (isMain) blade(at, len, f);
  }
  /** Projecting blade banner hung off the fascia at the far end of the main front, readable along the mall. */
  function blade(at, len, f) {
    const bw = 1.1, bh = 0.55, t = Math.min(len - 0.35, len * 0.9), arm = bw, mat = fascia(u.name, bw, { bg: u.bg, fg: u.fg, style: u.style }, bh);
    const p = at(t, 0.15 + arm / 2), ry = f.ry;
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat); m.position.set(p[0] + Math.cos(ry) * s * 0.03, 3.0, p[1] - Math.sin(ry) * s * 0.03); m.rotation.y = ry + s * Math.PI / 2; K.group.add(m); }
    const q = at(t, 0.15 + arm / 2);
    K.box(0.04, 0.04, arm + 0.1, black, q[0], 3.32, q[1], ry);
    K.box(0.07, bh + 0.08, arm + 0.04, brandM, q[0], 3.0, q[1], ry);
  }
  K.flat(P, FLOOR[type](), 0.04);
  K.flat(P, white, 3.6, true);

  // fit rectangle: depth by ray from the main front, width at half depth
  let depth = 0.3; while (depth < 16 && inPoly(...F.toWorld(0, -depth), P)) depth += 0.2;
  const d = Math.max(2.2, Math.min(depth - 0.3, 14)), mid = -d / 2;
  let wl = 0, wr = 0; while (wl < 14 && inPoly(...F.toWorld(-wl, mid), P)) wl += 0.2; while (wr < 14 && inPoly(...F.toWorld(wr, mid), P)) wr += 0.2;
  const x0 = -wl + 0.35, x1 = wr - 0.35, w = x1 - x0, cx = (x0 + x1) / 2;
  const doorX = doorWorld ? F.toLocal(...doorWorld)[0] : 0;
  const lane = (x, half = 0.4) => Math.abs(x - doorX) < 1.1 + half;                     // keep the door lane clear
  const away = doorX > cx ? x0 + 0.9 : x1 - 0.9;                                          // the side of the shop away from the door
  // warm interior light (0xffd6a5): recessed ceiling panels and an LED cove along the back wall, so the shop glows against the cooler mall
  for (let x = x0 + w / 4; x < x1; x += w / 2) for (let z = -d / 4; z > -d; z -= d / 2) S.cyl(0.24, 0.24, 0.02, 16, lamp(0xffd6a5, 3), x, 3.58, z, 0, 0, false);
  S.box(Math.max(0.4, w - 0.3), 0.03, 0.05, lamp(0xffd6a5, 3), cx, 3.46, -d + 0.1, 0, false);

  /* ---------- shared fittings ---------- */
  const counter = (a, b, z, front = brandM, top = marble(), h = 1.0, dep = 0.65) => { if (b - a < 0.3) return; S.box(b - a, h, dep, front, (a + b) / 2, h / 2, z); S.box(b - a + 0.05, 0.05, dep + 0.06, top, (a + b) / 2, h + 0.025, z); S.solid((a + b) / 2, z, b - a, dep + 0.05, h + 0.05); };
  const menus = (title, items, accent = '#ffc72c') => {
    const n = Math.max(1, Math.min(3, Math.floor(w / 1.8))), mw = Math.min(2.2, (w - 0.4) / n - 0.15);
    for (let i = 0; i < n; i++) { const x = x0 + 0.2 + (w - 0.4) * (i + 0.5) / n; S.box(mw + 0.08, 0.78, 0.05, black, x, 2.45, -d + 0.05); S.single(new THREE.PlaneGeometry(mw, 0.7), menuBoard(title + i + u.name, i ? items.slice().reverse() : items, { bg: dark ? u.bg : '#1d1d1b', fg: '#ffffff', accent, photo: '#' + shade(u.bg, 1.2).slice(1) }), x, 2.45, -d + 0.085); }
  };
  const shelfWall = (xa, xb, z, levels, cols, faceZ = 1, depthS = 0.4, item = 'box') => {
    if (xb - xa < 0.4) return;
    S.box(xb - xa, levels * 0.42 + 0.2, 0.06, paint(0xe8e4dc, 0.7), (xa + xb) / 2, (levels * 0.42 + 0.2) / 2, z - faceZ * depthS / 2);
    for (let lv = 0; lv < levels; lv++) {
      const y = 0.3 + lv * 0.42; S.box(xb - xa, 0.03, depthS, paint(0xeceae6, 0.6), (xa + xb) / 2, y, z);
      for (let t = xa + 0.12; t < xb - 0.1; t += 0.2) {
        const c = pick(cols), hh = 0.12 + rnd() * 0.16;
        if (item === 'bottle') S.cyl(0.035, 0.035, hh + 0.08, 8, paint(c, 0.3), t, y + 0.1 + hh / 2, z);
        else S.box(0.15, hh, 0.16, paint(c, 0.5), t, y + 0.02 + hh / 2, z);
      }
    }
    S.solid((xa + xb) / 2, z, xb - xa, depthS + 0.05, levels * 0.42 + 0.2);
  };
  const gondola = (xa, xb, z, cols) => {
    if (xb - xa < 0.8) return;
    S.box(xb - xa, 1.5, 0.1, paint(0xdedad2, 0.6), (xa + xb) / 2, 0.75, z); S.box(xb - xa, 0.1, 0.9, paint(0xdedad2, 0.6), (xa + xb) / 2, 0.05, z);
    for (let lv = 0; lv < 4; lv++) { const y = 0.15 + lv * 0.38; S.box(xb - xa, 0.025, 0.85, paint(0xeceae6, 0.6), (xa + xb) / 2, y, z);
      for (let t = xa + 0.12; t < xb - 0.1; t += 0.22) for (const s of [-1, 1]) { const hh = 0.14 + rnd() * 0.16; S.box(0.17, hh, 0.18, paint(pick(cols), 0.45), t, y + 0.015 + hh / 2, z + s * 0.27); } }
    S.solid((xa + xb) / 2, z, xb - xa, 0.95, 1.55);
  };
  const table = (x, z, top, seat) => {
    S.cyl(0.36, 0.36, 0.04, 14, top, x, 0.74, z); S.cyl(0.035, 0.035, 0.72, 6, black, x, 0.37, z); S.cyl(0.2, 0.2, 0.025, 12, black, x, 0.012, z);
    for (const s of [-1, 1]) { S.cyl(0.19, 0.19, 0.05, 12, seat, x + s * 0.62, 0.45, z); S.cyl(0.025, 0.025, 0.44, 6, black, x + s * 0.62, 0.22, z); S.box(0.36, 0.42, 0.04, seat, x + s * 0.8, 0.7, z, Math.PI / 2); }
    S.solid(x, z, 1.7, 0.8, 0.76);
    for (const s2 of [-1, 1]) addSeat(u.name, S.at(x + s2 * 0.62, z), S.at(x, z));
  };
  const espresso = (x, z) => {                                              // compact two-group machine, groups facing the back (staff side)
    S.box(0.8, 0.42, 0.5, brushedSteel(), x, 1.27, z); S.box(0.82, 0.04, 0.52, chrome(), x, 1.5, z); S.box(0.76, 0.32, 0.02, brandM, x, 1.27, z + 0.26);
    for (const g of [-0.2, 0.2]) { S.cyl(0.045, 0.045, 0.08, 12, chrome(), x + g, 1.1, z - 0.26); S.box(0.03, 0.025, 0.14, black, x + g, 1.04, z - 0.4); }
    for (let i = 0; i < 6; i++) S.cyl(0.032, 0.028, 0.065, 10, paint(0xfbfaf6, 0.3), x - 0.3 + (i % 3) * 0.3, 1.55, z - 0.05 + Math.floor(i / 3) * 0.1);
    S.box(0.18, 0.32, 0.26, black, x + 0.55, 1.21, z); S.cyl(0.1, 0.05, 0.22, 12, paint(0x3b2314, 0.7), x + 0.55, 1.48, z);
  };
  const pastryCase = (x, z, len) => {
    S.box(len, 0.45, 0.48, clearGlass(), x, 1.27, z + 0.02, 0, false); S.box(len, 0.02, 0.44, glow(0xfff0d0), x, 1.06, z, 0, false);
    for (let i = 0; i < Math.floor(len / 0.17); i++) { const px = x - len / 2 + 0.12 + i * 0.17; S.mesh(new THREE.TorusGeometry(0.042, 0.022, 6, 10, Math.PI * 1.2).rotateX(Math.PI / 2), paint(0xc98a45, 0.55), px, 1.09, z + 0.1); S.cyl(0.04, 0.034, 0.05, 10, paint(pick([0x7a4a2a, 0xd9a35b, 0xe8c27a]), 0.6), px, 1.29, z - 0.06); }
  };
  const till = (x, z) => { S.box(0.34, 0.25, 0.04, black, x, 1.22, z, 0); S.single(new THREE.PlaneGeometry(0.3, 0.2), glow(0x9fd3ee), x, 1.225, z + 0.025); };
  const brandLook = UNIFORM[u.name];
  const look = (apron) => brandLook ? { trousers: 0x1b1c20, skin: pick(SKIN), hair: pick(HAIR), sleeves: rnd() < 0.5 ? 'long' : 'short', ...brandLook } : ({ uniform: dark ? u.bg : 0x2b2c2f, apron: apron ? (dark ? 0x2b2c2f : brand.getHex()) : null, trousers: 0x1b1c20, skin: pick(SKIN), hair: pick(HAIR), sleeves: rnd() < 0.5 ? 'long' : 'short', hat: type === 'food' && rnd() < 0.6 ? 'cap' : null, hatColor: 0x1b1d22 });
  const add = (tasks, apron = type === 'cafe' || type === 'food') => staff.add({ at: F.toWorld, yaw: F.yaw, look: look(apron), tasks });

  /* ---------- templates ---------- */
  if (type === 'cafe' || type === 'food' || type === 'pub') {
    // front counter across the shop with the staff aisle behind it and a back counter against the wall
    const deep = d > 5.2, zc = deep ? -d + 2.2 : -d + 1.45, zb = -d + 0.45, zs = zc - 0.65;
    const ca = x0, cb = x1 - (deep ? 0.75 : 0.0);
    const counterFront = type === 'pub' ? slats('#7a4a2a') : type === 'food' ? darkTile('#2b2c2f') : brandM;
    counter(ca, cb, zc, counterFront, type === 'pub' ? paint(0x3a2416, 0.25) : marble());
    if (deep) counter(x0, x1, zb, brushedSteel(), brushedSteel(), 0.92, 0.6);
    const items = {
      cafe: [['Flat White', '£3.40'], ['Latte', '£3.50'], ['Cappuccino', '£3.50'], ['Americano', '£2.90'], ['Croissant', '£2.10']],
      food: [['Signature Box', '£7.95'], ['Chicken Rice', '£8.45'], ['Noodles', '£7.25'], ['Side Salad', '£3.50'], ['Soft Drink', '£1.95']],
      pub: [['Pale Ale', '£6.40'], ['IPA', '£6.90'], ['Stout', '£6.60'], ['Lager', '£5.90'], ['Cider', '£6.10']],
    }[type];
    if (variant === 'juice') items.splice(0, 5, ['Tunacado', '£7.95'], ['Green Shot', '£2.95'], ['Joe\'s Juice', '£4.95'], ['Avocado Toast', '£6.50']);
    if (variant === 'bakery') items.splice(0, 5, ['Sausage Roll', '£1.35'], ['Steak Bake', '£2.10'], ['Vegan Roll', '£1.40'], ['Doughnut', '£1.10'], ['Coffee', '£1.60']);
    menus(type === 'pub' ? 'On tap' : u.name, items, type === 'pub' ? '#e8c66a' : '#ffc72c');
    const orderX = type === 'cafe' ? ca + Math.min(1.4, (cb - ca) * 0.35) + 0.55 : type === 'food' ? cb - 0.5 : (ca + cb) / 2;
    addPlace(u.name, type, 'order', S.at(orderX, zc + 0.85), F.yaw + Math.PI);
    const span = cb - ca;
    if (type === 'cafe') {
      if (variant === 'juice') { for (let i = 0; i < 4; i++) S.cyl(0.08, 0.08, 0.35, 12, clearGlass(), ca + 0.4 + i * 0.35, 1.23, zc - 0.1); for (let i = 0; i < 8; i++) S.mesh(new THREE.SphereGeometry(0.06, 8, 6), paint(pick([0x6aa14a, 0xf2c230, 0xe23d3d, 0xf08a3c]), 0.5), ca + 0.3 + (i % 4) * 0.12, 1.1 + Math.floor(i / 4) * 0.1, zb); }
      else espresso(cb - 0.7, zc);
      pastryCase(ca + Math.min(1.4, span * 0.35) / 2 + 0.2, zc, Math.min(1.4, span * 0.35));
      till(ca + Math.min(1.4, span * 0.35) + 0.55, zc - 0.1);
    } else if (type === 'food') {
      // heated or chilled display along the counter
      const disp = Math.min(span - 0.8, 3.2), dx = ca + disp / 2 + 0.2;
      if (variant === 'sushi') { S.box(disp, 0.5, 0.5, clearGlass(), dx, 1.28, zc, 0, false); S.box(disp, 0.02, 0.48, glow(0xe8fff0), dx, 1.04, zc, 0, false); for (let i = 0; i < Math.floor(disp / 0.18); i++) for (const lv of [0, 1]) S.box(0.15, 0.05, 0.12, label('sushi' + (i % 3), (c) => { c.fillStyle = '#f5f5f0'; c.fillRect(0, 0, 128, 128); c.fillStyle = ['#e46a4a', '#f2a65a', '#3b6b3a'][i % 3]; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(24 + k * 26, 64, 11, 0, TAU); c.fill(); } }), dx - disp / 2 + 0.12 + i * 0.18, 1.1 + lv * 0.2, zc + (lv ? -0.05 : 0.08)); }
      else if (variant === 'bakery') { S.box(disp, 0.55, 0.5, clearGlass(), dx, 1.3, zc, 0, false); S.box(disp, 0.03, 0.46, glow(0xffd28a), dx, 1.05, zc, 0, false); for (let i = 0; i < Math.floor(disp / 0.16); i++) for (const lv of [0, 1]) S.box(0.13, 0.05, 0.08, paint(pick([0xd9a35b, 0xc98a45, 0xe8c27a]), 0.55), dx - disp / 2 + 0.1 + i * 0.16, 1.1 + lv * 0.22, zc); }
      else { S.box(disp, 0.12, 0.55, brushedSteel(), dx, 1.08, zc); for (let i = 0; i < Math.floor(disp / 0.36); i++) { S.box(0.32, 0.05, 0.45, brushedSteel(), dx - disp / 2 + 0.2 + i * 0.36, 1.15, zc); S.box(0.29, 0.03, 0.4, paint(pick([0xd6202a, 0xf08a3c, 0xf2c230, 0x3fa34d, 0x7a4a2a, 0xe8c27a]), 0.6), dx - disp / 2 + 0.2 + i * 0.36, 1.18, zc); }
        S.box(disp + 0.1, 0.03, 0.4, clearGlass(), dx, 1.55, zc + 0.1, 0, false); for (const sx of [-1, 1]) S.cyl(0.012, 0.012, 0.4, 6, chrome(), dx + sx * disp / 2, 1.38, zc + 0.1, 0, 0, false); }
      till(cb - 0.5, zc - 0.1);
      // back cooking line: woks / fryers / grill under a hood
      if (deep) { const lineM = variant === 'chicken' ? paint(0x1b1b1d, 0.4) : brushedSteel();
        for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.85) { if (variant === 'noodle') { S.mesh(new THREE.SphereGeometry(0.22, 12, 6, 0, TAU, Math.PI / 2, Math.PI / 2), black, x, 1.18, zb); } else if (variant === 'chicken') { S.box(0.6, 0.05, 0.45, lineM, x, 0.95, zb); S.box(0.5, 0.01, 0.35, paint(0xb8862b, 0.15), x, 0.97, zb); } else S.box(0.6, 0.04, 0.45, chrome(), x, 0.96, zb); }
        S.box(w, 0.45, 0.9, brushedSteel(), cx, 2.75, zb + 0.1); S.box(w - 0.2, 0.03, 0.8, glow(0xfff2d8), cx, 2.52, zb + 0.1, 0, false); }
    } else {                                                                     // pub: taps and a back bar of bottles
      for (let t = ca + 0.5; t < cb - 0.4; t += 0.35) { S.cyl(0.02, 0.02, 0.35, 8, chrome(), t, 1.22, zc - 0.05); S.box(0.04, 0.12, 0.04, paint(pick([0xc7a34a, 0x7a4a1e, 0x1b1b1b]), 0.4), t, 1.42, zc - 0.05); }
      if (deep) { S.box(w, 1.6, 0.35, paint(0x2b1a12, 0.5), cx, 1.75, -d + 0.2); for (let lv = 0; lv < 3; lv++) for (let t = x0 + 0.2; t < x1 - 0.15; t += 0.16) S.cyl(0.035, 0.035, 0.26, 8, paint(pick([0x2f6b3a, 0x7a4a1e, 0xc7a34a, 0x3a2216, 0xe9e2d0]), 0.3), t, 1.2 + lv * 0.45, -d + 0.42); }
      for (let t = ca + 0.5; t < cb - 0.3; t += 0.9) if (!lane(t, 0.2)) { S.cyl(0.18, 0.18, 0.05, 12, paint(0x5a3b26, 0.5), t, 0.75, zc + 0.75); S.cyl(0.025, 0.025, 0.72, 6, black, t, 0.37, zc + 0.75); S.solid(t, zc + 0.75, 0.38, 0.38, 0.77); }
    }
    // tables in the front part, clear of the door
    const tz = deep ? zc + 1.9 : null, top = type === 'pub' ? paint(0x5a3b26, 0.4) : paint(0xf2efe8, 0.4), seat = type === 'pub' ? paint(0x2b1a12, 0.6) : brandM;
    if (tz !== null && tz < -1.2) for (let x = x0 + 1.0; x < x1 - 0.9; x += 2.2) if (!lane(x, 0.9)) table(x, tz, top, seat);
    if (d > 7.5) for (let x = x0 + 1.0; x < x1 - 0.9; x += 2.2) if (!lane(x, 0.9)) table(x, tz + 1.8 < -1.0 ? tz + 1.8 : tz, top, seat);
    // staff
    if (type === 'cafe') {
      add([{ to: [cb - 0.95, zs], face: 0, act: variant === 'juice' ? 'pour' : 'grind', dur: 2.4, prop: variant === 'juice' ? 'cup' : 'portafilter' }, { to: [cb - 0.7, zs], face: 0, act: variant === 'juice' ? 'tamp' : 'brew', dur: 3.2 }, { to: [cb - 0.45, zs], face: 0, act: 'steam', dur: 3, prop: 'jug' }, { to: [ca + 1.0, zs], face: 0, act: 'handover', dur: 2.4, prop: 'cup', carry: true }]);
      if (span > 2.8) add([{ to: [ca + Math.min(1.4, span * 0.35) + 0.55, zs], face: 0, act: 'tap', dur: 4 }, { to: [ca + 0.5, zs], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: false }, ...(deep ? [{ to: [ca + 0.6, zb + 0.6], face: Math.PI, act: 'restock', dur: 2.2 }] : [])]);
    } else if (type === 'food') {
      add([{ to: [ca + 0.6, zs], face: 0, act: 'scoop', dur: 4, prop: 'scoop' }, { to: [cb - 0.5, zs], face: 0, act: 'tap', dur: 3.5 }, { to: [cb - 0.5, zs], face: 0, act: 'handover', dur: 2.4, prop: 'bag', carry: true }]);
      if (deep) add([{ to: [x0 + 0.7, zb + 0.65], face: Math.PI, act: variant === 'chicken' ? 'fries' : 'flip', dur: 5, prop: variant === 'chicken' ? 'basket' : 'spatula' }, { to: [Math.min(x1 - 0.7, x0 + 2.4), zb + 0.65], face: Math.PI, act: variant === 'noodle' ? 'scoop' : 'flip', dur: 4.5, prop: variant === 'noodle' ? 'scoop' : 'spatula' }, { to: [ca + 1.4, zs], face: 0, act: 'bag', dur: 2.5 }]);
    } else {
      add([{ to: [ca + 0.8, zs], face: 0, act: 'drink', dur: 4, prop: 'cup' }, { to: [cb - 0.6, zs], face: 0, act: 'handover', dur: 2.4, prop: 'cup', carry: true }, { to: [(ca + cb) / 2, zs], face: 0, act: 'wipe', dur: 2.5, prop: 'cloth' }], false);
    }
    return true;
  }

  if (type === 'grocery') {
    const cols = { tesco: GOODS, oseyo: [0xe23d3d, 0xf2c230, 0xffffff, 0x3fa34d, 0xf08a3c, 0x2f7fd0], pharmacy: [0xffffff, 0x2f7fd0, 0x05054b, 0xe8eef8, 0x9fd3ee, 0xd43f8d], beauty: [0xf3b7c8, 0xd43f8d, 0xffffff, 0xc7a34a, 0x1b1b1b, 0xe5007d] }[variant];
    // fridges or a feature wall along the back
    if (variant === 'tesco' || variant === 'oseyo') { S.box(w, 2.1, 0.65, black, cx, 1.05, -d + 0.35); S.box(w - 0.1, 1.9, 0.02, glow(0xdcefff), cx, 1.05, -d + 0.68, 0, false);
      for (let y = 0.35; y < 1.9; y += 0.38) for (let t = x0 + 0.12; t < x1 - 0.08; t += 0.17) S.box(0.12, 0.24, 0.08, paint(pick(cols), 0.4), t, y + 0.12, -d + 0.62); S.solid(cx, -d + 0.35, w, 0.7, 2.1); }
    else if (variant === 'pharmacy') { counter(x0 + 0.2, x1 - 0.2, -d + 1.5, paint(0x05054b, 0.4), paint(0xffffff, 0.3)); shelfWall(x0, x1, -d + 0.3, 5, cols, 1); const ph = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3, w - 0.4), 0.4), fascia('Pharmacy', Math.min(3, w - 0.4), { bg: '#05054b', fg: '#ffffff' }, 0.4)); const [px, pz] = F.toWorld(cx, -d + 0.36); ph.position.set(px, 2.5, pz); ph.rotation.y = F.yaw; K.group.add(ph); }
    else shelfWall(x0, x1, -d + 0.3, 5, cols, 1, 0.4, 'bottle');
    // aisles parallel to the front
    const zFirst = -2.9, zLast = -d + (variant === 'pharmacy' ? 3.0 : 1.9);
    for (let z = zFirst; z > zLast; z -= 2.1) for (let x = x0 + 1.0; x < x1 - 0.8; x += 1.8) if (!lane(x, 0.2)) addPlace(u.name, type, 'browse', S.at(x, z + 0.8), F.yaw + Math.PI);
    for (let z = zFirst; z > zLast; z -= 2.1) { const a = x0 + 0.3, b = x1 - 0.3; if (z > -3.5 && lane((a + b) / 2, (b - a) / 2)) { const mid2 = doorX; if (mid2 - 1.3 - a > 0.8) gondola(a, mid2 - 1.3, z, cols); if (b - (mid2 + 1.3) > 0.8) gondola(mid2 + 1.3, b, z, cols); } else gondola(a, b, z, cols); }
    // checkout by the front, away from the door
    const kx = Math.min(x1 - 0.8, Math.max(x0 + 0.8, away));
    counter(kx - 0.6, kx + 0.6, -1.4, paint(0xdedad2, 0.5), paint(0x2b2c2f, 0.3), 0.95, 0.6); till(kx, -1.45);
    addPlace(u.name, type, 'checkout', S.at(kx, -0.75), F.yaw + Math.PI);
    if (variant === 'tesco') for (let i = 0; i < 2; i++) { const sx = kx + (doorX > kx ? -1.6 - i * 0.9 : 1.6 + i * 0.9); if (sx > x0 + 0.4 && sx < x1 - 0.4 && !lane(sx, 0.3)) { S.box(0.55, 1.0, 0.5, paint(0xf4f4f2, 0.4), sx, 0.5, -1.4); S.box(0.45, 0.35, 0.05, black, sx, 1.25, -1.4 + 0.1); S.single(new THREE.PlaneGeometry(0.4, 0.3), glow(0x9fd3ee), sx, 1.25, -1.4 + 0.13); S.solid(sx, -1.4, 0.55, 0.5, 1.0); } }
    add([{ to: [kx, -2.05], face: 0, act: 'tap', dur: 4.5 }, { to: [kx, -2.05], face: 0, act: 'bag', dur: 3, prop: 'bag' }], false);
    const ar = Math.max(zLast + 0.4, -3.95);
    add([{ to: [x0 + 0.8, ar], face: Math.PI, act: 'restock', dur: 4 }, { to: [cx, ar], face: Math.PI, act: 'restock', dur: 4 }, { to: [x1 - 0.8, ar], face: Math.PI, act: 'restock', dur: 4 }], false);
    return true;
  }

  if (type === 'retail') {
    const cols = { cards: [0xe23d3d, 0xf3b7c8, 0x2f7fd0, 0xf2c230, 0x3fa34d, 0xffffff, 0x7a3fb0], tech: [0x1b1b1b, 0x2f7fd0, 0xe23d3d, 0xffffff, 0x8fc1e3], jewellery: [0xc7a34a, 0xc0c0c0, 0xf3b7c8, 0xffffff, 0xd43f8d], chocolate: [0x3a2216, 0x6b3b22, 0xc7a34a, 0xb51f2a, 0xe8d8b8], lifestyle: GOODS }[variant];
    shelfWall(x0, x1, -d + 0.3, variant === 'cards' ? 5 : 4, cols, 1, variant === 'cards' ? 0.2 : 0.4);
    if (variant === 'jewellery') for (let i = 0; i < Math.floor(w / 0.6); i++) { S.box(0.5, 1.6, 0.04, paint(0x1b1b1b, 0.5), x0 + 0.35 + i * 0.6, 1.4, -d + 0.08); for (let k = 0; k < 10; k++) S.box(0.03, 0.06, 0.02, paint(pick(cols), 0.2), x0 + 0.17 + i * 0.6 + (k % 5) * 0.08, 1.0 + Math.floor(k / 5) * 0.6, -d + 0.11); }
    // display tables in the middle (not in the door lane)
    for (let z = -2.4; z > -d + 1.6; z -= 2.2) for (let x = x0 + 1.2; x < x1 - 1.0; x += 2.4) if (!(z > -3.4 && lane(x, 0.8))) {
      S.box(1.4, 0.82, 0.8, variant === 'chocolate' ? paint(0x2b1a12, 0.5) : oak('#d2b48c'), x, 0.41, z);
      for (let k = 0; k < 8; k++) S.box(0.16, 0.08 + rnd() * 0.12, 0.13, paint(pick(cols), 0.4), x - 0.55 + (k % 4) * 0.36, 0.9, z - 0.2 + Math.floor(k / 4) * 0.4);
      S.solid(x, z, 1.45, 0.85, 0.85);
      addPlace(u.name, type, 'browse', S.at(x, z + 0.85), F.yaw + Math.PI);
    }
    const kx = Math.min(x1 - 0.8, Math.max(x0 + 0.8, away));
    counter(kx - 0.65, kx + 0.65, -1.3, variant === 'chocolate' ? paint(0x2b1a12, 0.4) : brandM, marble(), 1.0, 0.55); till(kx, -1.35);
    addPlace(u.name, type, 'checkout', S.at(kx, -0.7), F.yaw + Math.PI);
    add([{ to: [kx, -1.9], face: 0, act: 'tap', dur: 4 }, { to: [kx, -1.9], face: 0, act: 'bag', dur: 2.6, prop: 'bag' }], false);
    if (d > 4) add([{ to: [x0 + 0.9, -d + 0.95], face: Math.PI, act: 'restock', dur: 4 }, { to: [x1 - 0.9, -d + 0.95], face: Math.PI, act: 'restock', dur: 4 }], false);
    return true;
  }

  // services
  if (variant === 'timpson') {
    counter(x0, x1 - 0.7, -d + 1.5, paint(0xc8102e, 0.45), paint(0x2b2c2f, 0.3));
    S.box(0.5, 0.35, 0.4, brushedSteel(), x0 + 0.7, 1.22, -d + 1.5); S.cyl(0.07, 0.07, 0.05, 14, chrome(), x0 + 0.7, 1.3, -d + 1.3, Math.PI / 2);   // key cutter
    for (let i = 0; i < Math.floor(w * 3); i++) S.box(0.03, 0.07, 0.01, paint(pick([0xc7a34a, 0xc0c0c0, 0x8fc1e3, 0xe23d3d]), 0.2), x0 + 0.2 + (i % Math.floor(w * 1.5)) / 1.5 * 0.98, 1.4 + Math.floor(i / Math.floor(w * 1.5)) * 0.3, -d + 0.08);
    S.box(w, 0.9, 0.04, paint(0xe8e4dc, 0.6), cx, 1.6, -d + 0.04);
    add([{ to: [x0 + 0.7, -d + 0.9], face: 0, act: 'scoop', dur: 5, prop: 'scoop' }, { to: [cx, -d + 0.9], face: 0, act: 'tap', dur: 3.5 }, { to: [cx, -d + 0.9], face: 0, act: 'handover', dur: 2.4 }], false);
  } else if (variant === 'travel') {
    for (let i = 0; i < Math.max(1, Math.floor(w / 2.2)); i++) { const x = x0 + 1.1 + i * 2.2; if (lane(x, 0.6) && d < 5) continue;
      S.box(1.5, 0.75, 0.75, white, x, 0.375, -d + 1.4); S.box(0.5, 0.32, 0.03, black, x, 0.95, -d + 1.2); S.single(new THREE.PlaneGeometry(0.46, 0.28), glow(0x9fd3ee), x, 0.95, -d + 1.22);
      for (const s of [-1, 1]) { S.cyl(0.22, 0.22, 0.06, 12, brandM, x, 0.47, -d + 1.4 + s * 0.7); S.cyl(0.03, 0.03, 0.44, 6, black, x, 0.22, -d + 1.4 + s * 0.7); }
      S.solid(x, -d + 1.4, 1.5, 0.8, 0.77);
      if (i < 2) add([{ to: [x, -d + 0.65], face: 0, act: 'tap', dur: 6 }, { to: [x + 0.3, -d + 0.65], face: 0, act: 'handover', dur: 2.4 }], false);
    }
    for (let i = 0; i < 3; i++) S.single(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshBasicMaterial({ toneMapped: false, map: canvasTex(128, 180, (c) => { const gr = c.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, ['#3aa0d8', '#f08a3c', '#1c8a7a'][i]); gr.addColorStop(1, '#f2e2b8'); c.fillStyle = gr; c.fillRect(0, 0, 128, 180); c.fillStyle = '#fff'; c.font = `700 18px ${FONT}`; c.fillText(['Santorini', 'Marrakech', 'Lisbon'][i], 10, 30); c.fillText('from £' + (299 + i * 120), 10, 160); }) }), x0 + 0.8 + i * Math.max(1.2, (w - 1.6) / 2), 1.9, -d + 0.06);
  } else if (variant === 'bookies') {
    for (let i = 0; i < Math.floor(w / 0.95); i++) for (let k = 0; k < 2; k++) { S.box(0.9, 0.55, 0.06, black, x0 + 0.5 + i * 0.95, 2.0 + k * 0.6, -d + 0.06); S.single(new THREE.PlaneGeometry(0.84, 0.49), glow([0x1c8a3a, 0x0a3a8c, 0x2a2a2a, 0x8a1c1c][(i + k) % 4]), x0 + 0.5 + i * 0.95, 2.0 + k * 0.6, -d + 0.095); }
    counter(x0, Math.min(x1 - 0.8, x0 + 3.2), -d + 1.5, paint(0x0a3a8c, 0.45), paint(0xffffff, 0.3)); till(x0 + 1.0, -d + 1.45);
    for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.9) if (!lane(x, 0.3)) { S.box(0.6, 1.5, 0.5, paint(0x1b1b1b, 0.4), x, 0.75, -1.2); S.single(new THREE.PlaneGeometry(0.5, 0.4), glow(0xf2c230), x, 1.15, -1.2 - 0.26, Math.PI); S.solid(x, -1.2, 0.6, 0.5, 1.5); }
    add([{ to: [x0 + 1.0, -d + 0.9], face: 0, act: 'tap', dur: 5 }, { to: [x0 + 1.6, -d + 0.9], face: 0, act: 'handover', dur: 2.4 }], false);
  } else if (variant === 'salon') {
    for (let i = 0; i < Math.max(1, Math.floor((w - 1) / 1.3)); i++) { const x = x0 + 0.8 + i * 1.3;
      S.box(0.9, 1.1, 0.03, new THREE.MeshStandardMaterial({ color: 0xdfe8ee, metalness: 0.9, roughness: 0.05 }), x, 1.55, -d + 0.05); S.box(1.0, 0.06, 0.3, white, x, 0.95, -d + 0.2);
      S.cyl(0.25, 0.25, 0.08, 14, paint(0x1b1b1b, 0.4), x, 0.55, -d + 1.0); S.box(0.45, 0.5, 0.08, paint(0x1b1b1b, 0.4), x, 0.85, -d + 1.22); S.cyl(0.04, 0.06, 0.5, 8, chrome(), x, 0.27, -d + 1.0); S.solid(x, -d + 1.0, 0.55, 0.55, 0.6);
      if (i < 2) add([{ to: [x + 0.45, -d + 1.55], face: Math.PI + 0.6, act: 'scoop', dur: 5 }, { to: [x - 0.4, -d + 1.5], face: Math.PI - 0.6, act: 'wipe', dur: 4 }], false);
    }
    const kx = Math.min(x1 - 0.8, Math.max(x0 + 0.8, away)); counter(kx - 0.6, kx + 0.6, -1.3, brandM, white, 1.0, 0.5); till(kx, -1.35);
  }
  return true;
}
