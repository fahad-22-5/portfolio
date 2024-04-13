import React from 'react'
import './Skills.css'
import '../App.css'

function Skills() { 
  return (
    <div className='Skills About'>
      <h2 className='AboutMe SkillsHead'>SKILLS</h2>
      <div className="skillBox">
        <div className="Box One">
        <button className='Title SkillBtn'>Programming Languages</button>
            <button className='SkillBtn'>C/C++</button>
            <button className='SkillBtn'>Python</button>
            <button className='SkillBtn'>Java</button>
            <button className='SkillBtn'>Solidity</button>
            <button className='SkillBtn'>C#</button>
            <button className='SkillBtn'>SQL</button>
        </div>
        <div className="Box Two">
        <button className='Title SkillBtn'>Frontend</button>
            <button className='SkillBtn'>HTML5</button>
            <button className='SkillBtn'>CSS3</button>
            <button className='SkillBtn'>JavaScript</button>
            <button className='SkillBtn'>ReactJs</button>
            <button className='SkillBtn'>React Native</button>
        </div>
        <div className="Box Three">
        <button className='Title SkillBtn'>Technologies</button>
            <button className='SkillBtn'>AWS</button>
            <button className='SkillBtn'>Salesforce</button>
            <button className='SkillBtn'>MongoDB</button>
            <button className='SkillBtn'>GCP</button>
            <button className='SkillBtn'>AI/ML</button>

        </div>
      </div>
    </div>
  )
}

export default Skills
