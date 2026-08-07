import React, { useEffect, useRef } from 'react';
import './FunFacts.css';

const facts = [
  {
    icon: '☕',
    title: 'Caffeine Powered',
    color: 'magenta',
    desc: 'Recently tumbled down the specialty coffee rabbit hole. I now measure my code output in shots of espresso and pour-over bloom times.'
  },
  {
    icon: '🕸️',
    title: 'Web Slinger',
    color: 'red',
    desc: "Massive Spider-Man nerd. I spend all day building the web, but I'm still extremely disappointed it doesn't let me swing between skyscrapers."
  },
  {
    icon: '✈️',
    title: 'Globe Trotter',
    color: 'cyan',
    desc: 'Have passport, will travel. Exploring new countries, getting lost in foreign cities, and pretending I know the local language.'
  },
  {
    icon: '🍿',
    title: 'Cinema Purist',
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
    <section className="funfacts halftone-bg" id="funfacts" ref={sectionRef}>
      <div className="funfacts__container section-container">
        <div className="funfacts__header reveal">
          <h2 className="funfacts__title comic-heading">
            <span className="funfacts__title-accent">Alter</span> Ego
          </h2>
          <div className="funfacts__title-line"></div>
          <p className="funfacts__subtitle">When I'm not writing code...</p>
        </div>

        <div className="funfacts__grid stagger-children">
          {facts.map((fact, i) => (
            <div key={i} className={`funfacts__card funfacts__card--${fact.color} reveal`}>
              <div className="funfacts__icon-wrapper">
                <span className="funfacts__icon">{fact.icon}</span>
              </div>
              <h3 className={`funfacts__card-title comic-heading funfacts__card-title--${fact.color}`}>
                {fact.title}
              </h3>
              <p className="funfacts__card-desc">{fact.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FunFacts;
