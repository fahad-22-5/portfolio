import React from 'react';
import { profile } from '../data';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>© {new Date().getFullYear()} {profile.name}</p>
        <p className="mono">Built with React, caffeine and a lot of server logs.</p>
        <span className="footer__links">
          <a href="/warehouse" className="mono footer__replay">Play the warehouse ▶</a>
          <button type="button" className="mono footer__replay" onClick={() => window.dispatchEvent(new Event('intro:replay'))}>
            Replay intro ↺
          </button>
          <a href="#top" className="mono">Back to top ↑</a>
        </span>
      </div>
    </footer>
  );
}
