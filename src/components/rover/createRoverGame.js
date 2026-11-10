/**
 * Rover game orchestrator. Wires physics, grapple, mission world and FX
 * together and exposes a small surface to the host scene (Warehouse.jsx):
 *
 *   const rover = createRoverGame({...});
 *   rover.update(dt, elapsed, keys, joystick);   // once per frame
 *   rover.preRender(); renderer.render(); rover.postRender();
 */
import { createRoverFx } from './roverFx';
import { createRoverPhysics, ROVER_TUNING } from './roverPhysics';
import { createRoverWorld } from './roverWorld';
import { createRoverGrapple } from './roverGrapple';
import { SFX } from './roverContent';

const REAR_AXLE = -1.2;
const WHEEL_TRACK = 1.1;
const STEALTH_BODY = 0x14161c;

export function createRoverGame({
  scene, camera, forklift, chassis, bodyMat, colliders, state, bus, popLayer,
  reservedZones, halfW, halfD,
}) {
  const upgrades = { speedMul: 1, gripMul: 1, regenMul: 1, drainMul: 1, grappleMul: 1, radar: false };
  const input = { throttle: 0, steer: 0, boost: false, drift: false };
  const baseBodyColor = bodyMat.color.getHex();

  const fx = createRoverFx({ scene, camera, popLayer });
  const world = createRoverWorld({ scene, colliders, forklift, chassis, state, fx, bus, upgrades, reservedZones });
  const physics = createRoverPhysics({ forklift, chassis, colliders, state, upgrades, groundAt: world.groundAt, halfW, halfD });
  const grapple = createRoverGrapple({ scene, forklift, state, world, fx, upgrades });

  let trackOdometer = 0;
  let dustTimer = 0;
  let wallPopAt = 0;
  let driftPopAt = 0;
  let lastEnergy = -1;
  let lastBoosting = null;

  function readInput(keys, joy) {
    const joyOn = joy && joy.active;
    if (joyOn && Math.abs(joy.y) > 0.05) input.throttle = Math.max(-1, Math.min(1, joy.y * 1.35));
    else input.throttle = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);

    if (joyOn && Math.abs(joy.x) > 0.05) input.steer = -Math.max(-1, Math.min(1, joy.x * 1.25));
    else input.steer = (keys.a || keys.arrowleft ? 1 : 0) - (keys.d || keys.arrowright ? 1 : 0);

    input.boost = !!(keys.shift || bus.input.boost);
    input.drift = !!(keys[' '] || bus.input.drift);
  }

  /** Dust, tyre tracks, sparks, shake and comic words driven by physics events. */
  function feedback(ev, dt, elapsed) {
    const { x, y, z } = forklift.position;
    const yaw = forklift.rotation.y;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const rearX = x + sin * REAR_AXLE, rearZ = z + cos * REAR_AXLE;
    const speed = Math.abs(state.speed);
    const drifting = state.grounded && ev.slip > 5;

    if (state.grounded && speed > 2) {
      trackOdometer += speed * dt;
      if (trackOdometer > 1.1) {
        trackOdometer = 0;
        const travelYaw = Math.atan2(state.vx, state.vz);
        const width = drifting || state.boosting ? 1.7 : 1;
        fx.stampTrack(rearX + cos * WHEEL_TRACK, rearZ - sin * WHEEL_TRACK, travelYaw, width);
        fx.stampTrack(rearX - cos * WHEEL_TRACK, rearZ + sin * WHEEL_TRACK, travelYaw, width);
      }
    }

    dustTimer -= dt;
    if (state.grounded && dustTimer <= 0 && (speed > 9 || drifting)) {
      dustTimer = drifting ? 0.03 : 0.09;
      fx.burst('dust', rearX + (Math.random() - 0.5) * 2, 0.3, rearZ + (Math.random() - 0.5) * 2, drifting ? 2 : 1);
    }
    if (drifting && elapsed > driftPopAt) {
      driftPopAt = elapsed + 1.4;
      fx.pop(SFX.drift, rearX, 2, rearZ, 'cyan');
    }

    if (state.boosting) {
      fx.burst('boost', rearX - sin * 0.8, 1.3, rearZ - cos * 0.8, 1, state.stealth ? 0xe5e7eb : undefined);
    }
    if (ev.dash) {
      fx.pop(SFX.dash, x, y + 5, z, 'cyan');
      fx.burst('boost', rearX, 1.3, rearZ, 10);
      fx.shake(0.25);
    }
    if (ev.impact > 7) {
      fx.shake(Math.min(1.2, ev.impact * 0.045));
      fx.burst('spark', x + sin * 2.4, 1.4, z + cos * 2.4, 8);
      if (elapsed > wallPopAt) {
        wallPopAt = elapsed + 0.6;
        fx.pop(SFX.wall, x + sin * 2.4, 3.5, z + cos * 2.4, 'crimson');
      }
    }
    if (ev.land) {
      fx.shake(Math.min(1, ev.land * 0.05));
      fx.burst('dust', x, 0.3, z, 14);
      fx.pop(SFX.land, x, 3, z, 'gold');
    }
  }

  function writeHud() {
    const { boostFill, boostMeter } = bus.dom;
    if (boostFill && Math.abs(state.energy - lastEnergy) > 0.004) {
      lastEnergy = state.energy;
      boostFill.style.transform = `scaleX(${state.energy.toFixed(3)})`;
    }
    if (boostMeter && state.boosting !== lastBoosting) {
      lastBoosting = state.boosting;
      boostMeter.classList.toggle('rover-boost--active', state.boosting);
    }
  }

  function update(dt, elapsed, keys, joy) {
    readInput(keys, joy);
    const events = physics.step(dt, input);
    grapple.update(dt, !!(keys.f || bus.input.grapple), elapsed);
    world.update(dt, elapsed);
    feedback(events, dt, elapsed);
    fx.update(dt);
    writeHud();
  }

  function setStealth(on, announce = true) {
    if (state.stealth === on) return;
    state.stealth = on;
    bodyMat.color.setHex(on ? STEALTH_BODY : baseBodyColor);
    if (announce) {
      const { x, y, z } = forklift.position;
      fx.pop(on ? SFX.stealthOn : SFX.stealthOff, x, y + 6, z, 'white');
      fx.shake(0.3);
    }
  }

  // Dev-only handle for poking at the game from the browser console
  if (process.env.NODE_ENV !== 'production') {
    window.__rover = { state, forklift, upgrades, layout: world.layout };
  }

  return {
    update,
    setStealth,
    totals: world.totals,
    setShiftActive: world.setShiftActive,
    drawRadar: world.drawRadar,
    preRender: fx.preRender,
    postRender: fx.postRender,
    /** Follow-camera FOV: widens while boosting for a sense of speed. */
    fovTarget: () => 60 + (state.boosting ? 10 : 0)
      + Math.max(0, Math.min(4, (Math.abs(state.speed) - ROVER_TUNING.maxSpeed) * 0.4)),
    reset() { grapple.release(); physics.reset(); },
    dispose() { fx.dispose(); },
  };
}
