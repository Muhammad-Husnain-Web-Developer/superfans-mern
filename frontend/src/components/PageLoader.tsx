import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localeLogo } from '../pages/auth/AuthShell';

/**
 * How long after a login this loader stands down, in ms. The login navigates within a
 * frame or two of marking the window, so this only has to outlast that hop.
 */
const LOGIN_SUPPRESS_MS = 2000;

let suppressedUntil = 0;

/**
 * Called by the login flows just before they hand over to the page behind them.
 *
 * Both of them already draw their own loading screen — the percentage bar in
 * components/LoginLoader — and the page they land on would otherwise mount this one
 * straight afterwards and play its full 2.6s fade over a document that finished loading
 * long ago, so the reader watches two loading screens in a row for about five seconds.
 * The blade never had that problem: there, login was a redirect into a real page load,
 * and #loader was the only loading screen in the app.
 *
 * A short window rather than a flag that waits to be consumed: business accounts land on
 * /super-ads, which draws no loader at all, and an unconsumed flag would then sit there
 * and silence the next page that does draw one.
 */
export function suppressPageLoaderAfterLogin(): void {
  suppressedUntil = Date.now() + LOGIN_SUPPRESS_MS;
}

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
  /* read, never cleared — the window closes on its own, so this stays safe to call
     twice on the same mount the way StrictMode does in development */
  const afterLogin = Date.now() < suppressedUntil;

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

  if (afterLogin || gone) return null;

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
