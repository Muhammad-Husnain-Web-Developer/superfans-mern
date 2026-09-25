import { useEffect, useState } from 'react';
import { assetImage } from '../utils/format';
import '../styles/login-loader.css';

/**
 * How long the bar takes to fill. Must match the `animation-duration` on
 * `.login-loader-fill` in the stylesheet, and the wait `Login.tsx` holds after
 * a successful login — the number, the bar and the redirect all finish together.
 */
const FILL_MS = 2000;

/**
 * The loading screen shown once, the first time this browser session logs in.
 *
 * The client's brief: the Superheroina artwork on a white field with one gray bar
 * filling beneath it, and the percentage climbing with it; shown on login submit
 * only; not again in the same browser session, but always again after the browser
 * has been closed and reopened.
 *
 * The flag is a session cookie (no Max-Age) — cleared when the browser closes,
 * survives logout. `Login.tsx` reads and writes it; this component only draws.
 */
export function LoginLoader({ fading }: { fading: boolean }) {
  const [pct, setPct] = useState(10);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / FILL_MS);
      /* 10 → 100: the bar is already moving when this paints, so the first number
         the reader sees is not 0% */
      setPct(Math.round(10 + t * 90));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`login-loader${fading ? ' is-fading' : ''}`} role="status" aria-live="polite">
      <img className="login-loader-logo" src={assetImage('SUPERHEROINA.svg')} alt="" />
      <div className="login-loader-bar">
        <span className="login-loader-fill" />
      </div>
      <span className="login-loader-pct">{pct}%</span>
    </div>
  );
}