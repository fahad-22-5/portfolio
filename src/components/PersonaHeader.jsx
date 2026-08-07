import React, { useEffect, useRef } from 'react';
import './PersonaHeader.css';

function PersonaHeader({ id, title, subtitle, color = 'red' }) {
  const headerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    if (headerRef.current) observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div id={id} className={`persona-header persona-header--${color} reveal`} ref={headerRef}>
      <div className="persona-header__inner">
        <h2 className="persona-header__title comic-heading">{title}</h2>
        <p className="persona-header__subtitle">{subtitle}</p>
      </div>
      {/* Action lines for comic effect */}
      <div className="persona-header__lines"></div>
    </div>
  );
}

export default PersonaHeader;
