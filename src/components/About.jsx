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
    { icon: '🎓', label: '3-Continent Education', detail: 'India → London → New York' },
    { icon: '📄', label: '2 Research Papers', detail: 'IEEE + Wiley (HBET)' },
    { icon: '✈️', label: 'Global Deployment', detail: '2.5 Months in Madrid, Spain' },
    { icon: '🏢', label: 'Workshop Alumni', detail: 'Google, Microsoft, Columbia' },
  ];

  return (
    <section className="about halftone-bg" id="about" ref={sectionRef}>
      <div className="about__container section-container">
        <div className="about__header reveal">
          <h2 className="about__title comic-heading">
            <span className="about__title-accent">About</span> Me
          </h2>
          <div className="about__title-line"></div>
        </div>

        <div className="about__content">
          <div className="about__speech reveal">
            <div className="about__speech-bubble">
              <p className="about__bio">
                Ok, let's do this one last time! My name is <strong>Fahad</strong>. A while back,
                I was bitten by a coding bug and for the past <strong>six years</strong>, I've been
                diving into code like nobody's business. I think you know the rest — building apps,
                debugging nightmares, the whole web.
              </p>
              <p className="about__bio about__bio--accent">
                Currently at <strong>Falcon Autotech</strong>, coding the automation that gets your
                package sorted — literally. My main stack is <strong>.NET backend</strong>, and I
                specialize in building <strong>high-throughput Warehouse Management and Control Systems</strong> that
                power the supply chain under extreme load. I work across the full logistics
                stack — from <strong>PLC communication</strong> on the warehouse floor to integrating
                <strong> conveyors and PTL systems</strong>, <strong>RESTful APIs</strong>, and <strong>RabbitMQ
                message queues</strong> that reliably process over 100,000 parcels a day.
              </p>
            </div>
            <div className="about__speech-tail"></div>
          </div>

          <div className="about__highlights reveal stagger-children">
            {highlights.map((item, i) => (
              <div key={i} className="about__highlight-card reveal">
                <span className="about__highlight-icon">{item.icon}</span>
                <div>
                  <p className="about__highlight-label">{item.label}</p>
                  <p className="about__highlight-detail">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="about__education reveal">
          <h3 className="about__edu-title comic-heading">Education</h3>
          <div className="about__edu-grid">
            <div className="about__edu-card">
              <div className="about__edu-year">2020 – 2024</div>
              <h4 className="about__edu-name">Amity University, Noida</h4>
              <p className="about__edu-desc">B.Tech in Computer Science & Engineering</p>
            </div>
            <div className="about__edu-card about__edu-card--accent">
              <div className="about__edu-year">Jan – May 2023</div>
              <h4 className="about__edu-name">Study Abroad</h4>
              <p className="about__edu-desc">Birkbeck, University of London & Adelphi University, New York</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
