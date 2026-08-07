import React, { useEffect, useRef } from 'react';
import './Experience.css';

const experiences = [
  {
    role: 'Software Developer',
    company: 'Falcon Autotech',
    period: 'Jul 2024 – Present',
    location: 'Noida, India',
    color: 'red',
    bullets: [
      'Architected a high-throughput core sortation service capable of handling extreme loads, successfully processing over 100,000 parcels a day and built to reliably sustain peak loads of 10,000 parcels per hour.',
      'Delivered an end-to-end automation project for one of India\'s largest retail companies, integrating PTL (Put-to-Light) systems, conveyors, a .NET web backend, and client-facing RabbitMQ integration APIs.',
      'Deployed to Madrid, Spain for 2.5 months to commission and integrate automation software on-site for a major international client.',
      'Developing PLC communication layers to interface software systems with physical sortation hardware on the warehouse floor.',
      'Implementing cron-based job schedulers for automated report generation, data syncing, and system health monitoring.',
      'Writing optimized stored procedures and managing SQL data flows aligned with high-volume sortation system requirements.',
    ],
    tech: ['.NET', 'C#', 'SQL', 'RabbitMQ', 'MySQL', 'REST APIs', 'PLC', 'Cron Jobs'],
  },
  {
    role: 'Salesforce Developer Intern',
    company: 'SmartBridge',
    period: 'May 2023 – Jul 2023',
    location: 'Remote',
    color: 'cyan',
    bullets: [
      'Completed 3+ cloud projects and 10+ comprehensive Salesforce modules.',
      'Developed custom applications using Apex and Flows to automate business processes.',
      'Implemented Shield Platform encryption to enhance data security.',
    ],
    tech: ['Apex', 'Salesforce', 'Flows', 'Shield Encryption'],
  },
  {
    role: 'Frontend Developer Intern',
    company: 'Ulavi Technologies',
    period: 'Jan 2023 – May 2023',
    location: 'Singapore',
    color: 'magenta',
    bullets: [
      'Built attraction ticketing website with React and Tailwind CSS.',
      'Achieved 20% reduction in page load times through performance optimization.',
      'Adopted Agile methodologies for 25% faster project delivery.',
    ],
    tech: ['React', 'Tailwind CSS', 'JavaScript', 'Agile'],
  },
];

function Experience() {
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
      { threshold: 0.05 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="experience" id="experience" ref={sectionRef}>
      <div className="experience__container section-container">
        <div className="experience__header reveal">
          <h2 className="experience__title comic-heading">
            <span className="experience__title-accent">Work</span> Experience
          </h2>
          <div className="experience__title-line"></div>
        </div>

        <div className="experience__timeline">
          {/* Vertical connecting line */}
          <div className="experience__line"></div>

          {experiences.map((exp, i) => (
            <div
              key={i}
              className={`experience__card reveal experience__card--${exp.color}`}
              style={{ transitionDelay: `${i * 0.15}s` }}
            >
              {/* Timeline dot */}
              <div className={`experience__dot experience__dot--${exp.color}`}>
                <div className="experience__dot-inner"></div>
              </div>

              <div className="experience__card-content">
                <div className="experience__card-top">
                  <div>
                    <h3 className="experience__role">{exp.role}</h3>
                    <p className="experience__company">{exp.company}</p>
                  </div>
                  <div className="experience__meta">
                    <span className="experience__period">{exp.period}</span>
                    <span className="experience__location">{exp.location}</span>
                  </div>
                </div>

                <ul className="experience__bullets">
                  {exp.bullets.map((bullet, j) => (
                    <li key={j} className="experience__bullet">{bullet}</li>
                  ))}
                </ul>

                <div className="experience__tech">
                  {exp.tech.map((t, j) => (
                    <span key={j} className={`experience__tech-tag experience__tech-tag--${exp.color}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Experience;
