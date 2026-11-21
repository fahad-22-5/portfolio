/**
 * Organic foliage. Trees are a leaning tapered trunk, three branch forks and
 * 6-7 overlapping leaf volumes; hedges are rows of the same volumes billowing
 * over whatever they grow behind. Everything is batched: call tree()/hedge()
 * as often as you like, then flush() once to emit five InstancedMeshes.
 */
import * as THREE from 'three';
import { inst, rng } from '../util.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Leaf-cluster texture: a scatter of pointed leaves with veins, on transparent background. */
let leafTex = null;
function leafTexture() {
  if (leafTex) return leafTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), r = rng(91);
  for (let i = 0; i < 26; i++) {
    const x = 30 + r() * (S - 60), y = 30 + r() * (S - 60), L = 26 + r() * 22, a = r() * Math.PI * 2, w = L * (0.42 + r() * 0.15);
    const hue = 85 + r() * 30, light = 26 + r() * 22;
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `hsl(${hue}, ${45 + r() * 20}%, ${light}%)`;
    g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(-L * 0.1, -w, L / 2, 0); g.quadraticCurveTo(-L * 0.1, w, -L / 2, 0); g.fill();
    g.strokeStyle = `hsla(${hue}, 40%, ${light + 18}%, 0.7)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-L / 2, 0); g.lineTo(L / 2, 0); g.stroke();
    g.restore();
  }
  leafTex = new THREE.CanvasTexture(c); leafTex.colorSpace = THREE.SRGBColorSpace; leafTex.anisotropy = 4;
  return leafTex;
}

/** A leaf volume: ~110 leaf cards scattered through a lumpy unit ellipsoid. Normals point out of the
 *  volume (so it shades as a soft canopy) and vertex colours darken the inside and underside. */
function leafGeo(v) {
  const r = rng(300 + v), pos = [], nor = [], uv = [], col = [], c = new THREE.Color(), dark = new THREE.Color(0x1f3a18), mid = new THREE.Color(0x4a7a2e), tip = new THREE.Color(0x93a648);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), corner = new THREE.Vector3(), n = new THREE.Vector3();
  const N = 170;
  for (let k = 0; k < N; k++) {
    // point in the shell, biased outwards
    const u = r() * 2 - 1, th = r() * Math.PI * 2, rad = 0.55 + Math.pow(r(), 0.5) * 0.5, sq = Math.sqrt(1 - u * u);
    const cx = Math.cos(th) * sq * rad, cy = u * rad * 0.9, cz = Math.sin(th) * sq * rad;
    const bump = 1 + 0.15 * Math.sin(cx * 3.1 + v * 1.7) * Math.cos(cy * 2.7 + v);
    n.set(cx, cy, cz).normalize();
    const size = 0.28 + r() * 0.16;
    q.setFromEuler(e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI));
    const t = Math.min(1, Math.max(0, cy * 0.6 + 0.45 + (rad - 0.55) * 0.9));
    c.copy(dark).lerp(mid, Math.min(1, t * 1.5)); if (t > 0.65) c.lerp(tip, (t - 0.65) * 1.6);
    const quad = [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of quad) {
      corner.set(a * size / 2, b * size / 2, 0).applyQuaternion(q);
      pos.push(cx * bump + corner.x, cy * bump + corner.y, cz * bump + corner.z);
      nor.push(n.x, n.y, n.z); uv.push((a + 1) / 2, (b + 1) / 2); col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function createFoliage(ctx, parent) {
  const rnd = rng(4242), geos = [leafGeo(0), leafGeo(1), leafGeo(2)];
  const leaves = [[], [], []], trunks = [], branches = [];
  const TINT = [0xffffff, 0xe6f0d2, 0xd4e6c4, 0xf4f0c8, 0xc8dcc0];
  const dir = new THREE.Vector3();

  function blob(x, y, z, sx, sy, sz, tint) {
    leaves[Math.floor(rnd() * 3)].push({ x, y, z, sx, sy, sz, ry: rnd() * 6.28, rx: (rnd() - 0.5) * 0.5, c: tint ?? TINT[Math.floor(rnd() * TINT.length)] });
  }
  /** Cylinder from (ax,ay,az) to (bx,by,bz), pushed to `list` as a unit-height instance. */
  function limb(list, ax, ay, az, bx, by, bz, thick) {
    dir.set(bx - ax, by - ay, bz - az);
    const len = dir.length();
    list.push({ x: ax, y: ay, z: az, sx: thick, sy: len, sz: thick, q: new THREE.Quaternion().setFromUnitVectors(UP, dir.divideScalar(len)) });
  }

  /** London plane-ish street tree; k scales the whole tree. */
  function tree(x, z, k = 1) {
    const h = (3.6 + rnd() * 0.9) * k, lx = (rnd() - 0.5) * 0.9 * k, lz = (rnd() - 0.5) * 0.9 * k;
    const tx = x + lx, tz = z + lz;
    limb(trunks, x, 0, z, tx, h, tz, k);
    const az0 = rnd() * 6.28, crown = 1.75 * k;
    for (let i = 0; i < 3; i++) {
      const az = az0 + i * 2.09 + (rnd() - 0.5) * 0.6, reach = (1.5 + rnd() * 0.7) * k, rise = (1.5 + rnd() * 0.8) * k;
      const bx = tx + Math.sin(az) * reach, by = h + rise, bz = tz + Math.cos(az) * reach;
      limb(branches, tx, h - 0.3 * k, tz, bx, by, bz, k);
      blob(bx, by + 0.5 * k, bz, crown * (0.95 + rnd() * 0.3), crown * 0.78, crown * (0.95 + rnd() * 0.3));
    }
    blob(tx, h + 3.1 * k, tz, crown * 1.25, crown * 0.9, crown * 1.25);                       // top
    const extra = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < extra; i++) {
      const az = rnd() * 6.28, r = (1.2 + rnd() * 1.2) * k;
      blob(tx + Math.sin(az) * r, h + (1.2 + rnd() * 1.6) * k, tz + Math.cos(az) * r, crown * 0.85, crown * 0.65, crown * 0.85);
    }
  }

  /**
   * Overgrown hedge filling the box centred on (x, z), w x d, up to height h.
   * `wild` 0..1 makes it bulge and spill beyond the box.
   */
  function hedge(x, z, w, d, h, wild = 0.5) {
    const alongZ = d > w, len = alongZ ? d : w, girth = alongZ ? w : d;
    const r = Math.max(0.5, girth * 0.62), rows = h > 1.5 ? 2 : 1;
    for (let row = 0; row < rows; row++) {
      const step = r * 0.95;
      for (let s = -len / 2 + r * 0.6; s <= len / 2 - r * 0.6; s += step * (0.8 + rnd() * 0.4)) {
        const j = (rnd() - 0.5) * girth * 0.5 * wild, rr = r * (0.85 + rnd() * 0.45 * (0.5 + wild));
        const y = rows === 1 ? h - rr * 0.75 : row ? h - rr * 0.6 - rnd() * 0.25 : h * 0.42;
        blob(alongZ ? x + j : x + s, Math.max(rr * 0.45, y), alongZ ? z + s : z + j, rr, rr * (0.78 + rnd() * 0.25), rr, row ? undefined : 0xc4d6b8);
      }
    }
  }

  function flush() {
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8, map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
    geos.forEach((geo, i) => inst(parent, geo, leafMat, leaves[i]));
    const bark = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.95 });
    inst(parent, new THREE.CylinderGeometry(0.17, 0.33, 1, 14).translate(0, 0.5, 0), bark, trunks);
    inst(parent, new THREE.CylinderGeometry(0.06, 0.15, 1, 8).translate(0, 0.5, 0), bark, branches);
  }

  return { tree, hedge, blob, flush };
}
