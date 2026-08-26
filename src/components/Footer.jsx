import React from 'react';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer checker-bg">
      <div className="footer-marquee">
        <div className="marquee-content-fast">
          {Array(20).fill('END OF LINE / OVER AND OUT / ').map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      </div>
      <div className="footer-inner section-container">
        <div className="footer-left">
          <span className="footer-logo glitch-text" data-text="FAHAD">FAHAD</span>
          <p className="footer-copy">© {currentYear} FAHAD EQBAL HASHMI.</p>
        </div>

        <div className="footer-right">
          <p className="footer-credit">
            BUILT WITH <span style={{ color: 'var(--max-neon-pink)' }}>CHAOS</span> & <span style={{ color: 'var(--max-neon-yellow)' }}>COFFEE</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
