import React from 'react';
import './index.css';
import loadFonts from '../loadFonts';
import Nav from './components/Nav';
import Hero from './components/Hero';
import Conveyor from './components/Conveyor';
import Experience from './components/Experience';
import Skills from './components/Skills';
import Research from './components/Research';
import About from './components/About';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Intro from './components/Intro';
import TrackingRail from './components/TrackingRail';

loadFonts('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

export default function App() {
  return (
    <>
      <Intro />
      <a className="skip-link" href="#work">Skip to content</a>
      <Nav />
      <TrackingRail />
      <main>
        <Hero />
        <Conveyor />
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
