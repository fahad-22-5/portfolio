import React, { useEffect, useState } from 'react';

// Page-wide parcel tracker: a tag rides down a rail on the right edge as you
// scroll, stopping at a checkpoint per section with a tracking status.
const STOPS = [
  { id: 'top', label: 'Label printed' },
  { id: 'work', label: 'In transit · Route' },
  { id: 'skills', label: 'At hub · Inventory' },
  { id: 'research', label: 'Scanned · Research' },
  { id: 'about', label: 'Sorting · About' },
  { id: 'contact', label: 'Out for delivery' },
];

export default function TrackingRail() {
  const [marks, setMarks] = useState([]);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const scrollDriven = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('animation-timeline: scroll()');

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setMarks(STOPS.map(({ id }) => {
        const el = document.getElementById(id);
        return el ? Math.min(1, Math.max(0, (el.getBoundingClientRect().top + window.scrollY - 80) / max)) : 0;
      }));
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const p = window.scrollY / max;
        if (!scrollDriven) setProgress(p);
        let idx = 0;
        STOPS.forEach(({ id }, i) => {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top < window.innerHeight * 0.45) idx = i;
        });
        if (p > 0.995) idx = STOPS.length - 1;
        setActive(idx);
      });
    };
    measure();
    onScroll();
    const t = setTimeout(measure, 1200); // after fonts/intro settle
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, [scrollDriven]);

  return (
    <aside className="rail" aria-label="Page progress">
      <div className="rail__track">
        <span className="rail__fill" style={scrollDriven ? undefined : { transform: `scaleY(${progress})` }} />
        {marks.map((m, i) => (
          <a
            key={STOPS[i].id}
            href={`#${STOPS[i].id}`}
            className={`rail__stop ${i <= active ? 'is-passed' : ''} ${i === active ? 'is-active' : ''}`}
            style={{ top: `${m * 100}%` }}
            aria-label={STOPS[i].label}
          />
        ))}
        <div
          className="rail__tag"
          style={scrollDriven ? undefined : { transform: `translateY(calc(${progress} * (100vh - 220px)))` }}
        >
          <span className="rail__tag-id">FEH</span>
          <span className="rail__tag-status" key={active}>{STOPS[active].label}</span>
        </div>
      </div>
    </aside>
  );
}
