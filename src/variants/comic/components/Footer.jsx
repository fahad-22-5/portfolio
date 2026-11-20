import React from 'react';
import { profile } from '../data';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>© {new Date().getFullYear()} {profile.name}</p>
        <p className="mono">Built with React, caffeine and a lot of server logs.</p>
        <a href="#top" className="mono">Back to top ↑</a>
      </div>
    </footer>
  );
}
