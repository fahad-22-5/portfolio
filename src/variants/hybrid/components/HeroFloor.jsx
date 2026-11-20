import React, { useEffect, useRef, useState } from 'react';

// A live, top-down sortation floor behind the hero: an induction lane, a
// return lane that merges in, a scanner, a divert chute to bay 07, storage
// racks and two AMRs patrolling the aisles. Pure CSS transform animation on
// SVG groups (compositor-friendly); paused while the hero is off-screen.
// Coordinates are in viewBox units (1200 × 720).

const TICKS = Array.from({ length: 56 }, (_, i) => i * 24);
const RACK_X = Array.from({ length: 12 }, (_, i) => 640 + i * 46);

function Parcel({ className, delay }) {
  return (
    <g className={`hf-pk ${className}`} style={{ animationDelay: delay }}>
      <rect x="-12" y="-9" width="24" height="18" rx="2" className="hf-pk__box" />
      <line x1="0" y1="-9" x2="0" y2="9" className="hf-pk__tape" />
      <rect x="2" y="1" width="8" height="5" className="hf-pk__label" />
    </g>
  );
}

function Amr({ className, delay, carrying }) {
  return (
    <g className={`hf-amr ${className}`} style={{ animationDelay: delay }}>
      <rect x="-15" y="-15" width="30" height="30" rx="7" className="hf-amr__body" />
      {carrying && <rect x="-9" y="-9" width="18" height="14" rx="2" className="hf-pk__box" />}
      <circle cx="9" cy="-9" r="2.6" className="hf-amr__led" />
    </g>
  );
}

export default function HeroFloor() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`hero-floor ${visible ? '' : 'is-paused'}`} ref={ref} aria-hidden="true">
      <svg viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid slice">
        <defs>
          <clipPath id="hf-main"><rect x="-20" y="548" width="1240" height="24" /></clipPath>
          <clipPath id="hf-upper"><rect x="608" y="328" width="612" height="24" /></clipPath>
        </defs>

        {/* Storage racks + AMR aisles */}
        <g className="hf-line">
          {RACK_X.map((x) => (
            <g key={x}>
              <rect x={x} y="84" width="36" height="26" rx="2" />
              <rect x={x} y="184" width="36" height="26" rx="2" />
            </g>
          ))}
          <line x1="630" y1="147" x2="1190" y2="147" className="hf-aisle" />
          <line x1="630" y1="245" x2="1190" y2="245" className="hf-aisle" />
        </g>

        {/* Lanes */}
        <g className="hf-line">
          <rect x="-20" y="548" width="1240" height="24" />
          <rect x="608" y="328" width="612" height="24" />
          <rect x="608" y="352" width="24" height="196" />
          <polygon points="828,572 852,572 940,712 916,712" className="hf-chute" />
        </g>
        <g clipPath="url(#hf-main)">
          <g className="hf-ticks">
            {TICKS.map((x) => <line key={x} x1={x - 24} y1="548" x2={x - 24} y2="572" className="hf-tick" />)}
          </g>
        </g>
        <g clipPath="url(#hf-upper)">
          <g className="hf-ticks hf-ticks--rev">
            {TICKS.slice(0, 30).map((x) => <line key={x} x1={x + 600} y1="328" x2={x + 600} y2="352" className="hf-tick" />)}
          </g>
        </g>

        {/* Scanner arch on the main lane */}
        <g className="hf-line">
          <rect x="962" y="528" width="44" height="64" rx="3" />
        </g>
        <rect x="964" y="548" width="40" height="24" className="hf-beam" />

        {/* Labels */}
        <g className="hf-text">
          <text x="24" y="534">INDUCT · LANE 01</text>
          <text x="1060" y="320">RETURN · LANE 02</text>
          <text x="960" y="516">SCAN</text>
          <text x="944" y="702">BAY 07 →</text>
          <text x="640" y="70">AMR ZONE · RACKS A–L</text>
        </g>

        {/* Parcels */}
        <Parcel className="hf-pk--main" delay="0s" />
        <Parcel className="hf-pk--main" delay="-2.75s" />
        <Parcel className="hf-pk--main" delay="-5.5s" />
        <Parcel className="hf-pk--main" delay="-8.25s" />
        <Parcel className="hf-pk--divert" delay="-1.4s" />
        <Parcel className="hf-pk--divert" delay="-5.9s" />
        <Parcel className="hf-pk--merge" delay="0s" />
        <Parcel className="hf-pk--merge" delay="-6.3s" />

        {/* AMRs */}
        <Amr className="hf-amr--a" delay="0s" carrying />
        <Amr className="hf-amr--b" delay="-7s" />
      </svg>
    </div>
  );
}
