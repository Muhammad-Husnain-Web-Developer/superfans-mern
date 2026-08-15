import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const keyFor = (pathname: string) => `scroll:${pathname}`;

/**
 * Records where the page is scrolled to, for a grid that is about to open the
 * full-screen viewer.
 *
 * Call this at the moment of navigation rather than leaving it to an unmount
 * cleanup: the viewer is `position: fixed`, so the document collapses to one
 * viewport as it mounts and the browser clamps scrollY to 0 — anything reading
 * the position after that records the top of the page.
 */
export function rememberScroll(): void {
  sessionStorage.setItem(keyFor(window.location.pathname), String(Math.round(window.scrollY)));
}

/**
 * Puts a grid back where it was when the viewer closes.
 *
 * React Router does not restore scroll, so returning from a post landed you at
 * the top of a long wall instead of beside the post you had opened. Replayed
 * only on a back/forward step, so a fresh visit still starts at the top.
 *
 * `ready` should flip once the content that gives the page its height has
 * rendered — restoring before that has nothing to scroll to.
 */
export function useScrollMemory(ready: boolean): void {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const key = keyFor(pathname);

  /* read once, during the first render, so nothing that happens while the page
     rebuilds can move the target underneath us */
  const [target] = useState(() => Number(sessionStorage.getItem(key) ?? 0));
  const done = useRef(navigationType !== 'POP' || target === 0);

  /* The browser restores the scroll of a popped entry itself, after this hook
     has run, and what it recorded for the feed is 0 -- the viewer is fixed, so
     the document had collapsed by the time the reader left. That overwrote the
     restore every time. Hand the job over entirely; nothing else here relies on
     the browser's copy. */
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    if (done.current || !ready) return;

    /* Images and videos settle in over several frames. Being merely tall enough
       is not the moment to jump: the page keeps growing above the target, and
       the browser's scroll anchoring then carries the position past it -- a
       1400px offset was landing at 2056. Wait for the height to hold steady
       instead, and only then scroll. */
    let frame = 0;
    let steady = 0;
    let height = 0;
    let cancelled = false;
    const STEADY_FRAMES = 5;
    const settle = () => {
      if (cancelled) return;
      const current = document.documentElement.scrollHeight;
      steady = current === height ? steady + 1 : 0;
      height = current;

      const reachable = current - window.innerHeight;
      if ((reachable >= target && steady >= STEADY_FRAMES) || frame > 180) {
        window.scrollTo(0, target);
        done.current = true;
        sessionStorage.removeItem(key);
        return;
      }
      frame += 1;
      requestAnimationFrame(settle);
    };
    settle();
    return () => {
      cancelled = true;
    };
  }, [ready, target, key]);
}
