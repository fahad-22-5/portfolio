import React, { useEffect, useState } from 'react';
import Barcode from './Barcode';
import Segments from './Segments';
import { profile, stats } from '../data';

// Simulated: where a 100K/day sorter's running count would be since midnight IST.
function parcelsSinceMidnight() {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
  const secs = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds() + ist.getMilliseconds() / 1000;
  return Math.floor(secs * (100000 / 86400));
}

const statColors = ['amber', 'cyan', 'green', 'purple'];

export default function Hero() {
  const [count, setCount] = useState(parcelsSinceMidnight);

  useEffect(() => {
    const t = setInterval(() => setCount(parcelsSinceMidnight()), 400);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="hero halftone" id="top">
      <div className="container hero__grid">
        <div className="hero__copy">
          <p className="eyebrow caption">
            <span><span className="dot dot--live" aria-hidden="true" /> {profile.role}</span>
            <span>{profile.company} · {profile.location}</span>
          </p>
          <h1 className="hero__title">
            I build the software that sorts <span className="accent-text">100,000 parcels</span> a day.
          </h1>
          <p className="hero__lede bubble">
            I'm <strong>{profile.name}</strong>, a backend software engineer building high-throughput
            warehouse management and control systems — from PLC handshakes on the warehouse floor to
            the RabbitMQ queues and APIs that keep the supply chain moving. I write the code, then go
            on-site and take it live with the people who run it.
          </p>
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

        {/* Shift-card layout from the warehouse game */}
        <aside className="shift" aria-label="Mission card summary">
          <div className="shift__top">
            <span className="badge badge--amber">⚡ The 100K Shift</span>
            <span className="shift__order">Issue #01</span>
          </div>
          <p className="shift__title">{profile.name}</p>
          <p className="shift__client">{profile.company} · {profile.location}</p>
          <div className="shift__target">
            <span>Deliver to: <strong>your next engineering team</strong></span>
          </div>
          <div className="shift__grid">
            <div className="shift__target">
              <span className="shift__k">Contents</span>
              <span>.NET · C# · SQL · RabbitMQ · PLC</span>
            </div>
            <div className="shift__target">
              <span className="shift__k">Weight</span>
              <span className="shift__reward">2.5 yrs in production</span>
            </div>
          </div>
          <div className="shift__code">
            <Barcode value="FAHAD-EQBAL-HASHMI" />
          </div>
          <div className="shift__progress">
            <span className="shift__k">Shift progress</span>
            <Segments total={5} done={4} active={4} label="Shift progress: 4 of 5" />
          </div>
          <p className="shift__foot">Handle with curiosity ↑</p>
        </aside>
      </div>

      <div className="container">
        {/* Command-card row from the warehouse game HUD */}
        <dl className="stats">
          <div className="cmd cmd--red stats__cell--live">
            <dt className="cmd__label">
              <span>Parcels today</span>
              <span className="cmd__live">Live · sim</span>
            </dt>
            <dd>
              <span className="cmd__val tabular">{count.toLocaleString('en-IN')}</span>
              <span className="cmd__sub">through a 100K/day sorter since midnight IST</span>
            </dd>
          </div>
          {stats.map((s, i) => (
            <div className={`cmd cmd--${statColors[i]}`} key={s.value}>
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="cmd__val">{s.value}</span>
                <span className="cmd__sub">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
