import React, { useState, useEffect } from 'react';
import './RenovationBanner.css';

function RenovationBanner({ onVisibilityChange }) {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      if (onVisibilityChange) onVisibilityChange(false);
    }, 400);
  };

  useEffect(() => {
    if (visible && onVisibilityChange) {
      onVisibilityChange(true);
    }
  }, [visible, onVisibilityChange]);

  if (!visible) return null;

  // Duplicate content for seamless loop
  const bannerContent = (
    <>
      <span className="renovation-banner__item">
        <span className="renovation-banner__icon">🕸️</span>
        Site Under Renovation — More Things Coming Soon
      </span>
      <span className="renovation-banner__divider">✦</span>
      <span className="renovation-banner__item">
        <span className="renovation-banner__icon">🔧</span>
        Weaving New Features
      </span>
      <span className="renovation-banner__divider">✦</span>
      <span className="renovation-banner__item">
        <span className="renovation-banner__icon">🕷️</span>
        Stay Tuned, True Believer!
      </span>
      <span className="renovation-banner__divider">✦</span>
    </>
  );

  return (
    <div
      className={`renovation-banner ${closing ? 'renovation-banner--closing' : ''}`}
      id="renovation-banner"
    >
      <div className="renovation-banner__track">
        {bannerContent}
        {bannerContent}
      </div>
      <button
        className="renovation-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss renovation banner"
      >
        ✕
      </button>
    </div>
  );
}

export default RenovationBanner;
