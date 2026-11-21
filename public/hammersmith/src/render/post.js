/**
 * Post-processing pipeline, written against plain three (no addons):
 *
 *   scene -> HDR target (half-float, 4x MSAA, resolved depth texture)
 *         -> SAO ambient occlusion from depth (half res) + depth-aware blur
 *         -> bloom (bright-pass, dual-filter down/up chain)
 *         -> composite: AO, bloom, exposure, ACES filmic, grade, vignette, grain, sRGB
 *
 * render(scene, camera) replaces renderer.render(scene, camera).
 */
import * as THREE from 'three';

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPost(renderer, { samples = 4, aoRadius = 0.4, aoIntensity = 1.15, bloomStrength = 0.35, bloomThreshold = 0.85, bloomRadius = 0.4 } = {}) {
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rt = (o = {}) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, ...o });

  const hdr = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType) });
  const aoA = rt({ type: THREE.UnsignedByteType }), aoB = rt({ type: THREE.UnsignedByteType });
  const LEVELS = 6, down = [], up = [];
  for (let i = 0; i < LEVELS; i++) { down.push(rt()); up.push(rt()); }

  const pass = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

  /* ---------- SAO (scalable ambient obscurance) ---------- */
  const aoMat = pass(/* glsl */ `
    uniform sampler2D tDepth; uniform mat4 projInv, proj; uniform vec2 res; uniform float radius, intensity;
    varying vec2 vUv;
    vec3 vpos(vec2 uv) { float d = texture2D(tDepth, uv).x; vec4 v = projInv * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
    void main() {
      float d = texture2D(tDepth, vUv).x;
      if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
      vec3 P = vpos(vUv);
      vec2 px = 1.0 / res;
      // normal from the neighbour with the smaller depth step (keeps silhouettes clean)
      vec3 l = vpos(vUv - vec2(px.x, 0.0)), r = vpos(vUv + vec2(px.x, 0.0)), b = vpos(vUv - vec2(0.0, px.y)), t = vpos(vUv + vec2(0.0, px.y));
      vec3 dx = abs(l.z - P.z) < abs(r.z - P.z) ? P - l : r - P;
      vec3 dy = abs(b.z - P.z) < abs(t.z - P.z) ? P - b : t - P;
      vec3 N = normalize(cross(dx, dy));
      float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float ssR = radius * proj[1][1] / max(0.1, -P.z) * 0.5;          // world radius -> uv radius
      ssR = min(ssR, 0.12);
      float sum = 0.0; const int N_S = 14;
      for (int i = 0; i < N_S; i++) {
        float a = (float(i) + 0.5) / float(N_S);
        float ang = a * 7.0 * 6.2831853 + noise * 6.2831853;            // 7-turn spiral, rotated per pixel
        vec2 off = vec2(cos(ang), sin(ang)) * a * ssR;
        vec3 v = vpos(vUv + off) - P;
        float vv = dot(v, v), vn = dot(v, N);
        float f = max(radius * radius - vv, 0.0);
        sum += f * f * f * max((vn - 0.01 * -P.z) / (vv + 0.01), 0.0);
      }
      float r6 = pow(radius, 6.0);
      float ao = max(0.0, 1.0 - sum * intensity * 5.0 / (r6 * float(N_S)));
      gl_FragColor = vec4(vec3(ao), 1.0);
    }`, { tDepth: { value: hdr.depthTexture }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2() }, radius: { value: aoRadius }, intensity: { value: aoIntensity } });

  const blurMat = pass(/* glsl */ `
    uniform sampler2D tAO, tDepth; uniform vec2 dir; uniform float near, far;
    varying vec2 vUv;
    float lin(float d) { return near * far / (far - d * (far - near)); }
    void main() {
      float z0 = lin(texture2D(tDepth, vUv).x), s = 0.0, w = 0.0;
      for (int i = -4; i <= 4; i++) {
        vec2 uv = vUv + dir * float(i);
        float z = lin(texture2D(tDepth, uv).x), k = exp(-float(i * i) / 10.0) * max(0.0, 1.0 - abs(z - z0) / (0.05 * z0 + 0.05));
        s += texture2D(tAO, uv).x * k; w += k;
      }
      gl_FragColor = vec4(vec3(s / max(w, 1e-4)), 1.0);
    }`, { tAO: { value: null }, tDepth: { value: hdr.depthTexture }, dir: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 1000 } });

  /* ---------- bloom: soft-knee bright pass, then dual-filter blur ---------- */
  const brightMat = pass(/* glsl */ `
    uniform sampler2D tColor; uniform float threshold; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tColor, vUv).rgb; float br = max(c.r, max(c.g, c.b));
      float knee = threshold * 0.5, soft = clamp(br - threshold + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
      float k = max(soft, br - threshold) / max(br, 1e-4);
      gl_FragColor = vec4(min(c * k, vec3(40.0)), 1.0);
    }`, { tColor: { value: hdr.texture }, threshold: { value: bloomThreshold } });
  const downMat = pass(/* glsl */ `
    uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
    void main() {
      vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
      s += texture2D(tSrc, vUv + vec2(-px.x, -px.y)).rgb + texture2D(tSrc, vUv + vec2(px.x, -px.y)).rgb + texture2D(tSrc, vUv + vec2(-px.x, px.y)).rgb + texture2D(tSrc, vUv + px).rgb;
      gl_FragColor = vec4(s / 8.0, 1.0);
    }`, { tSrc: { value: null }, px: { value: new THREE.Vector2() } });
  const upMat = pass(/* glsl */ `
    uniform sampler2D tSrc, tAdd; uniform vec2 px; uniform float spread; varying vec2 vUv;
    void main() {
      vec3 s = texture2D(tSrc, vUv + vec2(-px.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(px.x * 2.0, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -px.y * 2.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, px.y * 2.0)).rgb;
      s += (texture2D(tSrc, vUv + vec2(-px.x, px.y)).rgb + texture2D(tSrc, vUv + px).rgb + texture2D(tSrc, vUv + vec2(px.x, -px.y)).rgb + texture2D(tSrc, vUv - px).rgb) * 2.0;
      gl_FragColor = vec4(s / 12.0 * spread + texture2D(tAdd, vUv).rgb, 1.0);     // spread > 1 weights the wide levels (a bigger halo)
    }`, { tSrc: { value: null }, tAdd: { value: null }, px: { value: new THREE.Vector2() }, spread: { value: 0.6 + bloomRadius } });   // radius 0.4 = an even sum of the levels

  /* ---------- composite ---------- */
  const compMat = new THREE.ShaderMaterial({
    vertexShader: VERT, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: hdr.texture }, tAO: { value: aoA.texture }, tBloom: { value: up[0].texture }, bloom: { value: bloomStrength }, aoMix: { value: 1 }, time: { value: 0 }, res: { value: new THREE.Vector2() }, sun: { value: new THREE.Vector3() }, sunTint: { value: new THREE.Vector3(1, 0.9, 0.8) } },   // sun: where it is on screen (uv) and how strong the flare is
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor, tAO, tBloom; uniform float bloom, aoMix, time; uniform vec2 res; uniform vec3 sun, sunTint; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tColor, vUv).rgb;
        float ao = mix(1.0, texture2D(tAO, vUv).x, aoMix);
        c *= ao;
        c += texture2D(tBloom, vUv).rgb * bloom / 6.0;          // the up-chain sums six levels
        // lens flare when the sun is in shot: a veil of glare, a horizontal streak, and faint ghosts on the line through the centre
        if (sun.z > 0.002) {
          vec2 asp = vec2(res.x / res.y, 1.0), sd = (vUv - sun.xy) * asp, ax = vec2(0.5) - sun.xy; float r = length(sd);
          float glare = 0.5 * exp(-r * 7.0) + 0.16 / (1.0 + r * r * 40.0) + 0.3 * exp(-abs(sd.y) * 60.0) * exp(-abs(sd.x) * 2.5);
          float g1 = length((vUv - (sun.xy + ax * 1.45)) * asp), g2 = length((vUv - (sun.xy + ax * 1.8)) * asp), g3 = length((vUv - (sun.xy + ax * 0.55)) * asp);
          float ghosts = smoothstep(0.075, 0.03, g1) * 0.5 + smoothstep(0.13, 0.11, g2) * smoothstep(0.07, 0.11, g2) * 0.6 + smoothstep(0.04, 0.0, g3) * 0.4;
          c += sunTint * sun.z * (glare * 1.3 + ghosts * vec3(0.6, 0.8, 1.0) * 0.07);
        }
        // grade (linear): a touch of warmth in the highlights, cool shadows, gentle saturation
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.08);
        c *= mix(vec3(0.97, 0.99, 1.04), vec3(1.03, 1.0, 0.96), smoothstep(0.05, 1.2, l));
        // lens: vignette and a whisper of grain
        vec2 q = vUv - 0.5; q.x *= res.x / res.y;
        c *= mix(1.0, 0.72, smoothstep(0.35, 1.05, length(q)));
        float g = fract(sin(dot(gl_FragCoord.xy + time * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
        c *= 1.0 + (g - 0.5) * 0.025;
        gl_FragColor = vec4(max(c, 0.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  function draw(mat, target) { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quad, ortho); }

  let W = 1, H = 1;
  function setSize(w, h) {
    W = Math.max(1, Math.floor(w)); H = Math.max(1, Math.floor(h));
    hdr.setSize(W, H);
    const aw = Math.max(1, W >> 1), ah = Math.max(1, H >> 1);
    aoA.setSize(aw, ah); aoB.setSize(aw, ah);
    for (let i = 0; i < LEVELS; i++) { const s = 2 ** (i + 1); down[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s))); up[i].setSize(Math.max(1, Math.floor(W / s)), Math.max(1, Math.floor(H / s))); }
    compMat.uniforms.res.value.set(W, H);
  }

  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  let aoOn = true;

  function render(scene, camera, time = 0) {
    const prevAuto = renderer.autoClear;
    renderer.setRenderTarget(hdr); renderer.clear(); renderer.render(scene, camera);

    // ambient occlusion
    if (aoOn) {
      const u = aoMat.uniforms; u.projInv.value.copy(camera.projectionMatrixInverse); u.proj.value.copy(camera.projectionMatrix); u.res.value.set(aoA.width, aoA.height);
      draw(aoMat, aoA);
      blurMat.uniforms.near.value = camera.near; blurMat.uniforms.far.value = camera.far;
      blurMat.uniforms.tAO.value = aoA.texture; blurMat.uniforms.dir.value.set(1 / aoA.width, 0); draw(blurMat, aoB);
      blurMat.uniforms.tAO.value = aoB.texture; blurMat.uniforms.dir.value.set(0, 1 / aoA.height); draw(blurMat, aoA);
    }
    compMat.uniforms.aoMix.value = aoOn ? 1 : 0;

    // bloom
    draw(brightMat, down[0]);
    for (let i = 1; i < LEVELS; i++) { downMat.uniforms.tSrc.value = down[i - 1].texture; downMat.uniforms.px.value.set(0.5 / down[i - 1].width, 0.5 / down[i - 1].height); draw(downMat, down[i]); }
    for (let i = LEVELS - 2; i >= 0; i--) {
      const src = i === LEVELS - 2 ? down[LEVELS - 1] : up[i + 1];
      upMat.uniforms.tSrc.value = src.texture; upMat.uniforms.tAdd.value = down[i].texture; upMat.uniforms.px.value.set(0.5 / src.width, 0.5 / src.height); draw(upMat, up[i]);
    }

    compMat.uniforms.time.value = time;
    draw(compMat, null);
    renderer.autoClear = prevAuto;
  }

  function dispose() { for (const t of [hdr, aoA, aoB, ...down, ...up]) t.dispose(); for (const m of [aoMat, blurMat, brightMat, downMat, upMat, compMat]) m.dispose(); quad.geometry.dispose(); black.dispose(); }

  /** Change the MSAA sample count: the target is rebuilt on its next use. */
  function setSamples(n) { if (hdr.samples !== n) { hdr.samples = n; hdr.dispose(); } }

  return { hdr, render, setSize, setSamples, dispose, set ao(v) { aoOn = v; }, get ao() { return aoOn; }, uniforms: { ao: aoMat.uniforms, comp: compMat.uniforms, bright: brightMat.uniforms, up: upMat.uniforms } };
}
