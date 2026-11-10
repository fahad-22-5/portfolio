/**
 * Rover mission content and world layout.
 * Résumé data is imported from the portfolio sections so the game and the
 * home page can never drift apart.
 *
 * World footprint: x ∈ [-190, 190], z ∈ [-75, 75].
 *   · Core hall  (|x| < 110): open driving space + four mixed districts
 *   · West wing  (x < -110) : ASRS matrix, plus a tower and a module to find
 *   · East wing  (x >  110) : racking + Put-to-Light, plus a tower and a module
 * Every district mixes activities (repair, jump, smash, collect) on purpose;
 * only the ramps are fixed points the rest is arranged around.
 * The centre spine (|x| < 30) and the cross lane (z ≈ 4…28) stay clear.
 */
import { experiences } from '../Experience';
import { skillCategories } from '../Skills';
import { publications } from '../Publications';

export const WORLD = {
  halfW: 190,
  halfD: 75,
  /** How far the rover's centre may travel */
  driveX: 184,
  driveZ: 68,
};

const PALETTE = {
  crimson: { hex: 0xdc143c, css: '#dc143c' },
  cobalt: { hex: 0x2f6fe0, css: '#2f6fe0' },
  cyan: { hex: 0x22d3ee, css: '#22d3ee' },
  gold: { hex: 0xfbbf24, css: '#fbbf24' },
  magenta: { hex: 0xec4899, css: '#ec4899' },
  green: { hex: 0x4ade80, css: '#4ade80' },
};

/* ── Districts: painted outline + sign. Place names only — contents are mixed. ── */
export const ZONES = [
  { id: 'server-bay', name: 'SERVER BAY', x0: -108, x1: -40, z0: -60, z1: -24, ...PALETTE.crimson },
  { id: 'rnd-zone', name: 'R&D ZONE', x0: 40, x1: 108, z0: -60, z1: -24, ...PALETTE.cyan },
  { id: 'trophy-lane-w', name: 'TROPHY LANE', x0: -108, x1: -32, z0: 32, z1: 50, ...PALETTE.gold },
  { id: 'trophy-lane-e', name: 'TROPHY LANE', x0: 32, x1: 108, z0: 32, z1: 50, ...PALETTE.gold },
  { id: 'smash-yard', name: 'SMASH YARD', x0: -104, x1: -62, z0: -18, z1: -2, ...PALETTE.magenta },
];

/* ── Work Experience → Signal Towers: one per region, so each is a trip ── */
const TOWER_SPOTS = [
  { x: -90, z: -42, callSign: 'TOWER ALPHA', ...PALETTE.crimson },   // Server Bay
  { x: -170, z: -40, callSign: 'TOWER BRAVO', ...PALETTE.cyan },     // far end of the west wing
  { x: 90, z: -42, callSign: 'TOWER CHARLIE', ...PALETTE.magenta },  // R&D Zone
];

export const SIGNAL_TOWERS = experiences.slice(0, TOWER_SPOTS.length).map((job, i) => ({
  id: `tower-${i}`,
  points: 300,
  ...TOWER_SPOTS[i],
  role: job.role,
  company: job.company,
  period: job.period,
  location: job.location,
  bullets: job.bullets,
  tech: job.tech,
}));

/* ── Achievements → Data Caches ── */
// guard: 'ramp' (needs a jump; x/z is the ramp, the cache floats past its lip),
//        'crates' / 'cocoons' (fenced in by breakable props)
const LANE_Z = 41;
export const DATA_CACHES = [
  {
    id: 'cache-throughput',
    x: -58, z: -32, guard: 'crates',                       // Server Bay
    icon: '📦',
    title: '100,000+ Parcels a Day',
    detail: 'Architected core sortation services that process 100,000+ parcels daily and sustain peaks of 10,000+ per hour.',
  },
  {
    id: 'cache-madrid',
    x: -78, z: LANE_Z, guard: 'ramp', rampYaw: Math.PI / 2, // Trophy Lane west ramp
    icon: '🇪🇸',
    title: 'Madrid On-Site Deployment',
    detail: 'Led a 2.5-month on-site rollout in Spain, integrating sortation software for a major European last-mile logistics provider.',
  },
  {
    id: 'cache-riyadh',
    x: -40, z: LANE_Z, guard: 'cocoons',                    // landing zone of the west ramp
    icon: '🇸🇦',
    title: 'Riyadh PTL Rollout',
    detail: 'Deployed and remotely tested Put-to-Light and conveyor automation for a leading Middle Eastern apparel brand.',
  },
  {
    id: 'cache-frontend',
    x: 78, z: LANE_Z, guard: 'ramp', rampYaw: -Math.PI / 2, // Trophy Lane east ramp
    icon: '⚡',
    title: '20% Faster Page Loads',
    detail: 'Cut page-load times by 20% and sped up delivery by 25% on a React ticketing platform.',
  },
  ...publications.map((pub, i) => ({
    id: `cache-pub-${i}`,
    x: i === 0 ? 40 : 58,                                   // east ramp landing zone / R&D Zone
    z: i === 0 ? LANE_Z : -32,
    guard: i === 0 ? 'crates' : 'cocoons',
    icon: '📜',
    title: `Published · ${pub.journal}`,
    detail: pub.title,
    meta: pub.date,
  })),
].map((c) => ({ points: 150, ...c }));

/* ── Skills → Power-Up Modules: spread across every district and both wings ── */
// `upgrade` keys are consumed by roverPhysics / roverGrapple / roverWorld.
const MODULE_BLUEPRINTS = [
  { x: 56, z: -50, name: '.NET Engine', perk: '+12% top speed', upgrade: { speedMul: 1.12 }, ...PALETTE.crimson },           // R&D Zone
  { x: -56, z: -52, name: 'SQL Traction Control', perk: 'Tighter grip, cleaner drifts', upgrade: { gripMul: 1.4 }, ...PALETTE.cyan }, // Server Bay
  { x: -102, z: 41, name: 'Cloud Turbo', perk: 'Boost recharges 60% faster', upgrade: { regenMul: 1.6 }, ...PALETTE.gold },   // run-up to the west ramp
  { x: 102, z: 41, name: 'AI Agent Radar', perk: 'Reveals caches & the bug on radar', upgrade: { radar: true }, ...PALETTE.magenta }, // run-up to the east ramp
];

const BONUS_MODULES = [
  {
    x: 174, z: 46, name: 'React Booster', perk: 'Boost burns 30% less energy', upgrade: { drainMul: 0.7 }, ...PALETTE.cobalt, // east wing, past the racking
    title: 'Frontend', skills: ['React.js', 'Tailwind CSS', 'Performance Optimization'],
  },
  {
    x: -136, z: 34, name: 'Python Grapple', perk: '+40% web-tether range', upgrade: { grappleMul: 1.4 }, ...PALETTE.green,   // west wing, in front of the ASRS
    title: 'ML & Research', skills: ['Python', 'TensorFlow', 'CNN', 'NLP', 'Computer Vision'],
  },
];

export const SKILL_MODULES = [
  ...skillCategories.slice(0, MODULE_BLUEPRINTS.length).map((cat, i) => ({
    ...MODULE_BLUEPRINTS[i],
    title: cat.title,
    skills: cat.skills,
  })),
  ...BONUS_MODULES,
].map((m, i) => ({ id: `module-${i}`, points: 100, ...m }));

/* ── World dressing ── */
export const RAMP_SIZE = { width: 6, length: 10, height: 2.6 };

// Swing posts sit on lane corners, never in the middle of a lane
export const GRAPPLE_POSTS = [
  { x: -34, z: -20 }, { x: 34, z: -20 }, { x: -34, z: 30 }, { x: 34, z: 30 }, { x: -116, z: 30 }, { x: 116, z: -22 },
];

// Loose breakables: the Smash Yard pile, plus small piles guarding modules and towers
export const LOOSE_PROPS = [
  // Smash Yard
  { kind: 'crate', x: -96, z: -11 }, { kind: 'cocoon', x: -88, z: -11 }, { kind: 'crate', x: -80, z: -11 },
  { kind: 'cocoon', x: -72, z: -11 }, { kind: 'crate', x: -92, z: -15 }, { kind: 'crate', x: -76, z: -15 },
  // Gates in front of the two Trophy Lane modules
  { kind: 'crate', x: -96, z: 38 }, { kind: 'crate', x: -96, z: 44 },
  { kind: 'cocoon', x: 96, z: 38 }, { kind: 'cocoon', x: 96, z: 44 },
  // R&D Zone clutter around the .NET Engine
  { kind: 'crate', x: 62, z: -47 }, { kind: 'cocoon', x: 50, z: -46 },
  // Server Bay: cocoons webbed around the SQL module
  { kind: 'cocoon', x: -62, z: -49 }, { kind: 'cocoon', x: -50, z: -50 },
  // Wings
  { kind: 'crate', x: -166, z: -30 }, { kind: 'crate', x: 168, z: 42 }, { kind: 'cocoon', x: -130, z: 30 },
];

// A full-width sprint: east side of the core hall to the far end of the west wing
export const PIZZA_RUN = {
  seconds: 15,
  from: { x: 84, z: -11 },
  to: { x: -176, z: 32 },
  storageKey: 'rover.pizzaBest',
};

export const VIP_TERMINAL = {
  x: 16, z: 30,
  email: 'eqbalfahad@gmail.com',
  linkedin: 'https://www.linkedin.com/in/fahadeqbalhashmi/',
};

/** Drive in and press E (or use the HUD button) to start / abort the 100k Shift. */
export const SHIFT_TERMINAL = { x: -16, z: 30, radius: 6 };

export const BUG_HOME = { x: 0, z: -46 };

/* ── Comic onomatopoeia (one place to retune wording) ── */
export const SFX = {
  grapple: 'THWIP!',
  snap: 'SNAP!',
  repair: 'ZAP!',
  smashCrate: 'CRASH!',
  smashCocoon: 'SPLAT!',
  wall: 'BONK!',
  drift: 'SKRRT!',
  dash: 'ZOOM!',
  land: 'THUD!',
  module: 'POWER UP!',
  cache: 'ZING!',
  bug: 'YOINK!',
  pizzaWin: 'HOT & FRESH!',
  pizzaFail: 'COLD PIZZA!',
  stealthOn: 'STEALTH!',
  stealthOff: 'UNMASKED!',
};

export const DEV_QUOTES = [
  'It works on my machine. So we shipped my machine.',
  '99 little bugs in the code. Take one down, patch it around… 127 little bugs in the code.',
  'There are two hard problems: cache invalidation, naming things, and off-by-one errors.',
  'A conveyor belt never files a ticket. It just stops. Loudly.',
  'Fact: one mis-acked RabbitMQ message can redeliver itself into legend.',
  'Weeks of debugging can save you hours of reading the logs.',
  'The PLC is never wrong. The PLC is merely "differently timed".',
  'Fact: a sorter at 10,000 parcels/hour makes a routing decision every 360 ms.',
  '"Temporary fix" is Latin for "load-bearing".',
  'Stored procedures: because sometimes the database wants to be the backend.',
  'I don\'t always test in production, but when I do, it\'s Friday at 5 pm.',
  'Fact: the cron job you forgot about is the most reliable employee in the building.',
  'Any sufficiently advanced retry policy is indistinguishable from a DDoS.',
  'Real warehouse wisdom: if the light is blinking, somebody already knows. Nobody has told you.',
];
