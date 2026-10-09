import React from 'react';
import { TypeAnimation } from 'react-type-animation';

function TypeAni() {
  return (
    <TypeAnimation
      sequence={[
        'BACKEND SOFTWARE ENGINEER',
        1200,
        '.NET / C# DEVELOPER',
        1200,
        'WAREHOUSE AUTOMATION ARCHITECT',
        1200,
        'HIGH-THROUGHPUT SYSTEMS BUILDER',
        1200,
        'AI-ASSISTED WORKFLOW EXPERT',
        1200,
      ]}
      wrapper="span"
      speed={50}
      style={{
        fontSize: 'inherit',
        display: 'inline-block',
        color: 'var(--sv-yellow)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
      }}
      repeat={Infinity}
    />
  );
}

export default TypeAni;
