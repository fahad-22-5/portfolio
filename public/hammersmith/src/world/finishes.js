/**
 * Shop finishes: procedural textures for real-looking materials (brushed
 * steel, oak, metro tile, marble, slatted timber, dark porcelain) plus the
 * menu boards and packaging graphics used in the fit-outs. Everything is
 * drawn once into canvases and cached.
 */
import * as THREE from 'three';
import { canvasTex, rng, FONT } from '../util.js';
import { concreteSet, graniteSet, travertineSet } from '../render/surfaces.js';

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const tiled = (t, rx, ry) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };

/** Brushed stainless: fine horizontal streaks. UVs in metres, 1 tile = 0.5 m. */
export const brushedSteel = (tint = 0xd5d9de) => once('steel' + tint, () => {
  const r = rng(3), t = canvasTex(256, 256, (c) => {
    c.fillStyle = '#c9ced4'; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { const v = 170 + r() * 70; c.fillStyle = `rgba(${v},${v + 3},${v + 6},0.35)`; c.fillRect(0, r() * 256, 256, 1); }
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.25})`; c.fillRect(r() * 256, r() * 256, 40 + r() * 140, 1); }
  });
  return new THREE.MeshStandardMaterial({ color: tint, map: tiled(t, 2, 2), metalness: 0.9, roughness: 0.25 });
});
export const chrome = () => once('chrome', () => new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.08 }));
/** Dark anodised aluminium: shopfront mullions, door frames, sign brackets. */
export const blackSteel = () => once('blacksteel', () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 }));
/** Galvanised sheet: ducts, flower buckets. */
export const galvanised = (tint = 0x9aa0a6, rough = 0.42) => once('galv' + tint + rough, () => new THREE.MeshStandardMaterial({ color: tint, metalness: 0.85, roughness: rough, side: THREE.DoubleSide }));

/** Warm off-white painted plaster for the structural piers: fine roller texture, roughness 0.6. UVs in metres. */
export const pillarPaint = () => once('pillar', () => { const d = concreteSet(); return new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.6, map: d.map, normalMap: d.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }); });
/** Dark grey recessed skirting. */
export const skirting = () => paint(0x34363a, 0.55);
/** Polished granite cladding slabs ('brown' | 'red' | 'tan' | 'grey'). UVs in metres. */
export const granite = (kind = 'brown') => once('granite' + kind, () => { const s = graniteSet(kind); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, metalness: 0.05, normalScale: new THREE.Vector2(0.5, 0.5) }); });
/** Honed travertine cladding slabs. UVs in metres. */
export const travertine = () => once('travertine', () => { const s = travertineSet(); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7) }); });

/** Sand-coloured stone cladding (the office block over the station entrance): the travertine slabs, warmer. UVs in metres. */
export const sandstone = () => once('sandstone', () => { const t = travertineSet(); return new THREE.MeshStandardMaterial({ color: 0xe6d2ac, map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, normalScale: new THREE.Vector2(0.6, 0.6) }); });

/**
 * Glass curtain wall: a 4 x 4 block of bays and storeys in one texture, so panes differ (sky tint, blinds, a few lit
 * offices), with a matching roughness/metalness map: mirror-smooth glass, satin spandrel panels, matt mullions.
 * UVs in metres; one bay = bayW x storeyH.
 */
export function curtainWall(bayW, storeyH, top, bottom, spandrel, mullion, o = {}) {
  return once(`curtain|${bayW}|${storeyH}|${top}|${bottom}|${spandrel}|${mullion}`, () => {
    const r = rng(Math.round(bayW * 100 + storeyH * 10)), N = 4, CW = 96, CH = 192, panes = [];
    for (let i = 0; i < N * N; i++) panes.push({ k: 0.82 + r() * 0.36, blind: r() < 0.22 ? 0.25 + r() * 0.5 : 0, lit: r() < 0.1 });
    const map = canvasTex(CW * N, CH * N, (c) => {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i * CW, y = j * CH, p = panes[i + j * N], gh = CH * 0.7;
        const gr = c.createLinearGradient(0, y, 0, y + gh); gr.addColorStop(0, shade(top, p.k)); gr.addColorStop(1, shade(bottom, p.k)); c.fillStyle = gr; c.fillRect(x, y, CW, gh);
        if (p.lit) { c.fillStyle = 'rgba(255,214,150,0.45)'; c.fillRect(x, y, CW, gh); }
        if (p.blind) { c.fillStyle = 'rgba(232,230,222,0.55)'; c.fillRect(x, y, CW, gh * p.blind); c.fillStyle = 'rgba(0,0,0,0.08)'; for (let k = 0; k < gh * p.blind; k += 5) c.fillRect(x, y + k, CW, 1); }
        c.fillStyle = spandrel; c.fillRect(x, y + gh, CW, CH - gh);
        c.fillStyle = mullion; c.fillRect(x, y, 4, CH); c.fillRect(x + CW - 4, y, 4, CH); c.fillRect(x, y + gh - 3, CW, 6); c.fillRect(x + CW / 2 - 2, y, 4, gh); c.fillRect(x, y + CH - 3, CW, 3);
      }
    });
    // green = roughness, blue = metalness
    const orm = canvasTex(CW * N, CH * N, (c) => {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i * CW, y = j * CH, p = panes[i + j * N], gh = CH * 0.7, rg = Math.round((0.04 + (p.k - 0.82) * 0.12) * 255);
        c.fillStyle = `rgb(0,${rg},235)`; c.fillRect(x, y, CW, gh);
        if (p.blind) { c.fillStyle = 'rgb(0,70,150)'; c.fillRect(x, y, CW, gh * p.blind); }
        c.fillStyle = 'rgb(0,90,90)'; c.fillRect(x, y + gh, CW, CH - gh);
        c.fillStyle = 'rgb(0,115,200)'; c.fillRect(x, y, 4, CH); c.fillRect(x + CW - 4, y, 4, CH); c.fillRect(x, y + gh - 3, CW, 6); c.fillRect(x + CW / 2 - 2, y, 4, gh); c.fillRect(x, y + CH - 3, CW, 3);
      }
    });
    orm.colorSpace = THREE.NoColorSpace;
    for (const t of [map, orm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / (bayW * N), 1 / (storeyH * N)); t.anisotropy = 8; }
    return new THREE.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, envMapIntensity: 1.25, ...o });
  });
}

/** Oak planks, 0.18 m wide. */
export const oak = (base = '#b98a5a') => once('oak' + base, () => {
  const r = rng(9), t = canvasTex(256, 512, (c) => {
    const w = 256 / 4;
    for (let p = 0; p < 4; p++) {
      const k = 0.85 + r() * 0.3; c.fillStyle = shade(base, k); c.fillRect(p * w, 0, w, 512);
      for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(70,40,15,${0.08 + r() * 0.12})`; c.lineWidth = 1 + r() * 2; c.beginPath(); const x = p * w + r() * w; c.moveTo(x, 0); c.bezierCurveTo(x + 6 - r() * 12, 170, x + 6 - r() * 12, 340, x + 4 - r() * 8, 512); c.stroke(); }
      c.fillStyle = 'rgba(40,25,10,0.5)'; c.fillRect(p * w, 0, 1.5, 512);
      const cut = r() * 512; c.fillRect(p * w, cut, w, 1.5);
    }
  });
  return new THREE.MeshStandardMaterial({ map: tiled(t, 1 / 0.72, 1 / 1.44), roughness: 0.55 });
});

/** White metro tiles (75 x 150 mm) with grey grout. 1 tile = 0.6 m. */
export const metroTile = (col = '#f4f3ef', grout = '#c9c7c0') => once('metro' + col, () => {
  const t = canvasTex(256, 256, (c) => {
    c.fillStyle = grout; c.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let k = -1; k < 4; k++) {
      const x = k * 64 + (row % 2 ? 32 : 0), y = row * 32, gr = c.createLinearGradient(0, y, 0, y + 30);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, col); gr.addColorStop(1, shade(col, 0.93)); c.fillStyle = gr; c.fillRect(x + 2, y + 2, 60, 28);
    }
  });
  return new THREE.MeshStandardMaterial({ map: tiled(t, 1 / 0.6, 1 / 0.6), roughness: 0.18, metalness: 0.05 });
});

/** White marble worktop with grey veins. */
export const marble = () => once('marble', () => {
  const r = rng(21), t = canvasTex(512, 256, (c) => {
    c.fillStyle = '#f1f0ec'; c.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 14; i++) { c.strokeStyle = `rgba(120,120,125,${0.15 + r() * 0.3})`; c.lineWidth = 0.6 + r() * 2; c.beginPath(); let x = r() * 512, y = r() * 256; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += 40 + r() * 60; y += (r() - 0.5) * 70; c.lineTo(x, y); } c.stroke(); }
  });
  return new THREE.MeshStandardMaterial({ map: tiled(t, 1, 1), roughness: 0.12, metalness: 0.0 });
});

/** Dark porcelain floor tiles, 600 mm. */
export const darkTile = (col = '#3d3d3f') => once('dtile' + col, () => {
  const r = rng(5), t = canvasTex(256, 256, (c) => {
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { c.fillStyle = shade(col, 0.92 + r() * 0.16); c.fillRect(a * 128, b * 128, 128, 128); }
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.05})`; c.fillRect(r() * 256, r() * 256, 1, 1); }
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; for (let k = 0; k <= 2; k++) { c.beginPath(); c.moveTo(k * 128, 0); c.lineTo(k * 128, 256); c.moveTo(0, k * 128); c.lineTo(256, k * 128); c.stroke(); }
  });
  return new THREE.MeshStandardMaterial({ map: tiled(t, 1 / 1.2, 1 / 1.2), roughness: 0.35 });
});

/** Vertical timber slats over a dark backing (McDonald's feature walls). */
export const slats = (wood = '#9a6b43') => once('slats' + wood, () => {
  const t = canvasTex(256, 64, (c) => {
    c.fillStyle = '#1b1b1d'; c.fillRect(0, 0, 256, 64);
    for (let k = 0; k < 8; k++) { const gr = c.createLinearGradient(k * 32, 0, k * 32 + 22, 0); gr.addColorStop(0, shade(wood, 0.8)); gr.addColorStop(0.5, wood); gr.addColorStop(1, shade(wood, 0.75)); c.fillStyle = gr; c.fillRect(k * 32 + 4, 0, 22, 64); }
  });
  return new THREE.MeshStandardMaterial({ map: tiled(t, 1 / 0.8, 1), roughness: 0.6 });
});

export const paint = (hex, rough = 0.7) => once('paint' + hex + rough, () => new THREE.MeshStandardMaterial({ color: hex, roughness: rough }));
/** Self-lit surface (screens, light panels, LED lines). `gain` > 1 pushes it over the bloom threshold so it glows. */
export const glow = (hex, gain = 1.3) => once('glow' + hex + '|' + gain, () => { const m = new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }); m.color.multiplyScalar(gain); return m; });
/** A lamp: white body with a strong emissive term, well over the bloom threshold (halo rings, downlights, LED strips). */
export const lamp = (hex = 0xfff8e7, intensity = 3.5) => once('lamp' + hex + '|' + intensity, () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: hex, emissiveIntensity: intensity, roughness: 0.5 }));
/** Transmissive glass (refracts what is behind it): transmission 0.9, IOR 1.5, roughness 0.05, reflectivity 0.9.
 *  Opt-in with ?glass=hi: any transmissive surface on screen makes three draw the opaque scene a second time
 *  (measured ~12 ms a frame here), so by default all glazing uses the blended physical glass below. */
export const HI_GLASS = typeof location !== 'undefined' && /[?&]glass=hi/.test(location.search);
const transmissive = () => new THREE.MeshPhysicalMaterial({ color: 0xf4fbff, metalness: 0, roughness: 0.05, transmission: 0.9, opacity: 1, transparent: true, ior: 1.5, reflectivity: 0.9, thickness: 0.012, specularIntensity: 1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
/** Shopfront glazing: physically based glass (IOR 1.5, Fresnel reflections of the environment, slight tint).
 *  Shopfronts are everywhere, so by default they blend rather than transmit (see HI_GLASS). */
export const clearGlass = () => once('cglass', () => (HI_GLASS ? transmissive()
  : new THREE.MeshPhysicalMaterial({ color: 0xeef7fb, metalness: 0, roughness: 0.05, ior: 1.5, reflectivity: 0.9, specularIntensity: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })));
/** The big panes (lift shafts, skylight). */
export const heroGlass = () => once('hglass', () => (HI_GLASS ? transmissive()
  : new THREE.MeshPhysicalMaterial({ color: 0xeef7fb, metalness: 0, roughness: 0.05, ior: 1.5, reflectivity: 0.9, specularIntensity: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })));

/**
 * Back-lit menu board. items: [[name, price], ...]; theme picks colours.
 */
export function menuBoard(title, items, { bg = '#111', fg = '#fff', accent = '#ffc72c', photo = '#c8873a' } = {}) {
  return once('menu' + title + bg, () => {
    const t = canvasTex(512, 320, (c) => {
      c.fillStyle = bg; c.fillRect(0, 0, 512, 320);
      c.fillStyle = accent; c.font = `800 34px ${FONT}`; c.fillText(title, 24, 46);
      c.font = `500 21px ${FONT}`;
      items.forEach(([n, p], i) => {
        const y = 92 + i * 34; c.fillStyle = fg; c.fillText(n, 24, y); c.textAlign = 'right'; c.fillStyle = accent; c.fillText(p, 488, y); c.textAlign = 'left';
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(24, y + 9, 464, 1);
      });
      // a product "photo" blob in the corner
      c.fillStyle = photo; c.beginPath(); c.ellipse(430, 50, 46, 30, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(418, 40, 20, 9, -0.3, 0, Math.PI * 2); c.fill();
    });
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  });
}

/** Printed label for a box/package side (Pret sandwich packs, McD cartons). */
export function label(key, draw, w = 128, h = 128) {
  return once('label' + key, () => new THREE.MeshStandardMaterial({ map: canvasTex(w, h, draw), roughness: 0.55 }));
}

export function shade(hex, k) {
  const c = new THREE.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return '#' + c.getHexString();
}

/** Shop fascia board texture: brand colours + lettering, with a few treatments (slats, ribs, tiles, dots, arches, grid, roundel, stars). */
export function fascia(text, w, { bg = '#111', fg = '#fff', style, sub, accent } = {}, h = 0.9) {
  return once(`fascia|${text}|${w.toFixed(1)}|${bg}|${fg}|${style}|${sub}|${accent}|${h}`, () => {
    const H = 128, Wd = Math.max(128, Math.min(2048, Math.round(H * w / h)));
    const t = canvasTex(Wd, H, (c) => {
      c.fillStyle = bg; c.fillRect(0, 0, Wd, H);
      if (style === 'slats') { c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 0; x < Wd; x += 14) c.fillRect(x, 0, 5, H); }
      if (style === 'ribs') { c.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 12) c.fillRect(0, y, Wd, 4); }
      if (style === 'tiles') { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; for (let x = 0; x < Wd; x += 32) for (let y = 0; y < H; y += 16) c.strokeRect(x + ((y / 16) % 2) * 16, y, 32, 16); }
      if (style === 'dots') { c.fillStyle = accent || '#fff'; for (let x = 12; x < Wd; x += 34) for (let y = 14; y < H; y += 34) { c.beginPath(); c.arc(x + ((y / 34) % 2) * 17, y, 7, 0, Math.PI * 2); c.fill(); } c.fillStyle = bg; c.fillRect(Wd * 0.18, 26, Wd * 0.64, 76); }
      if (accent && style !== 'dots') { c.fillStyle = accent; c.fillRect(0, H - 14, Wd, 14); }
      let left = 0;
      if (style === 'arches') { c.fillStyle = '#ffc72c'; c.font = `900 104px ${FONT}`; c.textBaseline = 'middle'; c.fillText('M', 26, 70); left = 96; }
      if (style === 'grid') { [['#f9b233', 0, 0], ['#00a3e0', 1, 0], ['#00a3e0', 0, 1], ['#f9b233', 1, 1]].forEach(([col, i, j]) => { c.fillStyle = col; c.fillRect(24 + i * 34, 30 + j * 34, 30, 30); }); left = 80; }
      if (style === 'roundel') { c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.fill(); c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 36, 0, Math.PI * 2); c.fill(); left = 96; }
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      const lbl = style === 'stars' ? `★  ${text}  ★` : text;
      let fs = sub ? 56 : 70; c.font = `800 ${fs}px ${FONT}`;
      const room = (Wd - left) * 0.9, tw = c.measureText(lbl).width; if (tw > room) { fs *= room / tw; c.font = `800 ${fs}px ${FONT}`; }
      c.fillText(lbl, left + (Wd - left) / 2, sub ? 50 : 66);
      if (sub) { c.font = `600 24px ${FONT}`; c.fillText(sub, left + (Wd - left) / 2, 100); }
    });
    const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); m.color.setScalar(1.3); return m;   // back-lit: bright enough to bloom
  });
}
