import React, { useEffect } from 'react';
import { initGA, trackPageView } from '../../utils/analytics';
import './index.css';
import loadFonts from '../loadFonts';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Conveyor from './components/Conveyor';
import Experience from './components/Experience';
import GameDock from './components/GameDock';
import Skills from './components/Skills';
import Research from './components/Research';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Intro from './components/Intro';
import TrackingRail from './components/TrackingRail';
import ScrollCue from './components/ScrollCue';

loadFonts('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

export default function App() {
  useEffect(() => {
    initGA();
    trackPageView(window.location.pathname + window.location.search);
  }, []);

  return (
    <>
      <Intro />
      <a className="skip-link" href="#work">Skip to content</a>
      <Nav />
      <TrackingRail />
      <ScrollCue />
      <main>
        <Hero />
        <Conveyor />
        <GameDock />
        <Experience />
        <Skills />
        <Research />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
