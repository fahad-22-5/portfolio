import React from 'react';

export default function SectionHead({ index, label, title, children }) {
  return (
    <header className="section-head reveal">
      <div className="section-head__rule">
        <span className="mono">{index}</span>
        <span className="mono">{label}</span>
      </div>
      <h2 className="section-head__title">{title}</h2>
      {children && <p className="section-head__lede">{children}</p>}
    </header>
  );
}
