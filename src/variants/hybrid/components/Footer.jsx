import React from 'react';
import { profile } from '../data';
import { trackEvent } from '../../../utils/analytics';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p>© {new Date().getFullYear()} {profile.name}</p>
        <p className="mono">Built with a lot of server logs and caffeine.</p>
        <span className="footer__links">
          <a href="/warehouse" className="mono footer__replay" onClick={() => trackEvent('warehouse_footer_clicked')}>Play the warehouse ▶</a>
          <button type="button" className="mono footer__replay" onClick={() => window.dispatchEvent(new Event('intro:replay'))}>
            Replay intro ↺
          </button>
          <a href="#top" className="mono">Back to top ↑</a>
        </span>
      </div>
    </footer>
  );
}
