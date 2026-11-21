/**
 * Physical sky: Preetham single-scattering model (Rayleigh + Mie, sun disc)
 * with a layer of drifting fbm cloud lit from the sun side. The same shader
 * covers the whole day: the scattering follows the sun down into a red
 * horizon, then a night sky takes over (deep blue, a sodium glow over the
 * city, stars, the moon). `cover` and `overcast` take the cloud from scattered
 * cumulus to a flat grey lid. render/daylight.js drives the uniforms.
 *
 * The dome follows the camera. bakeEnvironment() renders the same sky (clouds
 * frozen, no sun disc) into a prefiltered environment map, so every material
 * is lit by and reflects the sky as it is at that moment.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  uniform vec3 sunDir; uniform float rayleigh, turbidity, mieCoefficient;
  varying vec3 vWorld; varying vec3 vBetaR; varying vec3 vBetaM; varying float vSunE;
  const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
  const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w;     // always at the far plane
    float zc = clamp(sunDir.y, -1.0, 1.0);
    vSunE = 1000.0 * max(0.0, 1.0 - exp(-((1.6110731556870734 - acos(zc)) / 1.5)));
    vBetaR = totalRayleigh * rayleigh;
    float c = (0.2 * turbidity) * 10E-18;
    vBetaM = 0.434 * c * MieConst * mieCoefficient;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 sunDir, moonDir, cloudLight; uniform vec2 drift;
  uniform float mieG, gain, time, clouds, cover, disc, sat, overcast, night;
  varying vec3 vWorld; varying vec3 vBetaR; varying vec3 vBetaM; varying float vSunE;
  const float PI = 3.141592653589793;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return s; }
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float zen = acos(max(0.0, dot(up, dir)));
    float inv = 1.0 / (cos(zen) + 0.15 * pow(93.885 - zen * 180.0 / PI, -1.253));
    vec3 Fex = exp(-(vBetaR * 8.4E3 * inv + vBetaM * 1.25E3 * inv));
    float cosT = dot(dir, sunDir);
    float rPh = 0.05968310365946075 * (1.0 + pow(cosT * 0.5 + 0.5, 2.0));
    float g2 = mieG * mieG, mPh = 0.07957747154594767 * (1.0 - g2) / pow(1.0 - 2.0 * mieG * cosT + g2, 1.5);
    vec3 bT = (vBetaR * rPh + vBetaM * mPh) / (vBetaR + vBetaM);
    vec3 Lin = pow(vSunE * bT * (1.0 - Fex), vec3(1.5));
    Lin *= mix(vec3(1.0), pow(vSunE * bT * Fex, vec3(0.5)), clamp(pow(1.0 - dot(up, sunDir), 5.0), 0.0, 1.0));
    vec3 L0 = vec3(0.1) * Fex;
    L0 += vSunE * 19000.0 * Fex * smoothstep(0.99995, 0.99997, cosT) * disc;
    vec3 col = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);

    // night: deep blue overhead, the city's sodium glow low down, stars and the moon
    float up01 = clamp(dir.y, 0.0, 1.0);
    vec3 cityGlow = vec3(0.105, 0.066, 0.034);
    if (night > 0.003) {
      col += (vec3(0.010, 0.014, 0.028) + cityGlow * pow(1.0 - up01, 5.0)) * night;
      vec3 sd = dir * 170.0, id = floor(sd); float h = hash(id.xy + id.z * 37.0);
      float star = step(0.9968, h) * smoothstep(0.45, 0.05, length(fract(sd) - 0.5)) * (0.7 + 0.3 * sin(time * 2.3 + h * 40.0));
      col += vec3(0.9, 0.95, 1.0) * star * 1.4 * night * smoothstep(0.03, 0.3, dir.y);
      float mc = dot(dir, moonDir);
      col += (vec3(1.7, 1.7, 1.55) * smoothstep(0.99962, 0.99972, mc) * disc + vec3(0.2, 0.23, 0.3) * pow(max(mc, 0.0), 260.0)) * night;
    }
    // a lid of cloud greys out whatever sky is left between the clouds
    col = mix(col, vec3(0.60, 0.63, 0.68) * cloudLight + cityGlow * night * 0.8, overcast * 0.9 * smoothstep(-0.06, 0.1, dir.y));

    // below the horizon: warm grey haze so the env map's lower half reads as ground bounce
    float below = smoothstep(0.0, -0.12, dir.y);
    col = mix(col, vec3(0.055, 0.052, 0.048) * (cloudLight * 0.85 + 0.15) + cityGlow * night * 0.25, below);

    // cloud on a plane ~1.2 km up; scattered cumulus fades out towards the horizon, a rain lid runs right down to it
    if (clouds > 0.5 && dir.y > -0.02) {
      vec2 p = dir.xz / (max(dir.y, 0.0) + 0.08) * 1.6 + drift;
      float n = fbm(p * 1.3);
      float d = smoothstep(cover, cover + 0.28, n);
      float lit = clamp(0.55 + 0.45 * (fbm(p * 1.3 + sunDir.xz * 0.12) - n) * -6.0, 0.25, 1.0);   // brighter on the sun side
      vec3 cc = mix(vec3(0.62, 0.66, 0.74), vec3(1.0, 0.97, 0.92), lit) * (0.72 + 0.6 * pow(max(cosT, 0.0), 6.0));
      cc = mix(cc, vec3(0.50, 0.52, 0.56) * (0.75 + 0.5 * n), overcast);
      cc = cc * cloudLight + cityGlow * night * (0.5 + 0.5 * n);
      float fade = mix(smoothstep(0.0, 0.18, dir.y), smoothstep(-0.02, 0.05, dir.y), overcast);
      col = mix(col, cc * 1.05, d * fade * 0.92);
    }
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor = vec4(mix(vec3(lum), col, sat) * gain, 1.0);
  }`;

export function createSky(renderer, sunDir, { gain = 1 } = {}) {
  const make = () => ({
    sunDir: { value: sunDir.clone().normalize() }, moonDir: { value: new THREE.Vector3(0.45, 0.62, 0.64).normalize() }, cloudLight: { value: new THREE.Vector3(1, 1, 1) }, drift: { value: new THREE.Vector2() },
    rayleigh: { value: 1.2 }, turbidity: { value: 3.2 }, mieCoefficient: { value: 0.004 }, mieG: { value: 0.8 }, gain: { value: gain }, time: { value: 0 },
    clouds: { value: 1 }, cover: { value: 0.52 }, disc: { value: 1 }, sat: { value: 1 }, overcast: { value: 0 }, night: { value: 0 },
  });
  const uniforms = make();
  const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), mat);
  dome.frustumCulled = false; dome.renderOrder = -1000; dome.userData.dynamic = true;

  // the probe: the same sky on a small sphere, drawn into a cube map and prefiltered. One generator serves every bake.
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(), u2 = make();
  const m2 = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: u2, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const d2 = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), m2); env.add(d2);

  /** Bake the sky as it is now into a prefiltered environment map. Returns the render target: the caller owns it
   *  (use .texture, and dispose the target once it has been replaced). */
  function bakeEnvironment() {
    for (const k of Object.keys(uniforms)) { const a = uniforms[k].value, b = u2[k]; if (a && a.isVector3 || a && a.isVector2) b.value.copy(a); else b.value = a; }
    u2.disc.value = 0;            // the sun itself is the directional light
    u2.sat.value = 0.45;          // bounce light is greyer than the sky you look at
    return pm.fromScene(env, 0, 0.1, 100);
  }

  return {
    mesh: dome, uniforms, bakeEnvironment,
    update(camera, t) { dome.position.copy(camera.position); uniforms.time.value = t; },
    dispose() { pm.dispose(); d2.geometry.dispose(); m2.dispose(); },
  };
}

/** Interior image-based light, baked once and swapped in for the sky under the mall roof. A procedural room in the
 *  manner of three's RoomEnvironment, but shaped like this concourse: a charcoal exposed ceiling, warm halo rings
 *  hanging below it, white bulkheads over glowing shopfronts on every side, cream stone underfoot and one cool
 *  skylight. So polished surfaces mirror rings and shop windows, and nothing is lit by a flat white box. */
export function bakeInterior(renderer) {
  const room = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  const flat = (r, g, b, o = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), ...o });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 40), flat(0.1, 0.095, 0.088, { side: THREE.BackSide }));
  shell.position.y = 2; room.add(shell);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), flat(0.19, 0.175, 0.155));
  floor.position.y = -0.99; room.add(floor);
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(Math.PI / 2), flat(0.012, 0.012, 0.014));
  lid.position.y = 4.99; room.add(lid);
  const ring = flat(9, 8, 6.6), torus = new THREE.TorusGeometry(0.9, 0.11, 6, 24).rotateX(Math.PI / 2);
  for (let x = -15; x <= 15; x += 6) for (let z = -15; z <= 15; z += 6) { const m = new THREE.Mesh(torus, ring); m.position.set(x, 3.7, z); room.add(m); }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4, 10).rotateX(Math.PI / 2), flat(1.7, 1.9, 2.3)); sky.position.set(9, 4.95, -6); room.add(sky);   // the skylight, off to one side
  for (let k = 0; k < 4; k++) {                                                   // four walls: lit shop windows under a white bulkhead
    const g = new THREE.Group(); g.rotation.y = k * Math.PI / 2; room.add(g);
    const shop = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.7), flat(1.05, 0.85, 0.62)); shop.position.set(0, 0.4, -19.9); g.add(shop);
    const head = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.9), flat(0.3, 0.285, 0.26)); head.position.set(0, 2.5, -19.85); g.add(head);
  }
  const tex = pm.fromScene(room, 0.03, 0.1, 100).texture;
  room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  pm.dispose();
  return tex;
}
