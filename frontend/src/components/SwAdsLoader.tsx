import { useEffect, useState } from 'react';
import './sw-ads-loader.css';

/**
 * The SW ADS loading screen — port of the #loader block at the head of
 * resources/views/ads/sidebar.blade.php.
 *
 * The blade holds it for 1.6s after load, then fades it over 0.8s, which gives
 * the 1.4s top-to-bottom reveal of the icon room to finish. One component so
 * the Super-Ads pages and the two business auth pages, which the client wants
 * to load behind the same icon, cannot drift apart.
 */
export function SwAdsLoader() {
  const [faded, setFaded] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let fade: ReturnType<typeof setTimeout>;
    let remove: ReturnType<typeof setTimeout>;
    const start = () => {
      fade = setTimeout(() => {
        setFaded(true);
        remove = setTimeout(() => setGone(true), 800);
      }, 1600);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
    return () => {
      window.removeEventListener('load', start);
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`sw-ads-loader${faded ? ' is-faded' : ''}`}>
      <img src="/assets/images/logo-sw-ads.png" alt="Loading..." />
    </div>
  );
}
