/**
 * Architectural trim shared by every shopfront: the structural pier between
 * two units and the aluminium frame round the glazing. Everything goes
 * through the shop kit, so it lands in the mall's merged batches.
 */
import { pillarPaint, skirting, blackSteel } from './finishes.js';

/** Painted pier, `h` to the cornice: recessed dark skirting, a necking band, and a two-step cornice. */
export function pilaster(K, x, z, ry, h = 3.0) {
  const body = pillarPaint(), base = 0.16;
  K.box(0.45, h - base, 0.45, body, x, base + (h - base) / 2, z, ry);
  K.box(0.4, base, 0.4, skirting(), x, base / 2, z, ry);                  // skirting, set back 25 mm
  K.box(0.51, 0.06, 0.51, body, x, h - 0.21, z, ry);                      // necking band
  K.box(0.59, 0.1, 0.59, body, x, h - 0.03, z, ry);                       // cornice, stepping out twice
  K.box(0.69, 0.08, 0.69, body, x, h + 0.06, z, ry);
}

/** Head rail over a glazed front from p to q, and a sill rail under each glazed span ([[p, q], ...]). */
export function glazingFrame(K, p, q, spans, top = 3.0) {
  const m = blackSteel(), rail = (a, b, y, hh) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 0.1) return;
    K.box(len, hh, 0.1, m, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, Math.atan2(-dz, dx));
  };
  rail(p, q, top - 0.04, 0.08);
  for (const [a, b] of spans) { rail(a, b, 0.06, 0.12); rail(a, b, 2.25, 0.05); }      // sill, and a transom at door-head height
}
