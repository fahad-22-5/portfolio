/**
 * Static batching: after the world is built, every mesh that never moves is
 * merged with others sharing its material (and shadow flags and vertex layout)
 * into one mesh per 48 m cell, in world space. Thousands of little meshes
 * become a few hundred draw calls; cells keep frustum culling useful.
 *
 * Anything under an object with userData.dynamic (the cat, lifts, people,
 * laptops, the sky dome) is left alone, as are instanced, skinned,
 * multi-material and non-culled meshes.
 */
import * as THREE from 'three';

const _n = new THREE.Matrix3(), _v = new THREE.Vector3();

/** Materials built inline per object are often identical: key them by what they look like, not their identity. */
const tex = (t) => (t ? t.uuid : '-');
/** Has its own shader hook (the base class's empty method does not count). */
const customised = (m) => m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile;
function matKey(m) {
  if (customised(m)) return m.uuid;
  const c = (v) => (v && v.isColor ? `${v.r.toFixed(3)},${v.g.toFixed(3)},${v.b.toFixed(3)}` : '');   // not the hex string: HDR colours (> 1) all clamp to the same hex
  return [m.type, c(m.color), c(m.emissive), m.emissiveIntensity, m.roughness, m.metalness, m.opacity, m.transparent, m.side, m.vertexColors, m.flatShading, m.alphaTest, m.toneMapped, m.depthWrite, m.depthTest,
    m.envMapIntensity, m.fog, m.polygonOffset, m.blending, m.transmission, m.clearcoat, m.sheen, m.ior,
    tex(m.map), tex(m.normalMap), tex(m.roughnessMap), tex(m.alphaMap), tex(m.bumpMap), tex(m.emissiveMap), tex(m.metalnessMap), m.normalScale ? m.normalScale.x : ''].join('|');
}

/**
 * Flat-colour materials (no textures, opaque, not emissive) differ only in colour, and there are hundreds of them:
 * every paint tone on every shelf and counter. Draw calls, not triangles, are what this scene is short of, so those
 * all collapse into one vertex-coloured material per roughness / metalness / side bucket, with the colour baked
 * into the merged geometry. Returns the bucket key, or null if the material is not that simple.
 */
function plainKey(m) {
  if (m.type !== 'MeshStandardMaterial' || m.map || m.normalMap || m.roughnessMap || m.metalnessMap || m.emissiveMap || m.alphaMap || m.bumpMap || m.aoMap || m.envMap) return null;
  if (m.transparent || m.opacity !== 1 || m.vertexColors || m.alphaTest || m.blending !== THREE.NormalBlending || !m.depthWrite || !m.depthTest || m.polygonOffset || !m.fog || m.wireframe) return null;
  if ((m.emissive.r || m.emissive.g || m.emissive.b) && m.emissiveIntensity) return null;
  if (m.envMapIntensity !== 1 || customised(m)) return null;
  return `plain|${Math.round(m.roughness * 10)}|${Math.round(m.metalness * 10)}|${m.side}|${m.flatShading}`;
}

export function batchStatic(root, { cell = 48 } = {}) {
  root.updateMatrixWorld(true);
  const groups = new Map(), canon = new Map(), plain = new Map();
  const walk = (o) => {
    if (o.userData.dynamic) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.visible && o.frustumCulled && o.geometry.attributes.position && !o.morphTargetInfluences) {
      const g = o.geometry, a = g.attributes;
      if (!g.boundingSphere) g.computeBoundingSphere();
      _v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const sig = (a.normal ? 'n' : '') + (a.uv ? 'u' : '') + (a.color ? 'c' : '');   // (set before the bake: a baked group ignores it)
      const pk = plainKey(o.material); let bake = null;
      if (pk) {                                                  // flat colour: bake it into the vertices, share one material per bucket
        bake = o.material.color;
        if (!plain.has(pk)) plain.set(pk, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: Math.round(o.material.roughness * 10) / 10, metalness: Math.round(o.material.metalness * 10) / 10, side: o.material.side, flatShading: o.material.flatShading }));
        o.material = plain.get(pk);
      } else { const mk = matKey(o.material); if (!canon.has(mk)) canon.set(mk, o.material); o.material = canon.get(mk); }
      const key = `${o.material.uuid}|${bake ? 'bake' : sig}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}|${o.layers.mask}|${Math.floor(_v.x / cell)},${Math.floor(_v.z / cell)}`;
      let grp = groups.get(key); if (!grp) groups.set(key, (grp = { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, layers: o.layers.mask, bake: !!bake, list: [], tint: [] }));
      grp.list.push(o); grp.tint.push(bake);
    }
    for (const c of o.children.slice()) walk(c);
  };
  walk(root);

  let merged = 0, removed = 0;
  for (const grp of groups.values()) {
    if (grp.list.length < 2 && !grp.bake) continue;
    let n = 0; for (const o of grp.list) n += o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count;
    const first = grp.list[0].geometry.attributes, hasN = grp.bake ? true : !!first.normal, hasU = grp.bake ? false : !!first.uv, hasC = grp.bake || !!first.color;
    const pos = new Float32Array(n * 3), nor = hasN ? new Float32Array(n * 3) : null, uv = hasU ? new Float32Array(n * 2) : null, cs = hasC && !grp.bake ? first.color.itemSize : 3, col = hasC ? new Float32Array(n * cs) : null;
    let k = 0;
    for (let oi = 0; oi < grp.list.length; oi++) {
      const o = grp.list[oi], tint = grp.tint[oi];
      const g = o.geometry, A = g.attributes, idx = g.index, m = o.matrixWorld; _n.getNormalMatrix(m);
      if (grp.bake && !A.normal) g.computeVertexNormals();
      const cnt = idx ? idx.count : A.position.count;
      for (let i = 0; i < cnt; i++, k++) {
        const vi = idx ? idx.getX(i) : i;
        _v.fromBufferAttribute(A.position, vi).applyMatrix4(m); pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
        if (nor) { _v.fromBufferAttribute(A.normal, vi).applyMatrix3(_n).normalize(); nor[k * 3] = _v.x; nor[k * 3 + 1] = _v.y; nor[k * 3 + 2] = _v.z; }
        if (uv) { uv[k * 2] = A.uv.getX(vi); uv[k * 2 + 1] = A.uv.getY(vi); }
        if (tint) { col[k * 3] = tint.r; col[k * 3 + 1] = tint.g; col[k * 3 + 2] = tint.b; }
        else if (col) for (let c = 0; c < cs; c++) col[k * cs + c] = A.color.array[vi * cs + c];
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (nor) geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, cs));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, grp.mat); mesh.castShadow = grp.cast; mesh.receiveShadow = grp.receive; mesh.renderOrder = grp.order; mesh.layers.mask = grp.layers;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix(); root.add(mesh); merged++;
    for (const o of grp.list) { o.parent.remove(o); o.geometry.dispose(); removed++; }
  }
  // everything left that is static no longer needs its matrix recomputed every frame
  const freeze = (o) => { if (o.userData.dynamic) return; if (o !== root) { o.matrixAutoUpdate = false; o.updateMatrix(); } for (const c of o.children) freeze(c); };
  freeze(root);
  return { merged, removed };
}
