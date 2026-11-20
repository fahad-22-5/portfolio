import React from 'react';

// Segmented progress bar borrowed from the warehouse game's shift card.
export default function Segments({ total, done, active = -1, label }) {
  return (
    <div className="segs" role="img" aria-label={label || `${done} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`segs__seg ${i < done ? 'segs__seg--done' : ''} ${i === active ? 'segs__seg--active' : ''}`}
        />
      ))}
    </div>
  );
}
