/**
 * Hammersmith cat diorama. Framework-free entry point:
 *
 *   const world = createHammersmith(containerEl, { portfolioUrl: '/' });
 *   world.dispose();   // on unmount
 *
 * Only depends on `three`, so the src/ folder can be dropped into a bundler
 * project (CRA, Vite) unchanged, or served statically via index.html.
 */
import * as THREE from 'three';
import { createCollision, STEP } from './collision.js';
import { createCat } from './cat.js';
import { createUI } from './ui.js';
import { makeMaterials } from './util.js';
import { createPost } from './render/post.js';
import { createFloorReflection, cullForMirror, NO_MIRROR } from './render/reflect.js';
import { createZoneLighting } from './render/zones.js';
import { initialQuality, qualityTier, saveQuality, QUALITY_ORDER } from './render/quality.js';
import { createSky, bakeInterior } from './render/sky.js';
import { createDaylight } from './render/daylight.js';
import { buildSurroundings } from './world/surroundings.js';
import { buildBroadway } from './world/broadway.js';
import { createShoppers } from './world/shoppers.js';
import { createBodies } from './world/bodies.js';
import { createCleaners } from './world/cleaners.js';
import { createPedestrians } from './world/pedestrians.js';
import { createGame } from './game/game.js';
import { createMischief } from './game/mischief.js';
import { createParkour } from './game/parkour.js';
import { createPigeons } from './game/pigeons.js';
import { createStray } from './game/stray.js';
import { createQuests } from './game/quests.js';
import { createEvents, createEventCrew } from './game/events.js';
import { createEngines } from './audio/engines.js';
import { createDeckOps } from './world/deckops.js';
import { createRide } from './game/ride.js';
import { createContactShadows } from './render/contact.js';
import { SIM } from './world/sim.js';
import { batchStatic } from './render/batch.js';
import { isIndoors, MAIN_DOOR, ENV_BOX, CEIL } from './world/plan2024.js';
import { LANDMARKS, GATE_CARDS, HC_STATION, ABERCORN } from './mapData.js';

// real-cat pace: walk 1.6 m/s, trot 4.2 m/s; a 6 m/s hop clears benches and barriers (~0.8 m)
const WALK = 1.6, TROT = 4.2, BACK = 0.9, TURN = 2.6, JUMP = 6, GRAVITY = 22, R = 0.16;
const HOME = ABERCORN.lobby;
const SPAWN = { x: HOME.x0 + 2.4, y: 0.18, z: ABERCORN.doorZ, heading: -Math.PI / 2 };   // home: the reception of Abercorn House, looking out of the front doors at Bute Gardens

export function createHammersmith(container, opts = {}) {
  const { portfolioUrl = '/', portfolioLabel = 'Back to portfolio' } = opts;

  const root = document.createElement('div');
  root.className = 'hs-root';
  container.appendChild(root);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
  let qName = initialQuality(), Q = qualityTier(qName);     // ?quality=low|medium|high, or press Q
  let DPR = Math.min(window.devicePixelRatio, Q.dpr);       // the HDR target is 4x MSAA, so 1.5x is plenty
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;              // re-rendered every second frame (see frame()): half the shadow cost, no visible lag
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.transmissionResolutionScale = 0.5;          // glass refracts a half-res copy of the scene: plenty, and cheap
  root.appendChild(renderer.domElement);
  const post = createPost(renderer, { samples: Q.samples });
  post.ao = Q.ao;
  const refl = createFloorReflection(renderer);         // the mirror image the polished concourse floor shows
  let postOn = true;

  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;                // world matrices are refreshed once a frame in frame(), not once per render pass
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900);
  camera.layers.enable(NO_MIRROR);                    // the main view draws everything; the floor's mirror pass skips this layer

  // where the shadow-casting light is: render/daylight.js moves this through the day (sun) and night (moon)
  const SUN_DIR = new THREE.Vector3(-70, 95, 55).normalize();
  const sky = createSky(renderer, SUN_DIR);
  scene.add(sky.mesh);
  const envIn = bakeInterior(renderer);                // image-based light inside: warm ceiling panels. Outside it is the sky, baked by daylight.js
  // The sky probe is the scene's environment for good. Interior surfaces blend to the interior probe per pixel, by
  // where they are (render/zones.js), so nothing about the light depends on which zone the cat is standing in.
  scene.environmentIntensity = 0.7;
  const zones = createZoneLighting({ envIn });
  post.uniforms.bright.threshold.value = 1.2;             // one bloom threshold everywhere: lamps and lit signs glow, sunlit paving does not
  let adapt = 0;                                          // the camera's exposure adaptation: 0 = metering daylight, 1 = metering the mall
  scene.fog = new THREE.FogExp2(0x9fb2c4, 0.0016);        // aerial perspective: distant blocks go blue-grey (interior surfaces are exempt)

  // one shadow-casting sun; the ambient fill (probe + hemisphere) is per pixel, in zones.js
  const sun = new THREE.DirectionalLight(0xfff1dc, 4.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Q.shadow, Q.shadow);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -40;
  sun.shadow.camera.right = sun.shadow.camera.top = 40;      // tight frustum round the cat keeps 2048 texels sharp (~4 cm)
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2;
  sun.userData.dynamic = true; sun.target.userData.dynamic = true;   // follows the cat: never frozen or batched
  scene.add(sun, sun.target);

  const col = createCollision();
  const ctx = { scene, col, mats: makeMaterials(), updaters: [], gateLines: {}, floorRefl: refl, quality: Q, zones, daylit: [], streetLamps: [], streetLampMat: null, napSpots: [] };
  buildSurroundings(ctx);
  const hub = buildBroadway(ctx);
  col.index();                                        // bucket the static collision surfaces (lifts' moving floors stay live)
  const shoppers = createShoppers(ctx, scene, { count: 22 });   // the live mall: shoppers, diners, laptop workers, commuters
  // contact shadows: tables (from the seat registry), benches, planters, parked cars; then people, updated every frame
  const contact = createContactShadows(scene);
  { const done = new Set(); for (const s of SIM.seats) { const k = s.tx.toFixed(1) + ',' + s.tz.toFixed(1); if (!done.has(k)) { done.add(k); contact.add(s.tx, s.tz, 0.75); } } }
  for (const [x, z, rx, rz, ry] of SIM.contacts) contact.add(x, z, rx, rz, ry);
  contact.flush();
  const street = createPedestrians(ctx, scene, { count: 30 });   // people on the pavements: walking, waiting at the lights, at the bus stop
  const deck = createDeckOps(ctx, scene, { tone: (...a) => tone(...a) });   // the bus station working: buses on their stands, passengers queuing and boarding
  const eventCrew = createEventCrew(scene);            // the busker, the florist, whoever loses a balloon (src/game/events.js)
  const people = [...hub.staff.crew, ...shoppers.crowd.crew, ...street.crew, ...street.sweeper.crew, ...(deck ? deck.crew : []), ...eventCrew.crew.crew];
  const feet = contact.dynamic(people.length);
  // real bodies for the staff and the shoppers: skinned, motion-captured, loaded after the first frame
  const bodies = createBodies(ctx, scene, { contact });
  bodies.adopt(hub.staff.crew, { pool: 'staff', pace: 1.05 });
  bodies.adopt(shoppers.crowd.crew, { pool: 'shopper', pace: 1.25 });
  const cleaners = createCleaners(ctx, scene);                 // two cleaners in hi-vis, mopping near the wet-floor signs
  bodies.adopt(cleaners.crew, { pool: 'cleaner', pace: 0.9 });
  bodies.adopt(street.crew, { pool: 'shopper', pace: 1.4, offset: 9, range: 70 });
  bodies.adopt(street.sweeper.crew, { pool: 'cleaner', pace: 0.9, offset: 1, range: 70 });
  bodies.adopt(eventCrew.crew.crew, { pool: 'shopper', pace: 1.1, offset: 14, range: 70 });
  if (deck) bodies.adopt(deck.crew, { pool: 'shopper', pace: 1.3, offset: 5, range: 55, deck: true });
  bodies.start();
  const batched = batchStatic(scene);                       // merge everything static: thousands of meshes -> a few hundred draws
  zones.applyTo(scene);                               // every lit material: light by the surface's position
  // time of day and weather: sun, sky, the sky probe, haze, rain, wet ground, street lamps, lens flare
  const daylight = createDaylight({ renderer, scene, sky, sun, lightDir: SUN_DIR, zones, post, col, lamps: ctx.streetLamps, lampMat: ctx.streetLampMat, daylit: ctx.daylit, dryBox: HOME });
  const mirrored = cullForMirror(scene, ENV_BOX, CEIL + 0.3); refl.setCandidates(mirrored.list, mirrored.movers); refl.detail = Q.mirrorDetail;   // what the floor reflects: the mall interior, not the city or the stock on the shelves
  ctx.gateLines.broadway = hub.gates;
  const gateList = [['broadway', ctx.gateLines.broadway], ['hc', ctx.gateLines.hc]];

  const cat = createCat();
  cat.root.userData.dynamic = true;
  scene.add(cat.root);
  zones.applyTo(cat.root);
  const pos = cat.root.position;
  pos.set(SPAWN.x, SPAWN.y, SPAWN.z);
  ctx.catPos = pos;                                   // read by traffic so cars brake for the cat

  const ui = createUI(root, { portfolioUrl, portfolioLabel });

  /* ---------- input ---------- */
  const keys = { fwd: 0, back: 0, left: 0, right: 0, sprint: 0 };
  let jumpQueued = false, useQueued = false, dragging = false, lastX = 0, lastY = 0;
  const MAP = { w: 'fwd', arrowup: 'fwd', s: 'back', arrowdown: 'back', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', shift: 'sprint' };
  function onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase(), down = e.type === 'keydown';
    if (down && !audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { /* no sound */ } }   // sound needs a key press first
    if (MAP[k]) { keys[MAP[k]] = down ? 1 : 0; e.preventDefault(); }
    else if (k === ' ') { if (down && !e.repeat) jumpQueued = true; e.preventDefault(); }
    else if (k === 'e') { if (down && !e.repeat) useQueued = true; }
    else if (k === 'escape' && down) ui.hideCard();
    else if (k === 'p' && down && !e.repeat) postOn = !postOn;          // toggle post-processing (AO, bloom, grade)
    else if (k === 't' && down && !e.repeat) { daylight.skip(1); ui.meow(`${String(Math.floor(daylight.hour)).padStart(2, '0')}:00`); }   // an hour later
    else if (k === 'y' && down && !e.repeat) ui.meow(daylight.nextWeather());
    else if (k === 'm' && down && !e.repeat) game.toggleMap();
    else if (k === 'j' && down && !e.repeat) quests.toggle();
    else if (k === 'q' && down && !e.repeat) setQuality(QUALITY_ORDER[(QUALITY_ORDER.indexOf(qName) + 1) % QUALITY_ORDER.length]);
  }
  function onBlur() { keys.fwd = keys.back = keys.left = keys.right = keys.sprint = 0; dragging = false; }
  const canvas = renderer.domElement;
  function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); }
  function onMove(e) {
    if (!dragging) return;
    orbitYaw -= (e.clientX - lastX) * 0.006;
    orbitPitch = Math.min(1.2, Math.max(0.02, orbitPitch + (e.clientY - lastY) * 0.005));
    lastX = e.clientX; lastY = e.clientY;
  }
  function onUp() { dragging = false; }
  function onWheel(e) { zoom = Math.min(1.8, Math.max(0.55, zoom * (e.deltaY > 0 ? 1.08 : 0.93))); e.preventDefault(); }
  function resize() {
    const w = root.clientWidth || 1, h = root.clientHeight || 1;
    renderer.setSize(w, h, false);
    post.setSize(w * DPR, h * DPR);
    refl.setSize(w * DPR, h * DPR, Q.reflect);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  /** Switch quality tier live (resolution, MSAA, AO, reflections, shadow size). */
  function setQuality(name) {
    qName = name; Q = qualityTier(name); saveQuality(name);
    DPR = Math.min(window.devicePixelRatio, Q.dpr); renderer.setPixelRatio(DPR);
    post.setSamples(Q.samples); post.ao = Q.ao;
    if (sun.shadow.mapSize.x !== Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true; }   // redraw it in the very next frame: nothing may sample a missing shadow map
    refl.detail = Q.mirrorDetail;
    resize(); ui.meow(`Quality: ${name}`);
  }
  const ro = new ResizeObserver(resize); ro.observe(root); resize();

  /* ---------- audio (created on first key press) ---------- */
  let audio = null;
  function tone(f0, f1, dur, type = 'sine', gain = 0.08) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), v = audio.createGain(), t = audio.currentTime;
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      v.gain.setValueAtTime(gain, t); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(v).connect(audio.destination); o.start(t); o.stop(t + dur);
    } catch (err) { /* audio is optional */ }
  }
  /** a burst of filtered noise: wings (beats = flaps a second), a hiss (beats 0) */
  function noise(dur, gain = 0.05, freq = 1500, beats = 0) {
    if (!audio) return;
    try {
      const n = Math.floor(audio.sampleRate * dur), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { const s = i / audio.sampleRate, env = beats ? Math.max(0, Math.sin(s * beats * Math.PI)) ** 2 : Math.min(1, s * 20); d[i] = (Math.random() * 2 - 1) * env * (1 - i / n); }
      const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
      src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7; g.gain.value = gain;
      src.connect(f).connect(g).connect(audio.destination); src.start();
    } catch (err) { /* audio is optional */ }
  }

  /* ---------- state (all pre-allocated; the loop below allocates nothing) ---------- */
  let heading = SPAWN.heading, speed = 0, vy = 0, grounded = true;
  let orbitYaw = 0, orbitPitch = 0.28, zoom = 1, camDist = 4.5, arm = 4.5, fov = 60;
  const camPos = new THREE.Vector3(SPAWN.x - 2.4 * Math.sin(SPAWN.heading), SPAWN.y + 1.2, SPAWN.z - 2.4 * Math.cos(SPAWN.heading)), camTarget = new THREE.Vector3(SPAWN.x, SPAWN.y + 0.6, SPAWN.z);
  const wantPos = new THREE.Vector3(), wantTarget = new THREE.Vector3();
  const HALL_Z = HC_STATION.z + HC_STATION.d / 2;
  let frameNo = 0;
  let raf = 0, last = performance.now(), elapsed = 0, nearId = null, nearCard = null;
  let engines = null; const _look = new THREE.Vector3();
  // riding a bus: the cat follows the bus's matrix, the camera rides inside (src/game/ride.js)
  const ride = createRide({ ctx, ui, tone: (...a) => tone(...a), api: { pos, get heading() { return heading; }, set heading(h) { heading = h; }, place(x, y, z, h) { pos.set(x, y, z); heading = h; vy = 0; grounded = true; speed = 0; camPos.set(x - 3 * Math.sin(h), y + 1.5, z - 3 * Math.cos(h)); camTarget.copy(pos); } } });
  let boardBus = null;         // bus engine sound, once there is an AudioContext

  // playing as the cat: interactions, needs, postcards, saving, the minimap (src/game)
  const game = createGame({ ctx, scene, ui, cat, daylight, tone, people: [['s', shoppers.shoppers], ['p', street.people]],
    api: {
      pos, get heading() { return heading; }, set heading(h) { heading = h; }, get speed() { return speed; },
      place(x, y, z, h) { pos.set(x, y, z); heading = h; vy = 0; grounded = true; speed = 0; },
      push(v) { speed = v; },
    } });
  // mischief: a sausage roll from Greggs, packets off a Tesco shelf, begging for chips (src/game/mischief.js)
  const mischief = createMischief({ ctx, scene, ui, cat, game, tone, staff: hub.staff.crew, diners: shoppers.shoppers,
    api: { pos, get heading() { return heading; }, set heading(h) { heading = h; }, push(v) { speed = v; } } });
  // parkour: Space leaps onto ledges, across gaps and up on top of canopies; high spots to find (src/game/parkour.js)
  const parkour = createParkour({ ctx, scene, cat, ui, tone, game,
    api: { pos, get heading() { return heading; }, set heading(h) { heading = h; }, get speed() { return speed; }, set speed(v) { speed = v; }, land() { vy = 0; grounded = true; } } });
  // pigeons on the open pavements, and the tuxedo stray who runs Bute Gardens (src/game/pigeons.js, stray.js)
  const pigeons = createPigeons({ ctx, scene, tone: (...a) => tone(...a), noise: (...a) => noise(...a), walkers: () => street.crew, onFlush: (f, byCat) => { if (byCat) game.emit('flush', f.i); } });
  const stray = createStray({ ctx, scene, ui, game, pigeons, mischief, tone: (...a) => tone(...a), noise: (...a) => noise(...a),
    api: { pos, get heading() { return heading; }, set heading(h) { heading = h; }, get speed() { return speed; }, push(v) { speed = v; }, get riding() { return ride.active; }, get napping() { return game.napping; } } });
  // quests and the day's events (src/game/quests.js, events.js)
  const quests = createQuests({ root, ui, game, parkour, daylight, tone: (...a) => tone(...a) });
  const events = createEvents({ ctx, scene, ui, game, daylight, cat, eventCrew, tone: (...a) => tone(...a), noise: (...a) => noise(...a),
    api: { pos, get heading() { return heading; }, set heading(h) { heading = h; }, push(v) { speed = v; } } });
  let stalking = false, pigeonD = Infinity;
  const threatCat = { x: 0, y: 0, z: 0, r: 2, cat: true }, threatStray = { x: 0, y: 0, z: 0, r: 2 }, threats = [threatCat, threatStray];

  /** 0 street, 1 concourse, 2 bus deck (phase 4), 3 platforms, 4 H&C ticket hall */
  function zone() {
    if (pos.y < -0.6) return 3;
    if (pos.y > 4) return 2;                          // up on the bus station deck
    if (isIndoors(pos.x, pos.z)) return 1;
    if (Math.abs(pos.x - HC_STATION.x) < HC_STATION.w / 2 && pos.z < HALL_Z && pos.z > HALL_Z - 14) return 4;
    if (pos.x > HOME.x0 && pos.x < HOME.x1 && pos.z > HOME.z0 && pos.z < HOME.z1) return 5;
    return 0;
  }
  const ZONE_NAME = ['Street level · Hammersmith W6', 'Level 0 · Broadway concourse', 'Level 1 · Bus station', 'Platforms · District & Piccadilly', 'Hammersmith · Circle and H&C', 'Home · Abercorn House, Bute Gardens'];

  function moveCat(dt) {
    if (ride.active) { speed = 0; vy = 0; grounded = true; jumpQueued = false; cat.root.rotation.y = heading; parkour.hide(); return; }   // sitting on the bus
    if (game.busy) {                                  // eating or asleep: any movement key ends it
      if (keys.fwd || keys.back || keys.left || keys.right || jumpQueued) game.wake();
      else { speed = 0; jumpQueued = false; cat.root.rotation.y = heading; return; }
    }
    if (parkour.update(dt)) { jumpQueued = false; cat.root.rotation.y = heading; return; }   // mid-leap
    heading += (keys.left - keys.right) * TURN * dt;
    const want = keys.fwd ? (keys.sprint && game.canTrot ? TROT : stalking ? 0.8 : WALK) : keys.back ? -BACK : 0;   // creeping up on pigeons is slow
    speed += (want - speed) * Math.min(1, dt * 9);
    if (Math.abs(speed) < 0.01) speed = 0;
    const step = grounded ? STEP : 0.05;
    const dx = Math.sin(heading) * speed * dt, dz = Math.cos(heading) * speed * dt;
    // round body (radius R) that slides along walls instead of stopping dead at them
    const free = (x, z) => !col.blocked(x, z, pos.y, step) && !col.blocked(x + R, z, pos.y, step) && !col.blocked(x - R, z, pos.y, step) && !col.blocked(x, z + R, pos.y, step) && !col.blocked(x, z - R, pos.y, step);
    if (free(pos.x + dx, pos.z + dz)) { pos.x += dx; pos.z += dz; }
    else if (free(pos.x + dx, pos.z)) pos.x += dx;
    else if (free(pos.x, pos.z + dz)) pos.z += dz;
    else if (Math.abs(speed) > 0.8) speed = Math.sign(speed) * 0.8;

    const ground = col.groundAt(pos.x, pos.z, pos.y, step);
    if (grounded) {
      if (jumpQueued) {                                // a leap to what the cat is facing, a pounce at a pigeon, or a plain hop
        const pp = parkour.tryLeap() ? null : pigeons.pounce(pos, heading);
        if (pp && parkour.leapTo(pp[0], pp[1], pp[2])) setTimeout(() => ui.say(['So close!', 'Missed! Pigeons are quicker than they look.', 'Not this time.'][Math.floor(Math.random() * 3)]), 650);
        else if (!pp && !parkour.active) { vy = JUMP; grounded = false; }
      }
      else if (ground < pos.y - 0.45) { vy = 0; grounded = false; }
      else { const d = ground - pos.y; pos.y = Math.abs(d) < 0.3 ? ground : pos.y + d * Math.min(1, dt * 25); }   // steps snap, bigger drops ease
    } else {
      vy -= GRAVITY * dt;
      pos.y += vy * dt;
      if (vy <= 0 && pos.y <= ground) { pos.y = ground; vy = 0; grounded = true; }
      if (pos.y < -30) { pos.set(SPAWN.x, SPAWN.y, SPAWN.z); vy = 0; grounded = true; }   // safety net
    }
    jumpQueued = false;
    cat.root.rotation.y = heading;
    parkour.look(dt, grounded && !game.busy);
  }

  function interactions(dt) {
    if (ride.active) { ui.setPrompt(ride.prompt); if (useQueued) { useQueued = false; if (ride.use()) game.emit('ride'); } return; }
    hub.lift.update(dt, pos);
    for (let i = 0; i < gateList.length; i++) gateList[i][1].update(dt);

    // what would [E] do here? lift > ticket gates > landmark card > plain meow
    let prompt = hub.lift.prompt(pos), gate = null;
    nearId = null; nearCard = null;
    if (!prompt) {
      for (let i = 0; i < gateList.length; i++) if (gateList[i][1].near(pos.x, pos.y, pos.z)) gate = gateList[i];
      if (gate) { if (!gate[1].isOpen()) prompt = 'Touch in with Oyster &nbsp;·&nbsp; <b>Space</b> hop the barrier'; }
      else if (deck && (boardBus = deck.boardable(pos))) prompt = `Hop on the ${boardBus.line.n} to ${boardBus.line.dest}`;
      else if ((prompt = game.nearest())) { /* a thing to do here: food, a nap, a person */ }
      else {
        const r = Math.hypot(pos.x, pos.z);
        for (let i = 0; i < LANDMARKS.length; i++) {
          const l = LANDMARKS[i];
          if (Math.abs(pos.y - l.y) > 1.5) continue;
          const hit = l.ring ? r > l.ring[0] && r < l.ring[1] : Math.hypot(pos.x - l.x, pos.z - l.z) < l.r;
          if (hit) { nearId = l.id; nearCard = l; break; }
        }
        if (nearCard && ui.cardId !== nearId) prompt = `Inspect ${nearCard.sub.split(' · ')[0]}`;
      }
    }
    if (!prompt && parkour.hint) prompt = parkour.hint;
    ui.setPrompt(prompt || '');
    if (ui.cardId && ui.cardId !== nearId && ui.cardId !== game.card && !(gate && ui.cardId === gate[0])) ui.hideCard();

    if (useQueued) {
      useQueued = false;
      if (hub.lift.interact(pos)) tone(660, 880, 0.18);
      else if (!gate && boardBus) { deck.board(boardBus); ride.start(boardBus); boardBus = null; }
      else if (!gate && game.use()) { /* handled by the game */ }
      else if (gate) {
        gate[1].trigger(); tone(1480, 1480, 0.12, 'square', 0.05);
        ui.meow('Beep!'); ui.showCard(gate[0], GATE_CARDS[gate[0]]);
      } else {
        cat.meow(); tone(720, 420, 0.32, 'triangle'); ui.meow(); shoppers.meow(pos.x, pos.z); street.meow(pos.x, pos.z);
        if (nearCard) { ui.showCard(nearId, nearCard); game.postcard(nearId); }
      }
    }
  }

  function followCamera(dt) {
    const z = zone(), indoor = z !== 0 && z !== 2;
    ui.setLevel(ZONE_NAME[z]);
    // Exposure only: the camera meters where it is, and drifts to the new level over a second or two, like a phone
    // carried through a door. It never changes how any surface is lit.
    adapt += (zones.indoorAt(camPos.x, camPos.y, camPos.z) - adapt) * (1 - Math.exp(-dt / 1.1));
    renderer.toneMappingExposure = (1.0 + 0.1 * adapt) * daylight.exposure(adapt);   // and opens up for the dark outdoors at night
    camDist += ((indoor ? 2.6 : 4.5) * zoom - camDist) * Math.min(1, dt * 3);   // cat's-eye: close and low
    const wantFov = indoor ? 56 : 60;
    if (Math.abs(fov - wantFov) > 0.05) { fov += (wantFov - fov) * Math.min(1, dt * 3); camera.fov = fov; camera.updateProjectionMatrix(); }
    if (!dragging && Math.abs(speed) > 0.5) orbitYaw *= Math.exp(-dt * 2.5);     // drift back behind the cat

    const pitch = indoor ? Math.min(orbitPitch, 0.42) : orbitPitch, yaw = heading + orbitYaw;
    const flat = Math.cos(pitch) * camDist;
    wantTarget.set(pos.x, pos.y + 0.42, pos.z);
    wantPos.set(pos.x - Math.sin(yaw) * flat, pos.y + 0.42 + Math.sin(pitch) * camDist, pos.z - Math.cos(yaw) * flat);
    // keep the lens inside whichever volume the cat is in
    if (z === 1) wantPos.y = Math.min(wantPos.y, 5.6);
    else if (z === 3 && pos.y < -2.2) wantPos.y = Math.min(wantPos.y, -0.5);
    else if (z === 4) wantPos.y = Math.min(wantPos.y, 9);
    else if (z === 5) wantPos.y = Math.min(wantPos.y, 3.1);
    if (pos.y > -0.3) wantPos.y = Math.max(wantPos.y, 0.3);
    // spring arm: find the first wall along the arm (10 cm steps), then pull in fast and ease back out slowly,
    // so the arm length is continuous and never snaps from frame to frame
    {
      const ax = wantPos.x - wantTarget.x, ay = wantPos.y - wantTarget.y, az = wantPos.z - wantTarget.z, len = Math.hypot(ax, ay, az);
      let hit = len;
      for (let d = 0.3; d < len; d += 0.1) {
        const k = d / len;
        if (col.blocked(wantTarget.x + ax * k, wantTarget.z + az * k, wantTarget.y + ay * k - 0.2, 0.05)) { hit = Math.max(0.45, d - 0.3); break; }
      }
      arm += (hit - arm) * Math.min(1, dt * (hit < arm ? 16 : 2.5));
      const k = Math.min(arm, len) / len;
      wantPos.set(wantTarget.x + ax * k, wantTarget.y + ay * k, wantTarget.z + az * k);
    }

    camTarget.lerp(wantTarget, 1 - Math.exp(-dt * 14));
    camPos.lerp(wantPos, 1 - Math.exp(-dt * 12));
    if (ride.active) { ride.camera(camPos, camTarget); ui.setLevel(ride.level); }     // inside the bus, fixed to it
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // texel-snapped shadow camera that follows the cat (no shimmering as it moves)
    const snap = 80 / sun.shadow.mapSize.x;
    sun.target.position.set(Math.round(camTarget.x / snap) * snap, camTarget.y, Math.round(camTarget.z / snap) * snap);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 140);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));   // never negative: a frame's timestamp can be older than the clock read after bench()
    last = now;
    step(dt);
  }
  /** One whole frame: simulate, then draw. */
  function step(dt) {
    elapsed += dt;
    moveCat(dt);
    interactions(dt);
    cat.animate(dt, elapsed, speed, !grounded);
    for (let i = 0; i < ctx.updaters.length; i++) ctx.updaters[i](dt, elapsed);
    shoppers.update(dt, elapsed, pos);
    cleaners.update(dt, elapsed, pos);
    street.update(dt, elapsed, pos, daylight);
    if (deck) deck.update(dt, elapsed);
    ride.update();
    for (let i = 0; i < people.length; i++) { const q = people[i], r = q.root.position; feet.set(i, r.x, q.body ? -50 : r.y, r.z, q.body ? 0 : 0.42); }   // the mannequins' disc, until a real body takes over
    feet.commit();
    followCamera(dt);
    bodies.update(dt, camera);
    sky.update(camera, elapsed);
    daylight.update(dt, elapsed, camera); ui.setClock(daylight.label);
    game.update(dt);
    mischief.update(dt);
    stray.update(dt, elapsed);
    events.update(dt, elapsed);
    quests.update(dt);
    const sp = stray.pos;
    threatCat.x = pos.x; threatCat.y = pos.y; threatCat.z = pos.z; threatCat.r = ride.active ? 0 : Math.abs(speed) > 2.6 ? 6 : stalking ? 1.0 : Math.abs(speed) > 0.3 ? 2.4 : 1.4;
    threatStray.x = sp.x; threatStray.y = sp.y; threatStray.z = sp.z; threatStray.r = stray.hunting ? 0.9 : 2.0;
    pigeonD = pigeons.update(dt, threats, pos);
    const stalkNow = pigeonD < 6 && grounded && !game.busy && !keys.sprint && !ride.active && !parkour.active;   // near pigeons the cat crouches and creeps
    if (stalkNow !== stalking) { stalking = stalkNow; if (!game.busy) cat.setPose(stalking ? 'stalk' : null); }
    if (audio && !engines && audio.state === 'running') engines = createEngines(audio);
    if (engines) { camera.getWorldDirection(_look); engines.update(ctx.traffic.cars, camera.position, Math.atan2(_look.x, _look.z)); }
    if ((frameNo++ & 1) === 0) renderer.shadowMap.needsUpdate = true;
    scene.updateMatrixWorld();                          // once, for the mirror pass, the shadow pass and the main pass
    // mirror pass for the floor, only while the mall floor can be in view
    const nearMall = pos.y > -1 && pos.y < 5.5 && camPos.x > ENV_BOX.minX - 25 && camPos.x < ENV_BOX.maxX + 25 && camPos.z > ENV_BOX.minZ - 25 && camPos.z < ENV_BOX.maxZ + 25;
    refl.render(scene, camera, nearMall && sun.shadow.map !== null, dt, Q.mirrorEvery === 2 && (frameNo & 1) === 1);   // on 'medium' it takes turns with the shadow map
    if (postOn) post.render(scene, camera, elapsed); else { renderer.setRenderTarget(null); renderer.render(scene, camera); }
  }
  raf = requestAnimationFrame(frame);

  /**
   * Frame cost in milliseconds, measured without requestAnimationFrame: runs `frames` whole frames back to back,
   * then waits once for the GPU to finish them all. `avg` is the real work per frame (simulation + draw calls +
   * GPU), not the display's refresh interval, and is the same whether or not the tab is being throttled.
   * `cpu` is the script time per frame alone (median and 95th percentile).
   */
  function bench(frames = 120) {
    const gl = renderer.getContext(), px = new Uint8Array(4), t = [];
    cancelAnimationFrame(raf);
    for (let i = 0; i < 20; i++) step(1 / 60);                                   // warm up: programs, textures, shadow map
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);                    // blocks until everything queued is drawn
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) { const a = performance.now(); step(1 / 60); t.push(performance.now() - a); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const total = performance.now() - t0;
    last = performance.now(); raf = requestAnimationFrame(frame);
    t.sort((a, b) => a - b);
    return { avg: +(total / frames).toFixed(2), cpu: +t[t.length >> 1].toFixed(2), cpu95: +t[Math.floor(t.length * 0.95)].toFixed(2), width: renderer.domElement.width, height: renderer.domElement.height, quality: qName };
  }

  return {
    scene, camera, renderer, post, refl, zones, mirrored, sky, daylight, traffic: ctx.traffic, street, deck, game, mischief, parkour, pigeons, stray, quests, events, ctx, get audio() { return audio; }, get engines() { return engines; }, setQuality, bench, get quality() { return qName; }, shoppers, bodies, batched, cat: cat.root, lift: hub.lift, col,   // col: collision set, handy for debugging from the console
    /** Teleport, e.g. for deep links from the portfolio: world.warp(x, y, z, heading). */
    warp(x, y, z, h = heading) { pos.set(x, y, z); heading = h; vy = 0; grounded = false; camPos.set(x - 8 * Math.sin(h), y + 4, z - 8 * Math.cos(h)); camTarget.copy(pos); },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('blur', onBlur);
      ro.disconnect(); game.dispose(); ui.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      });
      post.dispose(); refl.dispose(); zones.dispose(); daylight.dispose(); envIn.dispose(); renderer.dispose(); if (engines) engines.dispose(); if (audio) audio.close();
      root.remove();
    },
  };
}
