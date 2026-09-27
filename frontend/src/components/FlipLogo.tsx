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
 *
 * The card only turns when there is a second face worth turning to. An account with no
 * uploaded picture would be flipping the artwork over onto itself, so it gets the plain
 * logo the sidebar carried before the flip existed.
 *
 * That one test covers being signed out as well, which is why there is no check for it
 * here: on the world the back face is the *reader's* own picture, and a signed-out reader
 * has no account, so the caller passes null and the card stays still. On a profile page
 * the back face belongs to the profile being read, and David asked (27 Sep 2026) for that
 * one to turn for guests too — a creator's card should look the same to everybody.
 */
export function FlipLogo({ picture, ring = false }: { picture: string | null; ring?: boolean }) {
  if (!picture) {
    return <img src="/assets/images/SUPERHEROINA.svg" style={{ width: '54%' }} alt="" />;
  }

  const photo = assetImage(picture);

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
/**
 * The SUPER ADS sidebar's logo card — the Superfans title banner *and* the SUPER ADS
 * CENTER line on the front, together, turning against the SW ADS mark on the back on
 * the same 4-second loop as the profile card above.
 *
 * David, 28 Sep 2026: "You do the same animation PAPER FLIP with this picture
 * Superfans title image + SW ADS image." Then, 30 Sep 2026: "We should spin the LOGO
 * TITLE + TEXT x NewLogoSWADS... Don't give space betwen old log and text, put it in
 * <DIV> all together and spin it. New Logo SWAds bigger."
 *
 * So the heading is no longer the sidebar's own — it lives inside the front face, which
 * is why this returns the title as well and AdsSidebar renders nothing beside it. The
 * face is a div rather than the bare <img> it used to be: it holds the banner and the
 * words stacked tight, and that whole block is what turns.
 *
 * Divs, not the spans the profile card uses: an <h6> is flow content and cannot sit
 * inside a <span>. The surrounding .side_logo is an <a>, which takes either.
 *
 * Both faces are fixed artwork, so there is nothing to pass in and nothing to guard
 * against — unlike the profile card, which holds still when the account has no
 * picture to turn to.
 *
 * Both files are already served: the banner is the sidebar's own logo, and the SW ADS
 * mark is what SwAdsLoader shows while the ads pages load.
 */
export function AdsFlipLogo() {
  return (
    <div className="logo-flip logo-flip--ads">
      <div className="logo-flip-inner">
        <div className="logo-flip-face logo-flip-front logo-flip-ads-title">
          <img src="/assets/images/Superworld-13.svg" alt="Super Ads" />
          <h6>SUPER ADS CENTER</h6>
        </div>
        <img
          className="logo-flip-face logo-flip-back"
          src="/assets/images/logo-sw-ads.png"
          alt=""
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
