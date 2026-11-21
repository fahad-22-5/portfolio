/**
 * Riding the bus.
 *
 * At an open door of a bus on its stand, E boards: the cat takes the front seat (upstairs on a double-decker,
 * the best seat in London) and the camera sits behind it inside the bus, looking out through the front window.
 * The bus runs as normal: the rest of its layover, down the ramp (out of sight: the screen goes dark), out of
 * the arch and along its road. At the first stop it pulls up with its doors open and E gets off on the pavement
 * side; stay on and it carries on to the end of its run, where everyone gets off.
 *
 * The cat simply follows the bus's own matrix, whoever is driving it (the deck while up there, the traffic on
 * the road), so the ride costs nothing beyond one matrix multiply a frame.
 */
import * as THREE from 'three';
import { BUS } from '../world/bus.js';

const SEAT = { dd: [0.755, 2.82, 4.6], sd: [0.705, 0.86, 1.16] };          // the front seat, nearside, in the bus's frame
const CAM = { dd: [[-0.15, 3.7, 3.7], [0.55, 2.9, 15]], sd: [[0.3, 1.78, -0.6], [0.4, 1.15, 14]] };   // above the seat backs, looking out of the front window
const STOP = { 'Hammersmith Rd': 'Hammersmith Road', 'King St': 'King Street', 'Fulham Palace Rd': 'Fulham Palace Road', "Shepherd's Bush Rd": "Shepherd's Bush Road" };

export function createRide({ ctx, ui, api, tone }) {
  let r = null;
  const v3 = new THREE.Vector3();

  function start(b) {
    r = { car: b.car, line: b.line, type: b.car.btype, last: new THREE.Matrix4().copy(b.car.matrix), dark: false, prompt: '', level: '', canAlight: false, wasRoad: false };
    ctx.catRiding = true; tone(1480, 1480, 0.1, 'square', 0.03);
    ui.toast(`On the ${r.line.n} to ${r.line.dest} · E gets off at the next stop`, 3600);
  }

  function update() {
    if (!r) return;
    const car = r.car, e = car.matrix.elements, y = e[13], squeezed = Math.hypot(e[8], e[9], e[10]) < 0.98, T = ctx.traffic;
    const onDeck = ctx.deckOps && ctx.deckOps.buses.find((b) => b.car === car);
    const onRoad = !onDeck && T.cars.find((v) => v.car === car);
    if (y < -50 || squeezed) {                                 // in the ramp tunnel, or still coming out of the arch: dark
      if (!r.dark) { r.dark = true; ui.fade(true); }
      r.prompt = 'Down the ramp…'; r.canAlight = false;
      if (!onDeck && !onRoad && r.wasRoad) alight('End of the line');
      return;
    }
    if (r.dark) { r.dark = false; ui.fade(false); }
    r.last.copy(car.matrix);
    const [sx, sy, sz] = SEAT[r.type];
    api.pos.copy(v3.set(sx, sy, sz).applyMatrix4(car.matrix)); api.heading = car.ry;
    r.level = `On the ${r.line.n} to ${r.line.dest}`;
    if (onDeck) { r.prompt = onDeck.state === 'DWELL' ? `${r.level} · leaving soon` : r.level; r.canAlight = false; }
    else if (onRoad) {
      r.wasRoad = true; onRoad.rider = true;
      const name = STOP[onRoad.route.stopName] || 'the next stop';
      if (onRoad.atStop) { r.prompt = `[E] Get off at ${name}`; r.canAlight = true; }
      else if (onRoad.stopDone && onRoad.s > onRoad.route.stopS + 100) { alight('End of the ride'); return; }   // before the run leaves the part of London that is built
      else { r.prompt = onRoad.stopDone ? `${r.level} · next: the end of the line` : `${r.level} · next stop: ${name}`; r.canAlight = false; }
    } else alight('End of the line');
  }

  /** the inside camera, written straight into the follow camera's position and target */
  function camera(pos, target) {
    if (!r) return;                                           // (while it is dark this is the last view, held still)
    const [c, l] = CAM[r.type];
    pos.set(c[0], c[1], c[2]).applyMatrix4(r.last); target.set(l[0], l[1], l[2]).applyMatrix4(r.last);
  }

  function alight(why) {
    if (!r) return;
    const T = BUS[r.type], dz = (T.fa + 0.75 + T.L / 2 - 0.25) / 2;
    for (const off of [3.2, 2.4, 4.2, 5.4, 1.5]) { v3.set(T.W / 2 + off, 0, dz).applyMatrix4(r.last); const ok = ctx.isPavement ? ctx.isPavement(v3.x, v3.z) : null; if (ok !== false || off === 1.5) break; }   // out of the door and on to the pavement
    const g = ctx.col.groundAt(v3.x, v3.z, Math.max(0.3, v3.y + 0.5), 1);
    api.place(v3.x, Number.isFinite(g) && g > -5 ? g : 0, v3.z, r.car.ry);
    ui.fade(false); ui.toast(why ? `${why} · off the ${r.line.n}` : `Off the ${r.line.n}`, 2600);
    tone(660, 440, 0.15, 'sine', 0.03);
    const v = ctx.traffic.cars.find((q) => q.car === r.car); if (v) v.rider = false;
    r = null; ctx.catRiding = false;
  }

  return {
    start, update, camera,
    get active() { return !!r; },
    get prompt() { return r ? r.prompt : ''; },
    get level() { return r ? r.level : ''; },
    use() { if (r && r.canAlight) { alight(null); return true; } return false; },
  };
}
