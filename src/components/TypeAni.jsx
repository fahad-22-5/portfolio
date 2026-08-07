import React from 'react';
import { TypeAnimation } from 'react-type-animation';

function TypeAni() {
  return (
    <TypeAnimation
      sequence={[
        'SOFTWARE DEVELOPER',
        1200,
        'BACKEND ENGINEER',
        1200,
        'SUPPLY CHAIN TECH BUILDER',
        1200,
        'WAREHOUSE SYSTEMS ARCHITECT',
        1200,
        'DATABASE ARCHITECT',
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
