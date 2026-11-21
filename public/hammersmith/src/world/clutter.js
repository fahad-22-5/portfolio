/**
 * The small things that make the concourse feel used: ribbed entrance mats
 * with the BROADWAY lettering, digital advertising totems, planter benches,
 * wet-floor signs and the steel bollards outside the doors.
 *
 * Furniture stands only where the mall is at least 6 m clear all round, so
 * no route is ever narrowed to nothing; each piece gets a collision box (so
 * the cat and the shoppers walk round it) and a contact shadow. Everything
 * repeated is instanced; the one-offs are merged by the static batcher.
 */
import * as THREE from 'three';
import { canvasTex, inst, box, FONT, TAU } from '../util.js';
import { blackSteel, brushedSteel, paint } from './finishes.js';
import { addContact, addBenchSeat } from './sim.js';
import { ENV_BOX, ENVELOPE, OPEN, MAIN_DOOR, LIFTS, isConcourse, inPoly, unitFront, hallX, hallZ } from './plan2024.js';

/* ---------- entrance mat ---------- */
let matRib = null;
/**
 * Dark ribbed barrier mat, `len` wide and `depth` deep, with BROADWAY woven in. Returns a group lying on y = 0:
 * the lettering reads the right way up to someone walking along the group's local -Z.
 */
export function entranceMat(len, depth = 2.4) {
  if (!matRib) {
    const t = canvasTex(64, 64, (c) => { c.fillStyle = '#2b2c2f'; c.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 8) { c.fillStyle = '#131415'; c.fillRect(0, y, 64, 3); c.fillStyle = '#3d3f43'; c.fillRect(0, y + 4, 64, 1); } });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);                    // UVs in metres: 0.2 m per tile, a rib every 25 mm
    matRib = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 1.5, roughness: 0.95 });
  }
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.PlaneGeometry(len, depth).rotateX(-Math.PI / 2), matRib);
  { const uv = base.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * depth); }
  base.receiveShadow = true; g.add(base);
  const lw = Math.min(len - 0.5, 4.6), lh = lw / 4.6;
  if (lw > 1.2) {
    const tex = canvasTex(1024, 224, (c) => {
      c.fillStyle = '#2b2c2f'; c.fillRect(0, 0, 1024, 224);
      c.fillStyle = '#a3a6ab'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 150px ${FONT}`;
      if ('letterSpacing' in c) c.letterSpacing = '14px';
      c.fillText('BROADWAY', 512, 118);
      for (let y = 0; y < 224; y += 5.6) { c.fillStyle = 'rgba(15,16,17,0.75)'; c.fillRect(0, y, 1024, 2.1); c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(0, y + 2.8, 1024, 0.8); }   // the ribs run through the letters
    });
    tex.anisotropy = 8;
    const let_ = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    let_.position.y = 0.004; let_.receiveShadow = true; g.add(let_);
  }
  return g;
}

/* ---------- advertising totem screens ---------- */
function adScreens() {
  const head = (c, bg) => { c.fillStyle = bg; c.fillRect(0, 0, 256, 34); c.fillStyle = '#fff'; c.font = `700 17px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('SixtySecond Stop', 12, 18); c.textAlign = 'right'; c.font = `600 13px ${FONT}`; c.fillText('Broadway', 244, 18); };
  const draws = [
    (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#ff5436'); g.addColorStop(1, '#ffb23a'); c.fillStyle = g; c.fillRect(0, 0, 256, 512);
      c.strokeStyle = '#fff'; c.lineWidth = 9; c.beginPath(); c.arc(128, 150, 62, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(128, 150); c.lineTo(128, 106); c.moveTo(128, 150); c.lineTo(160, 166); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 40px ${FONT}`; c.fillText('SixtySecond', 128, 272); c.font = `800 64px ${FONT}`; c.fillText('STOP', 128, 330);
      c.font = `600 19px ${FONT}`; c.fillText('Coffee  ·  Hot food  ·  To go', 128, 396); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 446, 256, 66); c.fillStyle = '#fff'; c.font = `700 20px ${FONT}`; c.fillText('Next to the station gates', 128, 479);
      head(c, 'rgba(0,0,0,0.35)');
    },
    (c) => {
      const g = c.createLinearGradient(0, 0, 256, 512); g.addColorStop(0, '#14265e'); g.addColorStop(1, '#2f7fd0'); c.fillStyle = g; c.fillRect(0, 0, 256, 512);
      ['#e4572e', '#f2b134', '#3fa34d', '#7fd0ff', '#b98cf0'].forEach((h, i) => { c.strokeStyle = h; c.lineWidth = 12; c.beginPath(); c.arc(128, 170, 70, i * TAU / 5, (i + 1) * TAU / 5 - 0.14); c.stroke(); });
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 46px ${FONT}`; c.fillText("What's on", 128, 300); c.font = `600 24px ${FONT}`; c.fillText('at Broadway this week', 128, 344);
      c.font = `600 18px ${FONT}`; ['Late opening Thursday', 'Flower market Saturday', 'Live jazz on the bridge'].forEach((t, i) => c.fillText(t, 128, 402 + i * 30));
      head(c, 'rgba(0,0,0,0.35)');
    },
    (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#0f6b5c'); g.addColorStop(1, '#8fd66a'); c.fillStyle = g; c.fillRect(0, 0, 256, 512);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(128, 168, 78, 52, -0.2, 0, TAU); c.fill(); c.fillStyle = '#f2b134'; c.beginPath(); c.ellipse(120, 160, 46, 28, -0.2, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 44px ${FONT}`; c.fillText('Fresh in', 128, 290); c.font = `800 44px ${FONT}`; c.fillText('60 seconds', 128, 338);
      c.font = `600 20px ${FONT}`; c.fillText('SixtySecond Stop', 128, 400); c.fillText('Open 6am – 10pm', 128, 430);
      head(c, 'rgba(0,0,0,0.35)');
    },
  ];
  return draws.map((d) => { const m = new THREE.MeshBasicMaterial({ map: canvasTex(256, 512, d), toneMapped: false }); m.map.anisotropy = 8; m.color.setScalar(1.45); return m; });   // back-lit LCD: over the bloom threshold
}

export function buildClutter(ctx, parent) {
  const { col } = ctx;
  const black = blackSteel(), steel = brushedSteel(), off = { shadow: false };

  /* ---------- where the mall is wide open ---------- */
  const exits = Object.keys(OPEN).map((k) => { const a = ENVELOPE[+k], b = ENVELOPE[(+k + 1) % ENVELOPE.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
  const gate = [hallX(15, 5), hallZ(15, 5)];
  const clear = (x, z, r) => { if (!isConcourse(x, z)) return false; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, s = Math.sin(a), c = Math.cos(a); if (!isConcourse(x + s * r, z + c * r) || !isConcourse(x + s * r * 0.5, z + c * r * 0.5)) return false; } return true; };
  const hash = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };
  const spots = [];
  for (let z = ENV_BOX.minZ; z <= ENV_BOX.maxZ; z += 1.5) for (let x = ENV_BOX.minX; x <= ENV_BOX.maxX; x += 1.5) {
    if (!clear(x, z, 3.0)) continue;
    if (exits.some(([ex, ez]) => Math.hypot(x - ex, z - ez) < 9) || Math.hypot(x - gate[0], z - gate[1]) < 9 || LIFTS.some((L) => Math.hypot(x - L.x, z - L.z) < 6.5)) continue;
    spots.push([x, z, hash(x, z)]);
  }
  spots.sort((p, q) => p[2] - q[2]);
  const picked = [];
  for (const s of spots) { if (picked.length >= 14) break; if (picked.every((p) => Math.hypot(p[0] - s[0], p[1] - s[1]) > 9)) picked.push(s); }
  /** The way people walk past (x, z): the direction with the longest clear run, as a compass angle. */
  const flow = (x, z) => {
    let best = 0, ang = 0;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI, s = Math.sin(a), c = Math.cos(a); let n = 0;
      for (const dir of [-1, 1]) for (let d = 0.5; d < 16; d += 0.5) { if (!isConcourse(x + s * d * dir, z + c * d * dir)) break; n++; }
      if (n > best) { best = n; ang = a; }
    }
    return ang;
  };

  /* ---------- totems and benches, alternating ---------- */
  const ads = adScreens(), screenGeo = new THREE.PlaneGeometry(0.84, 1.62);
  const greens = [], olive = paint(0x76823f, 0.92);
  const woods = [0xa9774a, 0x9c6b40, 0xb5824f, 0xa37245], leaves = [0x3f6b2b, 0x4f7d32, 0x5d8a44, 0x35602a];
  picked.forEach(([x, z], i) => {
    const a = flow(x, z);
    if (i % 2 === 0) {                                                             // totem: both screens face along the flow
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = a; parent.add(g);
      box(g, 1.06, 0.06, 0.36, steel, 0, 0.03, 0); box(g, 0.96, 2.3, 0.2, black, 0, 1.21, 0); box(g, 0.98, 0.035, 0.22, steel, 0, 2.375, 0);
      for (const s of [-1, 1]) { const m = new THREE.Mesh(screenGeo, ads[(i / 2 + (s > 0 ? 0 : 1)) % ads.length]); m.position.set(0, 1.42, s * 0.102); m.rotation.y = s > 0 ? 0 : Math.PI; g.add(m); }
      col.rect(x, z, 0.96, 0.2, { rot: a, h: 2.4, pad: 0.07 }).perch = 'an advertising totem';
      // a stainless litter bin at its end: the one way up for a cat
      for (const side of [1, -1]) {
        const bx = x + Math.cos(a) * 0.9 * side, bz = z - Math.sin(a) * 0.9 * side;
        if (!isConcourse(bx, bz) || !isConcourse(bx + 0.3, bz) || !isConcourse(bx - 0.3, bz) || !isConcourse(bx, bz + 0.3) || !isConcourse(bx, bz - 0.3)) continue;
        const bin = new THREE.Group(); bin.position.set(bx, 0, bz); parent.add(bin);
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.9, 20), steel); can.position.y = 0.45; can.castShadow = true; bin.add(can);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), black); lid.position.y = 0.93; bin.add(lid);
        const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.02), black); slot.position.set(0, 0.8, 0.205); bin.add(slot);
        col.rect(bx, bz, 0.42, 0.42, { h: 0.96 }); addContact(bx, bz, 0.5);
        break;
      } addContact(x, z, 0.8, 0.34, a);
      return;
    }
    // round bench: an olive upholstered ring round a planted core, as in the walking-tour footage; five places to sit, facing out
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    const ring = (rt, rb, h, mat, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 40), mat); m.position.y = y; g.add(m); };
    ring(0.98, 0.98, 0.26, paint(0x2c2e31, 0.7), 0.13); ring(1.05, 1.05, 0.2, olive, 0.36); ring(0.5, 0.57, 0.5, olive, 0.7); ring(0.45, 0.45, 0.06, paint(0x2a2018, 1), 0.97);
    for (let k = 0; k < 9; k++) { const q = k / 9 * TAU + i, r = k ? 0.24 : 0, sc = 0.2 + ((k * 37 + i * 11) % 9) * 0.014; greens.push({ x: x + Math.cos(q) * r, y: 1.13 + (k % 3) * 0.13 + (k ? 0 : 0.2), z: z + Math.sin(q) * r, sx: sc, sy: sc * 1.25, sz: sc, ry: q, c: leaves[(k + i) % 4] }); }
    for (let k = 0; k < 5; k++) { const h = a + k * TAU / 5, sx = Math.sin(h), sz = Math.cos(h); addBenchSeat(x + sx * 0.8, z + sz * 0.8, h, x + sx * 1.6, z + sz * 1.6); }
    col.rect(x, z, 1.9, 1.9, { h: 0.46, pad: 0.05 }); col.rect(x, z, 0.9, 0.9, { h: 1.0, pad: 0.05 }); addContact(x, z, 1.5);
  });
  inst(parent, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), greens, off);

  /* ---------- yellow wet-floor signs outside the food units ---------- */
  const wet = new THREE.MeshStandardMaterial({ roughness: 0.5, map: canvasTex(128, 256, (c) => {
    c.fillStyle = '#f6c915'; c.fillRect(0, 0, 128, 256); c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 25px ${FONT}`; c.fillText('CAUTION', 64, 40);
    c.beginPath(); c.moveTo(64, 70); c.lineTo(112, 156); c.lineTo(16, 156); c.closePath(); c.lineWidth = 7; c.lineJoin = 'round'; c.stroke();
    c.beginPath(); c.arc(70, 100, 7, 0, TAU); c.fill(); c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(66, 110); c.lineTo(58, 128); c.lineTo(74, 144); c.moveTo(58, 128); c.lineTo(44, 140); c.moveTo(64, 114); c.lineTo(82, 122); c.stroke();
    c.font = `800 25px ${FONT}`; c.fillText('WET', 64, 188); c.fillText('FLOOR', 64, 218); c.fillRect(0, 244, 128, 12);
  }) });
  wet.map.wrapS = wet.map.wrapT = THREE.RepeatWrapping; wet.map.repeat.set(1 / 0.3, 1 / 0.62);   // box() UVs are in metres: one print per panel
  ['Greggs', 'Pure.', 'Wasabi', 'COSTA', 'LEON'].forEach((name, i) => {
    const [fx, fz] = unitFront(name, 2.4), x = fx + (i % 2 ? 0.9 : -0.9), z = fz + (i % 3 ? 0.6 : -0.6);
    if (!isConcourse(x, z)) return;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = i * 1.3; parent.add(g);
    for (const s of [-1, 1]) { const p = box(g, 0.3, 0.62, 0.012, wet, 0, 0.3, s * 0.058); p.rotation.x = -s * 0.19; }
    addContact(x, z, 0.26);
  });

  /* ---------- steel bollards across the pavement outside every door ---------- */
  const posts = [], bands = [];
  const row = (cx, cz, tx, tz, half) => {
    const n = Math.max(1, Math.round(half * 2 / 1.6));
    for (let i = 0; i <= n; i++) {
      const d = -half + i * half * 2 / n, x = cx + tx * d, z = cz + tz * d; if (inPoly(x, z, ENVELOPE)) continue;
      posts.push({ x, y: 0.5, z }); bands.push({ x, y: 0.86, z });
      col.rect(x, z, 0.16, 0.16, { h: 1.0, pad: 0.05 }); addContact(x, z, 0.2);
    }
  };
  for (const k of Object.keys(OPEN)) {
    if (OPEN[k] === 'footbridge') continue;
    if (OPEN[k] === 'nw') { const [cx, cz] = MAIN_DOOR.front(20.3); row(cx, cz, -MAIN_DOOR.n[1], MAIN_DOOR.n[0], 7.2); continue; }   // the main door: outside the stone entrance building
    const a = ENVELOPE[+k], b = ENVELOPE[(+k + 1) % ENVELOPE.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let nx = tz, nz = -tx; if (inPoly(m[0] + nx * 0.8, m[1] + nz * 0.8, ENVELOPE)) { nx = -nx; nz = -nz; }
    row(m[0] + nx * 3.1, m[1] + nz * 3.1, tx, tz, Math.max(0.8, len / 2 - 0.4));
  }
  const pm = inst(parent, new THREE.CylinderGeometry(0.075, 0.075, 1.0, 16), steel, posts); pm.userData.keepShadow = true;
  inst(parent, new THREE.CylinderGeometry(0.078, 0.078, 0.05, 16), black, bands, off);
}
