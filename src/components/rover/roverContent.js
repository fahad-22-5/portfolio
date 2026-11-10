/**
 * Rover mission content.
 * Résumé data is imported from the portfolio sections so the game and the
 * home page can never drift apart.
 */
import { experiences } from '../Experience';
import { skillCategories } from '../Skills';
import { publications } from '../Publications';

const PALETTE = {
  crimson: { hex: 0xdc143c, css: '#dc143c' },
  cobalt: { hex: 0x2f6fe0, css: '#2f6fe0' },
  cyan: { hex: 0x22d3ee, css: '#22d3ee' },
  gold: { hex: 0xfbbf24, css: '#fbbf24' },
  magenta: { hex: 0xec4899, css: '#ec4899' },
  green: { hex: 0x4ade80, css: '#4ade80' },
};

/* ── Work Experience → Signal Towers ── */
const TOWER_SPOTS = [
  { x: -22, z: -36, callSign: 'TOWER ALPHA', ...PALETTE.crimson },
  { x: 40, z: 6, callSign: 'TOWER BRAVO', ...PALETTE.cyan },
  { x: -34, z: 36, callSign: 'TOWER CHARLIE', ...PALETTE.magenta },
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
// guard: 'ramp' (needs a jump), 'crates' / 'cocoons' (fenced in by breakable props)
export const DATA_CACHES = [
  {
    id: 'cache-throughput',
    x: 52, z: 24, guard: 'crates',
    icon: '📦',
    title: '100,000+ Parcels a Day',
    detail: 'Architected core sortation services that process 100,000+ parcels daily and sustain peaks of 10,000+ per hour.',
  },
  {
    id: 'cache-madrid',
    x: 8, z: 44, guard: 'ramp', rampYaw: Math.PI / 2,
    icon: '🇪🇸',
    title: 'Madrid On-Site Deployment',
    detail: 'Led a 2.5-month on-site rollout in Spain, integrating sortation software for a major European last-mile logistics provider.',
  },
  {
    id: 'cache-riyadh',
    x: -52, z: 28, guard: 'cocoons',
    icon: '🇸🇦',
    title: 'Riyadh PTL Rollout',
    detail: 'Deployed and remotely tested Put-to-Light and conveyor automation for a leading Middle Eastern apparel brand.',
  },
  {
    id: 'cache-frontend',
    x: 62, z: -14, guard: 'ramp', rampYaw: Math.PI,
    icon: '⚡',
    title: '20% Faster Page Loads',
    detail: 'Cut page-load times by 20% and sped up delivery by 25% on a React ticketing platform.',
  },
  ...publications.map((pub, i) => ({
    id: `cache-pub-${i}`,
    x: i === 0 ? -8 : 30,
    z: i === 0 ? -22 : -34,
    guard: i === 0 ? 'cocoons' : 'crates',
    icon: '📜',
    title: `Published · ${pub.journal}`,
    detail: pub.title,
    meta: pub.date,
  })),
].map((c) => ({ points: 150, ...c }));

/* ── Skills → Power-Up Modules ── */
// `upgrade` keys are consumed by roverPhysics / roverGrapple / roverWorld.
const MODULE_BLUEPRINTS = [
  { x: 0, z: 30, name: '.NET Engine', perk: '+12% top speed', upgrade: { speedMul: 1.12 }, ...PALETTE.crimson },
  { x: 24, z: -8, name: 'SQL Traction Control', perk: 'Tighter grip, cleaner drifts', upgrade: { gripMul: 1.4 }, ...PALETTE.cyan },
  { x: -26, z: 8, name: 'Cloud Turbo', perk: 'Boost recharges 60% faster', upgrade: { regenMul: 1.6 }, ...PALETTE.gold },
  { x: 14, z: -46, name: 'AI Agent Radar', perk: 'Reveals caches & the bug on radar', upgrade: { radar: true }, ...PALETTE.magenta },
];

const BONUS_MODULES = [
  {
    x: 70, z: 40, name: 'React Booster', perk: 'Boost burns 30% less energy', upgrade: { drainMul: 0.7 }, ...PALETTE.cobalt,
    title: 'Frontend', skills: ['React.js', 'Tailwind CSS', 'Performance Optimization'],
  },
  {
    x: -70, z: -40, name: 'Python Grapple', perk: '+40% web-tether range', upgrade: { grappleMul: 1.4 }, ...PALETTE.green,
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

export const GRAPPLE_POSTS = [
  { x: -12, z: -8 }, { x: 16, z: 26 }, { x: -40, z: 0 }, { x: 44, z: -22 }, { x: 0, z: 52 }, { x: 80, z: 10 },
];

export const LOOSE_PROPS = [
  { kind: 'crate', x: -6, z: 22 }, { kind: 'crate', x: 20, z: 4 }, { kind: 'cocoon', x: -18, z: 16 },
  { kind: 'cocoon', x: 34, z: 40 }, { kind: 'crate', x: -44, z: -22 }, { kind: 'cocoon', x: 56, z: 2 },
];

export const PIZZA_RUN = {
  seconds: 15,
  from: { x: -62, z: 42 },
  to: { x: 28, z: -20 },
  storageKey: 'rover.pizzaBest',
};

export const VIP_TERMINAL = {
  x: 10, z: 18,
  email: 'eqbalfahad@gmail.com',
  linkedin: 'https://www.linkedin.com/in/fahadeqbalhashmi/',
};

export const BUG_HOME = { x: 30, z: 30 };

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

