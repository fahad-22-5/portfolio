/**
 * Google Analytics 4 (GA4) Tracking Utility
 * 
 * Provides automated page view tracking for React Router SPA routes
 * and custom event dispatching (e.g. contact form submissions, warehouse entry).
 */

const GA_MEASUREMENT_ID = process.env.REACT_APP_GA_MEASUREMENT_ID;

/**
 * Checks if a valid GA4 Measurement ID is provided.
 */
export const isGAConfigured = () => {
  return Boolean(
    GA_MEASUREMENT_ID &&
    GA_MEASUREMENT_ID.trim() !== '' &&
    GA_MEASUREMENT_ID.startsWith('G-')
  );
};

/**
 * Initializes Google Analytics 4 gtag.js script asynchronously.
 */
export const initGA = () => {
  if (!isGAConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info(
        '%c[GA4 Analytics]%c Measurement ID not found in .env (REACT_APP_GA_MEASUREMENT_ID). Set it to enable visitor location tracking.',
        'color: #e23636; font-weight: bold;',
        'color: #94a3b8;'
      );
    }
    return false;
  }

  // Avoid inserting duplicate script tags
  if (document.getElementById('ga-gtag-script')) {
    return true;
  }

  // Inject Google Tag Manager / gtag.js
  const script = document.createElement('script');
  script.id = 'ga-gtag-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID.trim()}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag('js', new Date());

  // Disable automatic page_view so React Router can manually control it on route changes
  gtag('config', GA_MEASUREMENT_ID.trim(), {
    send_page_view: false,
    anonymize_ip: false, // Ensures accurate country/city geolocation resolution
  });

  return true;
};

/**
 * Tracks a page view event.
 * @param {string} path - URL path (e.g. '/' or '/warehouse')
 * @param {string} title - Optional document title
 */
export const trackPageView = (path, title) => {
  const currentPath = path || window.location.pathname;
  const currentTitle = title || document.title;

  if (isGAConfigured() && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: currentPath,
      page_location: window.location.href,
      page_title: currentTitle,
    });
  } else if (process.env.NODE_ENV === 'development') {
    console.debug(`[GA4 Dev] Page View: ${currentPath} ("${currentTitle}")`);
  }
};

/**
 * Tracks custom user interactions and events.
 * @param {string} eventName - Name of the event (e.g. 'contact_message_sent', 'warehouse_opened')
 * @param {object} eventParams - Optional key-value parameters
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (isGAConfigured() && window.gtag) {
    window.gtag('event', eventName, eventParams);
  } else if (process.env.NODE_ENV === 'development') {
    console.debug(`[GA4 Dev] Event: ${eventName}`, eventParams);
  }
};
