import React, { useEffect, useState } from 'react';
import Barcode from './Barcode';
import { profile, stats } from '../data';

// Simulated: where a 100K/day sorter's running count would be since midnight IST.
function parcelsSinceMidnight() {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
  const secs = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds() + ist.getMilliseconds() / 1000;
  return Math.floor(secs * (100000 / 86400));
}

export default function Hero() {
  const [count, setCount] = useState(parcelsSinceMidnight);

  useEffect(() => {
    const t = setInterval(() => setCount(parcelsSinceMidnight()), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="hero" id="top">
      <div className="container hero__grid">
        <div className="hero__copy">
          <p className="eyebrow mono">
            <span className="dot dot--live" aria-hidden="true" />
            {profile.role} · {profile.company} · {profile.location}
          </p>
          <h1 className="hero__title">
            I build the software that sorts <span className="accent-text">100,000 parcels</span> a day.
          </h1>
          <p className="hero__lede">
            I'm <strong>{profile.name}</strong>, a backend software engineer building high-throughput
            warehouse management and control systems — from PLC handshakes on the warehouse floor to
            the RabbitMQ queues and APIs that keep the supply chain moving.
          </p>
          <div className="hero__cta">
            <a href="#contact" className="btn btn--primary">
              Start a conversation
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </a>
            <a href="#work" className="btn btn--ghost">See the route history</a>
          </div>
        </div>

        <aside className="label" aria-label="Shipping label summary">
          <div className="label__head">
            <span className="label__priority">P1</span>
            <div>
              <p className="mono label__tiny">Priority dispatch</p>
              <p className="label__service">Engineer · Express</p>
            </div>
            <span className="mono label__tiny label__ref">FEH-2024-SD</span>
          </div>
          <div className="label__row">
            <p className="mono label__tiny">From</p>
            <p className="label__value">
              {profile.name}
              <br />
              <span>{profile.company} · {profile.location}</span>
            </p>
          </div>
          <div className="label__row">
            <p className="mono label__tiny">Deliver to</p>
            <p className="label__value">Your next engineering team</p>
          </div>
          <div className="label__split">
            <div>
              <p className="mono label__tiny">Contents</p>
              <p className="label__value label__value--sm">.NET · C# · SQL · RabbitMQ · PLC</p>
            </div>
            <div>
              <p className="mono label__tiny">Weight</p>
              <p className="label__value label__value--sm">2.5 yrs in production</p>
            </div>
          </div>
          <div className="label__code">
            <Barcode value="FAHAD-EQBAL-HASHMI" />
            <p className="mono label__tiny label__center">FEH · 2024 · SD · 100K</p>
          </div>
          <p className="label__foot mono">Handle with curiosity ↑</p>
        </aside>
      </div>

      <div className="container">
        <dl className="stats">
          <div className="stats__cell stats__cell--live">
            <dt className="mono"><span className="dot dot--live" aria-hidden="true" /> Live · simulated</dt>
            <dd>
              <span className="stats__value tabular">{count.toLocaleString('en-IN')}</span>
              <span className="stats__label">parcels through a 100K/day sorter since midnight IST</span>
            </dd>
          </div>
          {stats.map((s) => (
            <div className="stats__cell" key={s.value}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="stats__value">{s.value}</span>
                <span className="stats__label">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
