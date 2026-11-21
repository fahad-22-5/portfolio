/**
 * Broadway Hammersmith ground floor, traced from the centre's April 2024
 * letting plan (Savills / GCW) and put to real scale.
 *
 *   Map pixels (u right, v down, north up) -> world metres:
 *     x = 50 + (u - 844) * S,  z = -1.6 + (v - 509) * S,   S = 0.115 m/px
 *
 * Scale: kiosks on the plan are ~26 px across and 3 m in reality.
 * Anchor: the far (north-east) end of the footbridge lands on the existing
 * Bute Gardens gate, so everything east of the mall stays where it was.
 *
 * Walkability is a 0.25 m grid built once at load: inside the envelope, not
 * inside a unit, with gaps under 1.8 m closed off (the slivers between units
 * on the plan), then flood-filled from the main mall. Walk-in shops, the
 * footbridge and the ticket hall are added on top.
 */
export const S = 0.115;
export const W = (u, v) => [50 + (u - 844) * S, -1.6 + (v - 509) * S];
export const CEIL = 5.97, ROOF = 6.5;              // roof slab top = the bus station deck (lift top landing)

/* ---------- geometry helpers ---------- */
export function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export const centroid = (P) => { let a = 0, cx = 0, cz = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length], f = x1 * z2 - x2 * z1; a += f; cx += (x1 + x2) * f; cz += (z1 + z2) * f; } a /= 2; return Math.abs(a) < 1e-9 ? P[0] : [cx / (6 * a), cz / (6 * a)]; };
export const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a / 2); };
const bbox = (P) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of P) { if (x < a) a = x; if (x > b) b = x; if (z < c) c = z; if (z > d) d = z; } return { minX: a, maxX: b, minZ: c, maxZ: d }; };
const flatToPoly = (f) => { const o = []; for (let i = 0; i < f.length; i += 2) o.push(W(f[i], f[i + 1])); return o; };

/* ---------- envelope: the mall's outside wall, with its six exits ---------- */
const ENV_PX = [
  [58, 172], [112, 138],                       // -> NW exit (by Starbucks)
  [194, 110], [258, 52], [334, 18], [498, 22], [512, 40], [573, 60],   // -> N exit (station front gate passage)
  [647, 60], [742, 60], [654, 239], [765, 408], [633, 497], [568, 536], [567, 664],   // -> footbridge
  [596, 708], [643, 690], [802, 931],          // -> SE exit (Butterwick)
  [822, 995], [790, 1060], [749, 1144], [732, 1280],   // -> S exit (past Tesco)
  [650, 1300], [600, 1322], [600, 1385], [552, 1385], [330, 1360], [150, 1360], [128, 1300], [30, 1282],   // -> W exit (Bradmore Square)
  [30, 1180], [30, 996], [58, 990],
];
export const ENVELOPE = ENV_PX.map(([u, v]) => W(u, v));
/** OPEN[i] names the exit on edge ENVELOPE[i] -> ENVELOPE[i+1]. */
export const OPEN = { 1: 'nw', 7: 'north', 14: 'footbridge', 17: 'se', 21: 'south', 29: 'west' };
export const ENV_BOX = bbox(ENVELOPE);
/** The main door: the NW exit by Starbucks, where the big stone entrance building stands. m = middle of the
 *  opening, n = outward unit normal, front(d) = the point d metres out in front of it. */
export const MAIN_DOOR = (() => {
  const a = ENVELOPE[1], b = ENVELOPE[2], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let n = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len]; if (inPoly(m[0] + n[0], m[1] + n[1], ENVELOPE)) n = [-n[0], -n[1]];
  return { m, n, width: len, front: (d) => [m[0] + n[0] * d, m[1] + n[1] * d] };
})();
export const inEnvelope = (x, z) => x >= ENV_BOX.minX && x <= ENV_BOX.maxX && z >= ENV_BOX.minZ && z <= ENV_BOX.maxZ && inPoly(x, z, ENVELOPE);

/** Island around the mall (pavement), and the gyratory centre line around that. */
function hull(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
const grow = (P, d) => { const [cx, cz] = centroid(P); return P.map(([x, z]) => { const L = Math.hypot(x - cx, z - cz) || 1; return [x + (x - cx) / L * d, z + (z - cz) / L * d]; }); };
const HULL = hull(ENVELOPE.concat([W(1198, 1059), W(1011, 1171), W(854, 552), [58, -6], [58, 6]]));
/** Bulge a loop out round the main entrance building. In the entrance's own frame (d metres out of the door, o metres
 *  east along the frontage) the building stands at d = 0..16.5, o = -15..15:
 *    - in front of it the line is pushed out to `clear`
 *    - to the east it eases back to the original line over 25 m
 *    - to the west, where the hull turns its own corner, the line runs up the building's flank at o = -side and
 *      rounds the corner with radius `r` (it used to jump 30 m sideways there, which made a right-angled dog-leg). */
function bulge(P, clear, side, r) {
  const D = MAIN_DOOR, t = [-D.n[1], D.n[0]], S = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let j = 0; j < k; j++) {
      const x = a[0] + (b[0] - a[0]) * j / k, z = a[1] + (b[1] - a[1]) * j / k;
      S.push([(x - D.m[0]) * D.n[0] + (z - D.m[1]) * D.n[1], (x - D.m[0]) * t[0] + (z - D.m[1]) * t[1]]);
    }
  }
  const n = S.length, o0 = -side + r, world = (d, o) => [D.m[0] + D.n[0] * d + t[0] * o, D.m[1] + D.n[1] * d + t[1] * o];
  const cut = S.map(([d, o]) => d > -60 && o >= -side && o < o0);   // the hull's own corner, replaced by the flank and the arc
  /** The flank and the rounded corner, from the hull's west side (through `from`, the last point west of the flank) to the front. */
  const corner = (from, first) => {
    const k0 = (-side - from[1]) / ((first[1] - from[1]) || 1), dj = Math.min(clear - r, from[0] + (first[0] - from[0]) * k0), path = [];
    for (let d = dj; d < clear - r; d += 2) path.push([d, -side]);
    const steps = Math.max(2, Math.ceil(r * Math.PI / 4));
    for (let i = 0; i < steps; i++) { const a = Math.PI / 2 * i / steps; path.push([clear - r + r * Math.sin(a), o0 - r * Math.cos(a)]); }
    return path;
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const [d, o] = S[i];
    if (cut[i]) {
      if (cut[(i - 1 + n) % n]) continue;                           // only at the start of the run
      let e = i; while (cut[(e + 1) % n]) e = (e + 1) % n;
      const before = S[(i - 1 + n) % n], after = S[(e + 1) % n];
      const path = before[1] < -side ? corner(before, S[i]) : corner(after, S[e]).reverse();
      for (const q of path) out.push(world(q[0], q[1]));
      continue;
    }
    const w = o < 20 ? 1 : o > 45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (o - 20) / 25);
    const push = d > -2 && o >= o0 ? Math.max(0, clear - d) * w : 0;
    out.push(world(d + push, o));
  }
  return out;
}
export const ISLAND = bulge(grow(HULL, 5), 23, 19.5, 6);          // pavement in front of and beside the entrance building
export const GYRATORY = bulge(grow(HULL, 13), 31, 27.5, 14);      // road centre line sweeps round it, 8 m further out

/* ---------- units (from the plan) ---------- */
// kind: shop | food | kiosk | vacant | unit30 | station | service | lift | walkin
const RAW = [["Vacant","vacant",[337,20,496,27,497,39,512,41,511,64,379,153,357,169,321,186,299,150,281,162,257,122,291,100,263,54,334,58]],["Joe & the Juice","food",[256,57,261,59,284,99,218,141,212,143,194,110,210,83]],["Scribbler","shop",[253,125,273,158,265,166,273,178,248,196,244,195,216,149]],["Starbucks","food",[112,141,141,147,170,201,123,229,103,229,64,228,59,169]],["Pure.","food",[350,176,354,176,398,252,378,265,345,263,343,272,314,272,292,271,258,216,293,192,321,192]],["Greggs","food",[173,205,186,224,185,273,127,273,119,279,79,279,60,279,60,235,125,234]],["PAUL","food",[156,278,185,278,185,325,90,328,61,328,60,285,119,284,127,283,129,279]],["Crosstown","kiosk",[221,327,243,327,243,361,221,361]],["TEC","shop",[184,330,184,370,132,368,133,333]],["Lovisa","shop",[300,359,346,359,351,362,363,378,362,395,337,397,308,419,303,419,277,385,277,370]],["Hammersmith station","station",[654,239,765,408,729,432,720,430,709,414,703,415,696,421,706,439,702,452,633,497,621,494,611,479,606,480,601,485,609,500,604,512,568,536,552,534,514,482,509,472,522,461,502,430,504,361,603,297,604,292,596,276]],["TO LET","vacant",[372,380,464,380,465,476,462,479,458,479,436,449,403,473,397,471,346,403,366,401,367,383]],["Accessorize","shop",[133,374,185,375,186,444,161,465,132,489]],["Auntie Anne's","kiosk",[230,417,248,417,248,443,230,443]],["Hotel Chocolat","shop",[339,403,378,454,350,476,347,475,309,427]],["TO LET","vacant",[60,333,128,333,127,498,188,450,218,488,204,499,155,535,70,536,70,516,78,510,78,503,70,497,70,455,62,452]],["Timpson","shop",[381,459,395,479,368,498,352,480]],["Vuse","kiosk",[262,483,275,473,290,493,275,502]],["Oseyo","shop",[434,456,463,492,487,530,404,591,398,595,406,552,369,504]],["Top Gift","kiosk",[297,533,309,521,324,540,310,551]],["TO LET","vacant",[107,539,154,541,153,560,115,560,69,560,69,540]],["Boots","shop",[218,494,279,570,143,675,71,678,66,677,65,565,157,564,159,537]],["McDonald's","walkin",[489,535,553,626,549,639,568,666,566,671,506,709,492,707,476,702,400,602]],["UNIT 30","unit30",[282,573,307,608,170,715,166,713,143,678]],["Pret A Manger","walkin",[310,612,339,647,200,747,198,750,192,748,173,718]],["Sprigs","food",[128,681,142,683,173,730,98,732,67,731,66,685]],["Chopstix","food",[340,652,345,654,378,697,245,799,235,786,231,789,225,793,222,791,199,755]],["Lift","lift",[502,736,514,739,522,751,519,765,505,772,494,770,486,759,488,745]],["Cards Galore","shop",[604,712,624,741,547,794,532,775,534,753]],["Hays","shop",[137,735,178,735,190,755,167,771,109,773,68,773,68,738]],["Oliver Bonas","shop",[627,745,643,772,569,823,550,799]],["Wasabi","food",[388,710,419,748,417,775,301,866,278,836,285,828,267,803]],["Betfred","shop",[193,760,220,797,177,827,132,828,132,823,124,817,85,817,69,817,69,778,168,777]],["TO LET","vacant",[637,691,786,912,744,909,690,901,695,821,620,702]],["TO LET","vacant",[70,822,124,823,129,834,143,834,142,850,139,850,71,852]],["Pelicana","food",[646,776,678,824,680,856,676,893,664,893,662,899,639,896,621,894,573,827]],["LEON","food",[417,782,445,817,473,820,347,913,324,927,315,906,328,894,310,865]],["Service corridor","service",[378,699,387,709,266,803,280,824,277,839,300,869,309,864,324,896,294,922,268,889,259,883,216,922,218,954,202,955,187,955,186,896,183,892,161,891,161,861,215,862,222,858,239,842,212,805,233,789,244,801,247,800,377,703]],["Station building","station",[854,552,1198,1059,1011,1171,992,1171,983,1170,978,1164,802,931,643,690,649,682]],["Simya","food",[212,809,237,841,234,846,218,859,159,861,159,893,184,894,184,955,145,958,144,939,142,931,108,927,84,909,70,880,70,856,146,855,147,833,178,832]],["Superdrug","shop",[475,824,511,872,416,942,410,948,417,960,413,966,401,974,367,975,346,975,328,932]],["Café de Nata","food",[512,876,536,907,488,942,484,944,481,941,464,912]],["Mask Box","kiosk",[670,937,682,926,696,945,685,955]],["Harriet's","shop",[539,913,562,942,559,968,524,967,503,966,490,947]],["Chez Maiss","food",[261,885,291,924,311,910,367,1033,369,1040,326,1042,292,1043,292,1011,258,957,255,954,220,954,219,921]],["Printbox","kiosk",[691,964,702,954,716,971,705,982]],["COSTA","food",[484,951,499,970,552,1000,552,1006,517,1035,476,1037,422,1038,421,998]],["Great Scotts","food",[373,979,403,980,405,1038,392,1040,374,1038,349,982]],["Lola's","kiosk",[629,1014,638,1002,652,1019,646,1024]],["SUPERCUTS","shop",[736,989,783,995,791,995,798,990,817,1016,788,1038,751,1065,721,1026,721,998]],["Kindred","food",[127,996,144,996,146,1030,171,1030,171,1128,149,1130,149,1167,62,1170,40,1171,38,1164,34,1101,50,1099,52,1092,49,1075,31,1074,30,1002]],["TESCO","shop",[588,1061,694,1068,749,1144,736,1151,732,1158,732,1275,594,1276,566,1275,567,1221,564,1218,445,1217,445,1111,530,1110]],["CRAFT BEER CO.","food",[298,1112,382,1113,382,1171,363,1171,360,1174,360,1216,322,1217,311,1218,311,1247,293,1247,291,1257,259,1256,259,1206,296,1141]],["Green Mosaic","food",[163,1209,253,1209,254,1255,247,1255,210,1255,208,1263,164,1263]],["TO LET","vacant",[151,1283,164,1283,175,1289,312,1289,313,1352,305,1352,159,1352,159,1335,147,1332,135,1320,140,1308,134,1298]],["Lift","lift",[340,1304,355,1306,363,1317,361,1331,350,1339,339,1339,328,1329,328,1314]]];

/** Fascia colours for the simple shopfronts (bg, fg, optional style). */
const BRAND = {
  'Joe & the Juice': ['#e5007e', '#ffffff'], Scribbler: ['#111111', '#ffffff'], Starbucks: ['#00704a', '#ffffff', 'roundel'], 'Pure.': ['#1f3fa8', '#ffffff'],
  Greggs: ['#00264d', '#ffffff', 'grid'], PAUL: ['#141414', '#d8b25a'], Crosstown: ['#1d1d1b', '#ffffff'], TEC: ['#ffffff', '#1b1b1b'], Lovisa: ['#111111', '#ffffff'],
  Accessorize: ['#1b1b1b', '#ffffff'], "Auntie Anne's": ['#0057a8', '#ffffff'], 'Hotel Chocolat': ['#2b1a12', '#e9d8b8'], Timpson: ['#c8102e', '#ffffff'], Vuse: ['#1b1b1b', '#ff6b00'],
  Oseyo: ['#ffffff', '#d6202a'], 'Top Gift': ['#7a3fb0', '#ffffff'], Boots: ['#05054b', '#ffffff'], Sprigs: ['#3fa34d', '#ffffff'], Chopstix: ['#1f7a3a', '#ffffff'],
  'Cards Galore': ['#ffffff', '#d6202a'], Hays: ['#ffffff', '#1d1d1b'], 'Oliver Bonas': ['#ffffff', '#1b1b1b'], Wasabi: ['#b6d43a', '#ffffff', 'slats'], Betfred: ['#0a3a8c', '#ffffff'],
  Pelicana: ['#e2231a', '#ffffff'], LEON: ['#1b1b1b', '#ffffff'], Simya: ['#f4efe4', '#3a2a1c'], Superdrug: ['#e5007d', '#ffffff'], 'Café de Nata': ['#f4e9cf', '#7a4a1e'],
  'Mask Box': ['#ffffff', '#1b1b1b'], "Harriet's": ['#f2e6dc', '#3a2a1c'], 'Chez Maiss': ['#f5efe2', '#3a2a1c'], Printbox: ['#ffffff', '#1f3fa8'], COSTA: ['#6d1f37', '#ffffff'],
  'Great Scotts': ['#22324a', '#ffffff'], "Lola's": ['#f3b7c8', '#3a2a1c'], SUPERCUTS: ['#e30613', '#ffffff'], Kindred: ['#f2efe8', '#333333'], TESCO: ['#ffffff', '#00539f'],
  'CRAFT BEER CO.': ['#19a7a8', '#e8c66a', 'tiles'], 'Green Mosaic': ['#ffffff', '#2f7f3f'], 'TO LET': ['#e6e3dc', '#555555'], 'UNIT 30': ['#ffe14d', '#1b1b1b'],
};

export const UNITS = RAW.map(([name, kind, flat]) => {
  const poly = flatToPoly(flat), [bg, fg, style] = BRAND[name] || ['#e6e3dc', '#333333'];
  return { name, kind, poly, c: centroid(poly), box: bbox(poly), bg, fg, style, area: area(poly) };
});
/** Edge outward normal of a unit (away from its centroid). */
function edgeOf(u, i) {
  const P = u.poly, a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (nx * (m[0] - u.c[0]) + nz * (m[1] - u.c[1]) < 0) { nx = -nx; nz = -nz; }
  return { a, b, len, m, nx, nz, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
}
// Shops whose only frontage is the street (west face, Shepherd's Bush Rd): the plan stops their outline ~1.1 m
// short of the outside wall, so push that edge out to the wall and open it to the pavement.
const STREET = { Sprigs: 4, Hays: 5, Betfred: 7 };
for (const u of UNITS) {
  const e = STREET[u.name]; if (e === undefined) continue;
  const { a, b, nx, nz } = edgeOf(u, e);
  for (const p of [a, b]) { let o = 0; while (o < 3 && inEnvelope(p[0] + nx * (o + 0.05), p[1] + nz * (o + 0.05))) o += 0.05; p[0] += nx * o; p[1] += nz * o; }
  u.street = e; u.c = centroid(u.poly); u.box = bbox(u.poly); u.area = area(u.poly);
}
/** The street-facing front of a street shop (same shape as unitFronts). */
export const streetFronts = (u) => (u.street === undefined ? [] : [edgeOf(u, u.street)]);
/** Within a metre either side of a street shop's front (so its doorway has no solid seam). */
const STREET_EDGES = UNITS.flatMap(streetFronts);
function atStreetDoor(x, z) {
  for (const { a, b, len, nx, nz } of STREET_EDGES) {
    const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / len, o = (x - a[0]) * nx + (z - a[1]) * nz;
    if (t > 0.3 && t < len - 0.3 && o > -1 && o < 1) return true;
  }
  return false;
}

export const unitAt = (x, z) => { for (const u of UNITS) if (x >= u.box.minX && x <= u.box.maxX && z >= u.box.minZ && z <= u.box.maxZ && inPoly(x, z, u.poly)) return u; return null; };
export const unitNamed = (n) => UNITS.find((u) => u.name === n);

/* ---------- footbridge: 6 m corridor between the locker banks, from the mall mouth to the Bute Gardens gate ---------- */
// local +x runs from the mall (0) to the far doors (L); local z across, -3 north wall, +3 south wall
const FB0 = W(581.5, 686), FB_DIR = [0.829, -0.559];
export const FOOTBRIDGE = { origin: FB0, yaw: Math.atan2(-FB_DIR[1], FB_DIR[0]), length: 36.4, half: 3 };
const fc = Math.cos(FOOTBRIDGE.yaw), fs = Math.sin(FOOTBRIDGE.yaw);
export const fbWorld = (lx, lz) => [FB0[0] + lx * fc + lz * fs, FB0[1] - lx * fs + lz * fc];
export const fbLocal = (x, z) => { const dx = x - FB0[0], dz = z - FB0[1]; return [dx * fc - dz * fs, dx * fs + dz * fc]; };
/** Depth of the Broadway entrance building at the far end (the porch the corridor runs through to the street doors). */
export const PORCH = 5;
export const inFootbridge = (x, z) => { const [lx, lz] = fbLocal(x, z); return lx > -1 && lx < FOOTBRIDGE.length + PORCH && lz > -FOOTBRIDGE.half && lz < FOOTBRIDGE.half; };

/* ---------- Tube ticket hall: gateline on the station block face that borders the north lobby ---------- */
const HC = 0.545, HS = -0.84;
export const HALL_ROT = Math.atan2(HS, HC);
export const HALL_O = [12.85, -37.29];
export const hallX = (x, z) => HALL_O[0] + x * HC + z * HS;
export const hallZ = (x, z) => HALL_O[1] - x * HS + z * HC;
export const hallLocalX = (wx, wz) => (wx - HALL_O[0]) * HC - (wz - HALL_O[1]) * HS;
export const hallLocalZ = (wx, wz) => (wx - HALL_O[0]) * HS + (wz - HALL_O[1]) * HC;
export const HALL = { x0: 15, x1: 26, z0: 0.7, z1: 9.3 };
export const STAIR = { x0: 18.5, x1: 26.5, z0: 3, z1: 7 };
export const PLAT = { x0: 26.5, x1: 44.5, z0: -5, z1: 15, y: -4 };
export const inHall = (wx, wz) => { const x = hallLocalX(wx, wz), z = hallLocalZ(wx, wz); return x > 14.3 && x < HALL.x1 && z > HALL.z0 - 0.1 && z < HALL.z1 + 0.1; };
export const inStairHole = (wx, wz) => { const x = hallLocalX(wx, wz), z = hallLocalZ(wx, wz); return x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 && z < STAIR.z1; };

/** Skylight over the mall between Pret / Chopstix and McDonald's (as in both videos). */
export const SKYLIGHT = { c: W(372, 636), yaw: Math.atan2(0.62, 0.787), hw: 3.2, hl: 9 };

/** Within 2.5 m outside one of the open exits. */
const EXITS = Object.keys(OPEN).map((k) => { const a = ENVELOPE[+k], b = ENVELOPE[(+k + 1) % ENVELOPE.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, len }; });
function pastExit(x, z) {
  if (inPoly(x, z, ENVELOPE)) return false;
  for (const { a, b, len } of EXITS) {
    const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / len, o = Math.abs((x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0])) / len;
    if (t > -0.3 && t < len + 0.3 && o < 2.5) return true;
  }
  return false;
}

/* ---------- walkability grid ---------- */
const CELL = 0.25, GX0 = ENV_BOX.minX - 1, GZ0 = ENV_BOX.minZ - 1;
const NX = Math.ceil((ENV_BOX.maxX - GX0 + 1) / CELL), NZ = Math.ceil((ENV_BOX.maxZ - GZ0 + 1) / CELL);
const WALK = new Uint8Array(NX * NZ);       // 1 = mall floor you can stand on
{
  const base = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (j + 0.5) * CELL;
    // a cell counts as inside if any part of it is (else a saw-tooth of solid cells lines every exit)
    const h = CELL / 2, inside = inPoly(x, z, ENVELOPE) || inPoly(x - h, z - h, ENVELOPE) || inPoly(x + h, z - h, ENVELOPE) || inPoly(x - h, z + h, ENVELOPE) || inPoly(x + h, z + h, ENVELOPE);
    if ((inside || inFootbridge(x, z) || pastExit(x, z)) && !unitAt(x, z)) base[i + j * NX] = 1;   // floor continues out of every exit, so no exit gets eroded
  }
  // opening (erode then dilate, radius 0.9 m) removes the slivers between units and alleys too narrow to read as mall
  const R = Math.round(0.9 / CELL), dist = new Float32Array(NX * NZ);
  const distance = (src, val) => {           // chamfer distance to the nearest cell != val
    for (let k = 0; k < NX * NZ; k++) dist[k] = src[k] === val ? 1e9 : 0;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = i + j * NX; if (!dist[k]) continue; let d = dist[k];
      if (i > 0) d = Math.min(d, dist[k - 1] + 1); if (j > 0) d = Math.min(d, dist[k - NX] + 1); if (i > 0 && j > 0) d = Math.min(d, dist[k - NX - 1] + 1.414); if (i < NX - 1 && j > 0) d = Math.min(d, dist[k - NX + 1] + 1.414); dist[k] = d; }
    for (let j = NZ - 1; j >= 0; j--) for (let i = NX - 1; i >= 0; i--) { const k = i + j * NX; if (!dist[k]) continue; let d = dist[k];
      if (i < NX - 1) d = Math.min(d, dist[k + 1] + 1); if (j < NZ - 1) d = Math.min(d, dist[k + NX] + 1); if (i < NX - 1 && j < NZ - 1) d = Math.min(d, dist[k + NX + 1] + 1.414); if (i > 0 && j < NZ - 1) d = Math.min(d, dist[k + NX - 1] + 1.414); dist[k] = d; }
  };
  distance(base, 1); const eroded = new Uint8Array(NX * NZ); for (let k = 0; k < NX * NZ; k++) eroded[k] = dist[k] > R ? 1 : 0;
  distance(eroded, 0); const opened = new Uint8Array(NX * NZ); for (let k = 0; k < NX * NZ; k++) opened[k] = base[k] && dist[k] <= R + 0.5 ? 1 : 0;
  // keep only what connects to the main mall
  const [sx, sz] = W(300, 450), seed = Math.floor((sx - GX0) / CELL) + Math.floor((sz - GZ0) / CELL) * NX, q = [seed]; WALK[seed] = 1;
  while (q.length) { const k = q.pop(), i = k % NX; for (const n of [k - 1, k + 1, k - NX, k + NX]) { if (n < 0 || n >= NX * NZ || WALK[n] || !opened[n]) continue; if ((n === k - 1 && i === 0) || (n === k + 1 && i === NX - 1)) continue; WALK[n] = 1; q.push(n); } }
  // walk-in shops, the ticket hall
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const x = GX0 + (i + 0.5) * CELL, z = GZ0 + (j + 0.5) * CELL, u = unitAt(x, z);
    if ((u && (u.kind === 'walkin' || u.kind === 'shop' || u.kind === 'food' || u.kind === 'lift')) || inHall(x, z) || atStreetDoor(x, z)) WALK[i + j * NX] = 1;   // every shop is walk-in
  }
}
/** True where the cat can stand on the mall floor (inside the envelope). */
export function isMallFloor(x, z) {
  const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL);
  return i >= 0 && j >= 0 && i < NX && j < NZ && WALK[i + j * NX] === 1;
}
/** Solid inside the mall: in the envelope but not floor (units, back of house, slivers). */
export const isMallSolid = (x, z) => inEnvelope(x, z) && !isMallFloor(x, z);
/** Open mall floor, i.e. not inside a walk-in shop either. */
export const isConcourse = (x, z) => isMallFloor(x, z) && !(unitAt(x, z));
/** Indoors for the camera (mall, footbridge, hall). */
export const isIndoors = (x, z) => inEnvelope(x, z) || inFootbridge(x, z);

/** The spot just outside a unit's longest open-mall edge (for landmark cards and shopfronts). */
export function unitFronts(u, out = 1.6) {
  const P = u.poly, res = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1.2) continue;
    let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (nx * (m[0] - u.c[0]) + nz * (m[1] - u.c[1]) < 0) { nx = -nx; nz = -nz; }
    let hit = 0; for (const t of [0.2, 0.5, 0.8]) for (const o of [out * 0.6, out * 1.4]) if (isConcourse(a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + nz * o)) hit++;
    if (hit >= 4) res.push({ a, b, len, m, nx, nz, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
  }
  return res;
}
export function unitFront(name, out = 2.2) {
  const u = unitNamed(name); if (!u) return [0, 0];
  const f = unitFronts(u).sort((p, q) => q.len - p.len)[0];
  return f ? [f.m[0] + f.nx * out, f.m[1] + f.nz * out] : u.c;
}

/** Kiosk-free open floor sample points (for ring lights). */
export function floorSamples(step) {
  const out = [];
  for (let z = ENV_BOX.minZ; z <= ENV_BOX.maxZ; z += step) for (let x = ENV_BOX.minX; x <= ENV_BOX.maxX; x += step) if (isConcourse(x, z) && isConcourse(x + 1.6, z) && isConcourse(x - 1.6, z) && isConcourse(x, z + 1.6) && isConcourse(x, z - 1.6)) out.push([x, z]);
  return out;
}

/* ---------- glass lifts (the two 'Lift' units on the plan) ---------- */
/** Shaft centred on the unit, doors (local +Z) turned towards the most open concourse. */
export const LIFT_HALF = 1.75;
export const LIFTS = UNITS.filter((u) => u.kind === 'lift').map((u) => {
  let best = 0, rot = 0;
  for (let k = 0; k < 32; k++) {
    const a = k / 32 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a); let score = 0;
    for (let d = 2.2; d <= 6.2; d += 0.5) for (const o of [-1.2, 0, 1.2]) if (isConcourse(u.c[0] + dx * d + dz * o, u.c[1] + dz * d - dx * o)) score++;
    if (score > best) { best = score; rot = a; }
  }
  return { x: u.c[0], z: u.c[1], rot };
});
/** Inside a lift shaft (with a small margin), e.g. to keep the roof deck out of it. */
export function inLiftShaft(x, z, m = 0.1) {
  for (const L of LIFTS) { const c = Math.cos(L.rot), s = Math.sin(L.rot), dx = x - L.x, dz = z - L.z, lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) < LIFT_HALF + m && Math.abs(lz) < LIFT_HALF + m) return true; }
  return false;
}
export const liftSquare = (L, m = 0.1) => { const c = Math.cos(L.rot), s = Math.sin(L.rot), h = LIFT_HALF + m; return [[-h, -h], [h, -h], [h, h], [-h, h]].map(([lx, lz]) => [L.x + lx * c + lz * s, L.z - lx * s + lz * c]); };
/** Inside the skylight footprint (its frame stands up above the deck). */
export function inSkylight(x, z, m = 0) {
  const c = Math.cos(SKYLIGHT.yaw), s = Math.sin(SKYLIGHT.yaw), dx = x - SKYLIGHT.c[0], dz = z - SKYLIGHT.c[1], lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < SKYLIGHT.hw + m && Math.abs(lz) < SKYLIGHT.hl + m;
}
