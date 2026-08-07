import React from 'react';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="section-divider"></div>
      <div className="footer__inner">
        <div className="footer__left">
          <span className="footer__logo comic-heading">Fahad<span className="footer__logo-dot">.</span></span>
          <p className="footer__copy">© {currentYear} Fahad Eqbal Hashmi. All rights reserved.</p>
        </div>

        <div className="footer__right">
          <a href="mailto:eqbalfahad@gmail.com" className="footer__link">Email</a>
          <span className="footer__divider">·</span>
          <a href="https://www.linkedin.com/in/fahadeqbalhashmi" target="_blank" rel="noopener noreferrer" className="footer__link">LinkedIn</a>
        </div>
      </div>

      <p className="footer__credit">
        Designed & built with <span className="footer__heart">♥</span> and a lot of <span className="footer__coffee">☕</span>
      </p>
    </footer>
  );
}

export default Footer;
