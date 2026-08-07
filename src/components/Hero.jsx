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

      {/* Animated background particles */}
      <div className="hero__particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="hero__particle" style={{
            '--delay': `${Math.random() * 5}s`,
            '--x': `${Math.random() * 100}%`,
            '--duration': `${3 + Math.random() * 4}s`,
            '--size': `${2 + Math.random() * 4}px`,
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

        {/* Right side: Split Face Interactive Image */}
        <div className="hero__split-face-wrapper" ref={cardRef}>
          <div className="hero__split-face">
            {/* Split Image */}
            <img src="/split-face.jpg" alt="Spider-Man and Peter Parker" className="hero__split-img" />

            {/* Clickable halves */}
            <div
              className="hero__split-half hero__split-half--left"
              onClick={() => document.getElementById('spider-man-section').scrollIntoView({ behavior: 'smooth' })}
              title="View My Work"
            >
              <span className="hero__split-label">WORK</span>
            </div>
            <div
              className="hero__split-half hero__split-half--right"
              onClick={() => document.getElementById('peter-parker-section').scrollIntoView({ behavior: 'smooth' })}
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
