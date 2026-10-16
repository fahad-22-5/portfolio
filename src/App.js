import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import RenovationBanner from './components/RenovationBanner';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import PersonaHeader from './components/PersonaHeader';
import Experience from './components/Experience';
import Skills from './components/Skills';
import FunFacts from './components/FunFacts';
import Publications from './components/Publications';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WarehouseBanner from './components/WarehouseBanner';
import { initGA, trackPageView } from './utils/analytics';

const Warehouse = lazy(() => import('./components/Warehouse'));

function HomePage() {
  const [renovationBannerVisible, setRenovationBannerVisible] = useState(true);
  const [warehouseBannerVisible, setWarehouseBannerVisible] = useState(true);

  const handleRenovationBannerVisibility = useCallback((isVisible) => {
    setRenovationBannerVisible(isVisible);
  }, []);

  const handleWarehouseBannerVisibility = useCallback((isVisible) => {
    setWarehouseBannerVisible(isVisible);
  }, []);

  const totalBannerHeight = (renovationBannerVisible ? 36 : 0) + (warehouseBannerVisible ? 36 : 0);

  return (
    <div className="App" style={{ '--banner-height': `${totalBannerHeight}px` }}>
      <RenovationBanner onVisibilityChange={handleRenovationBannerVisibility} />
      <WarehouseBanner
        top={renovationBannerVisible ? 36 : 0}
        onVisibilityChange={handleWarehouseBannerVisibility}
      />
      <Navbar />
      <Hero />
      <div className="section-divider"></div>

      <PersonaHeader id="spider-man-section" title="Spider-Man" subtitle="Swinging past bugs straight into production" color="red" />
      <Experience />
      <div className="section-divider"></div>
      <Skills />
      <div className="section-divider"></div>
      <Publications />

      <div className="section-divider" style={{ margin: '4rem 0' }}></div>

      <PersonaHeader id="peter-parker-section" title="Peter Parker" subtitle="The Guy Behind the Mask" color="blue" />
      <About />
      <FunFacts />
      <div className="section-divider"></div>
      <Contact />
      <Footer />
    </div>
  );
}

function App() {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/warehouse"
        element={
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0e17' }} />}>
            <Warehouse />
          </Suspense>
        }
      />
    </Routes>
  );
}

export default App;
