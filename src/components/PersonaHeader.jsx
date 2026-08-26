import React, { useEffect, useRef } from 'react';
import './PersonaHeader.css';

function PersonaHeader({ id, title, subtitle, color }) {
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
    <div id={id} className="persona-header reveal" ref={headerRef} style={{ '--ph-color': color }}>
      <div className="persona-header-inner">
        <h2 className="persona-header-title glitch-text" data-text={title}>{title}</h2>
        <div className="persona-header-badge">
          {subtitle}
        </div>
      </div>
      <div className="persona-header-bg"></div>
    </div>
  );
}

export default PersonaHeader;
