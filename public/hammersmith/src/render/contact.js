/**
 * Soft contact shadows: radial-gradient decals just above the floor so people,
 * tables, benches and parked cars sit on the ground instead of floating
 * (indoors there is no sun shadow to do it). Static decals are batched into one
 * InstancedMesh; dynamic ones (people) are a second InstancedMesh updated every
 * frame without allocating.
 */
import * as THREE from 'three';

let mat = null;
function material() {
  if (mat) return mat;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  mat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, fog: false });
  return mat;
}
const GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const _o = new THREE.Object3D();

export function createContactShadows(scene) {
  const items = [];
  /** static decal at (x, y, z), radii rx/rz, turned by ry */
  function add(x, z, rx, rz = rx, ry = 0, y = 0.05) { items.push([x, y, z, rx, rz, ry]); }
  function flush() {
    if (!items.length) return;
    const m = new THREE.InstancedMesh(GEO, material(), items.length);
    items.forEach(([x, y, z, rx, rz, ry], i) => { _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.set(rx * 2, 1, rz * 2); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
    m.renderOrder = 1; m.frustumCulled = false; scene.add(m);
  }
  /** n moving decals; set(i, x, y, z, r) each frame, then commit() */
  function dynamic(n) {
    const m = new THREE.InstancedMesh(GEO, material(), n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.renderOrder = 1; m.frustumCulled = false; scene.add(m);
    return {
      set(i, x, y, z, r) { _o.position.set(x, y + 0.05, z); _o.rotation.set(0, 0, 0); _o.scale.set(r * 2, 1, r * 2); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); },
      commit() { m.instanceMatrix.needsUpdate = true; },
    };
  }
  return { add, flush, dynamic };
}
