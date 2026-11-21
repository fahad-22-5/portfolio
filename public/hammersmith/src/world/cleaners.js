/**
 * Cleaners: two people in hi-vis who mop the concourse beside the yellow
 * wet-floor signs. They use the same task loop as the shop staff (walk to a
 * spot, work there, move on), so they are a small crew of their own; the
 * skinned bodies come from bodies.js like everyone else's.
 */
import { createStaff } from './staff.js';
import { isConcourse, unitFront } from './plan2024.js';

export function createCleaners(ctx, parent) {
  const { col } = ctx, crew = createStaff(parent);
  const free = (x, z) => isConcourse(x, z) && !col.blocked(x, z, 0, 0.4);
  const clear = (ax, az, bx, bz) => { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4); for (let i = 0; i <= n; i++) if (!free(ax + (bx - ax) * i / n, az + (bz - az) * i / n)) return false; return true; };
  for (const [shop, turn] of [['Greggs', 0.4], ['COSTA', 2.1]]) {
    // a straight beat of three spots that starts beside the sign and stays on open floor
    const [sx, sz] = unitFront(shop, 3.4); if (!free(sx, sz)) continue;
    let beat = null;
    for (let k = 0; k < 16 && !beat; k++) { const a = turn + k * Math.PI / 8, ex = sx + Math.sin(a) * 6.5, ez = sz + Math.cos(a) * 6.5; if (free(ex, ez) && clear(sx, sz, ex, ez)) beat = [a, ex, ez]; }
    if (!beat) continue;
    const [a, ex, ez] = beat, mid = [(sx + ex) / 2, (sz + ez) / 2];
    crew.add({
      at: (x, z) => [x, z], yaw: 0, look: { uniform: 0xd7e021, trousers: 0x1d2733, skin: 0xd9a07a, hair: 0x2a1c12, sleeves: 'long' },
      tasks: [
        { to: [sx, sz], face: a, act: 'wipe', dur: 7, prop: 'mop', carry: true }, { to: mid, face: a + 0.5, act: 'wipe', dur: 6, prop: 'mop', carry: true },
        { to: [ex, ez], face: a + Math.PI, act: 'wipe', dur: 7, prop: 'mop', carry: true }, { to: mid, face: a - 0.5, act: 'wipe', dur: 5, prop: 'mop', carry: true },
      ],
    });
  }
  crew.flush();
  return crew;
}
