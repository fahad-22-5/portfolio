import React from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { experiences } from '../data';

export default function Experience() {
  const ref = useReveal();
  return (
    <section className="section" id="work" ref={ref}>
      <div className="container split">
        <SectionHead index="01" label="Route history" title="Where I've shipped.">
          Three checkpoints, with go-lives from Noida to Madrid and Riyadh — and one constant: systems that have to
          keep working under load.
        </SectionHead>

        <ol className="route">
          {experiences.map((exp) => {
            const isActive = exp.status === 'Active';
            return (
              <li className={`route__stop reveal ${isActive ? 'route__stop--active' : ''}`} key={exp.code}>
                <div className="route__marker" aria-hidden="true" />
                <div className="route__meta mono">
                  <span className={`pill ${isActive ? 'pill--accent' : ''}`}>{exp.status}</span>
                  <span>{exp.period}</span>
                  <span>{exp.location}</span>
                </div>
                <h3 className="route__role">{exp.role}</h3>
                <p className="route__company">{exp.company}</p>
                <ul className="route__bullets">
                  {exp.bullets.map((b) => <li key={b}>{b}</li>)}
                </ul>
                <ul className="chips">
                  {exp.tech.map((t) => <li className="chip" key={t}>{t}</li>)}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
