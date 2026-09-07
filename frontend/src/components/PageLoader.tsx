import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localeLogo } from '../pages/auth/AuthShell';

/**
 * Full-screen white loader with the locale Superworld logo —
 * exact port of #loader from layouts_direct_user/header.blade.php:
 * shown immediately, then `opacity 2.6s ease` to 0 and display:none after 10ms
 * of window 'load'. Measured on Laravel: img width 59% (805px @1366), z-index 9999999.
 */
export function PageLoader() {
  const { i18n } = useTranslation();
  const [faded, setFaded] = useState(false);
  const [gone, setGone] = useState(false);
  const { t: tUi } = useTranslation('ui');

  useEffect(() => {
    const start = () => {
      setFaded(true);
      // blade: setTimeout(() => loader.style.display = 'none', 10) — the 2.6s
      // transition keeps it visible while fading, then it is removed.
      setTimeout(() => setGone(true), 2600);
    };
    if (document.readyState === 'complete') {
      start();
      return;
    }
    window.addEventListener('load', start);
    return () => window.removeEventListener('load', start);
  }, []);

  if (gone) return null;

  return (
    <div
      id="loader"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999999,
        transition: faded ? 'opacity 2.6s ease' : undefined,
        opacity: faded ? 0 : 1,
        pointerEvents: faded ? 'none' : undefined,
      }}
    >
      <img src={localeLogo(i18n.resolvedLanguage ?? 'en')} alt={tUi('loading')} style={{ width: '59%' }} />
    </div>
  );
}
