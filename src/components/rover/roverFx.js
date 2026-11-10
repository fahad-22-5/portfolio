/**
 * Rover visual feedback: pooled particles, tyre tracks, screen shake and
 * comic-style pop-up words. Everything is pooled — no per-frame allocation.
 */
import * as THREE from 'three';

const MAX_PARTICLES = 240;
const MAX_TRACKS = 520;
const MAX_POPS = 10;

export const PARTICLE = {
  dust: { color: 0xb9a88c, size: 0.55, life: 0.7, gravity: -1.5, spread: 2.2, lift: 1.6 },
  spark: { color: 0xfde047, size: 0.22, life: 0.45, gravity: 18, spread: 9, lift: 6 },
  boost: { color: 0x38bdf8, size: 0.4, life: 0.35, gravity: 0, spread: 1.4, lift: 0.4 },
  debris: { color: 0x9a6b3a, size: 0.5, life: 0.9, gravity: 20, spread: 9, lift: 8 },
  silk: { color: 0xf1f5f9, size: 0.45, life: 1.0, gravity: 6, spread: 6, lift: 6 },
  glow: { color: 0xfbbf24, size: 0.35, life: 0.8, gravity: -4, spread: 5, lift: 5 },
};

export function createRoverFx({ scene, camera, popLayer }) {
  /* ── Particles ── */
  const particleMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false }),
    MAX_PARTICLES,
  );
  particleMesh.frustumCulled = false;
  scene.add(particleMesh);

  const particles = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0, gravity: 0,
  }));
  let particleCursor = 0;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleMesh.setMatrixAt(i, dummy.matrix);
    particleMesh.setColorAt(i, color.set(0xffffff));
  }

  function burst(kind, x, y, z, count = 6, tint) {
    const def = PARTICLE[kind];
    for (let i = 0; i < count; i++) {
      const p = particles[particleCursor];
      const angle = Math.random() * Math.PI * 2;
      const speed = def.spread * (0.4 + Math.random() * 0.6);
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = def.lift * (0.5 + Math.random() * 0.8);
      p.maxLife = p.life = def.life * (0.7 + Math.random() * 0.6);
      p.size = def.size * (0.7 + Math.random() * 0.6);
      p.gravity = def.gravity;
      particleMesh.setColorAt(particleCursor, color.set(tint ?? def.color));
      particleCursor = (particleCursor + 1) % MAX_PARTICLES;
    }
    particleMesh.instanceColor.needsUpdate = true;
  }

  /* ── Tyre tracks (ring buffer of floor decals) ── */
  const trackGeo = new THREE.PlaneGeometry(0.45, 1.25);
  trackGeo.rotateX(-Math.PI / 2);
  const trackMesh = new THREE.InstancedMesh(
    trackGeo,
    new THREE.MeshBasicMaterial({
      color: 0x05070c, transparent: true, opacity: 0.34, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    MAX_TRACKS,
  );
  trackMesh.frustumCulled = false;
  trackMesh.count = 0;
  scene.add(trackMesh);
  let trackCursor = 0;

  function stampTrack(x, z, yaw, width = 1) {
    dummy.position.set(x, 0.05, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(width, 1, 1);
    dummy.updateMatrix();
    trackMesh.setMatrixAt(trackCursor, dummy.matrix);
    trackCursor = (trackCursor + 1) % MAX_TRACKS;
    trackMesh.count = Math.min(MAX_TRACKS, trackMesh.count + 1);
    trackMesh.instanceMatrix.needsUpdate = true;
  }

  /* ── Screen shake ── */
  let shakeMag = 0;
  const shakeOffset = new THREE.Vector3();

  const shake = (magnitude) => { shakeMag = Math.min(1.6, Math.max(shakeMag, magnitude)); };

  /** Call right before / after renderer.render so follow-cam smoothing is unaffected. */
  function preRender() {
    if (shakeMag < 0.01) { shakeOffset.set(0, 0, 0); return; }
    shakeOffset.set(
      (Math.random() - 0.5) * shakeMag,
      (Math.random() - 0.5) * shakeMag,
      (Math.random() - 0.5) * shakeMag,
    );
    camera.position.add(shakeOffset);
    camera.updateMatrixWorld();
  }
  function postRender() {
    camera.position.sub(shakeOffset);
  }

  /* ── Comic pop-up words (DOM, projected from world space) ── */
  const projected = new THREE.Vector3();
  let activePops = 0;

  function pop(text, x, y, z, variant = 'crimson') {
    if (!popLayer || activePops >= MAX_POPS) return;
    projected.set(x, y, z).project(camera);
    if (projected.z > 1 || Math.abs(projected.x) > 1.1 || Math.abs(projected.y) > 1.1) return;

    const el = document.createElement('span');
    el.className = `rover-pop rover-pop--${variant}`;
    el.textContent = text;
    el.style.left = `${(projected.x * 0.5 + 0.5) * 100}%`;
    el.style.top = `${(-projected.y * 0.5 + 0.5) * 100}%`;
    el.style.setProperty('--tilt', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
    popLayer.appendChild(el);
    activePops++;
    setTimeout(() => { el.remove(); activePops--; }, 950);
  }

  /* ── Per-frame ── */
  function update(dt) {
    shakeMag *= Math.exp(-9 * dt);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        dummy.scale.setScalar(0);
      } else {
        p.vy -= p.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.35; }
        const t = 1 - p.life / p.maxLife;
        dummy.scale.setScalar(p.size * (0.5 + t) * (1 - t) * 1.6);
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      particleMesh.setMatrixAt(i, dummy.matrix);
    }
    particleMesh.instanceMatrix.needsUpdate = true;
  }

  // Meshes stay in the scene: the host's scene traversal disposes their GPU resources.
  function dispose() {
    if (popLayer) popLayer.textContent = '';
  }

  return { burst, stampTrack, shake, pop, update, preRender, postRender, dispose };
}
