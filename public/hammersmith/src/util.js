import * as THREE from 'three';
import { pavingSet, asphaltSet, concreteSet, brickSet } from './render/surfaces.js';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const FONT = '"Gill Sans", "Gill Sans MT", "Trebuchet MS", Arial, sans-serif';

/** Compass polar -> [x, z]. a = 0 is north (-Z), +90deg is east (+X). */
export const polar = (a, r) => [r * Math.sin(a), -r * Math.cos(a)];

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * A double-sided printed panel shows its texture mirrored from behind. This makes the back face sample the map
 * flipped left to right, so a hanging sign reads correctly from both sides with one mesh.
 */
export function readableBothSides(material) {
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace(/vMapUv/g, '( gl_FrontFacing ? vMapUv : vec2( 1.0 - vMapUv.x, vMapUv.y ) )')); };
  material.customProgramCacheKey = () => 'both-sides';
  return material;
}

/** Flat illuminated sign board, w x h metres, centred on its origin, facing +Z. Reads the right way round from both sides. */
export function sign(text, { w = 4, h = 1, bg = '#10131a', fg = '#fff', weight = 700, stripe, size = 0.6 } = {}) {
  const pxh = 128, pxw = Math.max(64, Math.round(pxh * w / h));
  const tex = canvasTex(pxw, pxh, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, pxw, pxh);
    if (stripe) stripe.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, pxh - 14 * (i + 1), pxw, 14); });
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = pxh * size;
    g.font = `${weight} ${fs}px ${FONT}`;
    const tw = g.measureText(text).width;
    if (tw > pxw * 0.9) { fs *= pxw * 0.9 / tw; g.font = `${weight} ${fs}px ${FONT}`; }
    g.fillText(text, pxw / 2, pxh / 2 - (stripe ? stripe.length * 6 : 0) + 4);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    readableBothSides(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  m.material.color.setScalar(1.25);                    // internally lit: just over the bloom threshold indoors
  return m;
}

/** London Underground roundel, `d` metres across. `lines` adds line-colour badges under the bar. */
export function roundel(d = 2, { text = 'UNDERGROUND', lines } = {}) {
  const tex = canvasTex(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512);
    g.beginPath(); g.arc(256, 256, 236, 0, TAU); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(256, 256, 190, 0, TAU); g.lineWidth = 74; g.strokeStyle = '#dc241f'; g.stroke();
    g.fillStyle = '#0019a8'; g.fillRect(0, 206, 512, 100);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 64; g.font = `700 ${fs}px ${FONT}`;
    const tw = g.measureText(text).width;
    if (tw > 470) { fs *= 470 / tw; g.font = `700 ${fs}px ${FONT}`; }
    g.fillText(text, 256, 260);
    if (lines) lines.forEach((col, i) => { g.fillStyle = col; g.fillRect(156 + i * (200 / lines.length), 330, 200 / lines.length - 6, 34); });
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(d, d),
    readableBothSides(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, toneMapped: false })));
}

/**
 * Slab between two rails of [x, y, z] points (left/right edges). thick = 0
 * gives a flat ribbon; otherwise skirts and an underside are added.
 */
export function slabStrip(L, R, thick = 0) {
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const down = (p) => [p[0], p[1] - thick, p[2]];
  for (let i = 0; i < L.length - 1; i++) {
    const l0 = L[i], l1 = L[i + 1], r0 = R[i], r1 = R[i + 1];
    quad(l0, r0, r1, l1);
    if (thick > 0) {
      quad(down(l0), down(l1), down(r1), down(r0));
      quad(l0, l1, down(l1), down(l0));
      quad(r0, down(r0), down(r1), r1);
    }
  }
  if (thick > 0) {
    const n = L.length - 1;
    quad(L[0], down(L[0]), down(R[0]), R[0]);
    quad(L[n], R[n], down(R[n]), down(L[n]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // world-space UVs (one tile = 4 m) so the tarmac texture runs seamlessly across every road
  const uv = new Float32Array(pos.length / 3 * 2);
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) { uv[j] = pos[i] * 0.25; uv[j + 1] = pos[i + 2] * 0.25; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Offset a 2D centre line [[x, z], ...] into left/right rails at height y. */
export function rails(pts, width, y = 0, closed = false) {
  const L = [], R = [], n = pts.length, hw = width / 2;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    const yy = typeof y === 'function' ? y(i) : y;
    L.push([pts[i][0] + dz * hw, yy, pts[i][1] - dx * hw]);
    R.push([pts[i][0] - dz * hw, yy, pts[i][1] + dx * hw]);
  }
  if (closed) { L.push(L[0]); R.push(R[0]); }
  return { L, R };
}

export const ribbon = (pts, width, y = 0.03, closed = false) => {
  const { L, R } = rails(pts, width, y, closed);
  return slabStrip(L, R, 0);
};

/** Resample a polyline every `step` metres -> [[x, z, dirX, dirZ], ...]. */
export function walk(pts, step, offset = 0) {
  const out = [];
  let carry = offset;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let d = carry; d < len; d += step) out.push([ax + dx * d, az + dz * d, dx, dz]);
    carry = (carry - len) % step; if (carry < 0) carry += step;
  }
  return out;
}

const _d = new THREE.Object3D(), _c = new THREE.Color();

/** Build an InstancedMesh from [{x,y,z,rx,ry,rz,sx,sy,sz,c}] (or q: Quaternion instead of the Euler angles). */
export function inst(parent, geo, mat, items, { shadow = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    _d.position.set(it.x || 0, it.y || 0, it.z || 0);
    if (it.q) _d.quaternion.copy(it.q); else _d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
    _d.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    _d.updateMatrix();
    m.setMatrixAt(i, _d.matrix);
    if (it.c !== undefined) m.setColorAt(i, _c.set(it.c));
  }
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadow; m.receiveShadow = shadow;
  m.computeBoundingSphere();
  parent.add(m);
  return m;
}

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  // 1 UV unit = 1 m on every face, so tiling textures (brick) keep their scale
  for (let i = 0; i < 24; i++) {
    const f = i >> 2;
    uv.setXY(i, uv.getX(i) * (f < 2 ? d : w), uv.getY(i) * (f === 2 || f === 3 ? d : h));
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Rect hole/outline for a Shape that will be rotated flat (shape y = -z). */
export function rectPath(x0, x1, z0, z1, Cls = THREE.Path) {
  const p = new Cls();
  p.moveTo(x0, -z0); p.lineTo(x1, -z0); p.lineTo(x1, -z1); p.lineTo(x0, -z1); p.closePath();
  return p;
}

/** Small seeded PRNG (mulberry32) so procedural detail is identical on every load. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const brickCache = new Map();
/** Brick-textured material. One tile = 2 m x 2 m: 16 courses of 8 bricks, per-brick tone variation. */
export function brickMat(hex) {
  if (brickCache.has(hex)) return brickCache.get(hex);
  const set = brickSet(hex);
  const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2) });
  brickCache.set(hex, m);
  return m;
}

/** A PBR set with every map tiled to `tile` metres (UVs are in metres). */
function tiled(set, tile) {
  const out = {}; for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = set[k].clone(); t.repeat.set(1 / tile, 1 / tile); t.needsUpdate = true; out[k] = t; }
  return out;
}

export function makeMaterials() {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const det = concreteSet();                                  // mottled render / pitted concrete detail, 2 m tile
  const conc = (color, o = {}) => std(color, { map: det.map, normalMap: det.normalMap, roughnessMap: det.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), ...o });
  const pave = pavingSet(3, 6, 0.66), street = pavingSet(8, 6, 0.6), tar = asphaltSet();
  return {
    ground: std(0xffffff, { roughness: 1, ...tiled(street, street.tile), normalScale: new THREE.Vector2(0.8, 0.8) }),
    asphalt: std(0xffffff, { side: THREE.DoubleSide, roughness: 1, map: tar.map, normalMap: tar.normalMap, roughnessMap: tar.roughnessMap, normalScale: new THREE.Vector2(0.9, 0.9) }),
    paving: std(0xffffff, { roughness: 1, ...tiled(pave, pave.tile) }),
    flag: std(0xffffff, { roughness: 1, ...tiled(pave, pave.tile) }), granite: conc(0xa9abae, { roughness: 0.7 }),
    pane: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.75 }),
    iron: std(0x131417, { roughness: 0.45, metalness: 0.5 }), lineYellow: std(0xeab308, { roughness: 0.7 }),
    floor: std(0x9097a3, { roughness: 0.35 }), inlay: std(0xb9bfca, { roughness: 0.3, side: THREE.DoubleSide }),
    concrete: conc(0x8d9299, { side: THREE.DoubleSide }), concreteDark: conc(0x5c6068),
    steel: std(0xaab2bd, { roughness: 0.3, metalness: 0.8 }), dark: std(0x15181e),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdff1fa, roughness: 0.05, metalness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.4, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    brick: brickMat(0x8a4a32), terracotta: std(0xb5553a), stone: conc(0xe9e4d8), white: conc(0xf2f0ea),
    tile: std(0xe7e9ec, { roughness: 0.4, side: THREE.DoubleSide }), red: std(0xd3211c, { roughness: 0.5 }),
    // lamps: emissive well over 1 so they bloom
    warm: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd6a5, emissiveIntensity: 3, roughness: 0.5 }),
    cool: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeaff, emissiveIntensity: 2.2, roughness: 0.5 }),
    blockWhite: conc(0xffffff),
    winGlass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0xffc777, emissiveIntensity: 0.0 }),
    trunk: std(0x5b4636), leaf: std(0xffffff),
    yellow: std(0xf2c230), buff: std(0xcdb37a),
  };
}
