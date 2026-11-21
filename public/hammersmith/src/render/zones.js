/**
 * Lighting by place, not by where the player stands.
 *
 * The scene has two worlds of ambient light: the sky outside (a probe baked
 * from the sky dome, plus a cool hemisphere fill and the sun) and the mall
 * inside (a probe of rings and shop windows, plus a warm fill, and no sun).
 * Which one lights a surface is decided per pixel from the surface's own
 * world position, so a wall looks the same from either side of a doorway and
 * nothing in the picture changes when the cat crosses a threshold.
 *
 * A top-down mask of the covered parts of the map carries, per 0.5 m cell:
 *   R  how much of the ambient light is the interior's (0 = open sky, 1 = deep
 *      inside). It ramps from 0 at each doorway to 1 a few metres in, which is
 *      the daylight that really does spill through an entrance.
 *   G  1 where a roof stops direct sun (0 under the skylight, where the
 *      shadow map decides).
 *   B  the height of that roof, so the bus deck on top and the upper floors
 *      of the station building stay outdoors.
 * Surfaces sample it 0.6 m along their normal, so the two faces of one wall
 * land on their own sides. Anything below street level is always interior.
 *
 * Every MeshStandard/Physical material in the scene gets the same small
 * shader patch (applyTo): blend the two probes, add the blended hemisphere
 * fill (there is no HemisphereLight object any more), gate the sun by G, and
 * keep the outdoor haze off interior surfaces.
 */
import * as THREE from 'three';
import { ENV_BOX, ENVELOPE, OPEN, MAIN_DOOR, FOOTBRIDGE, PORCH, UNITS, ROOF, fbWorld, inEnvelope, inFootbridge, inSkylight, inPoly, streetFronts } from '../world/plan2024.js';
import { HC_STATION } from '../mapData.js';

const C = 0.5, PASSAGE = { len: 16.5, half: 4.3, h: 5.9 };

function buildMask() {
  const S = HC_STATION, hx0 = S.x - S.w / 2 + 0.3, hx1 = S.x + S.w / 2 - 0.3, hFront = S.z + S.d / 2;
  const D = MAIN_DOOR, t = [-D.n[1], D.n[0]], fbEnd = fbWorld(FOOTBRIDGE.length + PORCH + 2, 0), mouth = D.front(PASSAGE.len + 2);
  const xs = [ENV_BOX.minX, ENV_BOX.maxX, hx0, hx1, fbEnd[0], mouth[0]], zs = [ENV_BOX.minZ, ENV_BOX.maxZ, hFront - 14, hFront, fbEnd[1], mouth[1]];
  const x0 = Math.min(...xs) - 10, z0 = Math.min(...zs) - 10, W = Math.ceil((Math.max(...xs) + 10 - x0) / C), H = Math.ceil((Math.max(...zs) + 10 - z0) / C);

  /** Covered at (x, z)? -> [ambient, roofed, roof height] or null. */
  const cover = (x, z) => {
    if (inEnvelope(x, z)) return inSkylight(x, z, -0.1) ? [0.7, 0, ROOF - 0.28] : [1, 1, ROOF - 0.28];
    if (inFootbridge(x, z)) return [1, 1, 4.0];
    const dx = x - D.m[0], dz = z - D.m[1], d = dx * D.n[0] + dz * D.n[1];
    if (d > -0.5 && d < PASSAGE.len && Math.abs(dx * t[0] + dz * t[1]) < PASSAGE.half) return [1, 1, PASSAGE.h];     // the passage under the station building
    if (x > hx0 && x < hx1 && z > hFront - 14 && z < hFront - 0.35) return [1, 1, S.h - 0.3];                           // Circle and H&C ticket hall
    return null;
  };
  // where daylight gets in: [centre x, z, outward normal x, z, half width, how far in the daylight reaches]
  const doors = [];
  for (const k of Object.keys(OPEN)) {
    if (OPEN[k] === 'footbridge' || OPEN[k] === 'nw') continue;        // these two lead into another covered space
    const a = ENVELOPE[+k], b = ENVELOPE[(+k + 1) % ENVELOPE.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len; if (inPoly(m[0] + nx * 0.8, m[1] + nz * 0.8, ENVELOPE)) { nx = -nx; nz = -nz; }
    doors.push([m[0], m[1], nx, nz, len / 2, 5]);
  }
  { const [mx, mz] = D.front(PASSAGE.len); doors.push([mx, mz, D.n[0], D.n[1], PASSAGE.half, 6]); }
  { const [ex, ez] = fbWorld(FOOTBRIDGE.length + PORCH, 0), [px, pz] = fbWorld(FOOTBRIDGE.length + PORCH - 1, 0); doors.push([ex, ez, ex - px, ez - pz, 3.2, 5]); }
  doors.push([S.x, hFront, 0, 1, 4, 6]);
  for (const u of UNITS) for (const f of streetFronts(u)) doors.push([f.m[0], f.m[1], f.nx, f.nz, f.len / 2, 3]);   // shops glazed to the street

  const data = new Uint8Array(W * H * 4), amb = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C, c = cover(x, z); if (!c) continue;
    let a = c[0];
    for (const [cx, cz, nx, nz, half, reach] of doors) {
      const dx = x - cx, dz = z - cz, depth = -(dx * nx + dz * nz); if (depth < -0.5 || depth > reach) continue;
      const side = half + Math.max(0, depth) * 0.5 - Math.abs(dx * nz - dz * nx); if (side <= 0) continue;          // the daylight fans out a little
      const k = Math.max(0, depth) / reach, s = k * k * (3 - 2 * k);
      a *= 1 - Math.min(1, side) * (1 - s);
    }
    const q = (i + j * W) * 4; data[q] = Math.round(a * 255); data[q + 1] = c[1] * 255; data[q + 2] = Math.round(Math.min(1, c[2] / 16) * 255); data[q + 3] = 255; amb[i + j * W] = a;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, data, amb, W, H, x0, z0 };
}

const DECL = /* glsl */ `
  uniform sampler2D tZone, tEnvIn; uniform vec4 uZoneRect; uniform vec3 uHemiOutS, uHemiOutG, uHemiInS, uHemiInG; uniform float uWet, uNight;
  varying vec3 vZoneW;
  float zIn = 0.0, zRoof = 0.0; vec3 zNrm = vec3(0.0, 1.0, 0.0);
  float zHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float zNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(zHash(i), zHash(i + vec2(1.0, 0.0)), f.x), mix(zHash(i + vec2(0.0, 1.0)), zHash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const WHERE = /* glsl */ `
  zNrm = transformNormalByInverseViewMatrix(normal, viewMatrix);
  {
    vec4 zm = texture2D(tZone, (vZoneW.xz + zNrm.xz * 0.6 - uZoneRect.xy) * uZoneRect.zw);
    float zc = zm.b * 16.0, under = max(1.0 - smoothstep(zc - 0.3, zc + 0.15, vZoneW.y), 0.0), below = step(vZoneW.y, -0.6);
    zIn = max(zm.r * under, below); zRoof = max(zm.g * under, below);
  }
  // Rain: open ground goes darker and glossy, with standing water in the hollows (a slow noise of world position).
  // Nothing under a roof gets wet, and people and anything marked userData.dry are left out (ZONE_DRY).
  #ifndef ZONE_DRY
  if (uWet > 0.004 && zRoof < 0.5 && vZoneW.y > -0.5) {
    float zOpen = (1.0 - zRoof) * (1.0 - zIn), zFlat = smoothstep(0.55, 0.92, zNrm.y);
    float zPud = smoothstep(0.50, 0.68, zNoise(vZoneW.xz * 0.28) * 0.7 + zNoise(vZoneW.xz * 1.1) * 0.3);
    float zW = uWet * zOpen * zFlat * (0.6 + 0.4 * zPud);
    diffuseColor.rgb *= 1.0 - 0.42 * zW - 0.12 * uWet * zOpen * (1.0 - zFlat);
    roughnessFactor = mix(roughnessFactor, mix(0.24, 0.05, zPud), zW);
    normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), zW * zPud * 0.85));
  }
  #endif
  // After dusk: glass outdoors (smooth and metallic in this scene's materials) shows lit rooms, one window bay at a
  // time, about half of them on. Car windows and street furniture are below the cut-off height.
  if (uNight > 0.01 && zIn < 0.5 && abs(zNrm.y) < 0.4 && metalnessFactor > 0.45 && roughnessFactor < 0.2 && vZoneW.y > 1.9) {
    vec2 zt = normalize(vec2(-zNrm.z, zNrm.x));
    float zh = zHash(floor(vec2(dot(vZoneW.xz, zt) / 2.6, vZoneW.y / 3.4)) + floor(zNrm.xz * 2.99) * 17.0);
    totalEmissiveRadiance += mix(vec3(1.0, 0.76, 0.48), vec3(0.82, 0.9, 1.0), step(0.82, zh)) * step(0.5, zh) * (0.16 + 0.5 * fract(zh * 7.3)) * uNight;
  }`;
const HEMI = /* glsl */ `
  #if defined( RE_IndirectDiffuse )
    { float hw = 0.5 * zNrm.y + 0.5; irradiance += mix(mix(uHemiOutG, uHemiOutS, hw), mix(uHemiInG, uHemiInS, hw), zIn); }
  #endif`;

export function createZoneLighting({ envIn }) {
  const mask = buildMask();
  const lin = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const uniforms = {
    tZone: { value: mask.tex }, tEnvIn: { value: envIn }, uZoneRect: { value: new THREE.Vector4(mask.x0, mask.z0, 1 / (mask.W * C), 1 / (mask.H * C)) },
    // the fill that used to be a HemisphereLight: cool sky over warm paving outside, warm lamps over a dark floor inside
    uHemiOutS: { value: lin(0xdfe9f5, 0.3) }, uHemiOutG: { value: lin(0x6f675c, 0.3) }, uHemiInS: { value: lin(0xfff5e6, 0.4) }, uHemiInG: { value: lin(0x303038, 0.4) },
    uWet: { value: 0 }, uNight: { value: 0 },                 // how wet the open ground is, and how far into the night (render/daylight.js)
  };
  const env = THREE.ShaderChunk.envmap_physical_pars_fragment
    .replace('vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );',
      'vec4 envMapColor = zIn > 0.995 ? textureCubeUV( tEnvIn, worldNormal, 1.0 ) : ( zIn < 0.005 ? textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 ) : mix( textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 ), textureCubeUV( tEnvIn, worldNormal, 1.0 ), zIn ) );')
    .replace('vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );',
      'vec4 envMapColor = zIn > 0.995 ? textureCubeUV( tEnvIn, reflectVec, roughness ) : ( zIn < 0.005 ? textureCubeUV( envMap, envMapRotation * reflectVec, roughness ) : mix( textureCubeUV( envMap, envMapRotation * reflectVec, roughness ), textureCubeUV( tEnvIn, reflectVec, roughness ), zIn ) );');
  const lights = THREE.ShaderChunk.lights_fragment_begin
    .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= 1.0 - zRoof;') + HEMI;
  const fog = THREE.ShaderChunk.fog_fragment.replace('mix( gl_FragColor.rgb, fogColor, fogFactor )', 'mix( gl_FragColor.rgb, fogColor, fogFactor * ( 1.0 - zIn ) )');
  if (!env.includes('tEnvIn') || !lights.includes('zRoof') || !fog.includes('zIn')) console.warn('zones: three\'s shader chunks have changed; the lighting patch did not apply');

  function patch(sh, dry) {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vZoneW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 zw = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n zw = instanceMatrix * zw;\n#endif\n vZoneW = ( modelMatrix * zw ).xyz; }');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', (dry ? '#define ZONE_DRY\n' : '') + '#include <common>\n' + DECL)
      .replace('#include <envmap_physical_pars_fragment>', env)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WHERE)
      .replace('#include <lights_fragment_begin>', lights)
      .replace('#include <fog_fragment>', fog);
  }
  const plainHook = THREE.Material.prototype.onBeforeCompile, done = new WeakSet();

  /** Patch every lit material under `root` (safe to call again after adding things). */
  function applyTo(root) {
    let n = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || !m.isMeshStandardMaterial || done.has(m)) continue;
        done.add(m); n++;
        const dry = !!(o.isSkinnedMesh || m.userData.dry), tag = dry ? 'zone|dry' : 'zone';   // people and indoor rooms outside the mask never get wet
        if (m.onBeforeCompile !== plainHook) {                       // already customised (the concourse floor): run its hook, then ours
          const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
          m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); patch(sh, dry); };
          m.customProgramCacheKey = () => key + '|' + tag;
        } else { m.onBeforeCompile = (sh) => patch(sh, dry); m.customProgramCacheKey = () => tag; }
        m.needsUpdate = true;
      }
    });
    return n;
  }

  /** How interior the light is at a point (0-1), for the camera's exposure. */
  function indoorAt(x, y, z) {
    if (y < -0.6) return 1;
    const i = Math.floor((x - mask.x0) / C), j = Math.floor((z - mask.z0) / C); if (i < 0 || j < 0 || i >= mask.W || j >= mask.H) return 0;
    const q = (i + j * mask.W) * 4; return y > mask.data[q + 2] / 255 * 16 ? 0 : mask.amb[i + j * mask.W];
  }

  return { uniforms, applyTo, indoorAt, mask, dispose() { mask.tex.dispose(); } };
}
