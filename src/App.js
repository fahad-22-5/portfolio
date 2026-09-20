import React, { useState, useCallback } from 'react';
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

function App() {
  const [bannerVisible, setBannerVisible] = useState(true);
  const handleBannerVisibility = useCallback((isVisible) => {
    setBannerVisible(isVisible);
  }, []);

  return (
    <div className="App" style={{ '--banner-height': bannerVisible ? '38px' : '0px' }}>
      <RenovationBanner onVisibilityChange={handleBannerVisibility} />
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

export default App;
