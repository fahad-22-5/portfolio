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

const MarqueeDivider = ({ text, bg, color, rotate }) => (
  <div className="marquee-container" style={{ background: bg, color: color, transform: `rotate(${rotate}deg) scale(1.05)`, margin: '4rem 0' }}>
    <div className="marquee-content">
      {Array(10).fill(text).map((t, i) => (
        <span key={i} style={{ padding: '0 2rem' }}>{t}</span>
      ))}
    </div>
  </div>
);

function App() {
  if (window.location.pathname === '/barista') {
    return <Barista />;
  }

  return (
    <div className="App">
      <div className="noise-overlay"></div>
      
      <Navbar />
      <Hero />
      
      <MarqueeDivider text="WARNING: RADIOACTIVE // SPIDER SENSE //" bg="var(--max-neon-yellow)" color="var(--max-black)" rotate="-2" />

      <PersonaHeader id="spider-man-section" title="SPIDER-MAN" subtitle="Swinging past bugs straight into production" color="var(--max-neon-red)" />
      <Experience />
      
      <MarqueeDivider text="TECH STACK // WEB SHOOTERS // SKILLS //" bg="var(--max-neon-blue)" color="var(--max-black)" rotate="3" />
      <Skills />
      
      <MarqueeDivider text="PUBLICATIONS // MULTIVERSE // ACADEMIA //" bg="var(--max-neon-green)" color="var(--max-black)" rotate="-1" />
      <Publications />

      <MarqueeDivider text="WHO IS HE? // SECRET IDENTITY //" bg="var(--max-neon-purple)" color="var(--max-white)" rotate="2" />

      <PersonaHeader id="peter-parker-section" title="PETER PARKER" subtitle="The Guy Behind the Mask" color="var(--max-neon-blue)" />
      <About />
      <FunFacts />
      
      <MarqueeDivider text="PING ME // LETS TALK //" bg="var(--max-neon-red)" color="var(--max-black)" rotate="-2" />
      <Contact />
      <Footer />
    </div>
  );
}

export default App;
