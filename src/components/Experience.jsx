import React, { useEffect, useRef } from 'react';
import './Experience.css';

const experiences = [
  {
    role: 'Software Developer',
    company: 'Falcon Autotech',
    period: 'Jul 2024 – Present',
    location: 'Noida, India',
    color: 'pink',
    bullets: [
      'Architected a high-throughput core sortation service capable of handling extreme loads, successfully processing over 100,000 parcels a day and built to reliably sustain peak loads of 10,000+ parcels per hour.',
      'Delivered an end-to-end automation project for one of India\'s largest retail companies, integrating PTL (Put-to-Light) systems, conveyors, a .NET web backend, and client-facing RabbitMQ integration APIs.',
      'Managed a 2.5-month on-site deployment in Madrid, Spain to integrate critical sorting and warehouse automation software for a major European last-mile e-commerce logistics provider.',
      'Developing PLC communication layers to interface software systems with physical sortation hardware on the warehouse floor.',
      'Implementing cron-based job schedulers for automated report generation, data syncing, and system health monitoring.',
      'Writing optimized stored procedures and managing SQL data flows aligned with high-volume sortation system requirements.',
    ],
    tech: ['.NET', 'C#', 'SQL', 'RabbitMQ', 'MySQL', 'REST APIs', 'PLC', 'Cron Jobs'],
    rotate: -1
  },
  {
    role: 'Salesforce Developer Intern',
    company: 'SmartBridge',
    period: 'May 2023 – Jul 2023',
    location: 'Remote',
    color: 'blue',
    bullets: [
      'Completed 3+ cloud projects and 10+ comprehensive Salesforce modules.',
      'Developed custom applications using Apex and Flows to automate business processes.',
      'Implemented Shield Platform encryption to enhance data security.',
    ],
    tech: ['Apex', 'Salesforce', 'Flows', 'Shield Encryption'],
    rotate: 2
  },
  {
    role: 'Frontend Developer Intern',
    company: 'Ulavi Technologies',
    period: 'Jan 2023 – May 2023',
    location: 'Singapore',
    color: 'green',
    bullets: [
      'Built attraction ticketing website with React and Tailwind CSS.',
      'Achieved 20% reduction in page load times through performance optimization.',
      'Adopted Agile methodologies for 25% faster project delivery.',
    ],
    tech: ['React', 'Tailwind CSS', 'JavaScript', 'Agile'],
    rotate: -1
  },
];

function Experience() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="comic-experience" id="experience" ref={sectionRef}>
      
      <div className="comic-exp-header">
        <h2 className="huge-heading glitch-text" data-text="ORIGIN STORY">
          ORIGIN STORY
        </h2>
        <div className="exp-volume-box">VOL. 1</div>
      </div>

      <div className="comic-gutter-timeline">
        {experiences.map((exp, i) => (
          <div 
            key={i} 
            className={`comic-exp-panel panel-color-${exp.color}`}
            style={{ transform: `rotate(${exp.rotate}deg)` }}
          >
            <div className="exp-panel-header">
              <div className="exp-company-box">{exp.company}</div>
              <div className="exp-meta-box">
                {exp.period} | {exp.location}
              </div>
            </div>
            
            <h3 className="exp-role glitch-text" data-text={exp.role}>{exp.role}</h3>
            
            <div className="exp-bullets">
              {exp.bullets.map((bullet, j) => (
                <div key={j} className="exp-bullet-item">
                  <span className="exp-bullet-icon">■</span>
                  <p>{bullet}</p>
                </div>
              ))}
            </div>

            <div className="exp-tech-strip">
              {exp.tech.map((t, j) => (
                <span key={j} className="exp-tech-tag">{t}</span>
              ))}
            </div>

            {/* Decorative comic element */}
            <div className={`exp-sfx exp-sfx-${i + 1}`}>
              {i === 0 ? "KABOOM!" : i === 1 ? "ZAP!" : "WHAM!"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Experience;
