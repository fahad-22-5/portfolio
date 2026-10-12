import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '../utils/analytics';
import './WarehouseBanner.css';

function WarehouseBanner({ top = 36, onVisibilityChange }) {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Duplicate content for seamless marquee loop matching RenovationBanner
  const bannerContent = (
    <>
      <span className="warehouse-banner__item">
        <span className="warehouse-banner__icon">🏭</span>
        Experience The Live 3D Warehouse Simulator
      </span>
      <span className="warehouse-banner__divider">✦</span>
      <span className="warehouse-banner__item">
        <span className="warehouse-banner__icon">🚜</span>
        Drive The Forklift &amp; Explore Automated Sortation
      </span>
      <span className="warehouse-banner__divider">✦</span>
      <span className="warehouse-banner__item">
        <span className="warehouse-banner__icon">📦</span>
        Put-to-Light • ASRS Matrix • .NET &amp; RabbitMQ
      </span>
      <span className="warehouse-banner__divider">✦</span>
      <span className="warehouse-banner__cta-btn">
        <span>🎮</span>
        Test Drive Now →
      </span>
      <span className="warehouse-banner__divider">✦</span>
    </>
  );

  return (
    <div
      className={`warehouse-banner ${closing ? 'warehouse-banner--closing' : ''}`}
      id="warehouse-banner"
      style={{ top: `${top}px` }}
    >
      <Link
        to="/warehouse"
        className="warehouse-banner__track"
        onClick={() => trackEvent('warehouse_banner_clicked')}
        title="Launch 3D Warehouse Simulation"
      >
        {bannerContent}
        {bannerContent}
      </Link>
      <button
        className="warehouse-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss warehouse banner"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export default WarehouseBanner;
