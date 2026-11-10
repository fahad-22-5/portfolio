/**
 * ASRS (automated storage & retrieval) cell: tote racking, climbing shuttle
 * bots and an operator pick station fed by a roller conveyor.
 *
 * Layout (local coordinates, +x points from the rack toward the station):
 *
 *     rack x ∈ [-16, 16]      lane (x = 18.5)     conveyor x ∈ [19.7, 35.3]     outfeed dock (x = 36.5)
 *     4 aisles along x  ───►  cross lane  ───►  infeed dock ─ operator ─ ───►  bypass lane back (z = 7)
 *
 * Shuttle 1 fetches a tote and pushes it straight onto the conveyor.
 * The operator handles it, shuttle 2 takes it off the far end and returns it
 * to the rack by the bypass lane, so no bot ever drives through the station.
 */
import * as THREE from 'three';

const RACK_W = 32;
const RACK_H = 22;
const COLS = 14;
const ROWS = 7;
const BAY_W = RACK_W / COLS;
const ROW_H = RACK_H / (ROWS + 1);
const AISLE_ZS = [10.5, 3.5, -3.5, -10.5];
const SIDES = [-1, 1];
const SHELF_OFFSET = 1.7;   // aisle centre → shelf centre
const SHELF_DEPTH = 1.5;
const DECK_TOP = 0.03;      // deck surface above the row height

const TOTE = { w: 1.8, h: 0.8, d: 1.15 };
const TRAY_Y = 0.84;        // top of a bot's tray == top of the conveyor rollers

const LANE_X = 18.5;
const DOCK_OUT_X = 36.5;
const BYPASS_Z = 7;
const CONVEYOR = { x0: 19.7, x1: 35.3, halfWidth: 0.78 };
const OPERATOR_X = 27.5;

const DRIVE_SPEED = 11;
const CLIMB_SPEED = 7;
const BELT_SPEED = 6;
const ARM_SECONDS = 0.9;
const WORK_SECONDS = 2.2;

const slotX = (col) => -RACK_W / 2 + BAY_W * (col + 0.5);
const rowY = (row) => (row + 1) * ROW_H;
const slotIndex = (aisle, sideIdx, col, row) => ((aisle * 2 + sideIdx) * COLS + col) * ROWS + row;

/** Polyline a bot can be placed along by travelled distance. */
function makePath(points) {
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(len);
    total += len;
  }
  return { points, lengths, total };
}

export function createAsrsSystem({ scene, colliders, x: originX, createLabelSprite, createRoundedBox, makeAABB }) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const instanced = (geo, mat, count) => {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    group.add(mesh);
    let i = 0;
    return {
      mesh,
      add(px, py, pz) {
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      },
    };
  };

  /* ════════ Racking ════════ */
  const uprightMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.6, roughness: 0.35 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.4, roughness: 0.45 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });

  const faces = AISLE_ZS.length * SIDES.length;
  const uprightLines = COLS / 2 + 1; // an upright frame every second bay
  const uprights = instanced(new THREE.BoxGeometry(0.22, RACK_H, 0.22), uprightMat, uprightLines * faces * 2);
  const decks = instanced(new THREE.BoxGeometry(RACK_W, 0.06, SHELF_DEPTH), deckMat, ROWS * faces);
  const beams = instanced(new THREE.BoxGeometry(RACK_W, 0.18, 0.1), beamMat, ROWS * faces * 2);
  const ties = instanced(new THREE.BoxGeometry(0.16, 0.16, SHELF_OFFSET * 2 + SHELF_DEPTH), darkSteelMat, uprightLines * AISLE_ZS.length);
  uprights.mesh.castShadow = true;

  AISLE_ZS.forEach((az) => {
    for (let u = 0; u < uprightLines; u++) {
      ties.add(-RACK_W / 2 + u * BAY_W * 2, RACK_H + 0.08, az);
    }
    SIDES.forEach((side) => {
      const faceZ = az + side * SHELF_OFFSET;
      for (let u = 0; u < uprightLines; u++) {
        const ux = -RACK_W / 2 + u * BAY_W * 2;
        uprights.add(ux, RACK_H / 2, faceZ - SHELF_DEPTH / 2);
        uprights.add(ux, RACK_H / 2, faceZ + SHELF_DEPTH / 2);
      }
      for (let row = 0; row < ROWS; row++) {
        const y = rowY(row);
        decks.add(0, y, faceZ);
        beams.add(0, y - 0.1, faceZ - SHELF_DEPTH / 2 + 0.04);
        beams.add(0, y - 0.1, faceZ + SHELF_DEPTH / 2 - 0.04);
      }
    });
  });

  /* ════════ Totes: one instanced mesh, each seated on its shelf deck ════════ */
  const toteGeo = createRoundedBox(TOTE.w, TOTE.h, TOTE.d, 0.05, 1);
  const toteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 });
  const slotCount = faces * COLS * ROWS;
  const toteMesh = new THREE.InstancedMesh(toteGeo, toteMat, slotCount);
  toteMesh.castShadow = true;
  group.add(toteMesh);
  const filled = new Uint8Array(slotCount);
  const TOTE_COLORS = [0x0284c7, 0x0284c7, 0x0ea5e9, 0x1d4ed8, 0xf59e0b];
  const color = new THREE.Color();

  function setSlot(aisle, sideIdx, col, row, isFilled) {
    const idx = slotIndex(aisle, sideIdx, col, row);
    filled[idx] = isFilled ? 1 : 0;
    dummy.position.set(
      slotX(col),
      rowY(row) + DECK_TOP + TOTE.h / 2,
      AISLE_ZS[aisle] + SIDES[sideIdx] * SHELF_OFFSET,
    );
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(isFilled ? 1 : 0);
    dummy.updateMatrix();
    toteMesh.setMatrixAt(idx, dummy.matrix);
    toteMesh.instanceMatrix.needsUpdate = true;
  }

  for (let aisle = 0; aisle < AISLE_ZS.length; aisle++) {
    for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS; row++) {
          const idx = slotIndex(aisle, sideIdx, col, row);
          toteMesh.setColorAt(idx, color.setHex(TOTE_COLORS[(col * 3 + row * 5 + aisle + sideIdx) % TOTE_COLORS.length]));
          setSlot(aisle, sideIdx, col, row, (col + row * 2 + sideIdx + aisle) % 5 !== 0);
        }
      }
    }
  }
  toteMesh.instanceColor.needsUpdate = true;

  /* ════════ Floor guide rails: aisles, cross lane, bypass loop ════════ */
  const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.3 });
  const addRail = (x0, z0, x1, z1) => {
    const alongX = z0 === z1;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    [-0.6, 0.6].forEach((off) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.1, 0.08, alongX ? 0.1 : len), railMat);
      rail.position.set((x0 + x1) / 2 + (alongX ? 0 : off), 0.04, (z0 + z1) / 2 + (alongX ? off : 0));
      group.add(rail);
    });
  };
  AISLE_ZS.forEach((az) => addRail(-RACK_W / 2 - 1, az, LANE_X, az));
  addRail(LANE_X, AISLE_ZS[3] - 1, LANE_X, AISLE_ZS[0] + 1);
  addRail(LANE_X, BYPASS_Z, DOCK_OUT_X, BYPASS_Z);
  addRail(DOCK_OUT_X, 0, DOCK_OUT_X, BYPASS_Z);

  /* ════════ Pick station ════════ */
  const conveyorLen = CONVEYOR.x1 - CONVEYOR.x0;
  const conveyorMid = (CONVEYOR.x0 + CONVEYOR.x1) / 2;
  [-1, 1].forEach((side) => {
    // Side frames double as guides, so a tote can only ride down the middle
    const frame = new THREE.Mesh(new THREE.BoxGeometry(conveyorLen, 0.34, 0.1), darkSteelMat);
    frame.position.set(conveyorMid, 0.74, side * CONVEYOR.halfWidth);
    frame.castShadow = true;
    group.add(frame);
    for (let lx = CONVEYOR.x0 + 0.4; lx < CONVEYOR.x1; lx += 3.7) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), darkSteelMat);
      leg.position.set(lx, 0.3, side * CONVEYOR.halfWidth);
      group.add(leg);
    }
  });
  const rollerGeo = new THREE.CylinderGeometry(0.1, 0.1, CONVEYOR.halfWidth * 2 - 0.12, 10);
  rollerGeo.rotateX(Math.PI / 2);
  const rollerCount = Math.floor(conveyorLen / 0.45);
  const rollers = instanced(rollerGeo, new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.25 }), rollerCount);
  for (let i = 0; i < rollerCount; i++) rollers.add(CONVEYOR.x0 + 0.25 + i * 0.45, TRAY_Y - 0.1, 0);

  // Scan arch over the belt (its bar is the status light)
  const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), darkSteelMat);
    post.position.set(OPERATOR_X + 1.5, 1.3, side * (CONVEYOR.halfWidth + 0.25));
    group.add(post);
  });
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, CONVEYOR.halfWidth * 2 + 0.64), lightBarMat);
  lightBar.position.set(OPERATOR_X + 1.5, 2.6, 0);
  group.add(lightBar);

  // Terminal on the far side of the belt, facing the operator
  const monitorPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), darkSteelMat);
  monitorPost.position.set(OPERATOR_X - 0.9, 0.95, CONVEYOR.halfWidth + 0.35);
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x38bdf8, emissiveIntensity: 0.7 }),
  );
  monitor.position.set(OPERATOR_X - 0.9, 2.0, CONVEYOR.halfWidth + 0.3);
  const sideTable = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 }));
  sideTable.position.set(OPERATOR_X + 2.8, 0.45, -1.9);
  sideTable.castShadow = true;
  group.add(monitorPost, monitor, sideTable);

  // Operator stands clear of every bot route, facing the belt
  const worker = new THREE.Group();
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }));
  legs.position.y = 0.6;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.3, 0.55), vestMat);
  torso.position.y = 1.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.8 }));
  head.position.y = 2.7;
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 }),
  );
  helmet.position.y = 2.72;
  const armGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
  armGeo.translate(0, -0.4, 0); // pivot at the shoulder
  const armL = new THREE.Mesh(armGeo, vestMat);
  armL.position.set(-0.55, 2.3, 0.1);
  const armR = new THREE.Mesh(armGeo, vestMat);
  armR.position.set(0.55, 2.3, 0.1);
  worker.add(legs, torso, head, helmet, armL, armR);
  worker.position.set(OPERATOR_X, 0, -(CONVEYOR.halfWidth + 0.75));
  group.add(worker);

  const stationLight = new THREE.PointLight(0x10b981, 0.8, 10);
  stationLight.position.set(OPERATOR_X, 3.5, 0);
  group.add(stationLight);

  const beltTote = new THREE.Mesh(toteGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 }));
  beltTote.castShadow = true;
  beltTote.visible = false;
  group.add(beltTote);

  const asrsStationSign = createLabelSprite('🤖 ASRS PICK STATION', '#38bdf8', '#0284c7');
  asrsStationSign.position.set(OPERATOR_X, 4.8, -1.8);
  asrsStationSign.scale.set(0, 0, 0);
  asrsStationSign.visible = false;
  const asrsSign = createLabelSprite('🤖 ASRS MATRIX SYSTEM', '#38bdf8', '#0284c7');
  asrsSign.position.set(0, RACK_H + 2.5, 0);
  asrsSign.scale.set(0, 0, 0);
  asrsSign.visible = false;
  group.add(asrsStationSign, asrsSign);

  /* ════════ Shuttle bots ════════ */
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.5 });
  const forkMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.3 });

  function createBot(bodyHex, ledHex) {
    const bot = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.5, 1.4),
      new THREE.MeshStandardMaterial({ color: bodyHex, metalness: 0.6, roughness: 0.35 }),
    );
    body.position.y = 0.5;
    body.castShadow = true;
    bot.add(body);
    [[-0.68, -0.72], [-0.68, 0.72], [0.68, -0.72], [0.68, 0.72]].forEach(([wx, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, 0.24, wz);
      bot.add(wheel);
    });
    // Flat tray, slightly larger than a tote, so the tote sits centred on the chassis
    // and can leave either sideways (forks) or straight ahead (onto the conveyor)
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.06, 1.32), darkSteelMat);
    tray.position.y = TRAY_Y - 0.03;
    bot.add(tray);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), new THREE.MeshBasicMaterial({ color: ledHex }));
    led.position.set(0.96, 0.5, 0);
    bot.add(led);

    // Telescopic forks: slide sideways (local z) into the shelf, carrying the tote
    const arm = new THREE.Group();
    [-0.55, 0.55].forEach((fx) => {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 1.25), forkMat);
      fork.position.set(fx, TRAY_Y + 0.015, 0);
      arm.add(fork);
    });
    const tote = new THREE.Mesh(toteGeo, new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 }));
    tote.position.y = TRAY_Y + 0.03 + TOTE.h / 2;
    tote.castShadow = true;
    tote.visible = false;
    arm.add(tote);
    bot.add(arm);

    group.add(bot);
    return { bot, arm, tote, state: 'idle', t: 0, path: null, job: null };
  }

  const fetcher = createBot(0xeab308, 0xfef08a);   // rack → conveyor
  const stower = createBot(0xf97316, 0xffedd5);    // conveyor → rack
  const shuttleA = createBot(0x10b981, 0xa7f3d0);  // ambient traffic on the far aisles
  const shuttleB = createBot(0x8b5cf6, 0xddd6fe);
  fetcher.bot.position.set(LANE_X, 0, 0);
  stower.bot.position.set(DOCK_OUT_X, 0, 0);
  stower.state = 'home';

  /* ════════ Motion helpers ════════ */
  const turnToward = (bot, target, dt) => {
    let diff = (target - bot.rotation.y) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    bot.rotation.y += diff * Math.min(1, dt * 9);
  };

  /** Place a bot `dist` along a path; returns true once it has arrived. */
  function drive(unit, dist, dt) {
    const { points, lengths, total } = unit.path;
    let d = Math.min(dist, total);
    let i = 0;
    while (i < lengths.length - 1 && d > lengths[i]) { d -= lengths[i]; i++; }
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const f = lengths[i] ? d / lengths[i] : 1;
    unit.bot.position.set(ax + (bx - ax) * f, 0, az + (bz - az) * f);
    turnToward(unit.bot, Math.atan2(-(bz - az), bx - ax), dt); // local +x faces travel
    return dist >= total;
  }

  /**
   * Climb to a shelf, run the forks out and back, climb down.
   * `onReach` fires once at full extension (grab or release the tote).
   */
  function shelfCycle(unit, dt) {
    const { job } = unit;
    const topY = rowY(job.row) + DECK_TOP - TRAY_Y - 0.03; // forks level with the deck
    const climb = Math.max(0.001, topY / CLIMB_SPEED);
    const t = unit.t;
    turnToward(unit.bot, 0, dt);
    const reach = SIDES[job.sideIdx] * SHELF_OFFSET * Math.cos(unit.bot.rotation.y);

    if (t < climb) {
      unit.bot.position.y = (t / climb) * topY;
    } else if (t < climb + ARM_SECONDS) {
      unit.bot.position.y = topY;
      const p = (t - climb) / ARM_SECONDS;
      unit.arm.position.z = Math.sin(p * Math.PI) * reach;
      if (p >= 0.5 && !job.done) { job.done = true; job.onReach(); }
    } else if (t < climb * 2 + ARM_SECONDS) {
      unit.arm.position.z = 0;
      unit.bot.position.y = topY * (1 - (t - climb - ARM_SECONDS) / climb);
    } else {
      unit.arm.position.z = 0;
      unit.bot.position.y = 0;
      return true;
    }
    return false;
  }

  // The main loop only works aisles 0–1; the ambient shuttles own aisles 2–3
  function pickSlot(wantFilled) {
    for (let tries = 0; tries < 60; tries++) {
      const aisle = Math.floor(Math.random() * 2);
      const sideIdx = Math.floor(Math.random() * 2);
      const col = Math.floor(Math.random() * COLS);
      const row = Math.floor(Math.random() * ROWS);
      if (!!filled[slotIndex(aisle, sideIdx, col, row)] === wantFilled) return { aisle, sideIdx, col, row };
    }
    return { aisle: 0, sideIdx: 0, col: 1, row: 1 };
  }

  const routeIn = (slot) => makePath([[LANE_X, 0], [LANE_X, AISLE_ZS[slot.aisle]], [slotX(slot.col), AISLE_ZS[slot.aisle]]]);
  const routeOut = (slot) => makePath([
    [DOCK_OUT_X, 0], [DOCK_OUT_X, BYPASS_Z], [LANE_X, BYPASS_Z],
    [LANE_X, AISLE_ZS[slot.aisle]], [slotX(slot.col), AISLE_ZS[slot.aisle]],
  ]);
  const reversed = (path) => makePath([...path.points].reverse());

  const belt = { state: 'empty', x: 0, t: 0 };
  const BELT_Y = TRAY_Y + TOTE.h / 2;

  function startFetch() {
    const slot = pickSlot(true);
    fetcher.job = { ...slot, done: false, onReach: () => { setSlot(slot.aisle, slot.sideIdx, slot.col, slot.row, false); fetcher.tote.visible = true; } };
    fetcher.path = routeIn(slot);
    fetcher.state = 'go';
    fetcher.t = 0;
  }
  startFetch();

  /* ════════ Per-frame update ════════ */
  function update(dt, elapsed) {
    /* Fetcher: rack → infeed dock */
    fetcher.t += dt;
    if (fetcher.state === 'go') {
      if (drive(fetcher, fetcher.t * DRIVE_SPEED, dt)) { fetcher.state = 'pick'; fetcher.t = 0; }
    } else if (fetcher.state === 'pick') {
      if (shelfCycle(fetcher, dt)) { fetcher.state = 'back'; fetcher.t = 0; fetcher.path = reversed(fetcher.path); }
    } else if (fetcher.state === 'back') {
      if (drive(fetcher, fetcher.t * DRIVE_SPEED, dt)) fetcher.state = 'dock';
    } else if (fetcher.state === 'dock') {
      turnToward(fetcher.bot, 0, dt); // square up to the belt
      if (belt.state === 'empty' && Math.abs(Math.sin(fetcher.bot.rotation.y / 2)) < 0.03) {
        // Push the tote straight off the tray onto the rollers
        fetcher.tote.visible = false;
        beltTote.visible = true;
        belt.state = 'in';
        belt.x = LANE_X;
        startFetch();
      }
    }

    /* Conveyor */
    if (belt.state === 'in') {
      belt.x = Math.min(OPERATOR_X, belt.x + BELT_SPEED * dt);
      if (belt.x >= OPERATOR_X) { belt.state = 'work'; belt.t = 0; }
    } else if (belt.state === 'work') {
      belt.t += dt;
      if (belt.t >= WORK_SECONDS) belt.state = 'out';
    } else if (belt.state === 'out') {
      // Wait at the end of the belt until the stower is parked at the dock
      const limit = stower.state === 'home' ? DOCK_OUT_X : CONVEYOR.x1 - TOTE.w / 2;
      belt.x = Math.min(limit, belt.x + BELT_SPEED * dt);
      if (belt.x >= DOCK_OUT_X) {
        belt.state = 'empty';
        beltTote.visible = false;
        stower.tote.visible = true;
        const slot = pickSlot(false);
        stower.job = { ...slot, done: false, onReach: () => { setSlot(slot.aisle, slot.sideIdx, slot.col, slot.row, true); stower.tote.visible = false; } };
        stower.path = routeOut(slot);
        stower.state = 'go';
        stower.t = 0;
      }
    }
    if (beltTote.visible) beltTote.position.set(belt.x, BELT_Y, 0);

    const working = belt.state === 'work';
    armL.rotation.x = working ? -1.1 + Math.sin(elapsed * 6) * 0.35 : -0.25;
    armR.rotation.x = working ? -1.1 - Math.sin(elapsed * 6) * 0.35 : -0.25;
    stationLight.intensity = working ? 2.6 : 0.8;
    lightBarMat.color.setHex(working ? 0x10b981 : 0x0284c7);

    /* Stower: outfeed dock → rack → back by the bypass lane */
    stower.t += dt;
    if (stower.state === 'go') {
      if (drive(stower, stower.t * DRIVE_SPEED, dt)) { stower.state = 'place'; stower.t = 0; }
    } else if (stower.state === 'place') {
      if (shelfCycle(stower, dt)) { stower.state = 'back'; stower.t = 0; stower.path = reversed(stower.path); }
    } else if (stower.state === 'back') {
      if (drive(stower, stower.t * DRIVE_SPEED, dt)) stower.state = 'home';
    } else {
      turnToward(stower.bot, 0, dt);
    }

    /* Ambient shuttles: one patrols its aisle, one rides up and down a column */
    const span = RACK_W / 2 - 2;
    const sweep = (elapsed * 9) % (span * 4);
    const px = sweep < span * 2 ? -span + sweep : span * 3 - sweep;
    shuttleA.bot.position.set(px, 0, AISLE_ZS[2]);
    turnToward(shuttleA.bot, sweep < span * 2 ? 0 : Math.PI, dt);

    const lift = rowY(ROWS - 2);
    const ride = (elapsed * CLIMB_SPEED * 0.6) % (lift * 2);
    shuttleB.bot.position.set(slotX(9), ride < lift ? ride : lift * 2 - ride, AISLE_ZS[3]);
  }

  /* ════════ Placement & collision ════════ */
  group.position.set(originX, 0, 0);
  scene.add(group);
  colliders.push(makeAABB(originX, 0, RACK_W / 2 + 1.5, 13.5));                       // racking
  colliders.push(makeAABB(originX + LANE_X, 0, 1.6, 12));                             // cross lane
  colliders.push(makeAABB(originX + (LANE_X + DOCK_OUT_X) / 2 + 1, 2.3, 10.5, 6.3));  // station + bypass loop

  return {
    update, asrsSign, asrsStationSign,
    /** World-space anchor points for proximity signage */
    stationX: originX + OPERATOR_X,
    matrixX: originX,
  };
}
