import React, { useEffect, useRef } from 'react';
import './Projects.css';

const projects = [
  {
    title: 'Sign-ificant',
    subtitle: 'ASL Detector',
    color: 'red',
    issue: '#001',
    description: 'Real-time detection of ASL using CV and ML. 40,000+ images trained on CNN.',
    tech: ['Python', 'CNN', 'OpenCV'],
    rotate: -4,
    zIndex: 3
  },
  {
    title: 'DeSocial',
    subtitle: 'Web3 Social',
    color: 'cyan',
    issue: '#002',
    description: 'Decentralized social media built on Ethereum blockchain.',
    tech: ['Solidity', 'Ethereum', 'React'],
    rotate: 5,
    zIndex: 2
  },
  {
    title: 'Portfolio',
    subtitle: 'Hyper-Pop',
    color: 'yellow',
    issue: '#003',
    description: 'This very site. A brutalist comic book experience.',
    tech: ['React', 'CSS', 'Design'],
    rotate: -2,
    zIndex: 1
  }
];

function Projects() {
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
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="comic-panel projects-panel reveal" id="projects" ref={sectionRef}>
      
      <div className="projects-header">
        <h2 className="huge-heading glitch-text" data-text="FEATURED ISSUES">
          FEATURED ISSUES
        </h2>
        <div className="barcode"></div>
      </div>

      <div className="comic-rack">
        {projects.map((project, i) => (
          <div 
            key={i} 
            className={`comic-issue-cover cover-${project.color}`}
            style={{ 
              transform: `rotate(${project.rotate}deg)`,
              zIndex: project.zIndex,
              marginLeft: i > 0 ? '-10%' : '0'
            }}
          >
            <div className="cover-header">
              <span className="cover-issue">{project.issue}</span>
              <span className="cover-price">25¢</span>
            </div>
            
            <div className="cover-body">
              <h3 className="cover-title">{project.title}</h3>
              <h4 className="cover-subtitle">{project.subtitle}</h4>
              <p className="cover-desc">{project.description}</p>
              
              <div className="cover-tech">
                {project.tech.map((t, j) => (
                  <span key={j} className="cover-tag">{t}</span>
                ))}
              </div>
            </div>

            <div className="cover-footer">
              APPROVED BY THE COMICS CODE AUTHORITY
            </div>
          </div>
        ))}
      </div>
      
    </section>
  );
}

export default Projects;
