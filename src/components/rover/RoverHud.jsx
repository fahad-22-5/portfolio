import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SIGNAL_TOWERS, DATA_CACHES, SKILL_MODULES } from './roverContent';
import './RoverHud.css';

const TOAST_MS = { cache: 6500, module: 5000, quote: 5500 };

/** Press-and-hold touch button that mirrors its state onto bus.input. */
function HoldButton({ bus, action, icon, label }) {
  const set = (down) => (e) => {
    e.preventDefault();
    bus.input[action] = down;
    if (down && navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* unsupported */ } }
  };
  return (
    <button
      type="button"
      className={`rover-touch__btn rover-touch__btn--${action}`}
      onTouchStart={set(true)} onTouchEnd={set(false)} onTouchCancel={set(false)}
      onMouseDown={set(true)} onMouseUp={set(false)} onMouseLeave={set(false)}
    >
      <span className="rover-touch__icon">{icon}</span>
      <span className="rover-touch__label">{label}</span>
    </button>
  );
}

/**
 * HUD for the rover missions: tracker, skill log, boost meter, repair bar,
 * pizza timer, toasts and the experience / VIP / pizza-result cards.
 * Discrete updates arrive over `bus`; per-frame values are written by the
 * game loop straight into the nodes registered on `bus.dom`.
 */
function RoverHud({ bus, hidden, showTouch, stealth, resumeUrl }) {
  const [towers, setTowers] = useState([]);
  const [caches, setCaches] = useState([]);
  const [modules, setModules] = useState([]);
  const [bugCaught, setBugCaught] = useState(false);
  const [pizzaBest, setPizzaBest] = useState(0);
  const [pizzaRunning, setPizzaRunning] = useState(false);
  const [card, setCard] = useState(null);     // { type: 'tower' | 'vip' | 'pizza', data }
  const [toasts, setToasts] = useState([]);   // [{ id, type, data }]
  const [logOpen, setLogOpen] = useState(false);
  const toastId = useRef(0);

  const pushToast = useCallback((type, data) => {
    const id = ++toastId.current;
    setToasts((list) => [...list.slice(-1), { id, type, data }]); // at most two on screen
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), TOAST_MS[type]);
  }, []);

  useEffect(() => {
    const add = (setter) => (def) => setter((list) => (list.some((d) => d.id === def.id) ? list : [...list, def]));
    const offs = [
      bus.on('tower', (def) => { add(setTowers)(def); setCard({ type: 'tower', data: def }); }),
      bus.on('cache', (def) => { add(setCaches)(def); pushToast('cache', def); }),
      bus.on('module', (def) => { add(setModules)(def); pushToast('module', def); }),
      bus.on('quote', (quote) => pushToast('quote', quote)),
      bus.on('bug', (vip) => { setBugCaught(true); setCard({ type: 'vip', data: { ...vip, fresh: true } }); }),
      bus.on('vip', (vip) => setCard({ type: 'vip', data: vip })),
      bus.on('pizza-start', ({ best }) => { setPizzaRunning(true); setPizzaBest(best); }),
      bus.on('pizza-end', (result) => {
        setPizzaRunning(false);
        setPizzaBest(result.best);
        setCard({ type: 'pizza', data: result });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [bus, pushToast]);

  // Enter / Escape dismiss the open card
  useEffect(() => {
    if (!card) return undefined;
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') setCard(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card]);

  const dom = (name) => (node) => { bus.dom[name] = node; };
  const skills = modules.flatMap((m) => m.skills);

  if (hidden) return null;

  return (
    <div className={`rover-hud ${showTouch ? 'rover-hud--touch' : ''}`}>
      {/* ── Mission tracker ── */}
      <div className="rover-tracker">
        <button type="button" className="rover-tracker__bar" onClick={() => setLogOpen((o) => !o)} title="Toggle mission log">
          <span className="rover-tracker__stat" title="Signal Towers — Work Experience">📡 {towers.length}/{SIGNAL_TOWERS.length}</span>
          <span className="rover-tracker__stat" title="Data Caches — Achievements">💎 {caches.length}/{DATA_CACHES.length}</span>
          <span className="rover-tracker__stat" title="Power-Up Modules — Skills">🧩 {modules.length}/{SKILL_MODULES.length}</span>
          <span className={`rover-tracker__stat ${bugCaught ? '' : 'rover-tracker__stat--dim'}`} title="Radioactive Bug">🐞</span>
          <span className={`rover-tracker__stat ${pizzaBest ? '' : 'rover-tracker__stat--dim'}`} title="Pizza Time best score">🍕{pizzaBest ? ` ${pizzaBest}` : ''}</span>
          {stealth && <span className="rover-tracker__stat" title="Stealth Mode: +30% speed">◼</span>}
          <span className="rover-tracker__caret">{logOpen ? '▲' : '▼'}</span>
        </button>

        {logOpen && (
          <div className="rover-log">
            <h4>📡 Signal Towers <small>repair to unlock work experience</small></h4>
            {SIGNAL_TOWERS.map((t) => {
              const done = towers.some((d) => d.id === t.id);
              return (
                <button
                  type="button" key={t.id} disabled={!done}
                  className="rover-log__row"
                  onClick={() => setCard({ type: 'tower', data: t })}
                >
                  {done ? `✓ ${t.role} · ${t.company}` : `⚠ ${t.callSign} — signal lost`}
                </button>
              );
            })}
            <h4>💎 Data Caches <small>hidden behind ramps & props</small></h4>
            {caches.length === 0 && <p className="rover-log__empty">None found yet.</p>}
            {caches.map((c) => <p key={c.id} className="rover-log__row">{c.icon} {c.title}</p>)}
            <h4>🧩 Tech Stack <small>from power-up modules</small></h4>
            {modules.length === 0 && <p className="rover-log__empty">Collect modules to log skills.</p>}
            {modules.map((m) => (
              <p key={m.id} className="rover-log__row" style={{ color: m.css }}>{m.name} — {m.perk}</p>
            ))}
          </div>
        )}

        {/* Skill log: grows as modules are collected */}
        {skills.length > 0 && !logOpen && (
          <div className="rover-skills">
            {skills.slice(-10).map((s) => <span key={s} className="rover-skills__chip">{s}</span>)}
            {skills.length > 10 && <span className="rover-skills__chip rover-skills__chip--more">+{skills.length - 10}</span>}
          </div>
        )}
      </div>

      {/* ── Boost meter ── */}
      <div className="rover-boost" ref={dom('boostMeter')}>
        <span className="rover-boost__label">BOOST{showTouch ? '' : ' [SHIFT]'}</span>
        <div className="rover-boost__bar"><div className="rover-boost__fill" ref={dom('boostFill')} /></div>
      </div>

      {/* ── Tower repair progress ── */}
      <div className="rover-repair" ref={dom('repair')} style={{ display: 'none' }}>
        <span className="rover-repair__label" ref={dom('repairLabel')} />
        <div className="rover-repair__bar"><div className="rover-repair__fill" ref={dom('repairFill')} /></div>
      </div>

      {/* ── Pizza Time countdown ── */}
      {pizzaRunning && (
        <div className="rover-pizza">
          <span className="rover-pizza__icon">🍕</span>
          <span className="rover-pizza__time" ref={dom('pizzaTime')}>15.0s</span>
          <svg className="rover-pizza__arrow" ref={dom('pizzaArrow')} viewBox="0 0 24 24" width="20" height="20">
            <polygon points="12,2 21,20 12,16 3,20" />
          </svg>
          <span className="rover-pizza__dist" ref={dom('pizzaDist')} />
        </div>
      )}

      {/* ── Toasts: achievements, modules, dev quotes ── */}
      <div className="rover-toasts">
        {toasts.map(({ id, type, data }) => (
          <div key={id} className={`rover-toast rover-toast--${type}`}>
            {type === 'cache' && (
              <>
                <span className="rover-toast__tag">💎 ACHIEVEMENT UNLOCKED</span>
                <strong>{data.icon} {data.title}</strong>
                <p>{data.detail}</p>
                {data.meta && <small>{data.meta}</small>}
              </>
            )}
            {type === 'module' && (
              <>
                <span className="rover-toast__tag" style={{ color: data.css }}>🧩 {data.name.toUpperCase()} INSTALLED</span>
                <strong>{data.perk}</strong>
                <p>{data.title}: {data.skills.join(' · ')}</p>
              </>
            )}
            {type === 'quote' && <p className="rover-toast__quote">“{data.text}”</p>}
          </div>
        ))}
      </div>

      {/* ── Touch actions ── */}
      {showTouch && (
        <div className="rover-touch">
          <HoldButton bus={bus} action="grapple" icon="🕸️" label="WEB" />
          <HoldButton bus={bus} action="drift" icon="💨" label="DRIFT" />
          <HoldButton bus={bus} action="boost" icon="⚡" label="BOOST" />
        </div>
      )}

      {/* ── Cards ── */}
      {card && (
        <div className="rover-card-overlay" onClick={() => setCard(null)}>
          <div className={`rover-card rover-card--${card.type}`} onClick={(e) => e.stopPropagation()}>
            {card.type === 'tower' && (
              <>
                <span className="rover-card__tag" style={{ background: card.data.css }}>📡 {card.data.callSign} BACK ONLINE</span>
                <h2 className="rover-card__title">{card.data.role}</h2>
                <p className="rover-card__sub">{card.data.company} · {card.data.period} · {card.data.location}</p>
                <ul className="rover-card__list">
                  {card.data.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <div className="rover-card__chips">
                  {card.data.tech.map((t) => <span key={t}>{t}</span>)}
                </div>
              </>
            )}

            {card.type === 'vip' && (
              <>
                <span className="rover-card__tag rover-card__tag--gold">★ VIP TERMINAL{card.data.fresh ? ' UNLOCKED' : ''}</span>
                <h2 className="rover-card__title">{card.data.fresh ? 'You caught the Radioactive Bug!' : 'Let’s build something.'}</h2>
                <p className="rover-card__sub">
                  {card.data.fresh
                    ? 'Anyone who chases a bug that hard deserves the direct line. The terminal is now marked ★ on your radar.'
                    : 'Open to backend, automation and systems roles.'}
                </p>
                <div className="rover-card__actions">
                  <a className="rover-card__btn rover-card__btn--primary" href={`mailto:${card.data.email}?subject=Let's%20talk`}>✉️ Hire Me</a>
                  <a className="rover-card__btn" href={card.data.linkedin} target="_blank" rel="noopener noreferrer">💼 LinkedIn</a>
                  <a className="rover-card__btn" href={resumeUrl} target="_blank" rel="noopener noreferrer">📄 Résumé</a>
                </div>
              </>
            )}

            {card.type === 'pizza' && (
              <>
                <span className="rover-card__tag rover-card__tag--gold">🍕 PIZZA TIME</span>
                <h2 className="rover-card__title">
                  {card.data.success ? `Delivered with ${card.data.timeLeft.toFixed(1)}s to spare!` : 'Too slow — the pizza went cold.'}
                </h2>
                <p className="rover-card__sub">
                  {card.data.success
                    ? `+${card.data.points} pts${card.data.isBest ? ' · 🏅 NEW HIGH SCORE BADGE' : ''} · Best: ${card.data.best}`
                    : `Tip: hold boost and drift the corners. Best: ${card.data.best || '—'}`}
                </p>
              </>
            )}

            <button type="button" className="rover-card__close" onClick={() => setCard(null)}>
              Keep Driving →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoverHud;
