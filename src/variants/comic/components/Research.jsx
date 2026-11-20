import React from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { publications } from '../data';

export default function Research() {
  const ref = useReveal();
  return (
    <section className="section" id="research" ref={ref}>
      <div className="container">
        <SectionHead index="03" label="Research" title="Published, peer-reviewed.">
          Alongside the warehouse work I've trained models — one to read sign language, one to support
          mental health.
        </SectionHead>
        <div className="papers">
          {publications.map((p, i) => (
            // Milestone-card layout from the warehouse game
            <article className="mile paper reveal" key={p.title}>
              <span className={`sfx sfx--paper sfx--${i}`} aria-hidden="true">{i === 0 ? 'Kapow!' : 'Zap!'}</span>
              <header className="mile__header">
                <span className="mile__icon" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <span className="mile__badge">{p.journal}</span>
                  <h3 className="mile__title paper__title">{p.title}</h3>
                </div>
              </header>
              <div className="mile__stat paper__statrow">
                <span>{p.statLabel}</span>
                <strong className="paper__stat">{p.stat}</strong>
              </div>
              <details className="mile__reveal paper__abstract">
                <summary className="mile__reveal-label">★ Abstract unlocked — tap to read</summary>
                <p className="mile__quote">{p.abstract}</p>
              </details>
              <ul className="chips">
                {p.tags.map((t) => <li className="chip" key={t}>{t}</li>)}
              </ul>
              <footer className="mile__footer">
                <span className="mile__points">Published {p.date}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
