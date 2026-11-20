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
          {publications.map((p) => (
            <article className="paper reveal" key={p.title}>
              <div className="paper__top mono">
                <span>{p.journal}</span>
                <span>{p.date}</span>
              </div>
              <p className="paper__stat">{p.stat}</p>
              <p className="paper__statlabel">{p.statLabel}</p>
              <h3 className="paper__title">{p.title}</h3>
              <details className="paper__abstract">
                <summary className="mono">Read abstract</summary>
                <p>{p.abstract}</p>
              </details>
              <ul className="chips">
                {p.tags.map((t) => <li className="chip" key={t}>{t}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
