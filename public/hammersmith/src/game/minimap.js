/**
 * The minimap: a round, north-up map in the corner of the HUD.
 *
 * The base map is drawn once, the first time it is needed, from the same data
 * the world is built from: the carriageways (ctx.roadways), every tall
 * collision surface (so every building, whatever module built it), and the
 * shopping centre's outline. Each update after that is one drawImage of the
 * part round the cat, plus a few markers: food, nap spots, postcards not yet
 * found, and the cat itself as an arrow.
 *
 * North is -z in this world (Bute Gardens runs away north at z = -200), so the
 * canvas's y axis is simply world z.
 */
import { ENVELOPE } from '../world/plan2024.js';

const X0 = -330, Z0 = -330, SPAN = 660, PX = 2;           // the area mapped, and pixels per metre in the base
const VIEW = 130;                                         // metres across the round view

export function createMinimap(canvas, { ctx, col }) {
  const g = canvas.getContext('2d');
  let base = null;

  function build() {
    const c = document.createElement('canvas'); c.width = c.height = SPAN * PX;
    const b = c.getContext('2d'), M = (v) => v * PX;
    b.fillStyle = '#cfc9bc'; b.fillRect(0, 0, c.width, c.height);                       // pavement and open ground
    // buildings: anything solid and taller than a person, sampled a metre at a time
    b.fillStyle = '#8f877b';
    for (const s of col.surfaces) {
      if (s.hf || s.h < 2.8 || s.h > 90 || s.minX < -500) continue;
      const area = (s.maxX - s.minX) * (s.maxZ - s.minZ); if (area < 4 || area > 20000) continue;
      for (let x = Math.ceil(s.minX); x <= s.maxX; x++) for (let z = Math.ceil(s.minZ); z <= s.maxZ; z++) {
        if (x < X0 || z < Z0 || x >= X0 + SPAN || z >= Z0 + SPAN || !s.test(x, z)) continue;
        b.fillRect(M(x - X0) - 1, M(z - Z0) - 1, PX + 1, PX + 1);
      }
    }
    // the shopping centre, a shade lighter so it reads as one place
    b.fillStyle = '#b3a891'; b.beginPath(); ENVELOPE.forEach(([x, z], i) => (i ? b.lineTo(M(x - X0), M(z - Z0)) : b.moveTo(M(x - X0), M(z - Z0)))); b.closePath(); b.fill();
    // carriageways on top
    b.strokeStyle = '#5c6067'; b.lineCap = 'round'; b.lineJoin = 'round';
    for (const w of ctx.roadways || []) { b.lineWidth = M(w.w); b.beginPath(); w.pts.forEach(([x, z], i) => (i ? b.lineTo(M(x - X0), M(z - Z0)) : b.moveTo(M(x - X0), M(z - Z0)))); b.stroke(); }
    base = c;
  }

  const COL = { food: '#f2b134', nap: '#7fb3ff', postcard: '#ffffff', home: '#ff8a3d', event: '#d36bff' };
  /** x, z, heading of the cat; marks: [{ x, z, kind, done }] */
  function draw(x, z, heading, marks) {
    if (!base) build();
    const W = canvas.width, H = canvas.height, k = W / VIEW;
    g.save();
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); g.clip();
    const sx = (x - X0 - VIEW / 2) * PX, sz = (z - Z0 - VIEW / 2) * PX;
    g.fillStyle = '#cfc9bc'; g.fillRect(0, 0, W, H);
    g.drawImage(base, sx, sz, VIEW * PX, VIEW * PX, 0, 0, W, H);
    for (const m of marks) {
      const mx = W / 2 + (m.x - x) * k, mz = H / 2 + (m.z - z) * k;
      if (mx < -6 || mz < -6 || mx > W + 6 || mz > H + 6) continue;
      g.globalAlpha = m.done ? 0.35 : 1;
      if (m.kind === 'postcard') { star(mx, mz, 5, COL.postcard); }
      else if (m.kind === 'nap' || m.kind === 'home') { g.fillStyle = COL[m.kind]; g.font = `700 ${m.kind === 'home' ? 13 : 10}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.kind === 'home' ? '⌂' : 'z', mx, mz); }
      else { g.fillStyle = COL[m.kind] || '#fff'; g.beginPath(); g.arc(mx, mz, 3.2, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke(); }
    }
    g.globalAlpha = 1;
    // the cat: an arrow the way it faces
    g.translate(W / 2, H / 2); g.rotate(-heading);
    g.fillStyle = '#ff8a3d'; g.strokeStyle = '#1b1b1d'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, 8); g.lineTo(5.5, -5); g.lineTo(0, -2.5); g.lineTo(-5.5, -5); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // north
    g.fillStyle = 'rgba(12,16,28,0.75)'; g.beginPath(); g.arc(W / 2, 9, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 10px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', W / 2, 9.5);
  }
  function star(x, y, r, fill) {
    g.fillStyle = fill; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
  }

  return { draw, get built() { return !!base; } };
}
