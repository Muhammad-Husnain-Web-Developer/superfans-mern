import { assetImage } from '../utils/format';
import '../styles/logo-spin.css';

/**
 * The sidebar's logo card — the Superheroina artwork on the front, the account's
 * profile picture on the back.
 *
 * The card flips continuously, on a 4-second loop: two seconds showing the
 * artwork, then two seconds showing the picture, forever. That is what David
 * asked for on 27 Sep 2026 ("the image should SPIN ANIMATION ALL TIME... Like
 * 2secs flip to SUPERHERO Logo 2s flip to Profile Picture").
 *
 * The animation is the stylesheet's, not this component's, so it runs the same
 * way on every screen — desktop, tablet, phone. Nothing here checks the
 * viewport width; the sidebar's own layout handles that, and the flip just
 * continues wherever the sidebar is drawn.
 *
 * `ring` is the control panel's "Profile picture border" Yes/No for whoever's picture
 * is on the back — the viewed profile on a profile page, the signed-in account on the
 * world. It is a prop rather than a read of the session here, because those two are not
 * always the same person.
 */
export function FlipLogo({ picture, ring = false }: { picture: string | null; ring?: boolean }) {
  const photo = picture ? assetImage(picture) : '/assets/images/SUPERHEROINA.svg';

  return (
    <span className={`logo-flip${ring ? ' logo-flip--ring' : ''}`}>
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