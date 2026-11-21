/**
 * Time of day and weather: one controller that keeps every outdoor light source in step.
 *
 *   - the sun's position for London (51.5 N, a late-summer day: up at about 6, down at about 8) and its colour as it
 *     drops; after dusk the same shadow-casting light becomes the moon
 *   - the sky dome (render/sky.js): sun, cloud cover, the overcast lid, stars
 *   - the sky probe that lights and is reflected by everything outdoors, re-baked as the sky changes
 *   - the outdoor ambient fill and the haze (zones.js uniforms, scene.fog)
 *   - cloud shadow: the sun dims when the cloud drifting across the dome covers it ("sunny spells")
 *   - weather: clear, sunny spells, overcast, drizzle. Drizzle brings rain streaks (never under a roof) and wet,
 *     reflective ground; it dries out slowly afterwards
 *   - street lamps and their pools of light on the ground, and lit windows, after dusk
 *   - the lens flare in the final composite, hidden when a building or a cloud is in front of the sun
 *
 * None of it touches the interior light (zones.js blends per pixel by place), so walking through a door changes
 * nothing, at any hour.
 */
import * as THREE from 'three';
import { NO_MIRROR } from './reflect.js';
import { canvasTex } from '../util.js';

const LAT = 51.49 * Math.PI / 180, DECL = 12 * Math.PI / 180, NOON = 13;     // British Summer Time: the sun is due south at about one o'clock
export const WEATHER = {
  //          cloud threshold (lower = more), grey lid, direct sun kept, haze, rain, cloud speed, turbidity
  clear:    { cover: 0.66, overcast: 0.0,  sun: 1.0,  fog: 1.0, rain: 0, wind: 0.6, turb: 2.6, label: 'Clear' },
  spells:   { cover: 0.50, overcast: 0.0,  sun: 1.0,  fog: 1.0, rain: 0, wind: 1.0, turb: 3.2, label: 'Sunny spells' },
  overcast: { cover: 0.34, overcast: 0.85, sun: 0.10, fog: 1.6, rain: 0, wind: 1.2, turb: 6.0, label: 'Overcast' },
  drizzle:  { cover: 0.30, overcast: 1.0,  sun: 0.04, fog: 2.8, rain: 1, wind: 1.6, turb: 8.0, label: 'Drizzle' },
};
const KEY_ORDER = ['spells', 'clear', 'overcast', 'drizzle'];                 // the Y key steps through these
const AUTO = ['spells', 'clear', 'spells', 'overcast', 'drizzle', 'overcast'];   // left alone, the weather drifts through these

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Where the sun is at `hour` (0-24), as a unit vector in world space (+X east, +Y up, +Z south). */
export function sunAt(hour, out = new THREE.Vector3()) {
  const H = (hour - NOON) * Math.PI / 12, sl = Math.sin(LAT), cl = Math.cos(LAT), sd = Math.sin(DECL), cd = Math.cos(DECL);
  return out.set(-cd * Math.sin(H), sl * sd + cl * cd * Math.cos(H), -(cl * sd - sl * cd * Math.cos(H)));
}

// the sky shader's cloud field, evaluated on the CPU for one direction (32-bit rounding, as the GPU does it)
const fr = Math.fround, fract = (x) => x - Math.floor(x);
function hash(x, y) { let px = fract(fr(x * 123.34)), py = fract(fr(y * 456.21)); const d = fr(px * (px + 45.32) + py * (py + 45.32)); px = fr(px + d); py = fr(py + d); return fract(fr(px * py)); }
function noise(x, y) { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy); }
function fbm(x, y) { let s = 0, a = 0.5; for (let i = 0; i < 6; i++) { s += a * noise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; a *= 0.5; } return s; }

export function createDaylight({ renderer, scene, sky, sun, lightDir, zones, post, col, lamps = [], lampMat = null, daylit = [], dryBox = null }) {
  const q = new URLSearchParams(location.search);
  const num = (k, d) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : d; };
  let hour = ((num('time', 11) % 24) + 24) % 24;
  const minutesPerHour = num('cycle', 2);                      // real minutes per game hour; ?cycle=0 stops the clock
  let weather = WEATHER[q.get('weather')] ? q.get('weather') : 'spells', autoStep = 0, autoTimer = q.get('weather') ? Infinity : 240;
  const W = { ...WEATHER[weather] };                           // the blended, current values
  let wet = W.rain > 0.5 ? 1 : 0, occl = 0, flareVis = 0, frame = 0, label = '', sinceBake = 99, bakedHour = -99, bakedCover = -9, bakedOver = -9, envRT = null;

  const S = new THREE.Vector3(), M = sky.uniforms.moonDir.value, v = new THREE.Vector3(), fwd = new THREE.Vector3();
  const sunCol = new THREE.Color(), moonCol = new THREE.Color(0.56, 0.66, 1.0);
  const hemiS0 = zones.uniforms.uHemiOutS.value.clone(), hemiG0 = zones.uniforms.uHemiOutG.value.clone();
  const nightS = new THREE.Color(0.042, 0.048, 0.072), nightG = new THREE.Color(0.052, 0.043, 0.034);   // the glow of a lit city on everything outdoors
  const fogClear = new THREE.Color(0x9fb2c4), fogGrey = new THREE.Color(0xa6abb0), fogDusk = new THREE.Color(0xc59a84), fogNight = new THREE.Color(0.030, 0.030, 0.040), fogC = new THREE.Color();
  const density0 = scene.fog.density;
  const daylitBase = daylit.map((m) => m.color.clone());

  /* ---------- rain: short streaks in a box that travels with the camera ---------- */
  const N = 6000, seeds = new Float32Array(N * 3);
  for (let i = 0; i < N * 3; i++) seeds[i] = fract(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
  const rg = new THREE.InstancedBufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); rg.setIndex([0, 1, 2, 0, 2, 3]);
  rg.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3)); rg.instanceCount = N;
  const rainU = { uTime: { value: 0 }, uRain: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1.6, 0.7) }, uCol: { value: new THREE.Vector3(0.6, 0.64, 0.7) },
    tZone: zones.uniforms.tZone, uZoneRect: zones.uniforms.uZoneRect, uDry: { value: dryBox ? new THREE.Vector4(dryBox.x0, dryBox.z0, dryBox.x1, dryBox.z1) : new THREE.Vector4(1, 1, 0, 0) } };
  const rain = new THREE.Mesh(rg, new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 seed; uniform float uTime, uRain; uniform vec3 uCam; uniform vec2 uWind; uniform sampler2D tZone; uniform vec4 uZoneRect, uDry; varying float vA;
      void main() {
        const vec3 BOX = vec3(26.0, 16.0, 26.0);
        float fall = 7.5 + seed.y * 2.5;
        vec3 p = seed * BOX; p.y -= uTime * fall; p.xz += uWind * uTime;
        p = uCam + mod(p - uCam + BOX * 0.5, BOX) - BOX * 0.5;                       // wrap round the camera
        vec3 dir = normalize(vec3(uWind.x, -fall, uWind.y));
        vec3 side = normalize(cross(dir, normalize(p - cameraPosition)));
        float wide = max(0.012, length(p - cameraPosition) * 0.0016);                 // about a pixel wide at any distance
        vec3 w = p + dir * (position.y * (0.32 + seed.z * 0.3)) + side * (position.x * wide);
        float keep = step(fract(seed.x * 91.7 + seed.z * 13.3), uRain);
        vec4 zm = texture2D(tZone, (p.xz - uZoneRect.xy) * uZoneRect.zw);
        if (zm.g > 0.5 && p.y < zm.b * 16.0) keep = 0.0;                             // under the mall roof
        if (p.x > uDry.x && p.x < uDry.z && p.z > uDry.y && p.z < uDry.w) keep = 0.0;   // inside the hostel
        if (p.y < 0.0) keep = 0.0;
        vA = keep * (1.0 - position.y * 0.6);
        gl_Position = keep > 0.0 ? projectionMatrix * viewMatrix * vec4(w, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; varying float vA; void main() { gl_FragColor = vec4(uCol, 0.34 * vA); }`,
  }));
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 50; rain.userData.dynamic = true; rain.layers.set(NO_MIRROR); scene.add(rain);

  /* ---------- pools of lamp light on the ground: one additive decal per street lamp ---------- */
  let pools = null;
  if (lamps.length) {
    const tex = canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,205,140,1)'); g.addColorStop(0.35, 'rgba(255,190,120,0.45)'); g.addColorStop(1, 'rgba(255,180,110,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), lamps.length);
    const m4 = new THREE.Matrix4(); lamps.forEach(([x, z], i) => pools.setMatrixAt(i, m4.makeTranslation(x, 0.145, z)));
    pools.frustumCulled = false; pools.visible = false; pools.renderOrder = 2; pools.userData.dynamic = true; pools.layers.set(NO_MIRROR); scene.add(pools);
  }

  function rebake() {
    const rt = sky.bakeEnvironment();
    scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt; sinceBake = 0; bakedHour = hour; bakedCover = W.cover; bakedOver = W.overcast;
  }

  function setWeather(name, manual = true) { if (!WEATHER[name]) return; weather = name; if (manual) autoTimer = 300; }

  function update(dt, elapsed, camera) {
    // the clock; the dead of night passes three times as fast
    sunAt(hour, S);
    if (minutesPerHour > 0) { hour = (hour + dt / (minutesPerHour * 60) * (S.y < -0.12 ? 3 : 1)) % 24; sunAt(hour, S); }
    // the weather drifts towards its target, and changes by itself every few minutes unless one was asked for
    autoTimer -= dt; if (autoTimer <= 0) { autoStep = (autoStep + 1) % AUTO.length; weather = AUTO[autoStep]; autoTimer = 200 + ((autoStep * 97) % 120); }
    const T = WEATHER[weather], k = 1 - Math.exp(-dt / 6);
    for (const key of ['cover', 'overcast', 'sun', 'fog', 'rain', 'wind', 'turb']) W[key] += (T[key] - W[key]) * k;
    wet = Math.min(1, Math.max(0, wet + (W.rain > 0.3 ? dt / 18 : -dt / 110)));

    const y = S.y, dayK = smooth(-0.06, 0.16, y), night = 1 - smooth(-0.2, -0.02, y), warm = smooth(0.0, 0.32, y), U = sky.uniforms;
    // cloud in front of the sun, from the same field the dome draws
    U.drift.value.x += dt * 0.006 * W.wind; U.drift.value.y += dt * 0.002 * W.wind;
    if (y > 0) { const s = 1.6 / (y + 0.08), n = fbm((S.x * s + U.drift.value.x) * 1.3, (S.z * s + U.drift.value.y) * 1.3); occl += (smooth(W.cover, W.cover + 0.28, n) - occl) * (1 - Math.exp(-dt / 1.2)); }

    // the one shadow-casting light: the sun by day, the moon by night, dark in between so the hand-over is never seen
    sunCol.setRGB(1, lerp(0.5, 0.945, warm), lerp(0.22, 0.86, warm));
    if (y > -0.035) { lightDir.copy(S); sun.color.copy(sunCol); sun.intensity = 4.6 * smooth(-0.015, 0.2, y) * W.sun * (1 - 0.82 * occl); }
    else { lightDir.copy(M); sun.color.copy(moonCol); sun.intensity = 0.34 * smooth(-0.05, -0.18, y) * (1 - 0.75 * W.overcast); }
    if (lightDir.y < 0.14) { lightDir.y = 0.14; lightDir.normalize(); }               // never so low that the shadow map is all grazing angles

    // the dome
    U.sunDir.value.copy(S); U.cover.value = W.cover; U.overcast.value = W.overcast; U.night.value = night; U.turbidity.value = W.turb;
    const cl = lerp(0.03, 1, dayK); U.cloudLight.value.set(cl, cl * lerp(0.62, 1, warm), cl * lerp(0.45, 1, warm));

    // ambient fill and haze outdoors
    const amb = dayK * (1 + 0.9 * W.overcast), tg = lerp(0.8, 1, warm), tb = lerp(0.68, 1, warm), hs = zones.uniforms.uHemiOutS.value, hg = zones.uniforms.uHemiOutG.value;
    hs.setRGB(hemiS0.r * amb + nightS.r * night, hemiS0.g * amb * tg + nightS.g * night, hemiS0.b * amb * tb + nightS.b * night);
    hg.setRGB(hemiG0.r * amb + nightG.r * night, hemiG0.g * amb * tg + nightG.g * night, hemiG0.b * amb * tb + nightG.b * night);
    fogC.copy(fogClear).lerp(fogGrey, W.overcast).lerp(fogDusk, (1 - warm) * dayK * (1 - W.overcast) * 0.8).multiplyScalar(lerp(0.05, 1, dayK)).lerp(fogNight, night * 0.9);
    scene.fog.color.copy(fogC); scene.fog.density = density0 * W.fog;
    zones.uniforms.uWet.value = wet; zones.uniforms.uNight.value = smooth(0.07, -0.07, y);

    // rain
    rain.visible = W.rain > 0.02;
    if (rain.visible) { rainU.uTime.value = elapsed; rainU.uRain.value = W.rain; rainU.uCam.value.copy(camera.position); const b = 0.1 + 0.55 * dayK; rainU.uCol.value.set(b, b * 1.05, b * 1.15); }

    // lamps come on as the light goes
    const lampOn = smooth(0.1, -0.02, y);
    if (lampMat) lampMat.emissiveIntensity = 0.03 + 7 * lampOn;
    if (pools) { pools.visible = lampOn > 0.01; pools.material.color.setScalar(0.5 * lampOn); }
    for (let i = 0; i < daylit.length; i++) daylit[i].color.copy(daylitBase[i]).multiplyScalar(lerp(0.06, 1, dayK));

    // the sky probe follows the sky: often around dawn and dusk, at once after a jump, otherwise every few seconds of change
    sinceBake += dt;
    const moved = Math.abs(hour - bakedHour), dh = Math.min(moved, 24 - moved), twilight = y > -0.2 && y < 0.3;
    if (!envRT || dh > 0.5 || (sinceBake > 1.2 && (dh > (twilight ? 0.03 : 0.12) || Math.abs(W.cover - bakedCover) > 0.02 || Math.abs(W.overcast - bakedOver) > 0.04))) rebake();

    // lens flare: where the sun is on screen, and whether anything solid stands in front of it
    let strength = 0;
    if (y > 0.01) {
      camera.getWorldDirection(fwd);
      if (fwd.dot(S) > 0.2) {
        v.copy(S).multiplyScalar(500).add(camera.position).project(camera);
        const edge = smooth(1.3, 0.92, Math.max(Math.abs(v.x), Math.abs(v.y)));
        if (edge > 0 && (frame++ & 1) === 0) {
          let hit = false; const c = camera.position;
          for (let d = 2.5; d < 240 && !hit; d += 3) { const py = c.y + S.y * d; if (py > 70) break; hit = col.blocked(c.x + S.x * d, c.z + S.z * d, py, 0); }
          flareVis += ((hit ? 0 : 1) - flareVis) * 0.35;
        }
        strength = flareVis * edge * smooth(0.0, 0.1, y) * (1 - 0.9 * occl) * (1 - 0.7 * W.overcast);
        post.uniforms.comp.sun.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5, strength);
      }
    }
    if (strength === 0) post.uniforms.comp.sun.value.z = 0;
    post.uniforms.comp.sunTint.value.set(sunCol.r, sunCol.g, sunCol.b);

    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60 / 5) * 5;
    label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${T.label}`;
  }

  rebake();
  return {
    update, setWeather, sunAt,
    get label() { return label; }, get hour() { return hour; }, get weather() { return weather; }, get wet() { return wet; }, get occlusion() { return occl; }, get rain() { return W.rain; }, get night() { return sky.uniforms.night.value; },
    /** How much to open the exposure for the dark outdoors (nothing when the camera is metering the mall). */
    exposure(indoor) { return 1 + 0.45 * sky.uniforms.night.value * (1 - indoor); },
    /** Jump the clock forward (the T key). */
    skip(hours = 1) { hour = (hour + hours + 24) % 24; },
    set(o = {}) { if (o.time !== undefined) hour = ((o.time % 24) + 24) % 24; if (o.weather) { setWeather(o.weather); if (o.now) { Object.assign(W, WEATHER[weather]); wet = W.rain > 0.5 ? 1 : 0; } } },   // now: skip the blend (and the drying)
    nextWeather() { setWeather(KEY_ORDER[(KEY_ORDER.indexOf(weather) + 1) % KEY_ORDER.length]); return WEATHER[weather].label; },
    dispose() { if (envRT) envRT.dispose(); sky.dispose(); rain.geometry.dispose(); rain.material.dispose(); if (pools) { pools.geometry.dispose(); pools.material.map.dispose(); pools.material.dispose(); } },
  };
}
