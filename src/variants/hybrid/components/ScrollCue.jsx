import React, { useEffect, useState } from 'react';

// "Scroll for more" cue: appears only if the visitor is still at the top a
// few seconds after the hero has finished printing, hides the moment they
// scroll, and can come back if they return to the top and sit idle again.
const PRINT_TAIL_MS = 2300; // hero keeps printing after the intro hands off
const IDLE_MS = 4000;       // how long at the top before we nudge
const TOP_PX = 40;

export default function ScrollCue() {
  const [ready, setReady] = useState(false);
  const [show, setShow] = useState(false);

  // Wait for the intro to finish, then for the print to land.
  useEffect(() => {
    const root = document.documentElement;
    let t;
    const check = () => {
      if (!root.dataset.intro || root.dataset.intro === 'done') {
        t = setTimeout(() => setReady(true), root.dataset.intro ? PRINT_TAIL_MS : 0);
        return true;
      }
      return false;
    };
    if (check()) return () => clearTimeout(t);
    const mo = new MutationObserver(() => { if (check()) mo.disconnect(); });
    mo.observe(root, { attributes: true, attributeFilter: ['data-intro'] });
    return () => { mo.disconnect(); clearTimeout(t); };
  }, []);

  // Idle at the top -> show; any scroll down -> hide.
  useEffect(() => {
    if (!ready) return undefined;
    let idle;
    const arm = () => {
      clearTimeout(idle);
      if (window.scrollY <= TOP_PX) idle = setTimeout(() => setShow(true), IDLE_MS);
    };
    const onScroll = () => {
      if (window.scrollY > TOP_PX) setShow(false);
      arm();
    };
    arm();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(idle); window.removeEventListener('scroll', onScroll); };
  }, [ready]);

  const goNext = () => {
    const next = document.getElementById('play') || document.getElementById('work');
    if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShow(false);
  };

  return (
    <button
      type="button"
      className={`scroll-cue ${show ? 'is-shown' : ''}`}
      onClick={goNext}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
    >
      <span className="scroll-cue__label">Scroll for more</span>
      <span className="scroll-cue__chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </button>
  );
}
