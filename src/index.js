import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PageLoader from './components/PageLoader';
import reportWebVitals from './reportWebVitals';

// Unlisted preview routes for redesign reviews. Each page is its own lazy chunk,
// so a preview only loads its own global CSS and the live site is unaffected.
const PREVIEWS = {
  '/preview/manifest-730665': lazy(() => import('./variants/manifest/App')),
  '/preview/comic-2e53ab': lazy(() => import('./variants/comic/App')),
  '/preview/hybrid-f84e5b': lazy(() => import('./variants/hybrid/App')),
};

const path = window.location.pathname.replace(/\/+$/, '');
const Preview = PREVIEWS[path];
const App = lazy(() => import('./App'));

if (Preview) {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
}

// Previews have their own intro, so they get a plain dark hold screen instead
// of the live site's "Loading portfolio" splash.
const fallback = Preview
  ? <div style={{ position: 'fixed', inset: 0, background: '#0d0d0a' }} aria-hidden="true" />
  : <PageLoader label="Loading portfolio" />;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={fallback}>
      {Preview ? (
        <Preview />
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
