/**
 * Playing as the cat: the game layer over the world.
 *
 * Interactions are entries in one registry. Each is a place (or a person) with
 * a reach, a prompt that may depend on the moment ("Meow at the counter",
 * nothing while the barista is still busy), and what happens when you press E.
 * The nearest one in reach shows its prompt in the HUD; new kinds of thing to
 * do are new entries, not new branches in the main loop.
 *
 *   add({ id, kind, x, y, z, r, dy, prompt: () => string | null, use: () => void, mark })
 *
 * Also here: the cat's needs (hunger and energy: food fills one, naps the
 * other, trotting drains energy), the postcards you collect by visiting
 * landmarks, what each person thinks of you, and saving all of it in the
 * browser (on every nap, every new postcard, every minute, and when you leave).
 */
import * as THREE from 'three';
import { SIM } from '../world/sim.js';
import { LANDMARKS } from '../mapData.js';
import { createMinimap } from './minimap.js';

const SAVE_KEY = 'hammersmith-cat-save-v1';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage blocked */ } },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v) => Math.max(0, Math.min(100, v));

/**
 * api: what the game may do to the cat ({ pos, heading (get/set), speed (get), place(x, y, z, h), push(v) }).
 * tone(f0, f1, dur, type, gain): the little synth for sound effects.
 */
export function createGame({ ctx, scene, ui, cat, api, daylight, people, tone }) {
  const things = [];
  const add = (t) => { const e = { r: 1.3, dy: 1.2, mark: null, ...t }; things.push(e); return e; };
  const st = { hunger: 80, energy: 90, postcards: new Set(), affinity: {}, served: {}, petted: {}, canTrot: true, rep: {}, perches: new Set(), stats: {}, quests: [] };   // stats: counters the quests read (src/game/quests.js); quests: ids done
  /* ---------- an event bus: what happened, for the quests ---------- */
  const listeners = {};
  const on = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  const emit = (type, data) => { for (const fn of listeners[type] || []) fn(data); for (const fn of listeners['*'] || []) fn(type, data); };   // rep: what each shop thinks of you (src/game/mischief.js)
  let act = null, clock = 0, saveT = 45, rumbleT = 30, tiredSaid = false, card = null;   // card: one of the game's info cards, open until the cat walks off

  /* ---------- food at the counters ---------- */
  const saucer = new THREE.Group(); saucer.visible = false; saucer.userData.dynamic = true; scene.add(saucer);
  {
    const china = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35 }), milk = new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.2 });
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.02, 20), china); dish.position.y = 0.01; saucer.add(dish);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 20), milk); pool.position.y = 0.021; saucer.add(pool); saucer.userData.pool = pool;
    if (ctx.zones) ctx.zones.applyTo(saucer);
  }
  const CAFE = {
    COSTA: 'A barista sets down a saucer of cat milk.',
    'Pret A Manger': 'A pup cup: a paper cup of milk foam, just for you.',
    Starbucks: 'A "puppuccino": foam in a little cup.',
    'Pure.': 'Someone behind the counter pours you a saucer of cat milk.',
  };
  const served = (shop) => st.served[shop] !== undefined && clock - st.served[shop] < 180;
  const firstOf = new Set();
  for (const p of SIM.places) {
    if (p.kind !== 'order' || p.type !== 'cafe' || firstOf.has(p.shop)) continue;
    firstOf.add(p.shop);
    add({ id: 'food:' + p.shop, kind: 'food', x: p.x, y: 0, z: p.z, r: 1.4, mark: 'food',
      prompt: () => (served(p.shop) ? null : 'Meow at the counter'),
      use: () => feed(p.shop, p.heading, CAFE[p.shop] || 'Someone behind the counter puts down a saucer of cat milk.', 35) });
  }
  for (const p of SIM.places) {
    if (p.kind !== 'checkout') continue;
    if (p.shop === 'Oseyo') add({ id: 'food:Oseyo', kind: 'food', x: p.x, y: 0, z: p.z, r: 1.4, mark: 'food',
      prompt: () => (served('Oseyo') ? null : 'Meow at the till'),
      use: () => feed('Oseyo', p.heading, 'The cashier slips you a flake of plain dried fish.', 18, false) });
    if (p.shop === 'Hotel Chocolat') add({ id: 'chocolate', kind: 'info', x: p.x, y: 0, z: p.z, r: 1.4,
      prompt: () => 'Meow at the counter',
      use: () => {
        cat.meow(); ui.say('"Sorry, no chocolate for you!"'); card = { id: 'chocolate', x: api.pos.x, z: api.pos.z };
        ui.showCard('chocolate', { title: 'No chocolate', code: '!', sub: 'Why cats can\'t have chocolate', body: 'Chocolate contains theobromine and caffeine, which cats break down very slowly. Even a little can cause vomiting, a racing heart and tremors, and dark chocolate is the most dangerous. The staff are right to say no.', memory: '' });
      } });
  }
  function feed(shop, heading, line, amount, dish = true) {
    api.heading = heading;
    cat.meow(); tone(720, 420, 0.32, 'triangle');
    ui.say(line);
    act = { kind: 'eat', t: 0, dur: 4.5, shop, amount, dish };
  }

  /* ---------- nap spots: home, the concourse benches, empty café chairs, the bus shelter ---------- */
  const cafeShops = new Set(SIM.places.filter((p) => p.type === 'cafe').map((p) => p.shop));
  for (const s of ctx.napSpots || []) add({ id: 'nap:' + s.name, kind: 'nap', x: s.x, y: s.y, z: s.z, r: s.r || 1.3, dy: 1.6, mark: s.home ? 'home' : 'nap',
    prompt: () => `Curl up on ${s.name}`, use: () => nap(s.x, s.y, s.z, s.heading || api.heading, s.name) });
  SIM.benches.forEach((s, i) => { if (i % 2) return; add({ id: 'nap:bench' + i, kind: 'nap', x: s.x, y: 0, z: s.z, r: 1.0, mark: 'nap',
    prompt: () => (s.taken ? null : 'Nap on the bench'), use: () => nap(s.x, s.h, s.z, s.heading + Math.PI / 2, 'the bench') }); });
  SIM.seats.forEach((s, i) => { if (!cafeShops.has(s.shop)) return; add({ id: 'nap:seat' + i, kind: 'nap', x: s.x, y: 0, z: s.z, r: 0.75,
    prompt: () => (s.taken ? null : 'Curl up on the chair'), use: () => nap(s.x, s.h, s.z, s.heading, 'a café chair') }); });
  function nap(x, y, z, heading, where) {
    api.place(x, y + 0.02, z, heading);
    cat.setPose('curl'); tone(140, 90, 0.9, 'sine', 0.05);
    act = { kind: 'nap', t: 0, dur: 4.2, slept: false, where };
  }

  /* ---------- people: some love cats, some ignore you, some don't like you, and they remember ---------- */
  const NICE = ['"Aww, hello you!"', '"Who\'s a lovely cat?"', '"Oh, you\'re so soft!"', '"Hello, puss!"'];
  const disposition = (key) => { const a = st.affinity[key] || 0; let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0; const base = h % 100 < 45 ? 'loves' : h % 100 < 80 ? 'ignores' : 'dislikes'; return base === 'ignores' && a >= 3 ? 'loves' : base === 'loves' && a <= -2 ? 'dislikes' : base; };
  const person = add({ id: 'person', kind: 'person', x: 0, y: 0, z: 0, r: 1.05, dy: 1.0, who: null, key: '',
    prompt: () => (person.who && !(st.petted[person.key] > clock) ? 'Rub against their legs' : null),
    use: () => {
      const key = person.key, d = disposition(key), sh = person.who; st.petted[key] = clock + 8; cat.meow();
      if (d === 'loves') { ui.say(pick(NICE)); tone(90, 70, 1.4, 'sawtooth', 0.025); st.energy = clamp(st.energy + 6); st.affinity[key] = (st.affinity[key] || 0) + 1; sh.react = 2.6; }
      else if (d === 'ignores') { ui.say('They don\'t seem to notice you.'); st.affinity[key] = (st.affinity[key] || 0) + 0.5; }
      else { ui.say('"Shoo! Go on!"'); api.push(-2.4); st.affinity[key] = (st.affinity[key] || 0) - 1; }
    } });
  function nearestPerson(p) {
    let best = null, bd = person.r * person.r, key = '';
    for (const [tag, list] of people) for (const sh of list) {
      if (sh.state === 'HID' || sh.state === 'GONE' || sh.p.hidden) continue;
      const q = sh.p.root.position, d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bd && Math.abs(q.y - p.y) < 1) { bd = d; best = sh; key = tag + sh.id; }
    }
    person.who = best; person.key = key;
    if (best) { person.x = best.p.root.position.x; person.y = best.p.root.position.y; person.z = best.p.root.position.z; }
  }

  /* ---------- postcards: one for each landmark, the first time you inspect it ---------- */
  function postcard(id) {
    if (st.postcards.has(id)) return;
    const l = LANDMARKS.find((q) => q.id === id); if (!l) return;
    st.postcards.add(id); tone(880, 1320, 0.25, 'triangle', 0.05); emit('postcard', id);
    ui.toast(`New postcard · ${l.sub.split(' · ')[0]} (${st.postcards.size}/${LANDMARKS.length})`);
    save();
  }

  /* ---------- saving ---------- */
  function save(note) {
    const p = api.pos, ok = store.set({ v: 1, at: Date.now(), pos: [p.x, p.y, p.z], heading: api.heading, hour: daylight.hour, weather: daylight.weather,
      hunger: st.hunger, energy: st.energy, postcards: [...st.postcards], affinity: st.affinity, rep: st.rep, perches: [...st.perches], stray: st.stray, stats: st.stats, quests: st.quests });
    if (note && ok) ui.toast(note);
    saveT = 60;
  }
  const q = new URLSearchParams(location.search);
  if (q.has('newgame')) store.clear();
  const saved = q.has('newgame') ? null : store.get();
  if (saved && saved.v === 1) {
    st.hunger = clamp(saved.hunger); st.energy = clamp(saved.energy); (saved.postcards || []).forEach((id) => st.postcards.add(id)); st.affinity = saved.affinity || {}; st.rep = saved.rep || {}; (saved.perches || []).forEach((n) => st.perches.add(n)); if (saved.stray) st.stray = saved.stray; if (saved.stats) st.stats = saved.stats; if (saved.quests) st.quests = saved.quests;
    if (!q.has('time') && !q.has('weather') && Number.isFinite(saved.hour)) daylight.set({ time: saved.hour, weather: saved.weather, now: true });
    if (saved.pos && saved.pos.every(Number.isFinite)) api.place(saved.pos[0], saved.pos[1], saved.pos[2], saved.heading || 0);
    setTimeout(() => ui.toast(`Welcome back · ${st.postcards.size}/${LANDMARKS.length} postcards`), 600);
  }
  const onHide = () => save();
  window.addEventListener('pagehide', onHide);

  /* ---------- minimap ---------- */
  const map = createMinimap(ui.mapCanvas, { ctx, col: ctx.col });
  const marks = things.filter((t) => t.mark).map((t) => ({ x: t.x, z: t.z, kind: t.mark, done: false }));
  const cards = LANDMARKS.filter((l) => l.x !== undefined).map((l) => ({ id: l.id, x: l.x, z: l.z, kind: 'postcard', done: false }));
  marks.push(...cards);
  let mapT = 0, mapOn = true;

  /* ---------- per frame ---------- */
  let near = null;
  /** The interaction in reach of the cat, or null; its prompt is what the HUD shows. */
  function nearest() {
    if (act) return null;
    const p = api.pos; nearestPerson(p);
    let best = null, bd = Infinity, bp = -1;
    for (const t of things) {
      if (t === person && !person.who) continue;
      const d = (t.x - p.x) ** 2 + (t.z - p.z) ** 2; if (d > t.r * t.r || Math.abs(p.y - t.y) > t.dy) continue;
      const pr = t.prompt(); if (!pr) continue;
      const rank = (t.pri || 0) * 2 + (t.kind === 'person' ? 0 : 1);           // urgent things (t.pri, set by its prompt), then places, then people; then the nearest
      if (best && (rank < bp || (rank === bp && d >= bd))) continue;
      best = t; bd = d; bp = rank; best._p = pr;
    }
    near = best; return best ? best._p : null;
  }
  function use() { if (near) { near.use(); return true; } return false; }

  function update(dt) {
    clock += dt;
    const sp = Math.abs(api.speed);
    if (!act || act.kind !== 'nap') { st.hunger = clamp(st.hunger - dt * 0.07); st.energy = clamp(st.energy - dt * (0.045 + (sp > 3 ? 0.14 : 0))); }
    st.canTrot = st.energy > 8;
    if (st.energy < 8 && !tiredSaid) { tiredSaid = true; ui.toast('Too tired to trot · find somewhere to nap'); } else if (st.energy > 20) tiredSaid = false;
    if (st.hunger < 15 && (rumbleT -= dt) < 0) { rumbleT = 45; ui.say('Your tummy rumbles.'); }
    if (act) {
      act.t += dt;
      if (act.kind === 'eat') {
        if (act.t > 1.2 && act.dish && !saucer.visible) { const p = api.pos, h = api.heading; saucer.position.set(p.x + Math.sin(h) * 0.34, p.y, p.z + Math.cos(h) * 0.34); saucer.visible = true; saucer.userData.pool.scale.setScalar(1); }
        if (act.t > 1.4) cat.setPose('eat');
        if (saucer.visible) saucer.userData.pool.scale.setScalar(Math.max(0.05, 1 - (act.t - 1.4) / 3));
        if (act.t > act.dur) { if (act.shop) emit('treat', act.shop); cat.setPose(null); saucer.visible = false; st.hunger = clamp(st.hunger + act.amount); if (act.shop) st.served[act.shop] = clock; tone(520, 660, 0.15, 'sine', 0.04); act = null; }
      } else if (act.kind === 'rest') {                    // sitting for a while (listening to the busker, sniffing flowers)
        if (act.t > 0.3 && act.pose) cat.setPose(act.pose);
        if (act.t > act.dur) { const done = act.done; cat.setPose(null); act = null; if (done) done(); }
      } else if (act.kind === 'nap') {
        if (act.t > 1.4 && !act.faded) { act.faded = true; ui.fade(true); }
        if (act.t > 3.2 && !act.slept) {
          act.slept = true; daylight.skip(1); st.energy = 100; st.hunger = clamp(st.hunger - 8);
          emit('nap', act.where); save(`Slept an hour on ${act.where} · game saved`); ui.fade(false);
        }
      }
    }
    if ((saveT -= dt) < 0) save();
    if (card && ((api.pos.x - card.x) ** 2 + (api.pos.z - card.z) ** 2 > 9 || ui.cardId !== card.id)) { if (ui.cardId === card.id) ui.hideCard(); card = null; }
    ui.setNeeds(st.hunger, st.energy);
    if (mapOn && (mapT -= dt) < 0) {
      mapT = 0.1;
      for (const c of cards) c.done = st.postcards.has(c.id);
      map.draw(api.pos.x, api.pos.z, api.heading, marks);
    }
  }

  return {
    add, nearest, use, update, postcard, save,
    /** true while the cat is eating or asleep: movement keys end it */
    get busy() { return !!act; },
    get napping() { return !!act && act.kind === 'nap'; },
    on, emit,
    /** sit (or whatever pose) for dur seconds, then done(); any movement key cuts it short */
    rest({ pose = 'sit', dur = 4, line, done }) { if (line) ui.say(line); act = { kind: 'rest', t: 0, dur, pose, done }; },
    /** a mark on the minimap ({ x, z, kind }); returns it, so it can move or be taken off */
    mark(m) { marks.push(m); return m; },
    unmark(m) { const i = marks.indexOf(m); if (i >= 0) marks.splice(i, 1); },
    /** eat something that is already on the floor (a stolen roll, a chip): { amount, dur, line } */
    eat({ amount, dur = 4, line }) { if (line) ui.say(line); act = { kind: 'eat', t: 0, dur, shop: null, amount, dish: false }; },
    disposition,
    /** curl up right here (a high spot): x, y, z, heading, the name of the place */
    napAt: nap,
    wake() { if (!act) return; if (act.kind === 'nap' && !act.slept) { ui.fade(false); } cat.setPose(null); saucer.visible = false; act = null; },
    get canTrot() { return st.canTrot; },
    /** the id of the info card the game has open, which the landmark cards must leave alone */
    get card() { return card ? card.id : null; },
    toggleMap() { mapOn = !mapOn; ui.showMap(mapOn); },
    state: st, things,
    dispose() { window.removeEventListener('pagehide', onHide); save(); },
  };
}
