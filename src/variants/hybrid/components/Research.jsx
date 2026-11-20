import React, { useCallback, useEffect, useRef, useState } from 'react';
import SectionHead from './SectionHead';
import useReveal from '../useReveal';
import { publications } from '../data';

function AbstractModal({ paper, index, onClose }) {
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
      <div className="modal__card mile" role="dialog" aria-modal="true" aria-labelledby="abstract-title">
        <header className="mile__header">
          <span className="mile__icon" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <span className="mile__badge">{paper.journal} · {paper.date}</span>
            <h3 className="mile__title paper__title" id="abstract-title">{paper.title}</h3>
          </div>
        </header>
        <div className="mile__stat paper__statrow">
          <span>{paper.statLabel}</span>
          <strong className="paper__stat">{paper.stat}</strong>
        </div>
        <div className="mile__reveal modal__body">
          <span className="mile__reveal-label">★ Abstract</span>
          <p className="mile__quote">{paper.abstract}</p>
        </div>
        <ul className="chips">
          {paper.tags.map((t) => <li className="chip" key={t}>{t}</li>)}
        </ul>
        <footer className="mile__footer">
          <span className="mile__points">Published {paper.date}</span>
          <button type="button" className="btn btn--ghost modal__close" onClick={onClose} ref={closeRef}>
            Close
          </button>
        </footer>
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
            // Milestone-card layout from the warehouse game
            <article className="mile paper reveal" key={p.title}>
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
              <button type="button" className="mile__reveal paper__open" onClick={() => setOpen(i)}>
                <span className="mile__reveal-label">★ Read abstract</span>
                <span className="paper__open-arrow" aria-hidden="true">↗</span>
              </button>
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
      {open !== null && (
        <AbstractModal paper={publications[open]} index={open} onClose={close} />
      )}
    </section>
  );
}
