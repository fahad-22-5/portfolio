import React from 'react';
import SectionHead from './SectionHead';
import Segments from './Segments';
import useReveal from '../useReveal';
import { experiences } from '../data';

export default function Experience() {
  const ref = useReveal();
  const total = experiences.length;
  return (
    <section className="section" id="work" ref={ref}>
      <div className="container split">
        <SectionHead index="01" label="Route history" title="Where I've shipped.">
          Three checkpoints, with go-lives from Noida to Madrid and Riyadh — and one constant: systems that have to
          keep working under load.
        </SectionHead>

        <ol className="route">
          {experiences.map((exp, i) => {
            const isActive = exp.status === 'Active';
            const step = total - i;
            const [headline, ...rest] = exp.bullets;
            return (
              <li className={`route__stop reveal ${isActive ? 'route__stop--active' : ''}`} key={exp.code}>
                <div className="route__marker" aria-hidden="true" />
                {/* Milestone-card layout from the warehouse game */}
                <article className={`mile ${isActive ? '' : 'mile--complete'}`}>
                  <header className="mile__header">
                    <span className="mile__icon" aria-hidden="true">{String(step).padStart(2, '0')}</span>
                    <div>
                      <span className="mile__badge">
                        Checkpoint {step}/{total} · {isActive ? 'Mission active' : 'Mission complete'}
                      </span>
                      <h3 className="mile__title">{exp.role}</h3>
                    </div>
                  </header>
                  <div className="mile__stat">
                    <span className="route__company">{exp.company}</span>
                    <strong>{exp.period}</strong>
                  </div>
                  <div className="mile__reveal">
                    <span className="mile__reveal-label">★ Highlight unlocked</span>
                    <p className="mile__quote">{headline}</p>
                  </div>
                  {rest.length > 0 && (
                    <ul className="route__bullets">
                      {rest.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  )}
                  <ul className="chips">
                    {exp.tech.map((t) => <li className="chip" key={t}>{t}</li>)}
                  </ul>
                  <footer className="mile__footer">
                    <span className="mile__points">{exp.location}</span>
                    <Segments total={total} done={step} active={isActive ? step - 1 : -1} label={`Checkpoint ${step} of ${total}`} />
                  </footer>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
