import React, { useCallback, useEffect, useRef, useState } from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { publications } from '../data';

function AbstractModal({ paper, onClose }) {
  const closeRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby="abstract-title">
        <div className="paper__top">
          <span>{paper.journal}</span>
          <span>{paper.date}</span>
        </div>
        <h3 className="modal__title" id="abstract-title">{paper.title}</h3>
        <div className="modal__stat">
          <span className="paper__stat">{paper.stat}</span>
          <span className="paper__statlabel">{paper.statLabel}</span>
        </div>
        <p className="modal__label">Abstract</p>
        <p className="modal__text">{paper.abstract}</p>
        <ul className="chips">
          {paper.tags.map((t) => <li className="chip" key={t}>{t}</li>)}
        </ul>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} ref={closeRef}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Research() {
  const ref = useReveal();
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <section className="section" id="research" ref={ref}>
      <div className="container">
        <SectionHead index="03" label="Research" title="Published, peer-reviewed.">
          Alongside the warehouse work I've trained models — one to read sign language, one to support
          mental health.
        </SectionHead>
        <div className="papers">
          {publications.map((p, i) => (
            <article className="paper reveal" key={p.title}>
              <div className="paper__top">
                <span>{p.journal}</span>
                <span>{p.date}</span>
              </div>
              <p className="paper__stat">{p.stat}</p>
              <p className="paper__statlabel">{p.statLabel}</p>
              <h3 className="paper__title">{p.title}</h3>
              <ul className="chips">
                {p.tags.map((t) => <li className="chip" key={t}>{t}</li>)}
              </ul>
              <button type="button" className="paper__open" onClick={() => setOpen(i)}>
                Read abstract <span aria-hidden="true">↗</span>
              </button>
            </article>
          ))}
        </div>
      </div>
      {open !== null && <AbstractModal paper={publications[open]} onClose={close} />}
    </section>
  );
}
