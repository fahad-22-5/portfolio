import React from 'react';

export default function SectionHead({ index, label, title, children }) {
  return (
    <header className="sh reveal">
      <div className="sh__rule">
        <span className="sh__idx">{index}</span>
        <span>{label}</span>
      </div>
      <h2 className="sh__title">{title}</h2>
      {children && <p className="sh__lede">{children}</p>}
    </header>
  );
}
