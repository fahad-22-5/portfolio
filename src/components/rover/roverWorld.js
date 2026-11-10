/**
 * Rover mission world: Signal Towers, Data Caches, Power-Up Modules,
 * breakable props, ramps, grapple posts, the Radioactive Bug, the VIP
 * terminal and the Pizza Time challenge.
 */
import * as THREE from 'three';
import {
  SIGNAL_TOWERS, DATA_CACHES, SKILL_MODULES, RAMP_SIZE, GRAPPLE_POSTS, LOOSE_PROPS,
  PIZZA_RUN, VIP_TERMINAL, BUG_HOME, SFX, DEV_QUOTES,
} from './roverContent';

const ROVER_RADIUS = 1.9;
const PROP_RADIUS = 1.2;
const REPAIR_RADIUS = 8.5;
const REPAIR_SECONDS = 2.2;
const SMASH_SPEED = 15;

const RED = 0xef4444;
const GREEN = 0x22c55e;

/* ── Small builders ── */
function makeLabel(text, cssColor, width = 9) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 112;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (label, color) => {
    ctx.clearRect(0, 0, 512, 112);
    ctx.fillStyle = 'rgba(8, 12, 24, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 100, 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 58;
    do { ctx.font = `${size}px 'Bebas Neue', 'Arial Narrow', sans-serif`; size -= 4; }
    while (ctx.measureText(label).width > 460 && size > 20);
    ctx.fillText(label, 256, 60);
    texture.needsUpdate = true;
  };
  draw(text, cssColor);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(width, width * (112 / 512), 1);
  sprite.userData.draw = draw;
  return sprite;
}

function makeBeam(hex, radius = 0.5, height = 36, opacity = 0.22) {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: hex, transparent: true, opacity, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.y = height / 2;
  return beam;
}

function makeFloorRing(hex, inner, outer) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 48),
    new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.07;
  return ring;
}

function makeCrateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a8763e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#5b3a1a';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 128; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 116, 116);
  ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(120, 120); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRoverWorld({ scene, colliders, forklift, chassis, state, fx, bus, upgrades, reservedZones = [] }) {
  const root = new THREE.Group();
  scene.add(root);

  /* ── Placement helpers ── */
  const reserved = [...reservedZones];
  const hitsStatic = (x, z, r) => {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (x - r < c.maxX && x + r > c.minX && z - r < c.maxZ && z + r > c.minZ) return true;
    }
    return false;
  };
  const isFree = (x, z, r) => Math.abs(x) < 96 && Math.abs(z) < 60
    && !hitsStatic(x, z, r + 1)
    && !reserved.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r);

  /** Spiral outward from the authored spot until nothing overlaps. */
  function findFree(x, z, r) {
    for (let ring = 0; ring < 16; ring++) {
      const steps = ring === 0 ? 1 : 10;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + ring * 0.4;
        const px = x + Math.cos(a) * ring * 3;
        const pz = z + Math.sin(a) * ring * 3;
        if (isFree(px, pz, r)) {
          reserved.push({ x: px, z: pz, r });
          return { x: px, z: pz };
        }
      }
    }
    return { x, z };
  }

  /* ════════ Ramps ════════ */
  const ramps = [];
  const rampShape = new THREE.Shape();
  rampShape.moveTo(-RAMP_SIZE.length / 2, 0);
  rampShape.lineTo(RAMP_SIZE.length / 2, 0);
  rampShape.lineTo(RAMP_SIZE.length / 2, RAMP_SIZE.height);
  rampShape.closePath();
  const rampGeo = new THREE.ExtrudeGeometry(rampShape, { depth: RAMP_SIZE.width, bevelEnabled: false });
  rampGeo.rotateY(-Math.PI / 2);
  rampGeo.translate(RAMP_SIZE.width / 2, 0, 0);
  const rampMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.3 });

  function addRamp(x, z, yaw) {
    const mesh = new THREE.Mesh(rampGeo, rampMat);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh);
    ramps.push({ x, z, sin: Math.sin(yaw), cos: Math.cos(yaw) });
  }

  function groundAt(x, z) {
    for (let i = 0; i < ramps.length; i++) {
      const r = ramps[i];
      const dx = x - r.x, dz = z - r.z;
      const along = dx * r.sin + dz * r.cos;
      const across = dx * r.cos - dz * r.sin;
      if (Math.abs(across) < RAMP_SIZE.width / 2 && Math.abs(along) < RAMP_SIZE.length / 2) {
        return RAMP_SIZE.height * (along + RAMP_SIZE.length / 2) / RAMP_SIZE.length;
      }
    }
    return 0;
  }

  /* ════════ Breakable props (crates & web-cocoons) ════════ */
  const props = [];
  const crateGeo = new THREE.BoxGeometry(2, 2, 2);
  const crateMat = new THREE.MeshStandardMaterial({ map: makeCrateTexture(), roughness: 0.85 });
  const cocoonGeo = new THREE.SphereGeometry(1.1, 12, 9);
  const cocoonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 });
  const strandGeo = new THREE.TorusGeometry(1.12, 0.05, 5, 18);
  const strandMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
  let quoteCursor = Math.floor(Math.random() * DEV_QUOTES.length);

  function addProp(kind, x, z) {
    let mesh;
    if (kind === 'crate') {
      mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.position.y = 1;
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.castShadow = true;
    } else {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(cocoonGeo, cocoonMat);
      body.scale.set(1, 1.45, 1);
      body.castShadow = true;
      mesh.add(body);
      [0.5, -0.4, 1.1].forEach((tilt, i) => {
        const strand = new THREE.Mesh(strandGeo, strandMat);
        strand.rotation.set(Math.PI / 2 + tilt * 0.5, tilt, 0);
        strand.position.y = (i - 1) * 0.55;
        mesh.add(strand);
      });
      mesh.position.y = 1.55;
    }
    mesh.position.x = x; mesh.position.z = z;
    root.add(mesh);
    const prop = { kind: 'prop', type: kind, mesh, x, z, vx: 0, vz: 0, gy: 1.3, alive: true };
    props.push(prop);
    return prop;
  }

  function smash(prop) {
    prop.alive = false;
    prop.mesh.visible = false;
    const isCrate = prop.type === 'crate';
    fx.burst(isCrate ? 'debris' : 'silk', prop.x, 1.2, prop.z, 18);
    fx.pop(isCrate ? SFX.smashCrate : SFX.smashCocoon, prop.x, 2.5, prop.z, isCrate ? 'gold' : 'white');
    fx.shake(0.7);
    quoteCursor = (quoteCursor + 1) % DEV_QUOTES.length;
    bus.emit('quote', { text: DEV_QUOTES[quoteCursor], source: isCrate ? 'crate' : 'cocoon' });
    bus.emit('score', 25);
  }

  function updateProps(dt, rx, rz) {
    const minDist = ROVER_RADIUS + PROP_RADIUS;
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (!p.alive) continue;

      // Rover contact: shove when slow, shatter when fast
      const dx = p.x - rx, dz = p.z - rz;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist && dist > 0.001 && state.y < 1.6) {
        const ux = dx / dist, uz = dz / dist;
        const closing = (state.vx - p.vx) * ux + (state.vz - p.vz) * uz;
        if (closing > SMASH_SPEED || (state.boosting && closing > 8)) {
          smash(p);
          state.vx *= 0.82; state.vz *= 0.82;
          continue;
        }
        const tx = rx + ux * minDist, tz = rz + uz * minDist;
        if (!hitsStatic(tx, tz, PROP_RADIUS * 0.8)) {
          p.x = tx; p.z = tz;
          if (closing > 0) {
            p.vx = ux * closing * 1.05; p.vz = uz * closing * 1.05;
            state.vx -= ux * closing * 0.35; state.vz -= uz * closing * 0.35;
          }
        } else if (closing > 0) {
          // Wedged against a wall: acts as a soft barrier
          state.vx -= ux * closing * 1.2; state.vz -= uz * closing * 1.2;
          forklift.position.x -= ux * (minDist - dist);
          forklift.position.z -= uz * (minDist - dist);
        }
      }

      // Slide with friction
      if (Math.abs(p.vx) + Math.abs(p.vz) > 0.05) {
        const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
        if (Math.abs(nx) > 100 || Math.abs(nz) > 64 || hitsStatic(nx, nz, PROP_RADIUS * 0.8)) {
          p.vx = 0; p.vz = 0;
        } else {
          p.x = nx; p.z = nz;
          if (p.type === 'crate') p.mesh.rotation.y += (p.vx + p.vz) * 0.02 * dt;
        }
        const drag = Math.exp(-3 * dt);
        p.vx *= drag; p.vz *= drag;
      }
      p.mesh.position.x = p.x; p.mesh.position.z = p.z;
    }
  }

  /* ════════ Signal Towers (work experience) ════════ */
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.5 });

  const towers = SIGNAL_TOWERS.map((def) => {
    const spot = findFree(def.x, def.z, 3.5);
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 0.9, 8), baseMat);
    base.position.y = 0.45; base.castShadow = true;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 9, 6), mastMat);
    mast.position.y = 5.2; mast.castShadow = true;
    group.add(base, mast);
    [3, 5.2, 7.4].forEach((y) => {
      const brace = new THREE.Mesh(new THREE.TorusGeometry(0.75 - y * 0.05, 0.06, 5, 12), mastMat);
      brace.rotation.x = Math.PI / 2; brace.position.y = y;
      group.add(brace);
    });
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }),
    );
    dish.position.set(0, 7.6, 0.5); dish.rotation.x = -Math.PI / 2.4;
    group.add(dish);

    const lampMat = new THREE.MeshBasicMaterial({ color: RED });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampMat);
    lamp.position.y = 10;
    group.add(lamp);

    const ring = makeFloorRing(RED, REPAIR_RADIUS - 0.35, REPAIR_RADIUS);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(REPAIR_RADIUS - 0.4, 48),
      new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.06; fill.scale.setScalar(0.001);
    const beam = makeBeam(def.hex, 0.6, 40, 0.25);
    beam.visible = false;
    const label = makeLabel('⚠ SIGNAL LOST', '#f87171', 9);
    label.position.y = 12;
    group.add(ring, fill, beam, label);

    root.add(group);
    colliders.push({ minX: spot.x - 1.5, maxX: spot.x + 1.5, minZ: spot.z - 1.5, maxZ: spot.z + 1.5 });
    return { def, x: spot.x, z: spot.z, progress: 0, repaired: false, sparkAt: 0, lampMat, lamp, ring, fill, beam, label };
  });

  let repairingId = null;
  let repairNode = null;

  function updateTowers(dt, elapsed, rx, rz) {
    let active = null;
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      if (t.repaired) {
        t.lamp.scale.setScalar(1 + Math.sin(elapsed * 3 + i) * 0.15);
        continue;
      }
      const inRange = Math.hypot(rx - t.x, rz - t.z) < REPAIR_RADIUS;
      t.lampMat.color.setHex(Math.sin(elapsed * 9 + i) > 0 ? RED : 0x450a0a);

      if (inRange) {
        active = t;
        t.progress += dt / REPAIR_SECONDS;
        if (elapsed > t.sparkAt) {
          t.sparkAt = elapsed + 0.1;
          fx.burst('spark', t.x, 5 + Math.random() * 5, t.z, 2);
        }
        if (t.progress >= 1) {
          t.repaired = true;
          active = null;
          t.lampMat.color.setHex(GREEN);
          t.ring.material.color.setHex(GREEN);
          t.fill.visible = false;
          t.beam.visible = true;
          t.label.userData.draw(`✓ ${t.def.company}`, t.def.css);
          fx.burst('glow', t.x, 6, t.z, 26, t.def.hex);
          fx.pop(SFX.repair, t.x, 9, t.z, 'cyan');
          fx.shake(0.45);
          bus.emit('tower', t.def);
          bus.emit('score', t.def.points);
        }
      } else {
        t.progress = Math.max(0, t.progress - dt * 0.6);
        if (elapsed > t.sparkAt) {
          t.sparkAt = elapsed + 1.2 + Math.random();
          fx.burst('spark', t.x, 9.5, t.z, 3);
        }
      }
      t.fill.scale.setScalar(Math.max(0.001, t.progress));
    }

    // HUD repair bar (direct DOM writes; no React re-render per frame)
    const { repair, repairFill, repairLabel } = bus.dom;
    if (repair) {
      const id = active ? active.def.id : null;
      if (id !== repairingId || repair !== repairNode) {
        repairingId = id;
        repairNode = repair; // HUD may remount (e.g. after the control room)
        repair.style.display = active ? 'flex' : 'none';
        if (active && repairLabel) repairLabel.textContent = `REPAIRING ${active.def.callSign} — HOLD POSITION`;
      }
      if (active && repairFill) repairFill.style.transform = `scaleX(${Math.min(1, active.progress).toFixed(3)})`;
    }
  }

  /* ════════ Data Caches (achievements) ════════ */
  const cacheGeo = new THREE.OctahedronGeometry(0.95, 0);
  const haloGeo = new THREE.TorusGeometry(1.5, 0.06, 6, 28);

  const caches = DATA_CACHES.map((def) => {
    const onRamp = def.guard === 'ramp';
    const spot = findFree(def.x, def.z, onRamp ? 8 : 6);
    let x = spot.x, z = spot.z, y = 1.7;

    if (onRamp) {
      const yaw = def.rampYaw || 0;
      addRamp(spot.x, spot.z, yaw);
      const reach = RAMP_SIZE.length / 2 + 7;
      x = spot.x + Math.sin(yaw) * reach;
      z = spot.z + Math.cos(yaw) * reach;
      y = 4.9;
      reserved.push({ x, z, r: 5 });
    } else {
      const kind = def.guard === 'crates' ? 'crate' : 'cocoon';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        addProp(kind, x + Math.cos(a) * 3.5, z + Math.sin(a) * 3.5);
      }
    }

    const group = new THREE.Group();
    group.position.set(x, y, z);
    const orb = new THREE.Mesh(cacheGeo, new THREE.MeshStandardMaterial({
      color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.25,
    }));
    const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0.8 }));
    const beam = makeBeam(0xfbbf24, 0.35, 26, 0.16);
    beam.position.y = 13 - y;
    group.add(orb, halo, beam);
    root.add(group);
    return { def, x, y, z, group, orb, halo, found: false };
  });

  function updateCaches(elapsed, rx, rz) {
    for (let i = 0; i < caches.length; i++) {
      const c = caches[i];
      if (c.found) continue;
      c.orb.rotation.y = elapsed * 1.6 + i;
      c.orb.position.y = Math.sin(elapsed * 2.2 + i) * 0.25;
      c.halo.rotation.x = elapsed * 1.1; c.halo.rotation.y = elapsed * 0.7;
      if (Math.hypot(rx - c.x, rz - c.z, state.y + 1.6 - c.y) < 3.3) {
        c.found = true;
        c.group.visible = false;
        fx.burst('glow', c.x, c.y, c.z, 22);
        fx.pop(SFX.cache, c.x, c.y + 1.5, c.z, 'gold');
        bus.emit('cache', c.def);
        bus.emit('score', c.def.points);
      }
    }
  }

  /* ════════ Power-Up Modules (skills) ════════ */
  const moduleGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const moduleEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(2.1, 2.1, 2.1));

  const modules = SKILL_MODULES.map((def) => {
    const spot = findFree(def.x, def.z, 3);
    const group = new THREE.Group();
    group.position.set(spot.x, 2.1, spot.z);
    const core = new THREE.Mesh(moduleGeo, new THREE.MeshStandardMaterial({
      color: def.hex, emissive: def.hex, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3,
    }));
    core.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    const cage = new THREE.LineSegments(moduleEdgeGeo, new THREE.LineBasicMaterial({ color: def.hex }));
    const label = makeLabel(def.name.toUpperCase(), def.css, 7);
    label.position.y = 2.4;
    const pad = makeFloorRing(def.hex, 1.7, 2.0);
    pad.position.y = -2.03;
    group.add(core, cage, label, pad);
    root.add(group);
    return { def, x: spot.x, z: spot.z, group, core, cage, taken: false };
  });

  function updateModules(elapsed, rx, rz) {
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      if (m.taken) continue;
      m.core.rotation.y = elapsed * 1.4 + i;
      m.cage.rotation.y = -elapsed * 0.6;
      m.group.position.y = 2.1 + Math.sin(elapsed * 2 + i) * 0.3;
      if (state.y < 2 && Math.hypot(rx - m.x, rz - m.z) < 3.4) {
        m.taken = true;
        m.group.visible = false;
        Object.assign(upgrades, m.def.upgrade);
        fx.burst('glow', m.x, 2, m.z, 20, m.def.hex);
        fx.pop(SFX.module, m.x, 4, m.z, 'cyan');
        bus.emit('module', m.def);
        bus.emit('score', m.def.points);
      }
    }
  }

  /* ════════ Grapple posts ════════ */
  const postGeo = new THREE.CylinderGeometry(0.22, 0.3, 6, 8);
  const postRingGeo = new THREE.TorusGeometry(0.7, 0.12, 6, 18);
  const postRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const posts = GRAPPLE_POSTS.map((def) => {
    const spot = findFree(def.x, def.z, 2);
    const pole = new THREE.Mesh(postGeo, mastMat);
    pole.position.set(spot.x, 3, spot.z); pole.castShadow = true;
    const ring = new THREE.Mesh(postRingGeo, postRingMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(spot.x, 5.4, spot.z);
    root.add(pole, ring);
    colliders.push({ minX: spot.x - 0.5, maxX: spot.x + 0.5, minZ: spot.z - 0.5, maxZ: spot.z + 0.5 });
    return { kind: 'anchor', x: spot.x, z: spot.z, gy: 5.4, alive: true };
  });

  LOOSE_PROPS.forEach((def) => {
    const spot = findFree(def.x, def.z, 2);
    addProp(def.kind, spot.x, spot.z);
  });

  /* ════════ Radioactive Bug + VIP terminal ════════ */
  const bugSpot = findFree(BUG_HOME.x, BUG_HOME.z, 2);
  const bugMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, emissive: 0x65ff00, emissiveIntensity: 1.6, roughness: 0.4 });
  const bugGroup = new THREE.Group();
  const bugBody = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), bugMat);
  bugBody.scale.set(1, 0.6, 1.35);
  const bugHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), bugMat);
  bugHead.position.set(0, 0.05, 0.95);
  const bugHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x65ff00, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  bugGroup.add(bugBody, bugHead, bugHalo);
  const legGeo = new THREE.BoxGeometry(1.1, 0.07, 0.07);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a2e05 });
  const bugLegs = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let k = -1; k <= 1; k++) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side * 0.85, -0.15, k * 0.5);
      leg.rotation.z = side * -0.5;
      bugGroup.add(leg);
      bugLegs.push(leg);
    }
  }
  bugGroup.position.set(bugSpot.x, 0.7, bugSpot.z);
  root.add(bugGroup);

  const bug = {
    kind: 'bug', x: bugSpot.x, z: bugSpot.z, vx: 0, vz: 0, gy: 0.8, alive: true,
    tx: bugSpot.x, tz: bugSpot.z, retargetAt: 0, pulled: false,
  };

  const terminal = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.2, 1.1), baseMat);
    body.position.y = 1.6; body.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
    screen.position.set(0, 2.3, 0.56);
    const label = makeLabel('★ VIP TERMINAL — HIRE ME', '#fbbf24', 9);
    label.position.y = 5;
    terminal.add(body, screen, label, makeBeam(0xfbbf24, 0.9, 40, 0.2), makeFloorRing(0xfbbf24, 4.6, 5));
  }
  const terminalSpot = findFree(VIP_TERMINAL.x, VIP_TERMINAL.z, 3);
  terminal.position.set(terminalSpot.x, -6, terminalSpot.z);
  terminal.visible = false;
  root.add(terminal);
  let terminalUnlocked = false;
  let nearTerminal = false;

  function updateBug(dt, elapsed, rx, rz) {
    if (terminalUnlocked) {
      terminal.position.y += (0 - terminal.position.y) * Math.min(1, 4 * dt);
      const near = Math.hypot(rx - terminalSpot.x, rz - terminalSpot.z) < 5.5;
      if (near && !nearTerminal) bus.emit('vip', VIP_TERMINAL);
      nearTerminal = near;
    }
    if (!bug.alive) return;

    const dx = bug.x - rx, dz = bug.z - rz;
    const dist = Math.hypot(dx, dz);

    if (dist < 3.4 && state.y < 2) {
      bug.alive = false;
      bugGroup.visible = false;
      terminalUnlocked = true;
      terminal.visible = true;
      fx.burst('glow', bug.x, 1, bug.z, 30, 0x65ff00);
      fx.pop(SFX.bug, bug.x, 2.5, bug.z, 'green');
      fx.shake(0.4);
      bus.emit('bug', VIP_TERMINAL);
      bus.emit('score', 500);
      return;
    }

    if (!bug.pulled) {
      let speed = 7;
      if (dist < 17) { // flee, zig-zagging
        speed = 19;
        const jitter = Math.sin(elapsed * 5) * 0.9;
        bug.tx = bug.x + (dx / dist) * 10 - (dz / dist) * jitter * 6;
        bug.tz = bug.z + (dz / dist) * 10 + (dx / dist) * jitter * 6;
      } else if (elapsed > bug.retargetAt || Math.hypot(bug.tx - bug.x, bug.tz - bug.z) < 1.5) {
        bug.retargetAt = elapsed + 3 + Math.random() * 3;
        bug.tx = bug.x + (Math.random() - 0.5) * 50;
        bug.tz = bug.z + (Math.random() - 0.5) * 50;
      }
      const tx = bug.tx - bug.x, tz = bug.tz - bug.z;
      const td = Math.hypot(tx, tz) || 1;
      bug.vx = (tx / td) * speed; bug.vz = (tz / td) * speed;
    }
    bug.pulled = false;

    const nx = bug.x + bug.vx * dt, nz = bug.z + bug.vz * dt;
    if (Math.abs(nx) > 96 || Math.abs(nz) > 60 || hitsStatic(nx, nz, 1)) {
      // Blocked: scurry somewhere else
      bug.tx = bug.x + (Math.random() - 0.5) * 40;
      bug.tz = bug.z + (Math.random() - 0.5) * 40;
      bug.retargetAt = elapsed + 1.5;
    } else {
      bug.x = nx; bug.z = nz;
    }

    bugGroup.position.set(bug.x, 0.7 + Math.abs(Math.sin(elapsed * 14)) * 0.12, bug.z);
    bugGroup.rotation.y = Math.atan2(bug.vx, bug.vz);
    for (let i = 0; i < bugLegs.length; i++) bugLegs[i].rotation.y = Math.sin(elapsed * 22 + i * 2) * 0.5;
    bugHalo.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.15);
  }

  /* ════════ Pizza Time (15-second delivery) ════════ */
  const pizzaFrom = findFree(PIZZA_RUN.from.x, PIZZA_RUN.from.z, 4);
  const pizzaTo = findFree(PIZZA_RUN.to.x, PIZZA_RUN.to.z, 4);

  const pizzaStart = new THREE.Group();
  pizzaStart.position.set(pizzaFrom.x, 0, pizzaFrom.z);
  const startLabel = makeLabel('🍕 PIZZA TIME — DRIVE IN', '#fb923c', 9);
  startLabel.position.y = 4.5;
  pizzaStart.add(makeFloorRing(0xfb923c, 3.3, 3.9), startLabel);

  const pizzaGoal = new THREE.Group();
  pizzaGoal.position.set(pizzaTo.x, 0, pizzaTo.z);
  const goalLabel = makeLabel('🍕 DELIVER HERE', '#4ade80', 8);
  goalLabel.position.y = 5;
  pizzaGoal.add(makeFloorRing(0x4ade80, 3.6, 4.3), makeBeam(0x4ade80, 1.2, 44, 0.28), goalLabel);
  pizzaGoal.visible = false;
  root.add(pizzaStart, pizzaGoal);

  const pizzaBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.28, 1.7),
    new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.9 }),
  );
  pizzaBox.position.set(0, 4.75, -0.4);
  pizzaBox.visible = false;
  chassis.add(pizzaBox);

  const pizza = { running: false, timeLeft: 0, armed: true };

  const readBest = () => {
    try { return Number(localStorage.getItem(PIZZA_RUN.storageKey)) || 0; } catch (e) { return 0; }
  };

  function endPizza(success) {
    pizza.running = false;
    pizzaGoal.visible = false;
    pizzaBox.visible = false;
    pizzaStart.visible = true;
    let best = readBest();
    const points = success ? Math.round(pizza.timeLeft * 50) : 0;
    const isBest = points > best;
    if (isBest) {
      best = points;
      try { localStorage.setItem(PIZZA_RUN.storageKey, String(best)); } catch (e) { /* private mode */ }
    }
    fx.pop(success ? SFX.pizzaWin : SFX.pizzaFail, forklift.position.x, 5, forklift.position.z, success ? 'gold' : 'white');
    if (success) { fx.burst('glow', pizzaTo.x, 2, pizzaTo.z, 30, 0xfb923c); bus.emit('score', points); }
    bus.emit('pizza-end', { success, points, best, isBest, timeLeft: Math.max(0, pizza.timeLeft) });
  }

  function updatePizza(dt, elapsed, rx, rz) {
    if (!pizza.running) {
      const onPad = Math.hypot(rx - pizzaFrom.x, rz - pizzaFrom.z) < 3.8;
      if (!onPad) pizza.armed = true;
      else if (pizza.armed) {
        pizza.armed = false;
        pizza.running = true;
        pizza.timeLeft = PIZZA_RUN.seconds;
        pizzaGoal.visible = true;
        pizzaBox.visible = true;
        pizzaStart.visible = false;
        fx.pop('PIZZA TIME!', rx, 5, rz, 'gold');
        bus.emit('pizza-start', { seconds: PIZZA_RUN.seconds, best: readBest() });
      }
      return;
    }

    pizza.timeLeft -= dt;
    const dx = pizzaTo.x - rx, dz = pizzaTo.z - rz;
    const dist = Math.hypot(dx, dz);

    const { pizzaTime, pizzaDist, pizzaArrow } = bus.dom;
    if (pizzaTime) pizzaTime.textContent = `${Math.max(0, pizza.timeLeft).toFixed(1)}s`;
    if (pizzaDist) pizzaDist.textContent = `${Math.round(dist)}m`;
    if (pizzaArrow) {
      const yaw = forklift.rotation.y;
      const forward = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
      pizzaArrow.style.transform = `rotate(${Math.round(Math.atan2(right, forward) * 57.3)}deg)`;
    }

    if (dist < 4.6) endPizza(true);
    else if (pizza.timeLeft <= 0) endPizza(false);
  }

  /* ════════ Grapple queries ════════ */
  function nearestTarget(x, z, range) {
    let best = null;
    let bestDist = range;
    const consider = (t) => {
      if (!t.alive) return;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bestDist && d > 3.5) { bestDist = d; best = t; }
    };
    posts.forEach(consider);
    props.forEach(consider);
    consider(bug);
    return best;
  }

  /** Reel a movable target (prop / bug) toward the rover. */
  function pull(target, rx, rz) {
    const dx = rx - target.x, dz = rz - target.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4.2) { target.vx = 0; target.vz = 0; }
    else { target.vx = (dx / dist) * 26; target.vz = (dz / dist) * 26; }
    if (target.kind === 'bug') target.pulled = true;
  }

  /* ════════ Radar overlay ════════ */
  function drawRadar(ctx, toX, toY, elapsed) {
    towers.forEach((t) => {
      const x = toX(t.x), y = toY(t.z);
      ctx.fillStyle = t.repaired ? '#22c55e' : (Math.sin(elapsed * 6) > 0 ? '#ef4444' : '#7f1d1d');
      ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y + 3); ctx.lineTo(x - 4, y + 3); ctx.closePath(); ctx.fill();
    });
    modules.forEach((m) => {
      if (m.taken) return;
      ctx.strokeStyle = m.def.css; ctx.lineWidth = 1.5;
      ctx.strokeRect(toX(m.x) - 2.5, toY(m.z) - 2.5, 5, 5);
    });
    if (upgrades.radar) {
      ctx.fillStyle = '#fbbf24';
      caches.forEach((c) => {
        if (c.found) return;
        ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 2.5, 0, Math.PI * 2); ctx.fill();
      });
      if (bug.alive && Math.sin(elapsed * 10) > 0) {
        ctx.fillStyle = '#84ff3c';
        ctx.beginPath(); ctx.arc(toX(bug.x), toY(bug.z), 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (terminalUnlocked) {
      ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText('★', toX(terminalSpot.x), toY(terminalSpot.z) + 3);
    }
    const p = pizza.running ? pizzaTo : pizzaFrom;
    ctx.strokeStyle = pizza.running ? '#4ade80' : '#fb923c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), pizza.running ? 4 + Math.sin(elapsed * 8) * 1.5 : 3, 0, Math.PI * 2); ctx.stroke();
  }

  function update(dt, elapsed) {
    const rx = forklift.position.x, rz = forklift.position.z;
    updateProps(dt, rx, rz);
    updateTowers(dt, elapsed, rx, rz);
    updateCaches(elapsed, rx, rz);
    updateModules(elapsed, rx, rz);
    updateBug(dt, elapsed, rx, rz);
    updatePizza(dt, elapsed, rx, rz);
  }

  /** Resolved entity positions (after free-spot placement) — handy for debugging. */
  const layout = () => ({
    towers: towers.map((t) => ({ id: t.def.id, x: t.x, z: t.z, repaired: t.repaired })),
    caches: caches.map((c) => ({ id: c.def.id, guard: c.def.guard, x: c.x, y: c.y, z: c.z, found: c.found })),
    modules: modules.map((m) => ({ id: m.def.id, x: m.x, z: m.z, taken: m.taken })),
    ramps: ramps.map((r) => ({ x: r.x, z: r.z })),
    posts: posts.map((p) => ({ x: p.x, z: p.z })),
    props: props.filter((p) => p.alive).map((p) => ({ type: p.type, x: p.x, z: p.z })),
    bug: { x: bug.x, z: bug.z, alive: bug.alive },
    terminal: terminalSpot, pizzaFrom, pizzaTo,
  });

  return {
    layout,
    update, groundAt, nearestTarget, pull, drawRadar,
    totals: { towers: towers.length, caches: caches.length, modules: modules.length },
  };
}
