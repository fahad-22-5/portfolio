/**
 * Registry the shop builders fill in while they lay out furniture, read by the
 * shopper simulation: where to order, where to sit, which shelves to browse.
 *
 *   place: { shop, type, kind: 'order' | 'browse' | 'checkout', x, z, heading, out: [dx, dz] (queue direction) }
 *   seat:  { shop, x, z, heading (facing the table), h (seat height), tx, tz (table), taken }
 */
export const SIM = { places: [], seats: [], contacts: [], benches: [] };
/** a soft contact-shadow decal to lay under something static: [x, z, rx, rz, ry] */
export const addContact = (x, z, rx, rz = rx, ry = 0) => SIM.contacts.push([x, z, rx, rz, ry]);

export function addPlace(shop, type, kind, [x, z], heading) {
  SIM.places.push({ shop, type, kind, x, z, heading, out: [-Math.sin(heading), -Math.cos(heading)], queue: [] });
}
export function addSeat(shop, [x, z], [tx, tz], h = 0.46) {
  SIM.seats.push({ shop, x, z, tx, tz, h, heading: Math.atan2(tx - x, tz - z), taken: null });
}
/** a place to sit on a concourse bench: seat (x, z), the way the sitter faces, and where they step on from */
export const addBenchSeat = (x, z, heading, ax, az, h = 0.46) => SIM.benches.push({ shop: 'bench', bench: true, x, z, heading, ax, az, h, taken: null });
