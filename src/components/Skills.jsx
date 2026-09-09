import React, { useEffect, useRef } from 'react';
import './Skills.css';

const skillCategories = [
  {
    title: 'BACKEND_CORE',
    skills: [
      { name: '.NET', level: 90 },
      { name: 'C#', level: 95 },
      { name: 'SQL', level: 85 },
      { name: 'RabbitMQ', level: 75 }
    ]
  },
  {
    title: 'SYS_LANGUAGES',
    skills: [
      { name: 'C/C++', level: 80 },
      { name: 'Java', level: 85 },
      { name: 'Python', level: 90 },
      { name: 'JavaScript', level: 95 }
    ]
  },
  {
    title: 'FRONTEND_GUI',
    skills: [
      { name: 'React.js', level: 95 },
      { name: 'React Native', level: 85 },
      { name: 'HTML5/CSS3', level: 90 }
    ]
  },
  {
    title: 'CLOUD_INFRA',
    skills: [
      { name: 'AWS', level: 70 },
      { name: 'GCP', level: 75 },
      { name: 'Git/GitHub', level: 95 },
      { name: 'AI/ML', level: 60 }
    ]
  },
];

function Skills() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scanning');
          }
        });
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="tech-hud" id="skills" ref={sectionRef}>
      <div className="hud-overlay"></div>
      
      <div className="hud-header">
        <h2 className="hud-title glitch-text" data-text="SYS.DIAGNOSTIC // SKILLS">
          SYS.DIAGNOSTIC // SKILLS
        </h2>
        <div className="hud-status">STATUS: OPTIMAL</div>
      </div>

      <div className="hud-grid">
        {skillCategories.map((cat, i) => (
          <div key={i} className="hud-panel">
            <div className="hud-panel-header">
              <span className="hud-bracket">[</span>
              <h3>{cat.title}</h3>
              <span className="hud-bracket">]</span>
            </div>
            
            <div className="hud-skills-list">
              {cat.skills.map((skill, j) => (
                <div key={j} className="hud-skill-row">
                  <span className="hud-skill-name">{skill.name}</span>
                  <div className="hud-progress-track">
                    <div className="hud-progress-bar" style={{ width: `${skill.level}%` }}></div>
                  </div>
                  <span className="hud-skill-level">{skill.level}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hud-footer">
        <div className="hud-scanline"></div>
        <div className="hud-soft-skills">
          <span className="hud-label">SECONDARY_PROCESSES:</span>
          {['Problem-solving', 'Communication', 'Analytical Thinking', 'Leadership'].map((s, i) => (
            <span key={i} className="hud-soft-tag">&lt;{s}&gt;</span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Skills;
