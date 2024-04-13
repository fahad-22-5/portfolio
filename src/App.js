import './App.css';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import About from './components/About';
import Skills from './components/Skills';
import Contact from './components/Contact';



function App() {

  return (
    <div className="App">
      <div className='Panel'>
        <LeftPanel/>
        <RightPanel/>
      </div>
      <About/>
      <Skills/>
      <Contact/>
    </div>
  );
}

export default App;
