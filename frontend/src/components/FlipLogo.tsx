import { useEffect, useState } from 'react';
import { assetImage } from '../utils/format';
import '../styles/logo-spin.css';

/**
 * The sidebar's logo card — the Superheroina artwork on the front, the profile
 * picture on the back.
 *
 * The flip fires once, when the sidebar opens: the artwork turns 180° and the
 * picture takes its place, and it stays there until the sidebar is closed.
 * Closing resets the card to the artwork (out of sight, as the panel slides
 * away), so the next open plays the same turn again.
 *
 * On desktop the sidebar is always on screen and never carries the offcanvas
 * class the toggle sets on a phone, so the card simply starts turned — the
 * picture is what belongs there.
 */
export function FlipLogo({ picture }: { picture: string | null }) {
  /* desktop: no offcanvas class ever appears, so begin on the picture.
     a phone: begin on the artwork, and let the class turn it. */
  const [flipped, setFlipped] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768,
  );

  useEffect(() => {
    const body = document.body;
    const sync = () => setFlipped(body.classList.contains('offcanvas'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const photo = picture ? assetImage(picture) : '/assets/images/SUPERHEROINA.svg';

  return (
    <span className={`logo-flip${flipped ? ' is-flipped' : ''}`}>
      <span className="logo-flip-inner">
        <img
          className="logo-flip-face logo-flip-front"
          src="/assets/images/SUPERHEROINA.svg"
          alt=""
        />
        <img
          className="logo-flip-face logo-flip-back"
          src={photo}
          alt=""
          aria-hidden="true"
        />
      </span>
    </span>
  );
}