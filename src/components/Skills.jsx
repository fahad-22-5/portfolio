import React, { useEffect, useRef } from 'react';
import './Skills.css';

const skillCategories = [
  {
    title: 'BACKEND & CORE',
    color: 'pink',
    skills: ['.NET', 'C#', 'SQL', 'MySQL', 'RabbitMQ', 'Firebase', 'PostgreSQL'],
  },
  {
    title: 'LANGUAGES',
    color: 'blue',
    skills: ['C/C++', 'Java', 'Python', 'JavaScript', 'Solidity'],
  },
  {
    title: 'FRONTEND',
    color: 'green',
    skills: ['React.js', 'React Native', 'HTML5', 'CSS3'],
  },
  {
    title: 'CLOUD & TOOLS',
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
      <div className="skills-container section-container">
        
        <div className="skills-grid">
          {skillCategories.map((cat, i) => (
            <div
              key={i}
              className={`skills-card brutal-card reveal`}
              style={{ 
                '--card-color': `var(--max-neon-${cat.color})`, 
                transform: `rotate(${i % 2 === 0 ? '-2deg' : '2deg'})`,
                transitionDelay: `${i * 0.1}s` 
              }}
            >
              <h3 className="skills-card-title">{cat.title}</h3>
              <div className="skills-tags">
                {cat.skills.map((skill, j) => (
                  <span key={j} className="skills-tag">{skill}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="skills-soft brutal-card reveal" style={{ '--card-color': 'var(--max-white)', transform: 'rotate(-1deg)' }}>
          <h3 className="skills-card-title" style={{ color: 'var(--max-black)' }}>ALSO KNOWN FOR</h3>
          <div className="skills-tags">
            {['Problem-solving', 'Communication', 'Analytical Thinking', 'Leadership', 'Flexibility'].map((s, i) => (
              <span key={i} className="skills-tag" style={{ background: 'var(--max-black)', color: 'var(--max-white)' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Skills;
