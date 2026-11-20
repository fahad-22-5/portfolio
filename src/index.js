import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import PageLoader from './components/PageLoader';
import reportWebVitals from './reportWebVitals';

// Routing at the entry point (each page is its own lazy chunk, so a page only
// loads its own global CSS):
//   /                 -> the current design (variants/hybrid)
//   /old-portfolio/*  -> the previous site, with its routes under that prefix
//   /warehouse        -> the 3D warehouse game (served by the previous site's router)
//   /preview/*        -> unlisted design previews (noindex)
const Home = lazy(() => import('./variants/hybrid/App'));
const OldSite = lazy(() => import('./App'));

const PREVIEWS = {
  '/preview/manifest-730665': lazy(() => import('./variants/manifest/App')),
  '/preview/comic-2e53ab': lazy(() => import('./variants/comic/App')),
  '/preview/hybrid-f84e5b': Home,
};

const OLD_BASE = '/old-portfolio';
const path = window.location.pathname.replace(/\/+$/, '');
const Preview = PREVIEWS[path];
const isHome = path === '';
const isOld = path === OLD_BASE || path.startsWith(`${OLD_BASE}/`);

if (Preview) {
  const robots = document.createElement('meta');
  robots.name = 'robots';
  robots.content = 'noindex, nofollow';
  document.head.appendChild(robots);
}

let page;
if (Preview) page = <Preview />;
else if (isHome) page = <Home />;
else if (isOld) page = <BrowserRouter basename={OLD_BASE}><OldSite /></BrowserRouter>;
else page = <BrowserRouter><OldSite /></BrowserRouter>;

// Pages with their own intro get a plain dark hold screen instead of the
// previous site's "Loading portfolio" splash.
const fallback = Preview || isHome
  ? <div style={{ position: 'fixed', inset: 0, background: '#0d0d0a' }} aria-hidden="true" />
  : <PageLoader label="Loading portfolio" />;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Suspense fallback={fallback}>{page}</Suspense>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
