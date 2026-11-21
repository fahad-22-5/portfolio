/**
 * Tools for building a shop fit-out in the shop's own frame.
 *
 * shopFrame(unit, edge): local origin = middle of the shopfront edge,
 * local +z = out towards the mall, -z = into the shop, x along the front.
 *
 * kit(): a builder that batches every static piece of the same material
 * into one merged mesh and turns local collision boxes into world ones.
 * kit.sub(frame) gives the same API in another frame while still feeding
 * the parent's batches, so many shops share a handful of draw calls.
 */
import * as THREE from 'three';

export function shopFrame(unit, edge) {
  const P = unit.poly, a = P[edge], b = P[(edge + 1) % P.length], F = frameFromEdge(a, b, unit.c);
  F.local = P.map(([x, z]) => F.toLocal(x, z));                      // the outline in the shop's own frame
  return F;
}

/** Frame on edge a->b, +z pointing away from the point `inside`. */
export function frameFromEdge(a, b, inside) {
  const M = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
  if (nx * (M[0] - inside[0]) + nz * (M[1] - inside[1]) < 0) { nx = -nx; nz = -nz; }
  const yaw = Math.atan2(nx, nz), c = Math.cos(yaw), s = Math.sin(yaw);
  const toWorld = (lx, lz) => [M[0] + lx * c + lz * s, M[1] - lx * s + lz * c];
  const toLocal = (x, z) => { const dx = x - M[0], dz = z - M[1]; return [dx * c - dz * s, dx * s + dz * c]; };
  return { origin: M, yaw, toWorld, toLocal, width: len };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** Box with 1 UV unit = 1 m on every face, so tiling textures keep their scale. */
export const metreBox = (w, h, d) => {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
  for (let i = 0; i < 24; i++) { const f = i >> 2; uv.setXY(i, uv.getX(i) * (f < 2 ? d : w), uv.getY(i) * (f === 2 || f === 3 ? d : h)); }
  return geo;
};

export function kit(ctx, parent, frame) {
  const { col } = ctx;
  const group = new THREE.Group(); group.position.set(frame.origin[0], 0, frame.origin[1]); group.rotation.y = frame.yaw; parent.add(group);
  const batches = new Map();
  function push(geo, mat, matrix, shadow) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    const key = mat.uuid + (shadow ? 's' : 'n');
    if (!batches.has(key)) batches.set(key, { mat, shadow, geos: [] });
    batches.get(key).geos.push(g);
  }

  /** The drawing API in a given frame (pre = matrix from that frame into this kit's group). */
  function api(F, pre) {
    const mesh = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, shadow = true) => {
      _p.set(x, y, z); _q.setFromEuler(_e.set(rx, ry, rz)); _s.set(sx, sy, sz); _m.compose(_p, _q, _s);
      if (pre) _m.premultiply(pre);
      push(geo, mat, _m, shadow);
    };
    const box = (w, h, d, mat, x, y, z, ry = 0, shadow = true) => mesh(metreBox(w, h, d), mat, x, y, z, 0, ry, 0, 1, 1, 1, shadow);
    const cyl = (rt, rb, h, seg, mat, x, y, z, rx = 0, rz = 0, shadow = true) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, 0, rz, 1, 1, 1, shadow);
    const single = (geo, mat, x = 0, y = 0, z = 0, ry = 0) => {
      const m = new THREE.Mesh(geo, mat), [wx, wz] = F.toWorld(x, z);
      if (pre) { m.position.set(wx, y, wz); m.rotation.y = F.yaw + ry; parent.add(m); } else { m.position.set(x, y, z); m.rotation.y = ry; group.add(m); }
      m.castShadow = true; m.receiveShadow = true; return m;
    };
    const solid = (x, z, w, d, h, { ry = 0, thick = h, pad = 0.05 } = {}) => { const [wx, wz] = F.toWorld(x, z); col.rect(wx, wz, w, d, { rot: F.yaw + ry, h, thick, pad }); };
    const seg = (p, q, h0, h1, mat, { collide = true, t = 0.2, shadow = true } = {}) => {
      const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz); if (len < 0.02) return;
      const ry = Math.atan2(-dz, dx), cx = (p[0] + q[0]) / 2, cz = (p[1] + q[1]) / 2;
      box(len, h1 - h0, t, mat, cx, (h0 + h1) / 2, cz, ry, shadow);
      if (collide) solid(cx, cz, len, t, h1, { ry, thick: h1 - h0 });
    };
    const flat = (poly, mat, y, down = false) => {
      const k = down ? 1 : -1, sh = new THREE.Shape(); poly.forEach(([x, z], i) => (i ? sh.lineTo(x, k * z) : sh.moveTo(x, k * z)));
      const geo = new THREE.ShapeGeometry(sh).rotateX(down ? Math.PI / 2 : -Math.PI / 2);
      const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
      mesh(geo, mat, 0, y, 0, 0, 0, 0, 1, 1, 1, false);
    };
    return { frame: F, mesh, box, cyl, single, solid, seg, flat, at: F.toWorld };
  }

  const own = api(frame, null);
  /** Same API in another frame (given in this kit's parent coordinates), batched into this kit. */
  function sub(F) {
    const inv = new THREE.Matrix4().makeRotationY(frame.yaw).setPosition(frame.origin[0], 0, frame.origin[1]).invert();
    const pre = new THREE.Matrix4().makeRotationY(F.yaw).setPosition(F.origin[0], 0, F.origin[1]).premultiply(inv);
    return api(F, pre);
  }

  function flush() {
    for (const { mat, shadow, geos } of batches.values()) {
      let n = 0; for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
      for (const g of geos) {
        const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3);
        if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += c; g.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat); m.castShadow = shadow; m.receiveShadow = true; group.add(m);
    }
    batches.clear();
  }
  return { group, ...own, sub, flush };
}
