import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import Barista from './components/Barista';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <>
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
            </>
          } />
          
          <Route path="/barista" element={<Barista />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
