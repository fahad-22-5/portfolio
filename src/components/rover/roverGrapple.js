/**
 * Web-tether: hold the grapple input to latch onto the highlighted target.
 *  - Anchor posts  → rope constraint; the rover swings around the post.
 *  - Props / bug   → the target is reeled in toward the rover.
 */
import * as THREE from 'three';
import { SFX } from './roverContent';

const BASE_RANGE = 24;
const UP = new THREE.Vector3(0, 1, 0);

export function createRoverGrapple({ scene, forklift, state, world, fx, upgrades }) {
  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 6),
    new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
  );
  rope.visible = false;
  rope.frustumCulled = false;

  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.09, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, depthTest: false }),
  );
  marker.rotation.x = Math.PI / 2;
  marker.visible = false;
  marker.renderOrder = 5;
  scene.add(rope, marker);

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let target = null;
  let wasHeld = false;

  function release(snapped) {
    if (snapped && target) fx.pop(SFX.snap, target.x, target.gy + 1, target.z, 'white');
    target = null;
    state.tether = null;
    rope.visible = false;
  }

  function attach(candidate, dist) {
    target = candidate;
    if (candidate.kind === 'anchor') {
      state.tether = { x: candidate.x, z: candidate.z, len: Math.max(5, dist) };
    }
    rope.visible = true;
    fx.pop(SFX.grapple, candidate.x, candidate.gy + 1.5, candidate.z, 'white');
    fx.burst('silk', candidate.x, candidate.gy, candidate.z, 6);
  }

  function update(dt, held, elapsed) {
    const px = forklift.position.x, pz = forklift.position.z;
    const range = BASE_RANGE * upgrades.grappleMul;

    if (!target) {
      const candidate = world.nearestTarget(px, pz, range);
      marker.visible = !!candidate;
      if (candidate) {
        marker.position.set(candidate.x, candidate.gy, candidate.z);
        marker.rotation.z = elapsed * 2.5;
        if (held && !wasHeld) attach(candidate, Math.hypot(candidate.x - px, candidate.z - pz));
      }
    }

    if (target) {
      marker.visible = false;
      const dist = Math.hypot(target.x - px, target.z - pz);
      if (!held || !target.alive) release(false);
      else if (dist > range * 1.7) release(true);
      else {
        if (target.kind !== 'anchor') world.pull(target, px, pz);

        // Stretch the rope mesh from the mast top to the target
        const yaw = forklift.rotation.y;
        from.set(px + Math.sin(yaw) * 1.7, forklift.position.y + 4.3, pz + Math.cos(yaw) * 1.7);
        to.set(target.x, target.gy, target.z);
        dir.subVectors(to, from);
        const length = dir.length();
        rope.position.copy(from).addScaledVector(dir, 0.5);
        rope.scale.set(1, length, 1);
        rope.quaternion.setFromUnitVectors(UP, dir.divideScalar(length || 1));
      }
    }
    wasHeld = held;
  }

  return { update, release: () => release(false), isAttached: () => !!target };
}
