import React from 'react';
import './PageLoader.css';

/**
 * Full-screen comic-panel loader. Used as the route Suspense fallback; the
 * same markup/classes are inlined in public/index.html as the first-paint
 * splash, so the site, the route transition and the game share one look.
 */
function PageLoader({ label = 'Loading' }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__card">
        <span className="page-loader__tag">⚡ Stand by</span>
        <h2 className="page-loader__title">{label}</h2>
        <div className="page-loader__bar"><div className="page-loader__fill" /></div>
      </div>
    </div>
  );
}

export default PageLoader;
