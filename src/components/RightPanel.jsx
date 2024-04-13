import React from 'react';
import './RightP.css';

function RightPanel() {
  return (
    <div className='RPanel'>
      <div className="nav"> 
        <button className='navButton'>
          About
        </button>
        <button className='navButton'>
          Get in touch!
        </button>
      </div>
      <div className="bubble">
      <h3 style={{padding: '1rem', fontSize: '1.1rem'}}>Software Engineer Fresher: Still Googling Everything, But Learning Fast!</h3>
      </div>
      
    </div>
  )
}

export default RightPanel
