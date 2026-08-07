import React, { useEffect, useRef } from 'react';
import './Publications.css';

const publications = [
  {
    title: 'A Pilot Study of a Gamified CBT-Based Digital Approach for Body Image Distress and Appearance-Related Concerns',
    journal: 'Human Behavior and Emerging Technologies',
    date: 'Jul 2026',
    color: 'magenta',
    description:
      'Body image concerns represent a significant mental health challenge, yet stigma, costs, and limited access to professionals prevent many from seeking help. We developed a pilot-scale serious game integrating Cognitive Behavioral Therapy (CBT) techniques with AI-driven real-time emotional assessment to deliver interactive, personalized guidance. The adaptive feedback system provides more personalized support during gameplay compared to traditional approaches. The AI model achieved 97.15% accuracy on held-out test data, outperforming a BERT-based baseline classifier. The study provides preliminary indications that digital gamification may offer a scalable and accessible approach for mental health support.',
    tags: ['AI/ML', 'CBT', 'Gamification', 'NLP', 'Serious Games', 'Mental Health Tech'],
  },
  {
    title: 'Impact of Colour Image and Skeleton Plotting on Sign Language Recognition Using Convolutional Neural Networks (CNN)',
    journal: 'IEEE',
    date: 'Mar 2024',
    color: 'cyan',
    description:
      'Sign language serves as a powerful and inclusive means of expression for the deaf and hard-of-hearing community. We introduced a CNN-based model for American Sign Language recognition where users capture hand gesture images and the model predicts the sign. The paper defines how different preprocessing techniques — color images vs. skeleton-mapped plotting — impact model accuracy. Using a self-created dataset of 40,000+ images and colored skeleton-mapped sign images, we achieved ~99% accuracy, demonstrating the significant impact of preprocessing on CNN performance.',
    tags: ['CNN', 'Computer Vision', 'Python', 'TensorFlow', 'ASL', 'Image Processing'],
  },
];

function Publications() {
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
    <section className="publications" id="publications" ref={sectionRef}>
      <div className="publications__container section-container">
        <div className="publications__header reveal">
          <h2 className="publications__title comic-heading">
            <span className="publications__title-accent">Research</span> Publications
          </h2>
          <div className="publications__title-line"></div>
        </div>

        <div className="publications__grid">
          {publications.map((pub, i) => (
            <article
              key={i}
              className={`publications__card reveal publications__card--${pub.color}`}
              style={{ transitionDelay: `${i * 0.15}s` }}
            >
              <div className="publications__card-top">
                <span className={`publications__journal publications__journal--${pub.color}`}>
                  {pub.journal}
                </span>
                <span className="publications__date">{pub.date}</span>
              </div>

              <h3 className="publications__card-title">{pub.title}</h3>

              <p className="publications__card-desc">{pub.description}</p>

              <div className="publications__tags">
                {pub.tags.map((tag, j) => (
                  <span key={j} className={`publications__tag publications__tag--${pub.color}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Publications;
