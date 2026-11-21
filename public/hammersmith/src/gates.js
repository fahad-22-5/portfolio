import * as THREE from 'three';
import { inst } from './util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
const RED = 0xff2a1f, GREEN = 0x35ff6a;

/**
 * A row of Oyster ticket gates. The row runs along local X; passengers walk
 * along local Z. `rot` is the row's rotation about Y, (x, y, z) its centre.
 * Cabinets, paddles and LEDs are one InstancedMesh each.
 */
export function createGateLine(ctx, { x, y = 0, z, rot = 0, count = 6, pitch = 1.3 }) {
  const { scene, col, mats } = ctx;
  const c = Math.cos(rot), s = Math.sin(rot);
  const wx = (lx, lz) => x + lx * c + lz * s;
  const wz = (lx, lz) => z - lx * s + lz * c;
  const half = (count * pitch) / 2;

  const cabs = [], leds = [];
  for (let i = 0; i <= count; i++) {
    const lx = -half + i * pitch;
    cabs.push({ x: wx(lx, 0), y: y + 0.5, z: wz(lx, 0), ry: rot });
    col.rect(wx(lx, 0), wz(lx, 0), 0.3, 1.5, { rot, h: y + 1.0, thick: 1.0, pad: 0.08 });
  }
  for (let i = 0; i < count; i++) {
    const lx = -half + i * pitch;
    leds.push({ x: wx(lx, -0.55), y: y + 1.02, z: wz(lx, -0.55), ry: rot });
    leds.push({ x: wx(lx + pitch, 0.55), y: y + 1.02, z: wz(lx + pitch, 0.55), ry: rot });
  }
  inst(scene, new THREE.BoxGeometry(0.3, 1.0, 1.5), mats.steel, cabs);
  const ledMesh = inst(scene, new THREE.BoxGeometry(0.2, 0.05, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), leds.map((l) => ({ ...l, c: RED })), { shadow: false });

  const paddleGeo = new THREE.BoxGeometry(0.47, 0.5, 0.05).translate(0.235, 0, 0);
  const paddles = new THREE.InstancedMesh(paddleGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8442e, roughness: 0.4, transparent: true, opacity: 0.85 }), count * 2);
  paddles.frustumCulled = false;
  scene.add(paddles);

  // one barrier per aisle: low slab, so the cat can hop over it but not walk through
  const barriers = [];
  for (let i = 0; i < count; i++) {
    const lx = -half + (i + 0.5) * pitch;
    barriers.push(col.rect(wx(lx, 0), wz(lx, 0), pitch - 0.3, 0.3, { rot, h: y + 0.95, thick: 0.75 }));
  }

  let open = 0, timer = 0, lit = false, drawn = -1;

  function draw() {
    for (let i = 0; i < count; i++) {
      const lx = -half + i * pitch;
      // left paddle hinges on cabinet i, right paddle on cabinet i + 1
      _p.set(wx(lx + 0.15, 0), y + 0.6, wz(lx + 0.15, 0));
      _q.setFromAxisAngle(_up, rot - open * Math.PI / 2);
      paddles.setMatrixAt(i * 2, _m.compose(_p, _q, _s));
      _p.set(wx(lx + pitch - 0.15, 0), y + 0.6, wz(lx + pitch - 0.15, 0));
      _q.setFromAxisAngle(_up, rot + Math.PI + open * Math.PI / 2);
      paddles.setMatrixAt(i * 2 + 1, _m.compose(_p, _q, _s));
    }
    paddles.instanceMatrix.needsUpdate = true;
    drawn = open;
  }
  draw();

  function setLeds(on) {
    if (on === lit) return;
    lit = on;
    _c.set(on ? GREEN : RED);
    for (let i = 0; i < count * 2; i++) ledMesh.setColorAt(i, _c);
    ledMesh.instanceColor.needsUpdate = true;
  }

  return {
    /** true when (px, py, pz) is standing at the gates on either side. */
    near(px, py, pz) {
      if (Math.abs(py - y) > 1) return false;
      const dx = px - x, dz = pz - z;
      return Math.abs(dx * c - dz * s) < half + 0.4 && Math.abs(dx * s + dz * c) < 2.8;
    },
    isOpen: () => timer > 0,
    trigger() { timer = 3.5; setLeds(true); },
    update(dt) {
      if (timer > 0) { timer -= dt; if (timer <= 0) setLeds(false); }
      const target = timer > 0 ? 1 : 0;
      if (open !== target) open = target > open ? Math.min(1, open + dt * 4) : Math.max(0, open - dt * 3);
      if (open !== drawn) {
        draw();
        const pass = open > 0.6;
        for (let i = 0; i < barriers.length; i++) barriers[i].enabled = !pass;
      }
    },
  };
}
