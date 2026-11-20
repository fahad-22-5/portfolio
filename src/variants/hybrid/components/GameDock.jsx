import React from 'react';
import useReveal from '../useReveal';

const GAME_URL = '/warehouse';

// "Bonus level" panel that sells the playable 3D warehouse: an arcade-style
// screen with a live top-down preview of the rover running a mission.
export default function GameDock() {
  const ref = useReveal();
  return (
    <section className="game" id="play" ref={ref} aria-labelledby="game-title">
      <div className="container">
        <div className="game__cabinet reveal">
          <div className="game__copy">
            <p className="game__eyebrow">
              <span className="game__badge">Bonus level</span>
              <span>Playable · in your browser</span>
            </p>
            <h2 className="game__title" id="game-title">Don't just read it. Drive the warehouse.</h2>
            <p className="game__text">
              I built a playable 3D sortation hall. Drive the rover across the floor, reach signal towers
              to unlock my work history, pick up skill modules and data caches, and watch Put-to-Light and
              an ASRS run around you.
            </p>
            <ul className="game__features">
              <li><span>01</span>Signal towers · work history</li>
              <li><span>02</span>Power-up modules · skills</li>
              <li><span>03</span>Data caches · achievements</li>
            </ul>
            <div className="game__actions">
              <a href={GAME_URL} className="btn btn--primary game__start">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></svg>
                Start the shift
              </a>
              <span className="game__hint">WASD / arrows · touch controls on mobile</span>
            </div>
          </div>

          <a href={GAME_URL} className="game__screen" aria-label="Open the warehouse game">
            <div className="game__hud">
              <span><span className="game__rec" aria-hidden="true" /> Mission 1 / 3</span>
              <span>Reach the signal tower</span>
            </div>
            <svg viewBox="0 0 400 260" className="game__arena" aria-hidden="true">
              <g className="ga-grid">
                {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="260" />)}
                {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 40} x2="400" y2={i * 40} />)}
              </g>
              <g className="ga-racks">
                <rect x="100" y="96" width="200" height="22" rx="3" />
                <rect x="100" y="142" width="200" height="22" rx="3" />
              </g>
              <g className="ga-node ga-node--cache"><circle cx="70" cy="70" r="7" /></g>
              <g className="ga-node ga-node--module"><circle cx="70" cy="190" r="7" /></g>
              <g className="ga-tower">
                <circle cx="330" cy="70" r="20" className="ga-tower__ring" />
                <circle cx="330" cy="70" r="9" className="ga-tower__core" />
              </g>
              <g className="ga-rover">
                <rect x="-13" y="-10" width="26" height="20" rx="5" className="ga-rover__body" />
                <rect x="5" y="-6" width="6" height="12" rx="2" className="ga-rover__nose" />
              </g>
            </svg>
            <span className="game__screen-cta">Press start ▶</span>
          </a>
        </div>
      </div>
    </section>
  );
}
