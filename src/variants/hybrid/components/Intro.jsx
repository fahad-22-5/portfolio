import React, { useCallback, useEffect, useRef, useState } from 'react';
import Barcode from './Barcode';
import './Intro.css';

// Timeline (ms). Loader -> parcel-sorting scene -> dock door rolls up over the site.
const LOAD_MS = 5000;
const DOOR_CLOSED_MS = 9300; // scene time when the dock door is fully down
const REVEAL_MS = 1100; // door roll-up

const BOOT_LINES = [
  [400, 'Powering conveyors'],
  [1150, 'Handshaking PLC · 12 nodes'],
  [1900, 'Opening RabbitMQ queues'],
  [2650, 'Calibrating scanners'],
  [3400, 'Loading manifest · FEH-2024-SD'],
  [4300, 'Sorter online'],
];

const LOG_LINES = [
  [800, 'induct', 'parcel FEH-2024-SD on belt 01'],
  [3800, 'scan', 'barcode read · 0.04 s'],
  [4600, 'route', 'dest = your next engineering team'],
  [5400, 'sort', 'divert → bay 07'],
  [7300, 'handover', 'client team signed off ✓'],
];

const STEPS = [
  [0, '01', 'Induction'],
  [3600, '02', 'Scan'],
  [5200, '03', 'Sort'],
  [7200, '04', 'Deliver'],
];

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Intro() {
  const [phase, setPhase] = useState(() => (prefersReducedMotion() ? 'done' : 'loading'));
  const [t, setT] = useState(0); // ms since the current phase started
  const phaseStart = useRef(performance.now());

  const goTo = useCallback((next) => {
    phaseStart.current = performance.now();
    setT(0);
    setPhase(next);
  }, []);

  // Clock for the current phase.
  useEffect(() => {
    if (phase === 'done') return undefined;
    const id = setInterval(() => setT(performance.now() - phaseStart.current), 50);
    return () => clearInterval(id);
  }, [phase]);

  // Phase transitions.
  useEffect(() => {
    if (phase === 'loading' && t >= LOAD_MS) goTo('scene');
    else if (phase === 'scene' && t >= DOOR_CLOSED_MS) goTo('reveal');
    else if (phase === 'reveal' && t >= REVEAL_MS) goTo('done');
  }, [phase, t, goTo]);

  // Expose the phase on <html> so the hero can build in as the door rolls up.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.intro = phase === 'done' ? 'done' : phase === 'reveal' ? 'reveal' : 'playing';
  }, [phase]);

  // "Replay intro" (footer) restarts the whole sequence.
  useEffect(() => {
    const replay = () => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); goTo('loading'); };
    window.addEventListener('intro:replay', replay);
    return () => window.removeEventListener('intro:replay', replay);
  }, [goTo]);

  // Lock scrolling and keep the page at the top while the intro plays.
  useEffect(() => {
    if (phase === 'done') {
      // The hero keeps printing for ~2s after the door is up; release scroll after it.
      const id = setTimeout(() => { document.documentElement.style.overflow = ''; }, prefersReducedMotion() ? 0 : 2300);
      return () => clearTimeout(id);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') goTo('reveal'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, goTo]);

  if (phase === 'done') return null;

  const skip = phase !== 'reveal' && (
    <button type="button" className="intro-skip" onClick={() => goTo('reveal')}>
      Skip intro <span aria-hidden="true">→</span>
    </button>
  );

  if (phase === 'reveal') {
    return <Door rolling />;
  }

  if (phase === 'loading') {
    const pct = Math.min(100, Math.round(easeOut(Math.min(t / (LOAD_MS - 300), 1)) * 100));
    return (
      <div className="intro intro--loading" role="status" aria-label={`Loading ${pct}%`}>
        <TopBar right={`BOOT ${String(pct).padStart(3, '0')}%`} />
        {skip}
        <div className={`boot ${t >= LOAD_MS - 320 ? 'boot--out' : ''}`}>
          <div className="boot__head">
            <span className="boot__mark">FEH</span>
            <div>
              <p className="boot__tiny">Sortation control system</p>
              <p className="boot__title">Starting the line</p>
            </div>
          </div>
          <div className="boot__scan">
            <Barcode value="FEH-2024-SD-100K" height={60} />
            <span className="boot__laser" aria-hidden="true" />
          </div>
          <div className="boot__pct tabular">{pct}<span>%</span></div>
          <div className="boot__bar" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={i < Math.round((pct / 100) * 24) ? 'is-on' : ''} />
            ))}
          </div>
          <ul className="boot__lines">
            {BOOT_LINES.map(([at, text]) => (
              <li key={text} className={t >= at ? 'is-on' : ''}>
                <span>{text}</span>
                <span className="boot__ok">{t >= at + 350 ? 'OK' : t >= at ? '…' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Scene
  const step = [...STEPS].reverse().find(([at]) => t >= at);
  const sorted = Math.round(easeOut(Math.min(t / 7600, 1)) * 100000);

  return (
    <div className="intro intro--scene">
      <TopBar right={`T+${(t / 1000).toFixed(1).padStart(4, '0')}s`} />
      {skip}

      <div className="hud hud--log" aria-hidden="true">
        {LOG_LINES.filter(([at]) => t >= at).map(([, k, v]) => (
          <p key={k}><span className="hud__k">&gt; {k}</span>{v}</p>
        ))}
      </div>

      <div className="hud hud--count" aria-hidden="true">
        <p className="hud__label">Parcels sorted · simulated</p>
        <p className="hud__num tabular">{sorted.toLocaleString('en-IN')}</p>
      </div>

      <div className="stage" aria-hidden="true">
        <div className="scanner">
          <span className="scanner__beam" />
          <span className="scanner__laser" />
          <span className="scanner__ok">READ OK</span>
        </div>
        <div className="belt"><span className="belt__surface" /></div>
        <span className="flap" />
        <svg className="chute" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 100,78 100,100 0,22" />
        </svg>
        <div className="bay">
          <span className="bay__tag">Bay 07</span>
          <span className="bay__to">Your next engineering team</span>
          <span className="bay__stamp">✓ Signed off</span>
        </div>

        <div className="parcel-run">
          <div className="box">
            <span className="box__tape" />
            <span className="box__label">
              <span>FEH</span>
              <Barcode value="FEH" height={14} />
            </span>
          </div>
        </div>
      </div>

      <div className="tracker" aria-hidden="true">
        {STEPS.map(([at, n, name], i) => {
          const end = i < STEPS.length - 1 ? STEPS[i + 1][0] : 8400;
          return (
            <div className={`tracker__seg ${t >= at ? 'is-on' : ''}`} key={n}>
              <span className="tracker__bar">
                <span className="tracker__fill" style={{ animationDelay: `${at}ms`, animationDuration: `${end - at}ms` }} />
              </span>
              <span className="tracker__name">{n} · {name}</span>
            </div>
          );
        })}
      </div>

      {step && (
        <p className="step" key={step[1]} aria-hidden="true">
          <span className="step__n">{step[1]}</span>
          <span className="step__name">{step[2]}</span>
        </p>
      )}

      <div className="finale">
        <p className="finale__eyebrow">Fahad Eqbal Hashmi · Software Engineer</p>
        <p className="finale__title">Every parcel, sorted.</p>
        <p className="finale__sub">I build the systems behind 100,000 a day.</p>
      </div>

      <Door />
      <p className="sr-only" role="status">Intro animation playing. Press Escape to skip.</p>
    </div>
  );
}

function TopBar({ right }) {
  return (
    <div className="intro-top" aria-hidden="true">
      <span><span className="intro-dot" /> FEH Sortation · Dock 01</span>
      <span className="tabular">{right}</span>
    </div>
  );
}

function Door({ rolling = false }) {
  return (
    <div className={`door ${rolling ? 'door--rolling' : 'door--closing'}`} aria-hidden="true">
      <div className="door__panel">
        <p className="door__code">Dock 01</p>
        <p className="door__name">Fahad Eqbal Hashmi</p>
        <p className="door__sub">Now open · scroll the manifest</p>
      </div>
      <span className="door__handle" />
    </div>
  );
}
