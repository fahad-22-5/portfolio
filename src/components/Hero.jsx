import React, { useEffect, useRef, useMemo } from 'react';
import './Hero.css';
import TypeAni from './TypeAni';

function Hero() {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let rect = null;
    let rafId = null;

    const handleMouseEnter = () => {
      rect = card.getBoundingClientRect();
    };

    const handleMouseMove = (e) => {
      if (!rect) rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (centerY - y) / 15;
      const rotateY = (x - centerX) / 15;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
      });
    };

    const handleMouseLeave = () => {
      rect = null;
      if (rafId) cancelAnimationFrame(rafId);
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
    };

    card.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    card.addEventListener('mousemove', handleMouseMove, { passive: true });
    card.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const particles = useMemo(() => (
    [...Array(20)].map((_, i) => ({
      delay: `${(i * 0.25) % 5}s`,
      x: `${(i * 19) % 100}%`,
      duration: `${3 + (i % 4)}s`,
      size: `${2 + (i % 5)}px`,
    }))
  ), []);

  return (
    <section className="hero" id="hero">

      {/* Animated background particles */}
      <div className="hero__particles">
        {particles.map((p, i) => (
          <div key={i} className="hero__particle" style={{
            '--delay': p.delay,
            '--x': p.x,
            '--duration': p.duration,
            '--size': p.size,
          }} />
        ))}
      </div>

      <div className="hero__content">
        {/* Left side: Text */}
        <div className="hero__text">
          <p className="hero__greeting">
            Hey there, I'm
          </p>

          <h1 className="hero__name comic-heading">
            <span className="hero__name-glitch" data-text="FAHAD">FAHAD</span>
            <span className="hero__name-line2">
              <span className="hero__name-glitch hero__name-glitch--alt" data-text="EQBAL">EQBAL</span>
              {' '}
              <span className="hero__name-glitch" data-text="HASHMI">HASHMI</span>
            </span>
          </h1>

          <div className="hero__tagline">
            <span className="hero__tagline-bracket">&lt;</span>
            <TypeAni />
            <span className="hero__tagline-bracket">/&gt;</span>
          </div>

          <p className="hero__subtitle">
            With great backend architecture comes a great <em>need to check server logs</em>.
          </p>

          <div className="hero__cta">
            <button className="hero__btn hero__btn--primary" onClick={() => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' })}>
              Get in Touch
            </button>
            <button className="hero__btn hero__btn--secondary" onClick={() => document.getElementById('about').scrollIntoView({ behavior: 'smooth' })}>
              Know More
            </button>
          </div>
        </div>

        {/* Right side: interactive name-tag card (left half → work, right half → about) */}
        <div className="hero__split-face-wrapper" ref={cardRef}>
          <div className="hero__split-face">
            {/* "Hello my name is" sticker */}
            <svg className="hero__nametag-squiggles" viewBox="0 0 320 400" aria-hidden="true">
              {[[38, 70, -18], [250, 58, 14], [270, 96, 20], [30, 318, 12], [262, 322, -16], [150, 350, 4], [60, 110, -8]].map(([x, y, r], i) => (
                <path
                  key={i}
                  d="M0,0 q6,-8 12,0 t12,0 t12,0"
                  transform={'translate(' + x + ' ' + y + ') rotate(' + r + ')'}
                  className={i % 2 ? 'hero__squiggle hero__squiggle--cyan' : 'hero__squiggle'}
                />
              ))}
            </svg>
            <div className="hero__nametag" role="img" aria-label="Hello, my name is Fahad">
              <div className="hero__nametag-top">
                <span className="hero__nametag-hello">HELLO</span>
                <span className="hero__nametag-sub">my name is</span>
              </div>
              <div className="hero__nametag-name"><span>Fahad</span></div>
            </div>

            {/* Clickable halves */}
            <div
              className="hero__split-half hero__split-half--left"
              onClick={() => document.getElementById('web-weaver-section').scrollIntoView({ behavior: 'smooth' })}
              title="View My Work"
            >
              <span className="hero__split-label">WORK</span>
            </div>
            <div
              className="hero__split-half hero__split-half--right"
              onClick={() => document.getElementById('alter-ego-section').scrollIntoView({ behavior: 'smooth' })}
              title="View About Me"
            >
              <span className="hero__split-label">ME</span>
            </div>
          </div>
          {/* Shadow behind */}
          <div className="hero__split-shadow"></div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero__scroll">
        <div className="hero__scroll-line"></div>
        <span className="hero__scroll-text">SCROLL</span>
      </div>

      {/* Diagonal section end */}
      <div className="hero__diagonal"></div>
    </section>
  );
}

export default Hero;
