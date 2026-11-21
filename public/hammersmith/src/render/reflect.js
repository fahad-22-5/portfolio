/**
 * Planar reflection for the polished concourse floor.
 *
 * Each frame the scene is drawn once more from the camera's mirror image
 * below the floor, into a small HDR target with a mip chain and a depth
 * texture. The floor material (floor.js) projects that image back on to
 * itself and blurs it by how far the reflected thing is above the floor
 * (from the depth texture) and how rough the tile is, so a shop window meets
 * its reflection sharply at the skirting and a ceiling ring four metres up
 * smears into a soft streak, as in the walking-tour footage.
 *
 * The mirror camera uses an oblique near plane on the floor, so nothing
 * below the floor (the platforms) can leak into the reflection, and no
 * material needs clipping planes.
 */
import * as THREE from 'three';

const _pos = new THREE.Vector3(), _dir = new THREE.Vector3(), _up = new THREE.Vector3(), _tgt = new THREE.Vector3();
const _rot = new THREE.Matrix4(), _plane = new THREE.Plane(), _clip = new THREE.Vector4(), _q = new THREE.Vector4(), _n = new THREE.Vector3(0, 1, 0);

/** Layer for meshes the mirror pass skips. The main camera sees layers 0 and 1, the mirror camera only 0. */
export const NO_MIRROR = 1;

/**
 * Decide what the floor can plausibly reflect, once, after the world is built. Everything else moves to the
 * NO_MIRROR layer so the mirror pass draws a fraction of the scene: nothing outside `box` (the mall's footprint,
 * {minX, maxX, minZ, maxZ}), nothing above `top` or below the floor, no floor decals, and no instanced small parts
 * (stock on shelves, cups, bolts) unless they give off light. Anything under a userData.dynamic object (the cat,
 * people, lifts, the sky) is always kept. Lights are never moved: the light set must match in both passes.
 * Returns the kept meshes with their bounding spheres: each frame the mirror pass also drops those that would
 * be too small in the reflection to matter (see `detail` below).
 */
export function cullForMirror(scene, box, top, pad = 8) {
  scene.updateMatrixWorld(true);
  const b = new THREE.Box3(), m = new THREE.Matrix4(), size = new THREE.Vector3(), sph = new THREE.Sphere(), list = [], movers = []; let skipped = 0;
  const lit = (mat) => mat.isMeshBasicMaterial ? !mat.alphaMap && mat.blending === THREE.NormalBlending : mat.emissive && mat.emissiveIntensity > 1 && mat.emissive.getHex() !== 0;
  const decal = (mat) => mat.blending !== THREE.NormalBlending || (mat.isMeshBasicMaterial && !!mat.alphaMap);
  const walk = (o) => {
    if (o.userData.dynamic) {                                   // a mover: kept whole, and switched on and off by distance each frame
      const meshes = []; o.traverse((c) => { if (c.isMesh && !decal(Array.isArray(c.material) ? c.material[0] : c.material)) meshes.push(c); });
      if (meshes.length) { b.setFromObject(o).getBoundingSphere(sph); movers.push({ root: o, meshes, r2: Math.max(0.6, sph.radius) ** 2, on: true }); }
      return;
    }
    if (o.isMesh) {
      const mat = Array.isArray(o.material) ? o.material[0] : o.material, g = o.geometry; let skip = false;
      if (mat.blending !== THREE.NormalBlending || (mat.isMeshBasicMaterial && mat.alphaMap)) skip = true;       // light pools, contact shadows
      else if (o.isInstancedMesh) {
        if (!g.boundingSphere) g.computeBoundingSphere();
        const live = o.instanceMatrix.usage === THREE.DynamicDrawUsage;                    // rewritten every frame: the crowd's bodies
        o.getMatrixAt(0, m); skip = !live && o.count > 0 && g.boundingSphere.radius * m.getMaxScaleOnAxis() < 0.3 && !lit(mat);
        if (!skip) { if (!o.boundingBox) o.computeBoundingBox(); b.copy(o.boundingBox).applyMatrix4(o.matrixWorld); }
      } else { if (!g.boundingBox) g.computeBoundingBox(); b.copy(g.boundingBox).applyMatrix4(o.matrixWorld); skip = b.getSize(size).length() < 0.5 && !lit(mat); }
      if (!skip) skip = b.max.x < box.minX - pad || b.min.x > box.maxX + pad || b.max.z < box.minZ - pad || b.min.z > box.maxZ + pad || b.min.y > top || b.max.y < 0;
      if (skip) { o.layers.set(NO_MIRROR); skipped++; } else { b.getBoundingSphere(sph); list.push({ o, x: sph.center.x, y: sph.center.y, z: sph.center.z, r2: sph.radius * sph.radius }); }
    }
    for (let i = 0; i < o.children.length; i++) walk(o.children[i]);
  };
  walk(scene);
  return { kept: list.length, skipped, list, movers };
}

/** detail: a kept mesh is drawn in the mirror only while its radius is more than this fraction of its distance. */
export function createFloorReflection(renderer, { y = 0.02, far = 110, detail = 0.045, moverDetail = 0.055 } = {}) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(4, 4), generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.PerspectiveCamera();
  const uniforms = {
    tRefl: { value: rt.texture }, tReflDepth: { value: rt.depthTexture },
    uReflMatrix: { value: new THREE.Matrix4() }, uReflProjInv: { value: new THREE.Matrix4() },
    uReflOn: { value: 0 }, uReflRes: { value: new THREE.Vector2(4, 4) }, uReflFocal: { value: 1 },
  };
  const hide = [];                 // meshes left out of the mirror pass (the floor itself)
  let scale = 0.5, level = 0, fresh = false, cands = [], movers = [], drawn = 0;
  const km2 = moverDetail * moverDetail;
  let k2 = detail * detail;

  // Resizing frees the target's textures. Until the mirror pass has drawn into the new ones, the floor must not
  // touch them: sampling a freed render-target texture makes three allocate it as an ordinary texture at the old
  // size, and the target can then never be completed. So the floor reads a 1 x 1 stand-in in the meantime.
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  uniforms.tRefl.value = blank; uniforms.tReflDepth.value = blank;                        // nothing drawn yet
  function setSize(w, h, s = scale) {
    scale = s;
    const W = Math.max(4, Math.floor(w * Math.max(s, 0.05))), H = Math.max(4, Math.floor(h * Math.max(s, 0.05)));
    if (W === rt.width && H === rt.height) return;
    uniforms.tRefl.value = blank; uniforms.tReflDepth.value = blank; uniforms.uReflOn.value = 0; level = 0; fresh = false;
    rt.setSize(W, H); rt.depthTexture.image.width = W; rt.depthTexture.image.height = H; uniforms.uReflRes.value.set(W, H);
  }

  /** Draw the mirror image for this frame. `want` = the floor could be on screen. `reuse` = keep last frame's image
   *  (and the matrix it was drawn with, so it still lands in the right place): half the cost for a one-frame lag. */
  function render(scene, camera, want, dt, reuse = false) {
    camera.updateMatrixWorld();
    _pos.setFromMatrixPosition(camera.matrixWorld);
    if (!want || scale <= 0 || _pos.y < y + 0.05) { level = 0; fresh = false; uniforms.uReflOn.value = 0; return false; }
    if (reuse && fresh) { level = Math.min(1, level + dt * 4); uniforms.uReflOn.value = level; return false; }
    level = Math.min(1, level + dt * 4); uniforms.uReflOn.value = level;
    fresh = true;

    // the camera, mirrored in the floor
    _rot.extractRotation(camera.matrixWorld);
    _dir.set(0, 0, -1).applyMatrix4(_rot); _up.set(0, 1, 0).applyMatrix4(_rot);
    cam.position.set(_pos.x, 2 * y - _pos.y, _pos.z);
    cam.up.set(_up.x, -_up.y, _up.z);
    cam.lookAt(_tgt.set(cam.position.x + _dir.x, cam.position.y - _dir.y, cam.position.z + _dir.z));
    cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = far; cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // world position -> where it sits in the mirror image
    uniforms.uReflMatrix.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    // oblique near plane on the floor (Lengyel): only what is above the floor is drawn
    _plane.set(_n, -y).applyMatrix4(cam.matrixWorldInverse);
    _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
    const p = cam.projectionMatrix.elements;
    _q.set((Math.sign(_clip.x) + p[8]) / p[0], (Math.sign(_clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
    _clip.multiplyScalar(2 / _clip.dot(_q));
    p[2] = _clip.x; p[6] = _clip.y; p[10] = _clip.z + 1 - 0.003; p[14] = _clip.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    uniforms.uReflProjInv.value.copy(cam.projectionMatrixInverse);
    uniforms.uReflFocal.value = camera.projectionMatrix.elements[5] * 0.5;

    // size cull: a shelf 40 m away is a pixel of blur in the floor; a shopfront at that distance still counts
    drawn = 0;
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i], dx = c.x - _pos.x, dy = c.y - _pos.y, dz = c.z - _pos.z, on = c.r2 > k2 * (dx * dx + dy * dy + dz * dz);
      c.o.layers.mask = on ? 1 : 2; if (on) drawn++;
    }
    for (let i = 0; i < movers.length; i++) {                 // people, lifts, cars: only the ones near enough to show
      const v = movers[i], e = v.root.matrixWorld.elements, dx = e[12] - _pos.x, dy = e[13] - _pos.y, dz = e[14] - _pos.z, on = v.r2 > km2 * (dx * dx + dy * dy + dz * dz);
      if (on) drawn += v.meshes.length;
      if (on !== v.on) { v.on = on; for (let j = 0; j < v.meshes.length; j++) v.meshes[j].layers.mask = on ? 1 : 2; }
    }
    for (let i = 0; i < hide.length; i++) hide[i].visible = false;
    const prev = renderer.getRenderTarget(), shadows = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;                   // the shadow map is redrawn by the main pass, which sees every caster
    renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(prev);
    renderer.shadowMap.needsUpdate = shadows;
    for (let i = 0; i < hide.length; i++) hide[i].visible = true;
    uniforms.tRefl.value = rt.texture; uniforms.tReflDepth.value = rt.depthTexture;      // drawn: safe to show
    return true;
  }

  return { uniforms, hide, target: rt, setSize, render, setCandidates(list, moving = []) { cands = list; movers = moving; },
    /** A mover created after the world was built (a loaded character): drawn in the mirror only when near. */
    addMover(root, meshes, radius = 1) { movers.push({ root, meshes, r2: radius * radius, on: true }); }, set detail(v) { k2 = v * v; }, get detail() { return Math.sqrt(k2); }, get drawn() { return drawn; }, get scale() { return scale; }, dispose() { rt.dispose(); blank.dispose(); } };
}
