import React, { useState, useEffect } from 'react';
import './Navbar.css';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Determine active section
      const sections = ['hero', 'about', 'experience', 'skills', 'publications', 'funfacts', 'contact'];
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.getBoundingClientRect().top <= 200) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'experience', label: 'EXPERIENCE' },
    { id: 'skills', label: 'SKILLS' },
    { id: 'publications', label: 'RESEARCH' },
    { id: 'about', label: 'THE HUMAN' },
    { id: 'contact', label: 'PING ME' },
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`} id="navbar">
      <div className="navbar-inner">
        <button className="navbar-logo glitch-text" data-text="F." onClick={() => scrollTo('hero')}>
          F<span style={{ color: 'var(--max-neon-red)' }}>.</span>
        </button>

        <div className={`navbar-links ${mobileOpen ? 'navbar-links-open' : ''}`}>
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`navbar-link ${activeSection === link.id ? 'navbar-link-active' : ''}`}
              onClick={() => scrollTo(link.id)}
            >
              {link.label}
            </button>
          ))}
        </div>

        <button
          className={`navbar-hamburger ${mobileOpen ? 'navbar-hamburger-open' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
