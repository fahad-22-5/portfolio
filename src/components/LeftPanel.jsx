import React from 'react'
import './NameCard'
import NameCard from './NameCard'
import '../App.css'

function LeftPanel() {
  return (
    <div className='LPanel'>
      <div className='hoverCard'>
        <NameCard/>
      </div>
    </div>
  )
}

export default LeftPanel
