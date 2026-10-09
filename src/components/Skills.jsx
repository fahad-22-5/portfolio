import React, { useEffect, useRef } from 'react';
import './Skills.css';

const skillCategories = [
  {
    title: 'Backend Core',
    color: 'red',
    skills: ['.NET', 'C#', 'RabbitMQ', 'Windows Services', 'RESTful APIs', 'Unit Testing', 'OOPs', 'API Design'],
  },
  {
    title: 'Databases & Storage',
    color: 'cyan',
    skills: ['MySQL', 'SQL Server', 'Stored Procedures', 'Database Design', 'NoSQL'],
  },
  {
    title: 'Tools & Cloud',
    color: 'yellow',
    skills: ['Claude Code', 'Antigravity', 'Cursor', 'Codex', 'AWS', 'GCP', 'Git', 'GitHub', 'Bitbucket'],
  },
  {
    title: 'AI & Architecture',
    color: 'magenta',
    skills: ['RAG', 'AI Agents', 'Data Structures & Algorithms', 'System Design', 'Debugging & Root-Cause Analysis'],
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

        {/* Soft skills & Practices */}
        <div className="skills__soft reveal">
          <h3 className="skills__soft-title comic-heading">Also Known For</h3>
          <div className="skills__soft-list">
            {['System Design', 'Debugging & Root-Cause Analysis', 'Cross-Team Collaboration', 'Documentation', 'Decision-Making', 'Agile Practices', 'Continuous Learning'].map((s, i) => (
              <span key={i} className="skills__soft-tag">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Skills;
