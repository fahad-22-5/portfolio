import './App.css';
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
  return (
    <div className="App">
      <Navbar />
      <Hero />
      <div className="section-divider"></div>
      
      <PersonaHeader id="spider-man-section" title="Spider-Man" subtitle="My Work & Stuff" color="red" />
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
