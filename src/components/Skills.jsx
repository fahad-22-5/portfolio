import React, { useEffect, useRef } from 'react';
import './Skills.css';

const skillCategories = [
  {
    title: 'Backend & Core',
    color: 'red',
    skills: ['.NET', 'C#', 'SQL', 'MySQL', 'RabbitMQ', 'Firebase', 'PostgreSQL'],
  },
  {
    title: 'Languages',
    color: 'cyan',
    skills: ['C/C++', 'Java', 'Python', 'JavaScript', 'Solidity'],
  },
  {
    title: 'Frontend',
    color: 'magenta',
    skills: ['React.js', 'React Native', 'HTML5', 'CSS3'],
  },
  {
    title: 'Cloud & Tools',
    color: 'yellow',
    skills: ['AWS', 'GCP', 'Git', 'GitHub', 'Salesforce', 'AI/ML'],
  },
];

function Skills() {
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
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="skills" id="skills" ref={sectionRef}>
      <div className="skills__container section-container">
        <div className="skills__header reveal">
          <h2 className="skills__title comic-heading">
            <span className="skills__title-accent">My</span> Skills
          </h2>
          <div className="skills__title-line"></div>
        </div>

        <div className="skills__grid">
          {skillCategories.map((cat, i) => (
            <div
              key={i}
              className={`skills__category reveal skills__category--${cat.color}`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <h3 className={`skills__category-title skills__category-title--${cat.color}`}>
                {cat.title}
              </h3>
              <div className="skills__tags">
                {cat.skills.map((skill, j) => (
                  <span
                    key={j}
                    className={`skills__tag skills__tag--${cat.color}`}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Soft skills */}
        <div className="skills__soft reveal">
          <h3 className="skills__soft-title comic-heading">Also Known For</h3>
          <div className="skills__soft-list">
            {['Problem-solving', 'Communication', 'Analytical Thinking', 'Leadership', 'Flexibility'].map((s, i) => (
              <span key={i} className="skills__soft-tag">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Skills;
