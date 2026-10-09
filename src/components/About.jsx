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
    { icon: '⚙️', label: '2.5 Years Experience', detail: 'Backend .NET/C# Systems' },
    { icon: '🎓', label: '3-Continent Education', detail: 'India → London → New York' },
    { icon: '✈️', label: 'Global Deployment', detail: '2.5 Months On-Site in Madrid, Spain' },
    { icon: '📄', label: '2 Research Publications', detail: 'IEEE + Wiley (HBET)' },
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
                Ok, let's do this one last time! My name is <strong>Fahad Eqbal Hashmi</strong>. I'm a <strong>Backend-focused Software Engineer</strong> with 2.5 years of real-world experience building high-throughput, critical backend systems in <strong>.NET/C#</strong>. I've owned and delivered end-to-end scalable backend systems for automation across India and 2+ systems internationally for major FMCG/Quick Commerce, e-commerce, retail, and logistics players.
              </p>
              <p className="about__bio about__bio--accent">
                Currently at <strong>Falcon Autotech</strong>, I architect high-throughput core sortation services processing over <strong>100,000 parcels a day</strong> (sustaining peak loads of 10,000+ parcels/hour). My expertise spans <strong>PLC communication layers</strong>, <strong>PTL (Put-to-Light) systems</strong>, <strong>conveyors</strong>, <strong>RESTful APIs</strong>, <strong>RabbitMQ</strong>, and optimized SQL data flows. I'm also proficient in AI-assisted workflows like <strong>Claude Code, Antigravity, Cursor, and Codex</strong> to accelerate delivery.
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
              <p className="about__edu-desc">Bachelor of Technology (B.Tech) in Computer Science & Engineering</p>
            </div>
            <div className="about__edu-card about__edu-card--accent">
              <div className="about__edu-year">Study-Abroad Semester</div>
              <h4 className="about__edu-name">International Academic Exposure</h4>
              <p className="about__edu-desc">Adelphi University (New York, USA) & Birkbeck, University of London (UK)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default About;
