import React, { useCallback, useEffect, useRef, useState } from 'react';
import Barcode from './Barcode';
import Segments from './Segments';
import './Intro.css';

// Same timeline as the manifest intro, drawn as a comic issue.
const LOAD_MS = 5000;
const DOOR_CLOSED_MS = 9300;
const REVEAL_MS = 1100;

const OBJECTIVES = [
  [400, 'Power up the conveyors'],
  [1150, 'Shake hands with the PLC'],
  [1900, 'Open the RabbitMQ queues'],
  [2650, 'Calibrate the scanners'],
  [3400, 'Load manifest FEH-2024-SD'],
  [4300, 'Sorter online!'],
];

const LOG_LINES = [
  [800, 'Induct', 'Parcel FEH-2024-SD on belt 01'],
  [3800, 'Scan', 'Barcode read in 0.04 s'],
  [4600, 'Route', 'Dest: your next engineering team'],
  [5400, 'Sort', 'Divert to bay 07'],
  [7300, 'Handover', 'Client team signed off!'],
];

const STEPS = [
  [0, '01', 'Induction', 'Meanwhile, at Dock 01…'],
  [3600, '02', 'Scan', 'The scanner locks on…'],
  [5200, '03', 'Sort', 'Divert to bay 07!'],
  [7200, '04', 'Deliver', 'Right on time.'],
];

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Intro() {
  const [phase, setPhase] = useState(() => (prefersReducedMotion() ? 'done' : 'loading'));
  const [t, setT] = useState(0);
  const phaseStart = useRef(performance.now());

  const goTo = useCallback((next) => {
    phaseStart.current = performance.now();
    setT(0);
    setPhase(next);
  }, []);

  useEffect(() => {
    if (phase === 'done') return undefined;
    const id = setInterval(() => setT(performance.now() - phaseStart.current), 50);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'loading' && t >= LOAD_MS) goTo('scene');
    else if (phase === 'scene' && t >= DOOR_CLOSED_MS) goTo('reveal');
    else if (phase === 'reveal' && t >= REVEAL_MS) goTo('done');
  }, [phase, t, goTo]);

  useEffect(() => {
    if (phase === 'done') {
      document.documentElement.style.overflow = '';
      return undefined;
    }
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') goTo('reveal'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, goTo]);

  if (phase === 'done') return null;
  if (phase === 'reveal') return <Door rolling />;

  const skip = (
    <button type="button" className="cx-skip" onClick={() => goTo('reveal')}>
      Skip intro <span aria-hidden="true">→</span>
    </button>
  );

  if (phase === 'loading') {
    const pct = Math.min(100, Math.round(easeOut(Math.min(t / (LOAD_MS - 300), 1)) * 100));
    const done = OBJECTIVES.filter(([at]) => t >= at + 350).length;
    return (
      <div className="cx cx--loading" role="status" aria-label={`Loading ${pct}%`}>
        <TopBar right={`Loading ${String(pct).padStart(3, '0')}%`} />
        {skip}
        <div className="cx-boot">
          <div className="cx-boot__top">
            <span className="cx-badge">⚡ The 100K Shift</span>
            <span className="cx-boot__issue">Issue #01</span>
          </div>
          <p className="cx-boot__title">Starting the line…</p>
          <div className="cx-boot__row">
            <div className="cx-burst" aria-hidden="true">
              <span className="cx-burst__pct">{pct}<small>%</small></span>
            </div>
            <div className="cx-boot__scan">
              <Barcode value="FEH-2024-SD-100K" height={58} />
              <span className="cx-boot__laser" aria-hidden="true" />
            </div>
          </div>
          <Segments total={6} done={done} active={done < 6 ? done : -1} label={`${done} of 6 objectives`} />
          <ul className="cx-boot__list">
            {OBJECTIVES.map(([at, text]) => (
              <li key={text} className={t >= at ? 'is-on' : ''}>
                <span className="cx-boot__star" aria-hidden="true">★</span>
                <span>{text}</span>
                {t >= at + 350 && <span className="cx-stamp">OK!</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const step = [...STEPS].reverse().find(([at]) => t >= at);
  const sorted = Math.round(easeOut(Math.min(t / 7600, 1)) * 100000);

  return (
    <div className="cx cx--scene">
      <TopBar right={`Page ${step ? step[1] : '01'} · T+${(t / 1000).toFixed(1)}s`} />
      {skip}

      {step && (
        <p className="cx-caption" key={`c${step[1]}`} aria-hidden="true">{step[3]}</p>
      )}

      <div className="cx-log" aria-hidden="true">
        <p className="cx-log__head">Mission log</p>
        {LOG_LINES.filter(([at]) => t >= at).map(([, k, v]) => (
          <p key={k} className="cx-log__line"><span>{k}</span>{v}</p>
        ))}
      </div>

      <div className="cx-count" aria-hidden="true">
        <p className="cx-count__label"><span>Parcels sorted</span><span className="cx-live">Sim</span></p>
        <p className="cx-count__num tabular">{sorted.toLocaleString('en-IN')}</p>
      </div>

      <div className="cx-stage" aria-hidden="true">
        <div className="cx-scanner">
          <span className="cx-scanner__eye" />
          <span className="cx-scanner__laser" />
        </div>
        <div className="cx-belt"><span className="cx-belt__surface" /></div>
        <span className="cx-flap" />
        <svg className="cx-chute" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points="0,0 100,78 100,100 0,22" />
        </svg>
        <div className="cx-bay">
          <span className="cx-bay__tag">Bay 07</span>
          <span className="cx-bay__to">Your next engineering team</span>
        </div>
        <div className="cx-parcel">
          <div className="cx-box">
            <span className="cx-box__tape" />
            <span className="cx-box__label">
              <span>FEH</span>
              <Barcode value="FEH" height={14} />
            </span>
          </div>
        </div>

      </div>

      {step && (
        <p className="cx-step" key={step[1]} aria-hidden="true">
          <span className="cx-step__n">{step[1]}</span>
          <span className="cx-step__name">{step[2]}</span>
        </p>
      )}

      <div className="cx-finale">
        <p className="cx-finale__title">Every parcel, sorted!</p>
        <p className="cx-finale__sub">I build the systems behind 100,000 a day.</p>
      </div>

      <Door />
      <p className="sr-only" role="status">Intro animation playing. Press Escape to skip.</p>
    </div>
  );
}

function TopBar({ right }) {
  return (
    <div className="cx-top" aria-hidden="true">
      <span className="cx-top__brand"><span className="cx-top__mark">FEH</span> Sortation Comics</span>
      <span className="cx-top__right tabular">{right}</span>
    </div>
  );
}

function Door({ rolling = false }) {
  return (
    <div className={`cx-door ${rolling ? 'cx-door--rolling' : 'cx-door--closing'}`} aria-hidden="true">
      <div className="cx-door__panel">
        <p className="cx-door__code">Dock 01 · Issue #01</p>
        <p className="cx-door__name">Fahad Eqbal Hashmi</p>
        <p className="cx-door__sub">Now open — read on!</p>
      </div>
      <span className="cx-door__handle" />
    </div>
  );
}
