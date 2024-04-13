import React from 'react'
import { TypeAnimation } from 'react-type-animation';

function TypeAni() {
  return (
    <TypeAnimation
      sequence={[
        // Same substring at the start will only be typed out once, initially
        "BUILDING APPS",
        600, // wait 1s before replacing "Mice" with "Hamsters"
        "DEBUGGING NIGHTMARES",
        600,
        "THE WHOLE WEB!",
        600
      ]}
      wrapper="span"
      speed={50}
      style={{ fontSize: '1.5rem', display: 'inline-block' }}
      repeat={Infinity}
    />
  )
}

export default TypeAni
