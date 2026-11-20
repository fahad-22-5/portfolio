import React, { useMemo } from 'react';

// Deterministic decorative barcode derived from a string.
export default function Barcode({ value, height = 56 }) {
  const bars = useMemo(() => {
    const out = [];
    let x = 0;
    const push = (w, fill) => {
      if (fill) out.push({ x, w });
      x += w;
    };
    push(2, true); push(1, false); push(2, true); push(2, false);
    for (const ch of value) {
      const c = ch.charCodeAt(0);
      for (let i = 0; i < 4; i++) {
        push(((c >> i) & 1) + 1, true);
        push(((c >> (i + 3)) & 1) + 1, false);
      }
    }
    push(2, true); push(1, false); push(2, true);
    return { out, width: x };
  }, [value]);

  return (
    <svg
      className="barcode"
      viewBox={`0 0 ${bars.width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Barcode ${value}`}
    >
      {bars.out.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}
