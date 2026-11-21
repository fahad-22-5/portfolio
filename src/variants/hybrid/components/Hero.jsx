import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Barcode from './Barcode';
import HeroFloor from './HeroFloor';
import AnimatedCounter, { localeGrouping } from './AnimatedCounter';
import { profile, stats } from '../data';

// Simulated: where a 100K/day sorter's running count would be since the
// visitor's own local midnight (Date uses the browser's time zone).
function parcelsSinceMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const secs = (now.getTime() - midnight.getTime()) / 1000;
  return Math.floor(Math.min(secs, 86400) * (100000 / 86400));
}

const LOCALE_GROUPING = localeGrouping();

// The hero is a single shipping label. After the intro it prints out of a
// slot, gets its barcode scanned, is stamped "In transit" and slapped down.
export default function Hero() {
  const [count, setCount] = useState(parcelsSinceMidnight);
  const wrapRef = useRef(null);
  const [dock, setDock] = useState(0);

  // Distance from the top of the page to the printer, so the print can run
  // docked at the top edge before the label settles into its place.
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (el) setDock(-Math.max(0, el.getBoundingClientRect().top + window.scrollY - 12));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCount(parcelsSinceMidnight()), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="hero" id="top">
      <HeroFloor />
      <div className="container hero__inner" style={{ '--dock': `${dock}px` }}>
        <p className="eyebrow hero__eyebrow">
          <span className="dot dot--live" aria-hidden="true" />
          {profile.role} · {profile.location}
        </p>

        <div className="biglabel-wrap" ref={wrapRef}>
          <div className="printer" aria-hidden="true">
            <span className="printer__led" />
            <span className="printer__brand">FEH · Thermal 4×6</span>
            <span className="printer__status">
              <span className="printer__status-run">Printing…</span>
              <span className="printer__status-done">Done ✓</span>
            </span>
            <span className="printer__slot" />
            <span className="printer__head" />
            <span className="printer__cut" />
          </div>
          <article className="biglabel">
            <span className="biglabel__stamp" aria-hidden="true">In transit</span>
            <header className="biglabel__head">
              <span className="biglabel__priority">P1</span>
              <div>
                <p className="biglabel__tiny">Priority dispatch</p>
                <p className="biglabel__service">Engineer · Express</p>
              </div>
              <span className="biglabel__tiny biglabel__ref">FEH-2024-SD · 1 of 1</span>
            </header>

            <div className="biglabel__main">
              <h1 className="hero__title">
                I build the software that sorts <span className="accent-text">100,000 parcels</span> a day.
              </h1>
            </div>

            <div className="biglabel__split">
              <div>
                <p className="biglabel__tiny">From</p>
                <p className="biglabel__value">
                  {profile.name}
                  <span>Backend &amp; warehouse automation · {profile.location}</span>
                </p>
              </div>
              <div>
                <p className="biglabel__tiny">Deliver to</p>
                <p className="biglabel__value">
                  Your next engineering team
                  <span>Signature on go-live</span>
                </p>
              </div>
            </div>

            <div className="biglabel__note">
              <p className="biglabel__tiny">Manifest note</p>
              <p className="hero__lede">
                I'm a backend software engineer building high-throughput warehouse management and control
                systems — from PLC handshakes on the warehouse floor to the RabbitMQ queues and APIs that
                keep the supply chain moving. <strong>I write the code, then go on-site and take it live with
                the people who run it.</strong>
              </p>
            </div>

            <div className="biglabel__split biglabel__split--meta">
              <div>
                <p className="biglabel__tiny">Contents</p>
                <p className="biglabel__value biglabel__value--sm">.NET · C# · SQL · RabbitMQ · PLC</p>
              </div>
              <div>
                <p className="biglabel__tiny">Service</p>
                <p className="biglabel__value biglabel__value--sm">Build · ship · go-live</p>
              </div>
            </div>

            <div className="biglabel__code">
              <div className="biglabel__barcode">
                <Barcode value="FAHAD-EQBAL-HASHMI" />
                <span className="biglabel__laser" aria-hidden="true" />
                <p className="biglabel__tiny biglabel__center">FEH · 2024 · SD · 100K</p>
              </div>
              <div className="hero__cta">
                <a href="#contact" className="btn btn--primary">
                  Start a conversation
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                </a>
                <a href="#work" className="btn btn--ghost">See the route history</a>
              </div>
            </div>

            <p className="biglabel__foot">Handle with curiosity ↑</p>
          </article>
        </div>

        <dl className="tally">
          <div className="tally__cell tally__cell--live">
            <dt className="tally__head">
              <span className="dot dot--live" aria-hidden="true" /> Live · simulated
            </dt>
            <dd>
              <AnimatedCounter className="tally__value tabular" value={count} duration={0.5} {...LOCALE_GROUPING} />
              <span className="tally__label">parcels sorted today, so far</span>
            </dd>
          </div>
          {stats.map((s) => (
            <div className="tally__cell" key={s.value}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="tally__value">{s.value}</span>
                <span className="tally__label">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
