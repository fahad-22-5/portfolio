/**
 * Quests: small goals built on what the cat can already do, and a journal to keep track (J).
 *
 * Each quest reads a counter in game.state.stats (or other saved state) and is done when it reaches its
 * goal. The counters move on the game's events (game.emit): a treat at a counter, a flock scattered, a
 * bus ride, a bit of mischief, the busker, the flower stall, the red balloon. Done quests are saved in
 * game.state.quests. Finish them all and Hammersmith knows your name.
 */
import { LANDMARKS } from '../mapData.js';

const CSS = `
.hs-journal{position:absolute;left:16px;top:64px;width:min(360px,calc(100% - 32px));max-height:calc(100% - 210px);overflow:auto;background:#fbfaf6;color:#111;border-radius:6px;padding:5px;box-shadow:0 10px 40px rgba(0,0,0,.55);opacity:0;transform:translateY(-8px);transition:opacity .2s,transform .2s;pointer-events:none}
.hs-journal.on{opacity:1;transform:none;pointer-events:auto}
.hs-journal-in{border:3px solid #111;border-radius:3px;padding:10px 14px 12px}
.hs-journal h3{margin:2px 0 8px;font-size:20px;text-transform:uppercase;letter-spacing:.03em;display:flex;justify-content:space-between;align-items:baseline}
.hs-journal h3 span{font-size:13px;color:#c8102e;letter-spacing:.06em}
.hs-q{padding:7px 0;border-top:1px solid #ddd}
.hs-q b{font-size:14px}
.hs-q.done b{color:#2c7a3f}
.hs-q.done b::before{content:"✓ "}
.hs-q p{margin:2px 0 0;font-size:13px;line-height:1.4;color:#333}
.hs-q i{display:block;font-size:12px;color:#777;margin-top:2px}
.hs-q .hs-qbar{height:5px;background:#e5e2da;border-radius:3px;margin-top:5px;overflow:hidden}
.hs-q .hs-qbar u{display:block;height:100%;background:#c8102e;text-decoration:none}
.hs-q.done .hs-qbar{display:none}
.hs-journal small{display:block;font-size:11px;color:#888;margin-top:8px}
`;

export function createQuests({ root, ui, game, tone, parkour, daylight }) {
  const st = game.state, S = st.stats;
  const set = (k) => (S[k] = Array.isArray(S[k]) ? S[k] : []);
  const add = (k, v) => { const a = set(k); if (!a.includes(v)) a.push(v); };
  const inc = (k) => { S[k] = (S[k] || 0) + 1; };
  const cards = LANDMARKS.filter((l) => l.x !== undefined).length;

  const QUESTS = [
    { id: 'feud', title: 'The Bute Gardens feud', text: 'Make peace with the tuxedo stray who runs Bute Gardens.', hint: 'Stare him down until he respects you, or bring him something tasty.', goal: 1, have: () => (st.stray && st.stray.friend ? 1 : 0) },
    { id: 'heights', title: 'Top cat', text: 'Find every high spot.', hint: 'Space leaps onto things. Look up: kiosk roofs, the bus shelter, the totems, parked cars, a tall hedge.', goal: () => parkour.names.length, have: () => st.perches.size },
    { id: 'cafes', title: 'Café crawl', text: 'Get a treat at four different counters.', hint: 'Meow at a café counter, or at the till in Oseyo.', goal: 4, have: () => set('cafes').length },
    { id: 'roll', title: 'Lunch on the run', text: 'Steal a sausage roll from Greggs and eat it.', hint: 'Wait until nobody behind the counter is looking. If they see you, trot.', goal: 1, have: () => S.rolls || 0 },
    { id: 'pigeons', title: 'Pigeon patrol', text: 'Scatter three different flocks of pigeons.', hint: 'Forecourt, bus stop, Bute Gardens. Trot at them, or creep up and pounce.', goal: 3, have: () => set('flocks').length },
    { id: 'bus', title: 'Top deck', text: 'Ride a bus and get off at a stop.', hint: 'Up the lift to the bus station; hop on at an open door.', goal: 1, have: () => S.rides || 0 },
    { id: 'trouble', title: 'Troublemaker', text: 'Get into four different kinds of trouble.', hint: 'Greggs, Tesco\'s shelves, begging at McDonald\'s, the flower stall\'s buckets.', goal: 4, have: () => set('mischief').length },
    { id: 'busker', title: 'Front row', text: 'Sit and listen to the busker in the station entrance.', hint: 'Plays from 11:00 to 17:00.', goal: 1, have: () => S.busker || 0 },
    { id: 'flowers', title: 'Stop and smell the flowers', text: 'Have a sniff at the flower stall outside the station.', hint: 'Open from 8:00 to 18:00.', goal: 1, have: () => S.sniff || 0 },
    { id: 'balloon', title: 'The red balloon', text: 'Bring back someone\'s lost balloon.', hint: 'Afternoons, somewhere outside. It will be stuck somewhere high.', goal: 1, have: () => S.balloons || 0 },
    { id: 'owl', title: 'Night owl', text: 'Watch the city from a high spot after dark.', hint: 'Between 21:00 and 5:00. T skips an hour.', goal: 1, have: () => S.owl || 0 },
    { id: 'postcards', title: 'Wish you were here', text: 'Collect every postcard.', hint: 'Inspect the landmarks: the white stars on the map.', goal: cards, have: () => st.postcards.size },
  ];
  const goalOf = (q) => (typeof q.goal === 'function' ? q.goal() : q.goal);
  const done = new Set(st.quests);
  const seen = {}; for (const q of QUESTS) seen[q.id] = Math.min(q.have(), goalOf(q));

  /* ---------- the counters ---------- */
  game.on('treat', (shop) => add('cafes', shop));
  game.on('roll', () => inc('rolls'));
  game.on('flush', (i) => add('flocks', i));
  game.on('ride', () => inc('rides'));
  game.on('mischief', (k) => add('mischief', k));
  game.on('busker', () => inc('busker'));
  game.on('sniff', () => inc('sniff'));
  game.on('balloon', () => inc('balloons'));
  game.on('*', () => { checkT = 0.3; });          // look again shortly after anything happens

  /* ---------- checking ---------- */
  let checkT = 2, owlT = 0, finalSaid = done.size === QUESTS.length;
  function check() {
    let changed = false;
    for (const q of QUESTS) {
      if (done.has(q.id)) continue;
      const g = goalOf(q), h = Math.min(q.have(), g);
      if (h >= g) {
        done.add(q.id); st.quests = [...done]; changed = true;
        ui.toast(`Quest complete · ${q.title}`, 3600);
        tone(660, 660, 0.12, 'triangle', 0.04); setTimeout(() => tone(880, 880, 0.12, 'triangle', 0.04), 130); setTimeout(() => tone(1320, 1320, 0.25, 'triangle', 0.04), 260);
      } else if (h > seen[q.id] && g > 1) ui.toast(`${q.title} · ${h}/${g}`, 2600);
      seen[q.id] = h;
    }
    if (changed) { game.save(); render(); }
    if (!finalSaid && done.size === QUESTS.length) { finalSaid = true; setTimeout(() => ui.toast('Every quest done · Hammersmith\'s favourite cat', 5000), 3800); }
  }

  /* ---------- the journal ---------- */
  if (!document.getElementById('hs-journal-style')) { const s = document.createElement('style'); s.id = 'hs-journal-style'; s.textContent = CSS; document.head.appendChild(s); }
  const box = document.createElement('div'); box.className = 'hs-journal'; root.appendChild(box);
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function render() {
    if (!box.classList.contains('on')) return;
    const items = QUESTS.map((q) => {
      const g = goalOf(q), h = Math.min(q.have(), g), ok = done.has(q.id);
      return `<div class="hs-q${ok ? ' done' : ''}"><b>${esc(q.title)}</b>${g > 1 && !ok ? ` <span style="font-size:12px;color:#777">${h}/${g}</span>` : ''}<p>${esc(q.text)}</p>${ok ? '' : `<i>${esc(q.hint)}</i>`}<div class="hs-qbar"><u style="width:${Math.round(h / g * 100)}%"></u></div></div>`;
    }).join('');
    box.innerHTML = `<div class="hs-journal-in"><h3>Journal <span>${done.size}/${QUESTS.length} done</span></h3>${items}<small>J closes the journal</small></div>`;
  }

  function update(dt) {
    if ((owlT -= dt) < 0) {                       // night owl: up on a high spot after dark
      owlT = 1;
      const hr = daylight.hour;
      if (!S.owl && parkour.onPerch && (hr >= 21 || hr < 5)) { S.owl = 1; ui.say('The lights of Hammersmith, all yours.'); }
    }
    if ((checkT -= dt) < 0) { checkT = 2; check(); }
  }

  return {
    update, list: QUESTS, done,
    toggle() { box.classList.toggle('on'); render(); },
    get open() { return box.classList.contains('on'); },
  };
}
