import React, { useEffect, useRef } from 'react';
import './About.css';

function About() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll('.reveal').forEach((el) => {
              el.classList.add('visible');
            });
          }
        });
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const highlights = [
    { icon: '🎓', label: '3-Continent Education', detail: 'India → London → New York', color: 'pink' },
    { icon: '📄', label: '2 Research Papers', detail: 'IEEE + Wiley (HBET)', color: 'blue' },
    { icon: '✈️', label: 'Global Deployment', detail: '2.5 Months in Madrid, Spain', color: 'yellow' },
    { icon: '🏢', label: 'Workshop Alumni', detail: 'Google, Microsoft, Columbia', color: 'green' },
  ];

  return (
    <section className="about checker-bg" id="about" ref={sectionRef}>
      <div className="about-container section-container">
        
        <div className="about-content">
          <div className="about-speech reveal brutal-card" style={{ '--card-color': 'var(--max-neon-blue)' }}>
            <h2 className="huge-heading" style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', marginBottom: '2rem', color: 'var(--max-white)' }}>
              THE HUMAN
            </h2>
            <div className="about-speech-bubble">
              <p className="about-bio">
                Ok, let's do this one last time! My name is <strong>Fahad</strong>. A while back, I was bitten by a coding bug and for the past <strong>six years</strong>, I've been diving into code like nobody's business. I think you know the rest — building apps, debugging nightmares, the whole web.
              </p>
              <div className="max-divider"></div>
              <p className="about-bio">
                Currently at <strong style={{ color: 'var(--max-neon-yellow)' }}>Falcon Autotech</strong>, coding the automation that gets your package sorted — literally. My main stack is <strong>.NET backend</strong>, and I specialize in building <strong>high-throughput Warehouse Management and Control Systems</strong> that power the supply chain under extreme load. I work across the full logistics stack — from <strong>PLC communication</strong> on the warehouse floor to integrating <strong>conveyors and PTL systems</strong>, <strong>RESTful APIs</strong>, and <strong>RabbitMQ message queues</strong> that reliably process over 100,000 parcels a day.
              </p>
            </div>
          </div>

          <div className="about-side">
            <div className="about-highlights reveal stagger-children">
              {highlights.map((item, i) => (
                <div key={i} className="about-highlight-card brutal-card reveal" style={{ '--card-color': `var(--max-neon-${item.color})` }}>
                  <span className="about-highlight-icon">{item.icon}</span>
                  <div>
                    <p className="about-highlight-label">{item.label}</p>
                    <p className="about-highlight-detail">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="about-education reveal brutal-card" style={{ '--card-color': 'var(--max-neon-pink)', marginTop: '2rem' }}>
              <h3 className="about-edu-title">EDUCATION</h3>
              <div className="about-edu-grid">
                <div className="about-edu-card">
                  <div className="max-badge" style={{ background: 'var(--max-white)' }}>2020 – 2024</div>
                  <h4 className="about-edu-name">Amity University, Noida</h4>
                  <p className="about-edu-desc">B.Tech in Computer Science & Engineering</p>
                </div>
                <div className="about-edu-card" style={{ marginTop: '1.5rem' }}>
                  <div className="max-badge" style={{ background: 'var(--max-neon-green)' }}>Jan – May 2023</div>
                  <h4 className="about-edu-name">Study Abroad</h4>
                  <p className="about-edu-desc">Birkbeck, University of London & Adelphi University, New York</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default About;
