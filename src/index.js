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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={<PageLoader label="Loading portfolio" />}>
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
