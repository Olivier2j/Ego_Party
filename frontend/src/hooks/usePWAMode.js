import { useEffect, useState } from 'react';

/**
 * Detects whether the app is running as an installed PWA (standalone mode).
 * Returns true when launched from the home screen (Android/iOS) or from the
 * installed PWA window on desktop — returns false in any regular browser tab.
 *
 * Reacts live to display-mode changes (e.g. user opens in browser vs app).
 */
export default function usePWAMode() {
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: minimal-ui)').matches ||
      // iOS Safari legacy flag
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = (e) => setIsStandalone(e.matches);
    // addEventListener isn't supported in old Safari — fallback to addListener
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  return isStandalone;
}
