/**
 * The concourse floor, as in the walking-tour footage: polished cream 600 mm
 * porcelain laid on the diagonal of the main mall, a salmon insert at every
 * corner, and a band of terracotta tiles along every shopfront, kiosk and
 * wall. The band is whole tiles of the same grid, so it steps along the
 * diagonal exactly as the real one does.
 *
 * One MeshStandardMaterial with three additions compiled in:
 *   - border: a mask traced from the plan says which tiles are terracotta
 *   - wear: low-frequency noise in world space dulls the gloss in patches
 *     and lanes, so the 2.4 m texture never reads as a repeat
 *   - reflection: the planar mirror image from reflect.js replaces the light
 *     probe's specular, blurred by height above the floor and by roughness
 */
import * as THREE from 'three';
import { concourseSet } from './surfaces.js';
import { ENV_BOX, SKYLIGHT, isConcourse } from '../world/plan2024.js';

/** The tile grid is turned 45 degrees from the long axis of the atrium. */
export const FLOOR_ANGLE = SKYLIGHT.yaw + Math.PI / 4;
const CA = Math.cos(FLOOR_ANGLE), SA = Math.sin(FLOOR_ANGLE);
/** World (x, z) -> floor UV in metres along the tile grid. */
export const floorUV = (x, z) => [x * CA + z * SA, -x * SA + z * CA];

/** 0.25 m mask over the mall: 255 where open floor lies within ~0.8 m of a shopfront, kiosk or wall. */
function borderMask() {
  const C = 0.25, x0 = ENV_BOX.minX - 1, z0 = ENV_BOX.minZ - 1, W = Math.ceil((ENV_BOX.maxX - x0 + 1) / C), H = Math.ceil((ENV_BOX.maxZ - z0 + 1) / C);
  const data = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * C, z = z0 + (j + 0.5) * C; if (!isConcourse(x, z)) continue;
    let near = false;
    for (let k = 0; k < 8 && !near; k++) { const a = k * Math.PI / 4, s = Math.sin(a), c = Math.cos(a); near = !isConcourse(x + s * 0.4, z + c * 0.4) || !isConcourse(x + s * 0.8, z + c * 0.8); }
    if (near) data[i + j * W] = 255;
  }
  const t = new THREE.DataTexture(data, W, H, THREE.RedFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  return { tex: t, rect: new THREE.Vector4(x0, z0, 1 / (W * C), 1 / (H * C)) };
}

const DECL = /* glsl */ `
  uniform sampler2D tBorder, tRefl, tReflDepth; uniform vec4 uBorderRect; uniform vec2 uGrid, uReflRes;
  uniform mat4 uReflMatrix, uReflProjInv; uniform float uReflOn, uReflFocal;
  varying vec3 vFloorW;
  float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fhash(i), fhash(i + vec2(1.0, 0.0)), f.x), mix(fhash(i + vec2(0.0, 1.0)), fhash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
// which 600 mm tile is this, where is its centre in the world, is that in the border band?
const BORDER = /* glsl */ `
  vec2 tileC = (floor(vMapUv * 4.0) + 0.5) * 0.6;
  vec2 tileW = vec2(tileC.x * uGrid.x - tileC.y * uGrid.y, tileC.x * uGrid.y + tileC.y * uGrid.x);
  float band = step(0.5, texture2D(tBorder, (tileW - uBorderRect.xy) * uBorderRect.zw).r);
  float fwear = fnoise(vFloorW.xz * 0.33) * 0.6 + fnoise(vFloorW.xz * 1.27 + 7.3) * 0.4;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.87, 0.635, 0.575), band) * (0.955 + 0.09 * fwear);`;
const WEAR = /* glsl */ `
  roughnessFactor = clamp(roughnessFactor * (0.66 + fwear * 0.95), 0.04, 1.0);`;
const REFLECT = /* glsl */ `
  if (uReflOn > 0.0) {
    vec4 rc = uReflMatrix * vec4(vFloorW, 1.0);
    vec2 ruv = rc.xy / rc.w + (normal.xy - nonPerturbedNormal.xy) * 0.035;                 // bevels and grout nudge the image
    float rdz = texture2D(tReflDepth, ruv).x;
    vec4 rvp = uReflProjInv * vec4(ruv * 2.0 - 1.0, rdz * 2.0 - 1.0, 1.0);
    float dObj = length(rvp.xyz / rvp.w), ray = clamp(dObj - length(vViewPosition), 0.0, 30.0);   // how far the reflected ray travels
    float rr = material.roughness;
    float px = ray * (rr * rr * 1.6 + 0.012) / max(dObj, 0.2) * uReflRes.y * uReflFocal;   // blur radius in mirror-image pixels
    float lod = clamp(log2(max(px, 1.0)), 0.0, 7.0);
    vec2 sv = vec2(0.0, px * 1.4 / uReflRes.y);                                            // smeared along the screen vertical, as a polished floor does
    vec3 pr = textureLod(tRefl, ruv, lod).rgb * 0.28
      + (textureLod(tRefl, ruv + sv * 0.5, lod).rgb + textureLod(tRefl, ruv - sv * 0.5, lod).rgb) * 0.22
      + (textureLod(tRefl, ruv + sv, lod).rgb + textureLod(tRefl, ruv - sv, lod).rgb) * 0.14;
    float fres = 0.05 + 0.95 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 5.0);
    float gloss = 1.0 - smoothstep(0.35, 0.85, rr);
    reflectedLight.indirectSpecular = mix(reflectedLight.indirectSpecular, min(pr, vec3(12.0)) * fres * gloss, uReflOn);
  }`;

/** refl: the object from createFloorReflection() (its uniforms are shared, so the material follows it frame by frame). */
export function concourseFloor(refl) {
  const set = concourseSet(), mask = borderMask();
  const m = new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0.05, normalScale: new THREE.Vector2(0.7, 0.7) });
  const own = { tBorder: { value: mask.tex }, uBorderRect: { value: mask.rect }, uGrid: { value: new THREE.Vector2(CA, SA) } };
  const off = { tRefl: { value: null }, tReflDepth: { value: null }, uReflMatrix: { value: new THREE.Matrix4() }, uReflProjInv: { value: new THREE.Matrix4() }, uReflOn: { value: 0 }, uReflRes: { value: new THREE.Vector2(1, 1) }, uReflFocal: { value: 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, refl ? refl.uniforms : off, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFloorW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + BORDER)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + WEAR)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + REFLECT);
  };
  m.customProgramCacheKey = () => 'concourse-floor';
  return m;
}
