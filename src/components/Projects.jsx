import React, { useEffect, useRef, useState } from 'react';
import './Projects.css';

const projects = [
  {
    title: 'Sign-ificant',
    subtitle: 'An American Sign Language Detector',
    color: 'red',
    issue: '#001',
    description:
      'Real-time detection of American Sign Language using Computer Vision and Machine Learning. Self-created a massive image dataset of 40,000+ images and trained a CNN model for accurate gesture recognition.',
    tech: ['Python', 'CNN', 'OpenCV', 'TensorFlow', 'Computer Vision'],
    highlights: [
      '40,000+ self-created training images',
      'Real-time gesture detection',
      'IEEE Published research paper',
    ],
  },
  {
    title: 'DeSocial',
    subtitle: 'Blockchain-Based Social Media',
    color: 'cyan',
    issue: '#002',
    description:
      'A decentralized social media application built on Ethereum blockchain for transparency and security. Leverages Moralis Web3 API for seamless blockchain integration.',
    tech: ['Solidity', 'Ethereum', 'Moralis', 'React', 'Web3', 'Remix'],
    highlights: [
      'Smart Contract backend on Ethereum',
      'Moralis Web3 API integration',
      'Decentralized & censorship-resistant',
    ],
  },
];

function Projects() {
  const sectionRef = useRef(null);
  const [flipped, setFlipped] = useState(null);

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
    <section className="projects benday-bg" id="projects" ref={sectionRef}>
      <div className="projects__container section-container">
        <div className="projects__header reveal">
          <h2 className="projects__title comic-heading">
            <span className="projects__title-accent">Featured</span> Projects
          </h2>
          <div className="projects__title-line"></div>
        </div>

        <div className="projects__grid">
          {projects.map((project, i) => (
            <div
              key={i}
              className={`projects__card reveal projects__card--${project.color} ${flipped === i ? 'projects__card--flipped' : ''}`}
              style={{ transitionDelay: `${i * 0.15}s` }}
              onClick={() => setFlipped(flipped === i ? null : i)}
            >
              {/* Front */}
              <div className="projects__card-front">
                <div className="projects__card-issue comic-heading">{project.issue}</div>
                <div className="projects__card-cover">
                  <h3 className="projects__card-title comic-heading">{project.title}</h3>
                  <p className="projects__card-subtitle">{project.subtitle}</p>
                </div>
                <div className="projects__card-bottom">
                  <span className="projects__card-flip-hint">Click to read more →</span>
                </div>
              </div>

              {/* Back */}
              <div className="projects__card-back">
                <h3 className="projects__card-back-title comic-heading">{project.title}</h3>
                <p className="projects__card-desc">{project.description}</p>

                <div className="projects__card-highlights">
                  {project.highlights.map((h, j) => (
                    <div key={j} className="projects__card-highlight">
                      <span className="projects__card-highlight-dot">●</span>
                      {h}
                    </div>
                  ))}
                </div>

                <div className="projects__card-tech">
                  {project.tech.map((t, j) => (
                    <span key={j} className={`projects__tech-tag projects__tech-tag--${project.color}`}>
                      {t}
                    </span>
                  ))}
                </div>

                <span className="projects__card-flip-hint">Click to flip back →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Projects;
