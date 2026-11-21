import * as THREE from 'three';
import { TAU, DEG, polar, sign, roundel, slabStrip, rails, ribbon, walk, inst, box, rectPath, canvasTex } from '../util.js';
import { FLYOVER, ROADS, BLOCKS, ABERCORN, HC_STATION, APOLLO } from '../mapData.js';
import { createGateLine } from '../gates.js';
import { buildButeGardens } from './buteGardens.js';
import { buildCars } from './cars.js';
import { inStairHole, ISLAND, GYRATORY, ENVELOPE, inPoly } from './plan2024.js';
import { createFoliage } from './foliage.js';
import { buildCityBlocks } from './cityBlocks.js';
import { buildStationStreet, JOIN, REPLACED, KERB_GAPS } from './stationStreet.js';

const STAIR_HOLE = inStairHole;

export function buildSurroundings(ctx) {
  const { scene, col, mats } = ctx;
  const g = new THREE.Group();
  scene.add(g);
  const flat = (shape, mat, y, seg = 24) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, seg).rotateX(-Math.PI / 2), mat);
    m.position.y = y; m.receiveShadow = true; g.add(m); return m;
  };

  /* ---------- ground, island, gyratory (from the traced polygon) ---------- */
  const islandPts = new THREE.CatmullRomCurve3(ISLAND.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.25)
    .getPoints(180).slice(0, -1).map((p) => [p.x, p.z]);   // fine enough to follow the rounded corner by the entrance
  const ground = new THREE.Shape();
  ground.moveTo(-520, -520); ground.lineTo(520, -520); ground.lineTo(520, 520); ground.lineTo(-520, 520); ground.closePath();
  const islandHole = new THREE.Path(); islandPts.forEach(([x, z], i) => (i ? islandHole.lineTo(x, -z) : islandHole.moveTo(x, -z))); islandHole.closePath();
  ground.holes.push(islandHole);
  flat(ground, mats.ground, 0);
  const island = new THREE.Shape(); islandPts.forEach(([x, z], i) => (i ? island.lineTo(x, -z) : island.moveTo(x, -z))); island.closePath();
  const mallHole = new THREE.Path(); ENVELOPE.forEach(([x, z], i) => (i ? mallHole.lineTo(x, -z) : mallHole.moveTo(x, -z))); mallHole.closePath(); island.holes.push(mallHole);   // the mall has its own floor
  flat(island, mats.paving, 0, 64);
  // street level everywhere, except the stairwell; 3.2 m thick so the platforms can sit underneath
  col.add({ minX: -520, maxX: 520, minZ: -520, maxZ: 520, h: 0, thick: 3.2, test: (x, z) => !STAIR_HOLE(x, z) });

  // Beadon Road, Shepherd's Bush Road, King Street and Hammersmith Road used to stop short of the gyratory: each now runs on to meet it
  const roads = ROADS.map((r) => (JOIN[r.name] ? { ...r, pts: [JOIN[r.name], ...r.pts] } : r));
  const road = (pts, w, y = 0.03, closed = false) => {
    const m = new THREE.Mesh(ribbon(pts, w, y, closed), mats.asphalt); m.receiveShadow = true; g.add(m); return m;
  };
  const gyratory = new THREE.CatmullRomCurve3(GYRATORY.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.25).getPoints(240).slice(0, -1).map((p) => [p.x, p.z]);
  // Hammersmith Road meets the gyratory at its north-east corner (Street View from Bute Gardens: an open junction, no building):
  // a short arm from the road's bend down to the ring. Traffic coming in turns left down it; traffic leaving runs straight on
  // along the north side.
  { let b = 0, bd = Infinity; gyratory.forEach(([x, z], i) => { const d = (x - 53) ** 2 + (z + 46) ** 2; if (d < bd) { bd = d; b = i; } }); roads.push({ name: 'Broadway junction', w: 13, pts: [gyratory[b], [69.6, -99.2]] }); }
  road(gyratory, 15, 0.03, true);
  roads.forEach((r) => road(r.pts, r.w));
  ctx.roadways = [{ pts: gyratory.concat([gyratory[0]]), w: 15 }, ...roads.map((r) => ({ pts: r.pts, w: r.w })), { pts: FLYOVER, w: 22 }];   // for the pedestrians, who keep off them
  road(FLYOVER, 22, 0.025);                                     // A4 at grade, under the flyover

  /* ---------- A4 flyover: deck, parapets, piers every 35 m ---------- */
  const fly = new THREE.CatmullRomCurve3(FLYOVER.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(48).map((p) => [p.x, p.z]);
  const deckRails = rails(fly, 18, 7.5);
  const flyDeck = new THREE.Mesh(slabStrip(deckRails.L, deckRails.R, 1.2), mats.concrete);
  flyDeck.castShadow = true; flyDeck.receiveShadow = true; g.add(flyDeck);
  for (const side of [-1, 1]) {
    const edge = fly.map((p, i) => {
      const l = deckRails.L[i], r = deckRails.R[i], t = side < 0 ? 0.02 : 0.98;
      return [l[0] + (r[0] - l[0]) * t, l[2] + (r[2] - l[2]) * t];
    });
    const pr = rails(edge, 0.4, 8.5);
    const parapet = new THREE.Mesh(slabStrip(pr.L, pr.R, 1.0), mats.concreteDark); g.add(parapet);
  }
  const piers = walk(fly, 35, 10).map(([x, z, dx, dz]) => {
    col.rect(x, z, 2.6, 5.4, { rot: Math.atan2(dx, dz), h: 6.3 });
    return { x, y: 3.15, z, ry: Math.atan2(dx, dz) };
  });
  inst(g, new THREE.BoxGeometry(2.2, 6.3, 5), mats.concreteDark, piers);

  /* ---------- generic massing with instanced window bands ---------- */
  const tones = [0x6f6a64, 0x7c7468, 0x5d6672, 0x8a7a68, 0x65707a, 0x787068];
  const bodies = [], bands = [];
  BLOCKS.filter((B) => !inPoly(B[0], B[1], GYRATORY) && !REPLACED(B)).forEach(([x, z, w, d, h], i) => {
    bodies.push({ x, y: h / 2, z, sx: w, sy: h, sz: d, c: tones[i % tones.length] });
    for (let y = 2.2; y < h - 1; y += 3.3) bands.push({ x, y, z, sx: w + 0.12, sy: 1.5, sz: d + 0.12, c: (i + Math.round(y)) % 3 ? 0x2a3a50 : 0x8fa9c4 });
    col.rect(x, z, w, d, { h, pad: 0.3 });
  });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  inst(g, unit, mats.blockWhite, bodies);
  inst(g, unit, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.7, envMapIntensity: 1.3 }), bands, { shadow: false }).material.color.multiplyScalar(0.75);   // ribbon glazing: reflects the sky

  /* ---------- trees + street lamps ---------- */
  const trees = [], lamps = [];
  const greens = [0x4f7a3a, 0x5d8a44, 0x466e36, 0x6a9450];
  roads.filter((r) => r.trees).forEach((r) => walk(r.pts, 24, 14).forEach(([x, z, dx, dz], i) => {
    for (const s of [-1, 1]) {
      const tx = x + dz * s * (r.w / 2 + 1.6), tz = z - dx * s * (r.w / 2 + 1.6);
      if (Math.hypot(tx - ABERCORN.x + 10, tz - ABERCORN.z) < 5 || tz > -128) continue;   // keep the porch and the corner clear
      trees.push({ x: tx, z: tz, k: 0.85 + ((i * 7 + s + 1) % 5) * 0.08 });
    }
  }));
  for (const [x, z] of [[-182, 70], [-160, 100], [-190, 105], [-150, 78], [-70, 62], [66, 70], [84, 52], [70, -62], [-120, 150], [-140, 160]]) if (!inPoly(x, z, GYRATORY)) trees.push({ x, z, k: 1.1 });
  const foliage = ctx.foliage = createFoliage(ctx, g);
  trees.forEach((t) => foliage.tree(t.x, t.z, t.k));
  islandPts.forEach(([x, z], i) => { if (i % 15 === 0) lamps.push([x, z]); });
  roads.forEach((r) => walk(r.pts, 34, 12).forEach(([x, z, dx, dz], i) => {
    const s = i % 2 ? 1 : -1; lamps.push([x + dz * s * (r.w / 2 + 1), z - dx * s * (r.w / 2 + 1)]);
  }));
  inst(g, new THREE.CylinderGeometry(0.07, 0.1, 7, 6), mats.dark, lamps.map(([x, z]) => ({ x, y: 3.5, z })));
  ctx.streetLampMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, emissive: 0xffd6a5, emissiveIntensity: 0.03, roughness: 0.4 });   // off by day; daylight.js lights them at dusk
  ctx.streetLamps = lamps;
  inst(g, new THREE.SphereGeometry(0.28, 8, 6), ctx.streetLampMat, lamps.map(([x, z]) => ({ x, y: 7.1, z })), { shadow: false });

  /* ---------- zebra crossing with Belisha beacons: over Beadon Road, on the way to the H&C station ---------- */
  const stripes = [], poles = [], bandsBW = [], globes = [], tactile = [];
  const zebra = (cx, cz, dirX, dirZ, w) => {                    // (dirX, dirZ): direction of traffic
    const len = Math.hypot(dirX, dirZ); dirX /= len; dirZ /= len;
    const ax = dirZ, az = -dirX, ry = Math.atan2(dirX, dirZ);   // across the road
    for (let d = -w / 2 + 0.6; d < w / 2; d += 1.2) stripes.push({ x: cx + ax * d, y: 0.05, z: cz + az * d, ry });
    for (const s of [-1, 1]) {
      const ex = cx + ax * s * (w / 2 + 1), ez = cz + az * s * (w / 2 + 1);
      tactile.push({ x: ex, y: 0.045, z: ez, ry });
      const px = ex + dirX * 2.2, pz = ez + dirZ * 2.2;
      poles.push({ x: px, y: 1.3, z: pz }); globes.push({ x: px, y: 2.8, z: pz });
      for (const y of [0.5, 1.3, 2.1]) bandsBW.push({ x: px, y, z: pz });
    }
  };
  zebra(-104, -119.4, -0.857, -0.515, 10);
  inst(g, new THREE.BoxGeometry(0.6, 0.02, 3.4), mats.white, stripes, { shadow: false });
  // buff blister paving at the dropped kerbs: 400 mm slabs, 6 x 6 domes each, with a matching bump map
  const blister = canvasTex(128, 128, (c) => {
    c.fillStyle = '#c8a769'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#8f7446'; c.lineWidth = 2; c.strokeRect(0, 0, 128, 128);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) { const x = 10.7 + i * 21.3, y = 10.7 + j * 21.3; c.fillStyle = '#a2854f'; c.beginPath(); c.arc(x + 1, y + 1.5, 6.2, 0, TAU); c.fill(); c.fillStyle = '#e2c88f'; c.beginPath(); c.arc(x, y, 5.4, 0, TAU); c.fill(); }
  });
  blister.wrapS = blister.wrapT = THREE.RepeatWrapping; blister.repeat.set(3, 9);
  inst(g, new THREE.BoxGeometry(1.2, 0.02, 3.6), new THREE.MeshStandardMaterial({ map: blister, bumpMap: blister, bumpScale: 2, roughness: 0.85 }), tactile, { shadow: false });
  inst(g, new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), mats.white, poles);
  inst(g, new THREE.CylinderGeometry(0.075, 0.075, 0.4, 8), mats.dark, bandsBW, { shadow: false });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffa516, toneMapped: false });
  inst(g, new THREE.SphereGeometry(0.24, 12, 8), beaconMat, globes, { shadow: false });
  const walkway = new THREE.Mesh(ribbon([[-103, -112], [-105, -128], [-105, -150]], 3.2, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9, side: THREE.DoubleSide }));
  walkway.receiveShadow = true; g.add(walkway);
  ctx.updaters.push((dt, t) => beaconMat.color.setHex((t % 1.4) < 0.7 ? 0xffa516 : 0x4a2f08));

  /* ---------- raised granite kerbs and lane markings along every carriageway ---------- */
  {
    const ways = [{ pts: gyratory.concat([gyratory[0]]), w: 15 }, ...roads.map((r) => ({ pts: r.pts, w: r.w })), { pts: FLYOVER, w: 22, plain: true }];
    const distTo = (x, z, pts) => {
      let best = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0] - ax, bz = pts[i + 1][1] - az, t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz || 1)));
        const d = Math.hypot(x - ax - bx * t, z - az - bz * t); if (d < best) best = d;
      }
      return best;
    };
    const onRoad = (x, z, skip, m = 0.1) => ways.some((wy) => wy !== skip && distTo(x, z, wy.pts) < wy.w / 2 + m);
    const atCrossing = (x, z) => tactile.some((t) => Math.hypot(x - t.x, z - t.z) < 2.6) || Math.hypot(x + 104, z + 119.4) < 7 || KERB_GAPS.some(([gx, gz, r]) => Math.hypot(x - gx, z - gz) < r);   // dropped kerbs, and no lane line through a zebra
    const kerbs = [], dashes = [];
    for (const wy of ways) {
      if (wy.plain) continue;
      for (const side of [-1, 1]) for (const [x, z, dx, dz] of walk(wy.pts, 1.2, 0.6)) {
        const kx = x + dz * side * (wy.w / 2 + 0.15), kz = z - dx * side * (wy.w / 2 + 0.15);
        if (!onRoad(kx, kz, wy) && !atCrossing(kx, kz) && distTo(kx, kz, wy.pts) > wy.w / 2) kerbs.push({ x: kx, y: 0.07, z: kz, ry: Math.atan2(dx, dz) });   // (last test: not inside its own carriageway, where the line turns a corner)
      }
      for (const [x, z, dx, dz] of walk(wy.pts, 6, 2)) if (!onRoad(x, z, wy, 1.5) && !atCrossing(x, z)) dashes.push({ x, y: 0.041, z, ry: Math.atan2(dx, dz) });
    }
    inst(g, new THREE.BoxGeometry(0.3, 0.14, 1.21), mats.granite, kerbs);
    inst(g, new THREE.BoxGeometry(0.13, 0.012, 2.4), mats.white, dashes, { shadow: false });
  }

  hcStation(ctx, g);
  {
    // St Paul's church, south-west of the centre: its tower and four pinnacles stand over the roofs from the bus deck and
    // the junction (Street View). Pale stone nave with lancet windows, tower at the east end.
    const stone = new THREE.MeshStandardMaterial({ color: 0xcfc6b2, roughness: 0.9 }), slate = new THREE.MeshStandardMaterial({ color: 0x4c515a, roughness: 0.7 }), cx = -100, cz = 104;
    box(g, 26, 15, 13, stone, cx - 2, 7.5, cz);
    const ridge = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-7, 0), new THREE.Vector2(7, 0), new THREE.Vector2(0, 5.5)]), { depth: 26, bevelEnabled: false }).rotateY(Math.PI / 2), slate);
    ridge.position.set(cx - 15, 15, cz); ridge.castShadow = true; g.add(ridge);
    box(g, 7.5, 31, 7.5, stone, cx + 14, 15.5, cz); box(g, 8.1, 0.6, 8.1, stone, cx + 14, 31.2, cz);
    inst(g, new THREE.ConeGeometry(0.75, 4.2, 6), stone, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: cx + 14 + sx * 3.3, y: 33.6, z: cz + sz * 3.3 }))));
    const dark = new THREE.MeshStandardMaterial({ color: 0x1f2630, roughness: 0.2, metalness: 0.5 }), slots = [];
    for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) slots.push({ x: cx - 12.5 + i * 4.2, y: 8, z: cz + sz * 6.53, sx: 1.1, sy: 6.5, sz: 0.06 });
    for (const [dx, dz, w, d] of [[0, 3.78, 1.4, 0.06], [0, -3.78, 1.4, 0.06], [3.78, 0, 0.06, 1.4], [-3.78, 0, 0.06, 1.4]]) slots.push({ x: cx + 14 + dx, y: 26, z: cz + dz, sx: w, sy: 4, sz: d });
    inst(g, new THREE.BoxGeometry(1, 1, 1), dark, slots, { shadow: false });
    col.rect(cx - 2, cz, 26, 13, { h: 15, pad: 0.3 }); col.rect(cx + 14, cz, 7.5, 7.5, { h: 31, pad: 0.3 });
  }
  buildButeGardens(ctx, g);
  buildCityBlocks(ctx, g);
  buildStationStreet(ctx, g, gyratory);
  buildCars(ctx, g, gyratory, roads);                 // last: the traffic needs the roads as joined, and the crossings' signal heads
  foliage.flush();

  // (the clouds are in the sky shader now: they move, thicken and clear with the weather)
  apollo(ctx, g);

  // St Paul's Church on its green, and the copper bulk of The Ark east along the A4
  const green = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x35513a, roughness: 1 }));
  green.position.set(-170, 0.02, 88); g.add(green);
  box(g, 14, 12, 30, mats.stone, -172, 6, 88); box(g, 7, 24, 7, mats.stone, -172, 12, 68);
  col.rect(-172, 85, 14, 37, { h: 24, pad: 0.3 });
  const ark = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.4, metalness: 0.5 }));
  ark.scale.set(30, 24, 42); ark.position.set(224, 4, 172); ark.castShadow = true; g.add(ark);
  col.rect(224, 172, 52, 76, { h: 26 });
}

/* Hammersmith (Circle and H&C lines): Victorian brick terminus north of Beadon Rd. */
function hcStation(ctx, g) {
  const { col, mats } = ctx, S = HC_STATION;
  const x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, front = S.z + S.d / 2, hallBack = front - 14;
  // train shed behind the ticket hall (solid)
  box(g, S.w, S.h, S.d - 14, mats.brick, S.x, S.h / 2, S.z - 7);
  col.rect(S.x, S.z - 7, S.w, S.d - 14, { h: S.h, pad: 0.2 });
  // facade with an arched portal
  const face = new THREE.Shape();
  face.moveTo(-S.w / 2, 0); face.lineTo(S.w / 2, 0); face.lineTo(S.w / 2, S.h); face.lineTo(0, S.h + 2.6); face.lineTo(-S.w / 2, S.h); face.closePath();
  const arch = new THREE.Path(); arch.moveTo(-4, 0); arch.lineTo(-4, 4.2); arch.absarc(0, 4.2, 4, Math.PI, 0, true); arch.lineTo(4, 0); arch.closePath();
  face.holes.push(arch);
  const facade = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 0.7, bevelEnabled: false, curveSegments: 20 }), mats.brick);
  facade.position.set(S.x, 0, front - 0.7); facade.castShadow = true; g.add(facade);
  box(g, S.w + 0.4, 0.5, 1, mats.stone, S.x, 8.9, front - 0.3); box(g, S.w + 0.4, 0.5, 1, mats.stone, S.x, S.h, front - 0.3);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.28, 8, 24, Math.PI), mats.stone);
  ring.position.set(S.x, 4.2, front + 0.02); g.add(ring);
  const r = roundel(2.6, { lines: ['#f3a9bb', '#ffd300'] }); r.position.set(S.x, 11.9, front + 0.26); g.add(r);
  const name = sign('HAMMERSMITH STATION', { w: 14, h: 1, bg: '#0019a8' }); name.position.set(S.x, 9.8, front + 0.06); g.add(name);
  const lines = sign('Circle  ·  Hammersmith & City', { w: 9, h: 0.6, bg: '#fff', fg: '#111', stripe: ['#ffd300', '#f3a9bb'] });
  lines.position.set(S.x - 11, 3.2, front + 0.06); g.add(lines);
  // ticket hall shell: side walls, roof, tiled back wall
  for (const x of [x0 + 0.3, x1 - 0.3]) { box(g, 0.6, S.h, 14, mats.brick, x, S.h / 2, front - 7); col.rect(x, front - 7, 0.6, 14, { h: S.h, pad: 0.15 }); }
  box(g, S.w, 0.4, 14, mats.concreteDark, S.x, S.h - 0.2, front - 7);
  for (const sx of [-1, 1]) col.rect(S.x + sx * (4 + (S.w / 2 - 4) / 2), front - 0.35, S.w / 2 - 4, 0.7, { h: S.h, pad: 0.15 });
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(S.w - 1.2, 13.3).rotateX(-Math.PI / 2), mats.tile);
  hallFloor.position.set(S.x, 0.04, front - 7.2); hallFloor.receiveShadow = true; g.add(hallFloor);
  inst(g, new THREE.BoxGeometry(6, 0.08, 0.6), mats.warm, [-9, 0, 9].map((dx) => ({ x: S.x + dx, y: 7.5, z: front - 6 })), { shadow: false });
  const plat = sign('Platforms 1 – 3  ↑', { w: 6, h: 0.8, bg: '#ffd329', fg: '#111' });
  plat.position.set(S.x, 4, hallBack + 0.05); g.add(plat);
  const inner = roundel(2.4, { text: 'HAMMERSMITH', lines: ['#f3a9bb', '#ffd300'] }); inner.position.set(S.x - 9, 3.4, hallBack + 0.05); g.add(inner);
  // S-stock nose glimpsed beyond the gates
  box(g, 2.8, 2.9, 0.3, mats.red, S.x + 9, 1.7, hallBack + 0.2); box(g, 2.3, 1.1, 0.34, mats.dark, S.x + 9, 2.3, hallBack + 0.2);
  // gates across the hall + fences out to the side walls
  const gateZ = front - 7;
  ctx.gateLines.hc = createGateLine(ctx, { x: S.x, z: gateZ, rot: Math.PI, count: 6 });
  for (const sx of [-1, 1]) {
    const w = S.w / 2 - 4.05 - 0.6, cx = S.x + sx * (4.05 + w / 2);
    box(g, w, 1.1, 0.12, mats.steel, cx, 0.55, gateZ);
    col.rect(cx, gateZ, w, 0.12, { h: 1.1, pad: 0.1 });
  }
}

/* Eventim Apollo: white Art Deco hall with a curved front, facing the flyover. */
function apollo(ctx, g) {
  const { col, mats } = ctx, A = APOLLO;
  const a = new THREE.Group(); a.position.set(A.x, 0, A.z); a.rotation.y = A.rot; g.add(a);
  box(a, A.w, A.h, A.d, mats.white, 0, A.h / 2, 0);
  const R = 45, half = 35 * DEG, cz = -A.d / 2 + R * Math.cos(half);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(R, R, A.h - 2, 40, 1, false, Math.PI - half, half * 2), mats.white);
  front.position.set(0, (A.h - 2) / 2, cz); front.castShadow = true; a.add(front);
  const fins = [];
  for (let i = -4; i <= 4; i++) {
    const t = i * 6.5 * DEG;
    fins.push({ x: -Math.sin(t) * (R + 0.05), y: 10, z: cz - Math.cos(t) * (R + 0.05), ry: t });
  }
  inst(a, new THREE.BoxGeometry(2.4, 9, 0.3), new THREE.MeshStandardMaterial({ color: 0x1b2433, roughness: 0.2, emissive: 0xffd08a, emissiveIntensity: 0.35 }), fins, { shadow: false });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(R + 3, R + 3, 0.6, 40, 1, false, Math.PI - half * 0.8, half * 1.6), mats.dark);
  canopy.position.set(0, 4.6, cz); a.add(canopy);
  const marquee = sign('EVENTIM APOLLO', { w: 26, h: 2.2, bg: '#111318', fg: '#ff4338' });
  marquee.position.set(0, 16.6, cz - R - 0.4); marquee.rotation.y = Math.PI; a.add(marquee);
  col.rect(A.x, A.z, A.w, A.d, { rot: A.rot, h: A.h, pad: 0.3 });
  const bz = -A.d / 2 - 4;
  col.rect(A.x + bz * Math.sin(A.rot), A.z + bz * Math.cos(A.rot), 44, 8.5, { rot: A.rot, h: A.h });
}
