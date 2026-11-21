const CSS = `
.hs-root{position:relative;width:100%;height:100%;overflow:hidden;background:#141b2e;font-family:"Gill Sans","Gill Sans MT","Trebuchet MS",Arial,sans-serif;color:#fff;user-select:none;-webkit-user-select:none}
.hs-root canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none}
.hs-root canvas:active{cursor:grabbing}
.hs-top{position:absolute;top:16px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;pointer-events:none}
.hs-back{pointer-events:auto;color:#fff;text-decoration:none;background:rgba(12,16,28,.72);border:1px solid rgba(255,255,255,.18);padding:8px 14px;border-radius:999px;font-size:14px;backdrop-filter:blur(6px)}
.hs-back:hover{background:rgba(220,36,31,.9)}
.hs-level{background:#0019a8;border-radius:4px;padding:8px 14px;font-size:14px;font-weight:700;letter-spacing:.04em;box-shadow:0 2px 12px rgba(0,0,0,.4)}
.hs-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.hs-clock{background:rgba(12,16,28,.72);border:1px solid rgba(255,255,255,.18);border-radius:4px;padding:4px 10px;font-size:12px;letter-spacing:.03em;backdrop-filter:blur(6px)}
.hs-clock:empty{display:none}
.hs-map{width:168px;height:168px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.8);box-shadow:0 2px 14px rgba(0,0,0,.45);background:#cfc9bc}
.hs-map.off{display:none}
.hs-root .hs-map canvas{width:100%;height:100%;cursor:default}
.hs-needs{width:168px;display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;background:rgba(12,16,28,.72);border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:6px 9px;font-size:11px;letter-spacing:.03em;backdrop-filter:blur(6px)}
.hs-bar{height:7px;background:rgba(255,255,255,.16);border-radius:4px;overflow:hidden}
.hs-bar i{display:block;height:100%;border-radius:4px;transition:width .5s,background .5s}
.hs-toast{position:absolute;left:50%;top:64px;transform:translate(-50%,-6px);background:rgba(12,16,28,.86);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:8px 16px;font-size:14px;white-space:nowrap;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none}
.hs-toast.on{opacity:1;transform:translate(-50%,0)}
.hs-fade{position:absolute;inset:0;background:#05070c;opacity:0;transition:opacity 1.3s;pointer-events:none}
.hs-fade.on{opacity:.92}
.hs-bubble.long{font-size:15px;font-weight:600;max-width:min(440px,80vw);white-space:normal;text-align:center;line-height:1.35}
.hs-help{position:absolute;left:16px;bottom:16px;background:rgba(12,16,28,.72);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.7;backdrop-filter:blur(6px);pointer-events:none}
.hs-help b,.hs-prompt b{display:inline-block;min-width:1.5em;text-align:center;background:#fff;color:#111;border-radius:4px;padding:0 5px;margin-right:4px;font-size:12px}
.hs-prompt{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);background:rgba(12,16,28,.82);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:9px 18px;font-size:15px;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none}
.hs-prompt.on{opacity:1}
.hs-bubble{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);background:#fff;color:#111;font-weight:700;border-radius:16px;padding:6px 14px;font-size:18px;opacity:0;transition:opacity .15s,transform .15s;pointer-events:none}
.hs-bubble.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.hs-card{position:absolute;right:16px;bottom:16px;width:min(380px,calc(100% - 32px));background:#fbfaf6;color:#111;border-radius:6px;padding:5px;box-shadow:0 10px 40px rgba(0,0,0,.55);transform:translateY(20px);opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}
.hs-card.on{opacity:1;transform:none}
.hs-card-in{border:3px solid #111;border-radius:3px;padding:12px 16px 14px}
.hs-borough{color:#c8102e;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.hs-title{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:26px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;line-height:1.1;margin:4px 0 6px}
.hs-title span:last-child{color:#c8102e;font-size:22px}
.hs-sub{font-size:14px;font-weight:700;border-top:1px solid #bbb;padding-top:8px}
.hs-body{font-size:14px;line-height:1.5;margin-top:6px;color:#333}
.hs-memory{font-size:14px;line-height:1.5;margin-top:8px;padding-left:10px;border-left:3px solid #c8102e;font-style:italic}
.hs-memory:empty{display:none}
@media (max-width:640px){.hs-help{display:none}.hs-title{font-size:20px}.hs-map{width:112px;height:112px}.hs-needs{width:112px}.hs-toast{white-space:normal;max-width:80vw;text-align:center}}
`;

export function createUI(root, { portfolioUrl, portfolioLabel }) {
  if (!document.getElementById('hs-style')) {
    const s = document.createElement('style'); s.id = 'hs-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="hs-fade"></div><div class="hs-top"><a class="hs-back"></a><div class="hs-right"><div class="hs-level"></div><div class="hs-clock"></div><div class="hs-map"><canvas width="336" height="336"></canvas></div><div class="hs-needs"><span>Food</span><div class="hs-bar"><i class="hs-food"></i></div><span>Energy</span><div class="hs-bar"><i class="hs-energy"></i></div></div></div></div><div class="hs-toast"></div>
    <div class="hs-help"><b>W</b><b>A</b><b>S</b><b>D</b> walk &amp; turn<br><b>Shift</b> trot &nbsp; <b>Space</b> jump<br><b>E</b> interact / meow &nbsp; drag to look<br><b>T</b> time &nbsp; <b>Y</b> weather &nbsp; <b>M</b> map &nbsp; <b>J</b> journal</div>
    <div class="hs-prompt"></div><div class="hs-bubble">Meow!</div>
    <div class="hs-card"><div class="hs-card-in"><div class="hs-borough">London Borough of Hammersmith &amp; Fulham</div>
      <div class="hs-title"><span></span><span></span></div><div class="hs-sub"></div><div class="hs-body"></div><div class="hs-memory"></div></div></div>`;
  const nodes = [...el.children];
  nodes.forEach((n) => root.appendChild(n));
  const q = (c) => root.querySelector(c);
  const back = q('.hs-back'), level = q('.hs-level'), clock = q('.hs-clock'), prompt = q('.hs-prompt'), bubble = q('.hs-bubble'), card = q('.hs-card');
  const mapBox = q('.hs-map'), food = q('.hs-food'), energy = q('.hs-energy'), toastEl = q('.hs-toast'), fadeEl = q('.hs-fade');
  let needsKey = '', toastTimer = 0;
  const barColour = (v) => (v > 50 ? '#7bd389' : v > 20 ? '#f2b134' : '#e4572e');
  back.href = portfolioUrl; back.textContent = `← ${portfolioLabel}`;
  const [tName, tCode] = q('.hs-title').children;
  let promptText = '', levelText = '', clockText = '', bubbleTimer = 0, cardId = null;

  return {
    // These only touch the DOM when the value changes, so they are safe to call every frame.
    setPrompt(text) {
      if (text === promptText) return;
      promptText = text;
      if (text) prompt.innerHTML = text.includes('[E]') || text.includes('[Space]') ? text.replace('[E]', '<b>E</b>').replace('[Space]', '<b>Space</b>') : (/^(Going|Step|On the|Down the)/.test(text) ? text : `<b>E</b> ${text}`);
      prompt.classList.toggle('on', !!text);
    },
    setLevel(text) { if (text !== levelText) { levelText = text; level.textContent = text; } },
    setClock(text) { if (text !== clockText) { clockText = text; clock.textContent = text; } },
    /** the minimap's canvas (drawn by game/minimap.js) */
    mapCanvas: mapBox.firstChild,
    showMap(on) { mapBox.classList.toggle('off', !on); },
    setNeeds(h, e) {
      const k = Math.round(h) + ',' + Math.round(e); if (k === needsKey) return; needsKey = k;
      food.style.width = h.toFixed(0) + '%'; food.style.background = barColour(h); energy.style.width = e.toFixed(0) + '%'; energy.style.background = barColour(e);
    },
    toast(text, ms = 2800) { toastEl.textContent = text; toastEl.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms); },
    /** a longer line in the speech bubble: what someone says, or what happens */
    say(text, ms = 2600) { bubble.textContent = text; bubble.classList.add('on', 'long'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('on', 'long'), ms); },
    fade(on) { fadeEl.classList.toggle('on', on); },
    meow(text = 'Meow!') {
      bubble.textContent = text; bubble.classList.remove('long'); bubble.classList.add('on');
      clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => bubble.classList.remove('on'), 900);
    },
    get cardId() { return cardId; },
    showCard(id, c) {
      cardId = id;
      tName.textContent = c.title; tCode.textContent = c.code || 'W6';
      q('.hs-sub').textContent = c.sub || ''; q('.hs-body').textContent = c.body || ''; q('.hs-memory').textContent = c.memory || '';
      card.classList.add('on');
    },
    hideCard() { if (cardId !== null) { cardId = null; card.classList.remove('on'); } },
    dispose() { clearTimeout(bubbleTimer); clearTimeout(toastTimer); nodes.forEach((n) => n.remove()); },
  };
}
