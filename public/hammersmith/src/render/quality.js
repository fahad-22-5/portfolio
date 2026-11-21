/**
 * Quality tiers. Pick one with ?quality=low|medium|high (remembered in
 * localStorage), or press Q in the scene to cycle. Everything here can change
 * live except the number of pooled lights, which is read when the mall is built.
 *
 *   dpr      cap on the device pixel ratio
 *   samples  MSAA samples on the HDR target
 *   ao       screen-space ambient occlusion
 *   reflect  floor reflection resolution, as a fraction of the frame (0 = off: the floor shows the light probe only)
 *   mirrorDetail  the reflection skips anything smaller than this fraction of its distance (bigger = cheaper)
 *   mirrorEvery   redraw the reflection every frame (1) or every other frame, alternating with the shadow map (2)
 *   shadow   sun shadow map size
 *   lights   real point lights that follow the cat round the mall, per pool
 */
const TIERS = {
  low: { dpr: 1, samples: 0, ao: false, reflect: 0, mirrorDetail: 0.2, mirrorEvery: 2, shadow: 1024, lights: 0 },
  medium: { dpr: 1.25, samples: 4, ao: true, reflect: 0.5, mirrorDetail: 0.12, mirrorEvery: 2, shadow: 2048, lights: 2 },
  high: { dpr: 1.5, samples: 4, ao: true, reflect: 0.75, mirrorDetail: 0.045, mirrorEvery: 1, shadow: 2048, lights: 3 },
};
export const QUALITY_ORDER = ['low', 'medium', 'high'];
const KEY = 'hs-quality';

export function initialQuality() {
  let name = null;
  try { name = new URLSearchParams(location.search).get('quality') || localStorage.getItem(KEY); } catch (e) { /* no storage: use the default */ }
  return TIERS[name] ? name : 'medium';
}
export const qualityTier = (name) => TIERS[name] || TIERS.medium;
export function saveQuality(name) { try { localStorage.setItem(KEY, name); } catch (e) { /* private mode */ } }
