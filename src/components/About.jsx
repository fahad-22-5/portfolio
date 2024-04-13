import React from 'react'
import '../App.css'
import '../components/RightP.css'
import TypeAni from './TypeAni'

function About() {
  return (
    <div className='About'>
      <h2 className='AboutMe'>ABOUT ME</h2>
      <h3 className='AboutText'>"Hey there, A while back, I was bitten by a coding bug and for the past four years, I've been diving into code like nobody's business. I think you know the rest - <br/><TypeAni/></h3>
    </div>
  )
}

export default About
