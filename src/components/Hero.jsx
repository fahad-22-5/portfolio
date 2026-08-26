import React, { useEffect, useRef } from 'react';
import './Hero.css';
import TypeAni from './TypeAni';

function Hero() {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (centerY - y) / 15;
      const rotateY = (x - centerX) / 15;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <section className="hero" id="hero">
      
      {/* Background Graphic Elements */}
      <div className="hero-bg-graphic hero-circle-1"></div>
      <div className="hero-bg-graphic hero-circle-2"></div>
      
      <div className="hero-content">
        <div className="hero-left">
          <div className="hero-header">
            <div className="max-badge" style={{ background: 'var(--max-neon-red)' }}>SPIDER-VERSE</div>
            <div className="max-badge" style={{ background: 'var(--max-neon-blue)' }}>EARTH-199999</div>
          </div>

          <h1 className="hero-title">
            <span className="glitch-text" data-text="FAHAD">FAHAD</span>
            <br />
            <span className="glitch-text" data-text="EQBAL">EQBAL</span>
          </h1>
          
          <div className="hero-subtitle-box brutal-card">
            <p>
              With great backend architecture comes a great <strong style={{ color: 'var(--max-neon-red)' }}>need to check server logs</strong>.
            </p>
            <div className="hero-type">
               <TypeAni />
            </div>
            <div className="hero-cta-group">
              <button className="max-btn max-btn-primary" onClick={() => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' })}>
                THWIP ME
              </button>
              <button className="max-btn max-btn-secondary" onClick={() => document.getElementById('spider-man-section').scrollIntoView({ behavior: 'smooth' })}>
                SEE SUITS
              </button>
            </div>
          </div>
        </div>

        {/* Right side: Split Face Interactive Image */}
        <div className="hero-split-face-wrapper" ref={cardRef}>
          <div className="hero-split-face brutal-card" style={{ '--card-color': 'var(--max-neon-red)' }}>
            <img src="/split-face.jpg" alt="Spider-Man and Peter Parker" className="hero-split-img" />

            <div
              className="hero-split-half hero-split-half-left"
              onClick={() => document.getElementById('spider-man-section').scrollIntoView({ behavior: 'smooth' })}
              title="View My Work"
            >
              <span className="hero-split-label" style={{ color: 'var(--max-neon-red)' }}>SPIDEY</span>
            </div>
            <div
              className="hero-split-half hero-split-half-right"
              onClick={() => document.getElementById('peter-parker-section').scrollIntoView({ behavior: 'smooth' })}
              title="View About Me"
            >
              <span className="hero-split-label" style={{ color: 'var(--max-neon-blue)' }}>PETER</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Absolute positioning marquees for chaos */}
      <div className="marquee-container hero-marquee-1" style={{ background: 'var(--max-neon-red)', color: 'var(--max-black)' }}>
        <div className="marquee-content">
          {Array(10).fill('WEB ARCHITECT / CREATIVE DEVELOPER / ').map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
      
    </section>
  );
}

export default Hero;
