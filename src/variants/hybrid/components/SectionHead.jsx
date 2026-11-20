import React from 'react';

export default function SectionHead({ index, label, title, children }) {
  return (
    <header className="section-head reveal">
      <p className="caption">
        <span>Chapter {index}</span>
        <span>{label}</span>
      </p>
      <h2 className="section-head__title">{title}</h2>
      {children && <p className="section-head__lede bubble">{children}</p>}
    </header>
  );
}
