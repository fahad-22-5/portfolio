import * as THREE from 'three';
import { furSet } from './render/surfaces.js';

/**
 * Procedural low-poly cat. root.position is the point between the paws,
 * the cat faces local +Z. animate() only touches pre-built nodes.
 *
 * Body, head, ears and legs are the original box-built cat. The tail is the
 * 8-segment chain (capsule links, painted tabby coat) with its own sway
 * animation, attached at the rump; its parameters are unchanged.
 */
/**
 * o: another coat for other cats (the player is the ginger tabby): { fur, dark, cream, eye, coat: [base, stripe, belly], sheen, size, nick }
 * nick: a torn left ear.
 */
export function createCat(o = {}) {
  const C = { fur: 0xd9822b, dark: 0xb5651d, cream: 0xf5e6cf, eye: 0xc8f25a, coat: [0xd9893a, 0x92471a, 0xf4e3c8], sheen: 0xffd2a0, size: 0.75, nick: false, ...o };
  const fur = new THREE.MeshStandardMaterial({ color: C.fur, roughness: 0.9 });
  const furDark = new THREE.MeshStandardMaterial({ color: C.dark, roughness: 0.9 });
  const cream = new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.9 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe79aa0, roughness: 0.7 });
  const eye = new THREE.MeshBasicMaterial({ color: C.eye, toneMapped: false });

  const root = new THREE.Group();
  const rig = new THREE.Group();           // scaled so the cat reads at follow-cam distance
  rig.scale.setScalar(C.size);                // about 0.33 m at the shoulder, a touch over a real cat
  root.add(rig);

  const part = (parent, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
  };

  const torso = new THREE.Group(); torso.position.y = 0.34; rig.add(torso);
  part(torso, 0.2, 0.19, 0.5, fur, 0, 0, 0);
  part(torso, 0.21, 0.06, 0.36, furDark, 0, 0.075, -0.03);   // back stripe
  part(torso, 0.16, 0.1, 0.2, cream, 0, -0.06, 0.17);        // chest

  const head = new THREE.Group(); head.position.set(0, 0.12, 0.3); torso.add(head);
  part(head, 0.2, 0.17, 0.18, fur, 0, 0.02, 0.03);
  part(head, 0.1, 0.07, 0.07, cream, 0, -0.03, 0.14);
  part(head, 0.03, 0.02, 0.02, pink, 0, -0.005, 0.18);
  part(head, 0.035, 0.035, 0.01, eye, -0.055, 0.045, 0.122);
  part(head, 0.035, 0.035, 0.01, eye, 0.055, 0.045, 0.122);
  const earGeo = new THREE.ConeGeometry(0.05, 0.1, 4);
  const ears = [-1, 1].map((s) => {
    const e = new THREE.Mesh(earGeo, furDark);
    e.position.set(s * 0.065, 0.15, 0.01); e.rotation.z = -s * 0.18; e.castShadow = true;
    head.add(e); return e;
  });

  // legs: hip pivots, order FL, FR, BL, BR
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.075, -0.06, sz * 0.19); torso.add(hip);
    part(hip, 0.06, 0.24, 0.07, fur, 0, -0.12, 0);
    part(hip, 0.065, 0.05, 0.085, cream, 0, -0.255, 0.008);
    return hip;
  });

  /* ---------- tail: the current 8-link chain, re-anchored at the old rump point ---------- */
  const furTail = furSet();
  const furMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.85, map: furTail.map, normalMap: furTail.normalMap, normalScale: new THREE.Vector2(0.55, 0.55),
    sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(C.sheen),
  });
  const tail = [], tailMeshes = [];
  {
    const anchor = new THREE.Group(); anchor.position.set(0, 0.05, -0.25); anchor.scale.setScalar(1.25 / 0.75); torso.add(anchor);   // real-size chain inside the 0.75 rig
    let parent = anchor;
    for (let i = 0; i < 8; i++) {
      const r = 0.0165 - i * 0.0009, seg = new THREE.Group(); if (i) seg.position.set(0, 0, -0.042); parent.add(seg);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.034, 8, 20), furMat); m.position.set(0, 0, -0.021); m.rotation.x = Math.PI / 2; m.castShadow = true; seg.add(m);
      tailMeshes.push([m, i === 7 ? 'tip' : 'tail']); tail.push(seg); parent = seg;
    }
  }
  tail.forEach((s, i) => { s.rotation.set(i === 0 ? 0.6 : 0.22, 0, 0); });
  root.updateMatrixWorld(true);
  paintCoat(tailMeshes, C.coat);
  if (C.nick) { ears[0].scale.set(0.8, 0.62, 1); ears[0].rotation.z += 0.25; }

  let phase = 0, meow = 0, pose = null, shown = null, pk = 0, lastPuff = 1;            // pose: 'eat' (head down at a dish) or 'curl' (asleep)
  const mix = (a, b, k) => a + (b - a) * k;

  /** speed in m/s (signed), airborne flag, t = elapsed seconds. */
  function animate(dt, t, speed, airborne) {
    const v = Math.abs(speed), gait = Math.min(1, v / 3);
    phase += dt * (5 + v * 2.2) * (speed < 0 ? -1 : 1) * (v > 0.1 ? 1 : 0);
    const amp = airborne ? 0 : gait * (v > 4.5 ? 0.85 : 0.6);
    const tuck = airborne ? 0.9 : 0;
    // diagonal pairs for a walk; front/back pairs bound together when sprinting
    const trot = v > 4.5 ? 0.6 : Math.PI;
    legs[0].rotation.x = Math.sin(phase) * amp - tuck;
    legs[1].rotation.x = Math.sin(phase + trot) * amp - tuck;
    legs[2].rotation.x = Math.sin(phase + Math.PI) * amp + tuck;
    legs[3].rotation.x = Math.sin(phase + Math.PI + trot) * amp + tuck;

    const breathe = Math.sin(t * 2.2) * 0.02 * (1 - gait);
    torso.scale.set(1 + breathe, 1 + breathe, 1);
    torso.position.y = 0.34 + Math.abs(Math.sin(phase)) * 0.025 * gait;
    torso.rotation.x = airborne ? -0.25 : 0;

    meow = Math.max(0, meow - dt);
    head.rotation.x = -meow * 1.4 + Math.sin(phase * 2) * 0.05 * gait;
    head.rotation.y = Math.sin(t * 0.6) * 0.25 * (1 - gait);
    const twitch = Math.pow(Math.max(0, Math.sin(t * 1.3)), 40) * 0.5;
    ears[0].rotation.z = 0.18 + twitch;
    ears[1].rotation.z = -0.18 - Math.pow(Math.max(0, Math.sin(t * 0.9 + 2)), 40) * 0.5;

    // tail chain (unchanged): carried up in a soft question mark, swaying from the base
    const tailGait = Math.min(1, v / 2.5), up = 0.75 - tailGait * 0.35;
    for (let i = 0; i < tail.length; i++) {
      tail[i].rotation.x = i === 0 ? 1.05 * up + 0.1 : (i < 4 ? 0.14 * up : -0.1 * up * (i - 3) * 0.6);   // up from the rump, tip curling over
      tail[i].rotation.y = Math.sin(t * (1.6 + tailGait * 3.5) - i * 0.55) * (0.07 + i * 0.025);
    }

    // poses blend in over a quarter of a second, and back out the same way
    pk += ((pose ? 1 : 0) - pk) * Math.min(1, dt * 4);
    if (pk > 0.002 && shown === 'curl') {                        // lying down, paws tucked, head on the side, tail wrapped round
      const k = pk, slow = Math.sin(t * 1.1) * 0.025;
      torso.position.y = mix(torso.position.y, 0.13, k); torso.scale.set(1 + slow * k, 1 + slow * k, 1); torso.rotation.z = mix(0, 0.22, k);
      legs[0].rotation.x = mix(legs[0].rotation.x, -1.45, k); legs[1].rotation.x = mix(legs[1].rotation.x, -1.45, k);
      legs[2].rotation.x = mix(legs[2].rotation.x, 1.45, k); legs[3].rotation.x = mix(legs[3].rotation.x, 1.45, k);
      head.rotation.x = mix(head.rotation.x, 0.45, k); head.rotation.y = mix(head.rotation.y, 0.75, k);
      for (let i = 0; i < tail.length; i++) { tail[i].rotation.x = mix(tail[i].rotation.x, i === 0 ? -0.15 : 0.02, k); tail[i].rotation.y = mix(tail[i].rotation.y, 0.34 + Math.sin(t * 0.7) * 0.02 * i, k); }
    } else if (pk > 0.002 && shown === 'eat') {                   // crouched at the dish, head down, lapping
      const k = pk, lap = Math.sin(t * 9) * 0.06;
      torso.position.y = mix(torso.position.y, 0.27, k); torso.rotation.x = mix(torso.rotation.x, 0.2, k);
      legs[0].rotation.x = mix(legs[0].rotation.x, -0.3, k); legs[1].rotation.x = mix(legs[1].rotation.x, -0.3, k);
      legs[2].rotation.x = mix(legs[2].rotation.x, 0.5, k); legs[3].rotation.x = mix(legs[3].rotation.x, 0.5, k);
      head.rotation.x = mix(head.rotation.x, 0.75 + lap, k); head.rotation.y = mix(head.rotation.y, 0, k);
    } else if (pk > 0.002 && shown === 'sit') {                   // sitting up, front legs straight, tail round the paws
      const k = pk;
      torso.rotation.x = mix(torso.rotation.x, -0.62, k); torso.position.y = mix(torso.position.y, 0.3, k);
      legs[0].rotation.x = mix(legs[0].rotation.x, 0.62, k); legs[1].rotation.x = mix(legs[1].rotation.x, 0.62, k);
      legs[2].rotation.x = mix(legs[2].rotation.x, -0.95, k); legs[3].rotation.x = mix(legs[3].rotation.x, -0.95, k);
      head.rotation.x = mix(head.rotation.x, 0.58, k);
      for (let i = 0; i < tail.length; i++) { tail[i].rotation.x = mix(tail[i].rotation.x, i === 0 ? -0.9 : 0.05, k); tail[i].rotation.y = mix(tail[i].rotation.y, 0.28 + Math.sin(t * 0.8 - i) * 0.03 * i, k); }
    } else if (pk > 0.002 && shown === 'arch') {                  // back up, legs stiff, ears flat, tail up and fluffed: hissing
      const k = pk;
      torso.position.y = mix(torso.position.y, 0.41, k); torso.rotation.x = 0;
      for (const l of legs) l.rotation.x = mix(l.rotation.x, 0, k);
      head.rotation.x = mix(head.rotation.x, 0.3, k); head.rotation.y = mix(head.rotation.y, 0, k);
      ears[0].rotation.x = ears[1].rotation.x = -0.75 * k;
      for (let i = 0; i < tail.length; i++) { tail[i].rotation.x = mix(tail[i].rotation.x, i === 0 ? 1.45 : 0.02, k); tail[i].rotation.y = mix(tail[i].rotation.y, 0, k); }
    } else if (pk > 0.002 && shown === 'stalk') {                 // belly low, head forward, tail flat: hunting
      const k = pk;
      torso.position.y = mix(torso.position.y, 0.24, k); torso.rotation.x = mix(torso.rotation.x, 0.06, k);
      head.rotation.x = mix(head.rotation.x, 0.12, k); head.rotation.y = mix(head.rotation.y, 0, k);
      for (let i = 0; i < tail.length; i++) tail[i].rotation.x = mix(tail[i].rotation.x, i === 0 ? 0.05 : -0.02, k);
    } else if (pk <= 0.002) { torso.rotation.z = 0; }
    if (shown !== 'arch' || pk < 0.01) { ears[0].rotation.x = ears[1].rotation.x = 0; }
    const puff = shown === 'arch' ? 1 + pk * 0.7 : 1;               // a bottle-brush tail
    if (puff !== lastPuff) { lastPuff = puff; for (const [m] of tailMeshes) m.scale.set(puff, 1, puff); }
  }

  return { root, animate, meow() { meow = 0.45; }, setPose(p) { pose = p; if (p) shown = p; } };
}

/** Ginger tabby colouring in the cat's own frame (rest pose): cream underneath, broken stripes on top. */
function paintCoat(list, coat = [0xd9893a, 0x92471a, 0xf4e3c8]) {
  const base = new THREE.Color(coat[0]), dark = new THREE.Color(coat[1]), cream = new THREE.Color(coat[2]), c = new THREE.Color();
  const p = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (const [mesh, tag] of list) {
    const geo = mesh.geometry = mesh.geometry.clone(), pos = geo.attributes.position, nor = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
    nm.getNormalMatrix(mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      let stripe = 0, belly = sstep(-0.15, -0.6, n.y);
      if (tag === 'body' || tag === 'chest') stripe = sstep(0.25, 0.75, Math.sin(p.z * 75 + Math.sin(p.x * 40) * 1.3 + Math.sin(p.z * 23) * 0.8)) * sstep(-0.2, 0.35, n.y);
      if (tag === 'chest') belly = Math.max(belly, sstep(0.2, 0.75, n.z) * sstep(0.27, 0.22, p.y));
      if (tag === 'body') belly = Math.max(belly, sstep(0.1, 0.18, p.z) * sstep(0.3, 0.8, n.z + 0.3 - n.y));   // cream bib on the chest
      if (tag === 'leg') { stripe = 0.4 * sstep(0.45, 0.85, Math.sin(p.y * 110 + p.z * 20)) * sstep(0.0, 0.6, Math.abs(n.x)); belly = Math.max(belly * 0.6, sstep(0.07, 0.03, p.y)); }
      if (tag === 'tail') stripe = sstep(0.1, 0.6, Math.sin((p.z * 0.8 - p.y * 0.6) * 95));
      if (tag === 'tip') stripe = 0.9;
      if (tag === 'head') stripe = sstep(0.35, 0.8, Math.sin(p.x * 260)) * sstep(0.4, 0.8, n.y) * sstep(0.04, 0.0, Math.abs(p.x));      // the forehead 'M'
      if (tag === 'cheek') { stripe = sstep(0.5, 0.85, Math.sin(p.y * 330)) * sstep(0.3, 0.8, Math.abs(n.x)); belly = sstep(-0.1, -0.6, n.y); }
      if (tag === 'cream' || tag === 'paw') belly = 1;
      const noise = (Math.sin(p.x * 431 + p.y * 213) * Math.sin(p.z * 377 + p.x * 97)) * 0.04;
      c.copy(base); if (tag === 'leg') c.lerp(cream, 0.32);
      c.lerp(dark, stripe * 0.85).lerp(cream, belly);
      cols[i * 3] = c.r * (1 + noise); cols[i * 3 + 1] = c.g * (1 + noise); cols[i * 3 + 2] = c.b * (1 + noise);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
}

