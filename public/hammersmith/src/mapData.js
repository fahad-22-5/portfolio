/**
 * Geometry traced from the Hammersmith map screenshot (702 x 666 px).
 *
 * SCALE: the screenshot has no visible scale bar, so the ratio is estimated
 * from the Broadway island (about 200 m across Butterwick -> Queen Caroline St,
 * 250 px in the image) => 0.8 m per pixel. If you measure a real scale bar,
 * change M_PER_PX and everything traced below rescales with it.
 *
 * World: 1 unit = 1 m, +X east, -Z north, +Y up. Origin = centre of the
 * Broadway island (pixel 365, 385).
 */
export const M_PER_PX = 0.8;
export const ORIGIN_PX = [365, 385];
export const px = (u, v) => [(u - ORIGIN_PX[0]) * M_PER_PX, (v - ORIGIN_PX[1]) * M_PER_PX];
const trace = (pts) => pts.map(([u, v]) => px(u, v));

/** Kerb line of the Broadway island (the block the gyratory circulates around). */
export const BROADWAY_ISLAND = trace([
  [262, 300], [330, 268], [455, 272], [490, 300], [500, 400],
  [505, 478], [330, 492], [245, 470], [235, 380],
]);

/** Centre line of the A4 Hammersmith Flyover, west to east. */
export const FLYOVER = trace([[0, 566], [150, 556], [330, 545], [500, 541], [702, 540]]);

/** Streets as centre lines + carriageway width (m). */
export const ROADS = [
  { name: 'Hammersmith Rd', w: 14, pts: trace([[452, 261], [590, 261], [740, 259]]) },
  { name: "Shepherd's Bush Rd", w: 13, pts: trace([[332, 262], [331, 135], [340, -2]]) },
  { name: 'Beadon Rd', w: 10, pts: trace([[290, 269], [228, 231], [160, 190]]) },
  { name: 'King St', w: 12, pts: trace([[235, 302], [115, 312], [-10, 322]]) },
  { name: 'Fulham Palace Rd', w: 13, pts: trace([[330, 500], [335, 545], [346, 760]]) },
  // Bute Gardens: N-S leg off Hammersmith Rd, then the dog-leg east.
  { name: 'Bute Gardens', w: 9, trees: true, pts: trace([[485, 252], [485, 110], [495, 92], [578, 58], [700, 28]]) },
  { name: 'Wolverton Gardens', w: 9, trees: true, pts: trace([[578, 252], [578, 58]]) },
  { name: 'Rowan Rd', w: 9, trees: true, pts: trace([[690, 252], [690, 30]]) },
];

export const BUTE_X = px(485, 0)[0]; // 96 m east of the origin

/** Abercorn House, 28-30 Bute Gardens: 44 m long block on the east side, set back behind a garden wall. */
import { unitFront, MAIN_DOOR } from './world/plan2024.js';
const PRET = unitFront('Pret A Manger'), TESCO = unitFront('TESCO'), MCD = unitFront("McDonald's");
const FRONT = MAIN_DOOR.front(20.5);             // on the pavement in front of the main entrance (Starbucks door)

export const ABERCORN = { x: BUTE_X + 16.5, z: -190, w: 14, h: 17.3, d: 44, doorZ: -174.25,       // entrance is in the south end bay
  lobby: { x0: BUTE_X + 8.8, x1: BUTE_X + 17, z0: -177.2, z1: -171.3 } };                           // the reception behind the front doors: the cat's home

export const HC_STATION = { x: -105, z: -190, w: 35, h: 12, d: 80 }; // tracks at px 215-245
export const APOLLO = { x: -76, z: 190, w: 55, h: 18, d: 65, rot: 0.4 };

/** Generic massing blocks [x, z, w, d, h] placed in the gaps between traced streets. */
export const BLOCKS = [
  [-152, -95, 50, 28, 16], [-178, -18, 90, 38, 14], [-232, -100, 60, 40, 12],
  [5, -130, 38, 38, 22], [50, -132, 18, 34, 18], [20, -200, 58, 60, 20],
  [155, -160, 13, 108, 12], [185, -170, 13, 118, 12],
  [245, -170, 13, 118, 12], [275, -170, 14, 118, 12], [135, -264, 40, 12, 11],
  [190, 50, 66, 56, 20], [270, 20, 50, 110, 16],
  [-55, -150, 34, 56, 18], [-58, -240, 38, 78, 16], [-162, -215, 40, 70, 14],
  [40, 195, 78, 44, 16], [140, 200, 60, 50, 14], [-190, 200, 70, 50, 13], [-250, 60, 60, 50, 12],
  [60, -260, 60, 36, 14], [-110, 30, 0, 0, 0],
].filter((b) => b[4] > 0);

/**
 * Street-sign cards. `memory` is yours to fill in: when it is non-empty it is
 * shown under the landmark facts on the card.
 */
export const LANDMARKS = [
  { id: 'abercorn', title: 'Bute Gardens', code: 'W6', sub: 'Abercorn House · Nos. 28–30',
    body: 'A long brown-brick block with white stone bands and a set-back top floor. The white porch sits behind a low garden wall and hedge, under a plane tree.',
    memory: '', x: ABERCORN.x - 11, z: ABERCORN.doorZ, y: 0, r: 6 },
  { id: 'corner', title: 'Bute Gardens', code: 'W6', sub: 'B&K Newsagent · corner of Hammersmith Road',
    body: 'The red-brick corner where Bute Gardens leaves Hammersmith Road: newsagent below, dental practice above, hanging baskets on the lamp post.',
    memory: '', x: BUTE_X - 5, z: -107, y: 0, r: 6 },
  { id: 'pret', title: 'Broadway Concourse', code: 'W6', sub: 'Pret A Manger',
    body: 'The commuter pit-stop at the north end of the atrium food row: coffee and a baguette before the Tube or the bus.',
    memory: '', x: PRET[0], z: PRET[1], y: 0, r: 4.5 },
  { id: 'tesco', title: 'Broadway Concourse', code: 'W6', sub: 'Tesco Express',
    body: 'Meal-deal territory, on the way out to the Bradmore Square doors.',
    memory: '', x: TESCO[0], z: TESCO[1], y: 0, r: 6 },
  { id: 'apollo', title: 'Queen Caroline St', code: 'W6', sub: 'Eventim Apollo',
    body: 'Opened in 1932 as the Gaumont Palace, designed by Robert Cromie. A Grade II* listed Art Deco hall tucked just south of the flyover.',
    memory: '', x: -94, z: 148, y: 0, r: 13 },
  { id: 'flyover', title: 'Hammersmith Flyover', code: 'A4', sub: 'Great West Road',
    body: 'Opened in 1961, an early precast, prestressed concrete elevated road carrying the A4 over the gyratory on a single line of piers.',
    memory: '', x: -28, z: 128, y: 0, r: 12 },
  { id: 'hc', title: 'Beadon Road', code: 'W6', sub: 'Hammersmith · Circle and Hammersmith & City lines',
    body: 'The western terminus of both lines. The railway reached Hammersmith in 1864 and moved to this site in 1868; it is a separate station from the one under the Broadway.',
    memory: '', x: -105, z: -146, y: 0, r: 7 },
  { id: 'front', title: 'Hammersmith Broadway', code: 'W6', sub: 'Hammersmith station · main entrance',
    body: 'The stone-fronted entrance with the glazed bow above the doors. Walk straight through for the shopping centre, the District and Piccadilly line gates, and the buses.',
    memory: '', x: FRONT[0], z: FRONT[1], y: 0, r: 7 },
  { id: 'mcd', title: 'Broadway Concourse', code: 'W6', sub: "McDonald's",
    body: "Under the skylight on the main mall, opposite Pret and Chopstix. The kitchen line runs the full width behind the counter.",
    memory: '', x: MCD[0], z: MCD[1], y: 0, r: 5 },
];

export const GATE_CARDS = {
  broadway: { title: 'Hammersmith', code: '⊖', sub: 'District and Piccadilly lines',
    body: 'Oyster accepted. Stairs ahead lead down to the platforms. Opened by the District Railway in 1874; Piccadilly line trains have called here since 1906.' },
  hc: { title: 'Hammersmith', code: '⊖', sub: 'Circle and Hammersmith & City lines',
    body: 'Oyster accepted. Platforms 1–3 straight ahead: every train from here heads east through Paddington.' },
};
