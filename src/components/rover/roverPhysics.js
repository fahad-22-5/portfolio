/**
 * Rover driving model: momentum, drift, boost/dash, jumps and suspension.
 * All units are world-units and seconds (frame-rate independent).
 */

import { WORLD } from './roverContent';

export const ROVER_TUNING = {
  maxSpeed: 27,
  reverseFactor: 0.6,
  accel: 34,
  brake: 62,
  coastDrag: 1.5,
  turnRate: 2.4,
  pivotFactor: 0.55,
  grip: 9,
  driftGrip: 1.3,
  tetherGrip: 0.8,
  boostSpeedMul: 1.55,
  boostAccelMul: 1.9,
  boostDrain: 0.42,
  boostRegen: 0.2,
  boostRegenDelay: 0.7,
  dashImpulse: 13,
  dashCost: 0.22,
  gravity: 24,
  stepHeight: 0.9,
  stealthSpeedMul: 1.3,
  bounds: { x: WORLD.driveX, z: WORLD.driveZ },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Critically-underdamped spring used for chassis pitch / roll / heave. */
function makeSpring(stiffness, damping) {
  const s = { value: 0, velocity: 0 };
  s.step = (target, dt) => {
    s.velocity += (-stiffness * (s.value - target) - damping * s.velocity) * dt;
    s.value += s.velocity * dt;
    return s.value;
  };
  s.reset = () => { s.value = 0; s.velocity = 0; };
  return s;
}

/**
 * @param forklift   root group (yaw + position)
 * @param chassis    child group that leans/bounces on the suspension
 * @param colliders  static AABBs: { minX, maxX, minZ, maxZ }
 * @param state      shared mutable state (speed / maxSpeed are read by the HUD)
 * @param upgrades   multipliers granted by power-up modules
 * @param groundAt   (x, z) => floor height (ramps)
 */
export function createRoverPhysics({ forklift, chassis, colliders, state, upgrades, groundAt, halfW, halfD }) {
  const T = ROVER_TUNING;
  const pitch = makeSpring(90, 10);
  const roll = makeSpring(90, 10);
  const heave = makeSpring(150, 9);
  const events = { impact: 0, land: 0, dash: false, slip: 0 };

  Object.assign(state, {
    vx: 0, vz: 0, vy: 0, y: 0, grounded: true,
    energy: 1, boosting: false, boostLocked: false, boostHeld: false, regenWait: 0,
    tether: null, stealth: false, maxSpeed: T.maxSpeed,
  });

  forklift.rotation.order = 'YXZ';

  const blocked = (x, z, y) => {
    const minX = x - halfW, maxX = x + halfW, minZ = z - halfD, maxZ = z + halfD;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (minX < c.maxX && maxX > c.minX && minZ < c.maxZ && maxZ > c.minZ) return true;
    }
    return groundAt(x, z) - y > T.stepHeight; // too tall to climb = wall
  };

  function step(dt, input) {
    events.impact = 0; events.land = 0; events.dash = false; events.slip = 0;
    if (dt <= 0) return events;

    let yaw = forklift.rotation.y;
    let sin = Math.sin(yaw), cos = Math.cos(yaw);
    let vf = state.vx * sin + state.vz * cos;   // forward speed
    let vl = state.vx * cos - state.vz * sin;   // sideways slip
    const prevVf = vf;

    /* ── Boost & dash ── */
    const wantBoost = input.boost && input.throttle > -0.05;
    if (!input.boost) state.boostLocked = false;
    if (wantBoost && !state.boostHeld && state.energy >= T.dashCost && state.grounded) {
      vf += T.dashImpulse;
      state.energy -= T.dashCost;
      events.dash = true;
    }
    state.boostHeld = input.boost;
    state.boosting = wantBoost && !state.boostLocked && state.energy > 0;

    if (state.boosting) {
      state.energy -= T.boostDrain * upgrades.drainMul * dt;
      state.regenWait = T.boostRegenDelay;
      if (state.energy <= 0) { state.energy = 0; state.boostLocked = true; state.boosting = false; }
    } else if ((state.regenWait -= dt) <= 0) {
      state.energy = Math.min(1, state.energy + T.boostRegen * upgrades.regenMul * dt);
    }

    /* ── Throttle ── */
    const throttle = state.boosting ? 1 : input.throttle;
    const topSpeed = T.maxSpeed * upgrades.speedMul * (state.stealth ? T.stealthSpeedMul : 1);
    const maxFwd = topSpeed * (state.boosting ? T.boostSpeedMul : 1);
    state.maxSpeed = topSpeed * T.boostSpeedMul; // HUD gauge full-scale

    if (state.grounded) {
      if (throttle > 0.05) {
        vf += (vf < 0 ? T.brake : T.accel * throttle * (state.boosting ? T.boostAccelMul : 1)) * dt;
      } else if (throttle < -0.05) {
        vf += (vf > 0 ? -T.brake : T.accel * 0.8 * throttle) * dt;
      } else {
        vf *= Math.exp(-T.coastDrag * dt);
      }
    }
    if (vf > maxFwd) vf = Math.max(maxFwd, vf - 40 * dt); // dash overshoot bleeds off
    vf = Math.max(vf, -topSpeed * T.reverseFactor);

    /* ── Steering ── */
    const absVf = Math.abs(vf);
    const steerScale = absVf > 0.6 ? Math.sign(vf) * clamp(absVf / 6, T.pivotFactor, 1) : T.pivotFactor;
    const yawRate = input.steer * T.turnRate * steerScale
      * (input.drift ? 1.3 : 1) * (state.grounded ? 1 : 0.3);
    yaw += yawRate * dt;

    /* ── Lateral grip (low grip = drift) ── */
    const grip = input.drift ? T.driftGrip : state.tether ? T.tetherGrip : T.grip * upgrades.gripMul;
    if (state.grounded) vl *= Math.exp(-grip * dt);
    events.slip = Math.abs(vl);

    sin = Math.sin(yaw); cos = Math.cos(yaw);
    state.vx = sin * vf + cos * vl;
    state.vz = cos * vf - sin * vl;

    /* ── Move with per-axis collision so the rover slides along walls ── */
    let x = forklift.position.x;
    let z = forklift.position.z;
    const nx = clamp(x + state.vx * dt, -T.bounds.x, T.bounds.x);
    if (blocked(nx, z, state.y)) {
      events.impact = Math.max(events.impact, Math.abs(state.vx));
      state.vx *= -0.3;
    } else x = nx;
    const nz = clamp(z + state.vz * dt, -T.bounds.z, T.bounds.z);
    if (blocked(x, nz, state.y)) {
      events.impact = Math.max(events.impact, Math.abs(state.vz));
      state.vz *= -0.3;
    } else z = nz;

    /* ── Web-tether rope constraint (swing around an anchor) ── */
    const tether = state.tether;
    if (tether) {
      const dx = x - tether.x, dz = z - tether.z;
      const dist = Math.hypot(dx, dz);
      if (dist > tether.len && dist > 0.001) {
        const ux = dx / dist, uz = dz / dist;
        const px = tether.x + ux * tether.len, pz = tether.z + uz * tether.len;
        if (!blocked(px, pz, state.y)) { x = px; z = pz; }
        const outward = state.vx * ux + state.vz * uz;
        if (outward > 0) { state.vx -= ux * outward; state.vz -= uz * outward; }
        // Face along the swing so releasing slingshots the rover forward
        const speed = Math.hypot(state.vx, state.vz);
        if (speed > 4) {
          let diff = (Math.atan2(state.vx, state.vz) - yaw) % (Math.PI * 2);
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          yaw += diff * Math.min(1, 7 * dt);
        }
      }
    }

    /* ── Vertical: ramps launch, gravity lands ── */
    const ground = groundAt(x, z);
    if (state.grounded) {
      if (ground >= state.y - 0.05) {
        state.vy = clamp((ground - state.y) / dt, 0, 16);
        state.y = ground;
      } else {
        state.grounded = false; // floor fell away: keep climb velocity = jump
      }
    }
    if (!state.grounded) {
      state.vy -= T.gravity * dt;
      state.y += state.vy * dt;
      if (state.y <= ground) {
        if (state.vy < -8) events.land = -state.vy;
        state.y = ground; state.vy = 0; state.grounded = true;
      }
    }

    forklift.position.set(x, state.y, z);
    forklift.rotation.y = yaw;

    const vfNow = state.vx * Math.sin(yaw) + state.vz * Math.cos(yaw);
    state.speed = vfNow;
    state.rotSpeed = yawRate;

    /* ── Suspension ── */
    const slopePitch = (!state.grounded || ground > 0.05)
      ? -Math.atan2(state.vy, Math.max(Math.abs(vfNow), 6)) : 0;
    forklift.rotation.x += (slopePitch - forklift.rotation.x) * Math.min(1, 10 * dt);

    if (events.impact > 6) { pitch.velocity += events.impact * 0.02 * Math.sign(prevVf || 1); heave.velocity -= 1.2; }
    if (events.land) heave.velocity -= Math.min(6, events.land * 0.35);
    if (events.dash) pitch.velocity -= 1.1;

    const longAccel = (vfNow - prevVf) / dt;
    chassis.rotation.x = pitch.step(clamp(-longAccel * 0.0035, -0.09, 0.09), dt);
    chassis.rotation.z = roll.step(clamp(yawRate * vfNow * 0.0022 + vl * 0.004, -0.11, 0.11), dt);
    chassis.position.y = clamp(heave.step(0, dt), -0.35, 0.5);

    return events;
  }

  function reset() {
    Object.assign(state, {
      speed: 0, rotSpeed: 0, vx: 0, vz: 0, vy: 0, y: 0, grounded: true,
      energy: 1, boosting: false, boostLocked: false, tether: null,
    });
    pitch.reset(); roll.reset(); heave.reset();
    chassis.rotation.set(0, 0, 0);
    chassis.position.y = 0;
    forklift.rotation.x = 0;
  }

  return { step, reset };
}
