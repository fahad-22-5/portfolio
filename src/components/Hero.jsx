import React from 'react';
import './Hero.css';

function Hero() {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero" id="hero">
      {/* Background color blocks */}
      <div className="hero-bg-left"></div>
      <div className="hero-bg-right"></div>

      {/* Main content */}
      <div className="hero-inner">
        
        {/* Giant Name */}
        <div className="hero-name-block">
          <h1 className="hero-name glitch-text" data-text="FAHAD">FAHAD</h1>
          <div className="hero-issue-tag">ISSUE #01 — THE ORIGIN</div>
        </div>

        {/* Two persona cards side by side */}
        <div className="hero-personas">
          <div className="persona-card persona-peter" onClick={() => scrollTo('peter-parker-section')}>
            <div className="persona-label">PETER PARKER</div>
            <h2 className="persona-title">SYSTEMS<br/>ARCHITECT</h2>
            <div className="persona-tags">
              <span className="persona-tag tag-blue">C#</span>
              <span className="persona-tag tag-blue">.NET</span>
              <span className="persona-tag tag-blue">SQL</span>
              <span className="persona-tag tag-blue">RabbitMQ</span>
            </div>
          </div>

          <div className="persona-card persona-spidey" onClick={() => scrollTo('spider-man-section')}>
            <div className="persona-label">SPIDER-MAN</div>
            <h2 className="persona-title">PRODUCTION<br/>HERO</h2>
            <div className="persona-tags">
              <span className="persona-tag tag-red">AWS</span>
              <span className="persona-tag tag-red">Python</span>
              <span className="persona-tag tag-red">React</span>
              <span className="persona-tag tag-red">GCP</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="hero-cta-row">
          <button className="max-btn max-btn-primary" onClick={() => scrollTo('contact')}>THWIP ME</button>
          <button className="max-btn max-btn-secondary" onClick={() => scrollTo('experience')}>SEE SUITS</button>
        </div>

      </div>

      {/* Bottom Marquee */}
      <div className="marquee-container hero-marquee" style={{ background: 'var(--max-neon-yellow)', color: 'var(--max-black)' }}>
        <div className="marquee-content">
          {Array(10).fill('BACKEND ENGINEER / SYSTEMS ARCHITECT / ').map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Hero;
