import React, { useEffect, useRef } from 'react';
import './FunFacts.css';

const facts = [
  {
    icon: '☕',
    title: 'CAFFEINE POWERED',
    color: 'pink',
    desc: 'Recently tumbled down the specialty coffee rabbit hole. I now measure my code output in shots of espresso and pour-over bloom times.'
  },
  {
    icon: '🕸️',
    title: 'WEB SLINGER',
    color: 'blue',
    desc: "Massive Spider-Man nerd. I spend all day building the web, but I'm still extremely disappointed it doesn't let me swing between skyscrapers."
  },
  {
    icon: '✈️',
    title: 'GLOBE TROTTER',
    color: 'green',
    desc: 'Have passport, will travel. Exploring new countries, getting lost in foreign cities, and pretending I know the local language.'
  },
  {
    icon: '🍿',
    title: 'CINEMA PURIST',
    color: 'yellow',
    desc: "If I'm watching a movie, I'm watching it in a theatre. No exceptions, no laptops, no small screens."
  }
];

function FunFacts() {
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

  return (
    <section className="funfacts" id="funfacts" ref={sectionRef}>
      <div className="funfacts-container section-container">
        
        <div className="funfacts-grid stagger-children">
          {facts.map((fact, i) => (
            <div 
              key={i} 
              className={`funfacts-card brutal-card reveal`}
              style={{ 
                '--card-color': `var(--max-neon-${fact.color})`,
                transform: `rotate(${i % 2 === 0 ? '1deg' : '-1deg'})`
              }}
            >
              <div className="funfacts-icon-wrapper" style={{ background: `var(--max-neon-${fact.color})` }}>
                <span className="funfacts-icon">{fact.icon}</span>
              </div>
              <h3 className="funfacts-card-title">{fact.title}</h3>
              <p className="funfacts-card-desc">{fact.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FunFacts;
